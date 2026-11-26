import { describe, expect, test } from "bun:test";
import type { AnalyzeResult } from "@azure/ai-form-recognizer";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { loadConfig } from "../src/config.js";
import { createServer, startServer, isAuthorized } from "../src/server.js";
import { analyzeDocument } from "../src/tools/analyze-document.js";
import { downloadResult } from "../src/tools/download-result.js";
import { AnalyzeDocumentSchema } from "../src/tools/schemas.js";
import type { ResultStore } from "../src/services/result-storage.js";
import type { AnalysisDependencies } from "../src/tools/analyze-document.js";

const id = "70d6a4a5-9161-4ee3-98b0-591a754ec9ee";
const stored = {
  resultId: id, model: "layout" as const, filename: `${id}.md`, contentType: "text/markdown; charset=utf-8",
  sizeBytes: 12, createdAt: "2026-01-01T00:00:00Z", expiresAt: "2026-01-08T00:00:00Z",
};
const download = {
  resultId: id, filename: `${id}.md`, url: "https://s3.example.com/result?signature=secret",
  expiresAt: "2026-01-02T01:00:00Z", resultExpiresAt: stored.expiresAt,
};
const analysis = { content: "Extracted document content", pages: [], tables: [] } as unknown as AnalyzeResult;
function dependencies(): AnalysisDependencies {
  return {
    documentIntelligence: { analyzeDocument: async () => analysis },
    results: { save: async () => stored, download: async () => download },
  };
}

describe("tool contracts and authentication", () => {
  test("only accepts an exact bearer token", () => {
    expect(isAuthorized("Bearer secret", "secret")).toBe(true);
    for (const value of [undefined, ["Bearer secret"], "secret", "Bearer wrong", "Bearer secret ", "Basic secret"]) {
      expect(isAuthorized(value, "secret")).toBe(false);
    }
  });

  for (const source of ["/etc/passwd", "file:///etc/passwd", "http://example.com/doc.pdf", "https://user:pass@example.com/doc.pdf", "https://example.com/doc.pdf#fragment"]) {
    test(`rejects unsafe document source: ${source}`, () => {
      expect(AnalyzeDocumentSchema.safeParse({ model: "layout", source }).success).toBe(false);
    });
  }

  test("formats and stores analysis but never persists the source query credentials", async () => {
    const deps = dependencies();
    let markdown = "";
    deps.results.save = async (value, model) => { markdown = value; expect(model).toBe("layout"); return stored; };
    const result = await analyzeDocument({ model: "layout", source: "https://example.com/doc.pdf?token=SECRET" }, deps);
    expect(result).toEqual(stored);
    expect(markdown).toContain("Extracted document content");
    expect(markdown).toContain("https://example.com/doc.pdf");
    expect(markdown).not.toContain("SECRET");
  });

  test("invalid input cannot invoke Azure", async () => {
    const deps = dependencies();
    deps.documentIntelligence.analyzeDocument = async () => { throw new Error("must not invoke Azure"); };
    await expect(analyzeDocument({ model: "read", source: "/etc/passwd" }, deps)).rejects.toThrow("HTTPS");
  });

  test("Azure failure never returns an ID or leaks signed source URLs", async () => {
    const deps = dependencies();
    let saved = false;
    deps.documentIntelligence.analyzeDocument = async () => { throw new Error("https://example.com/?SECRET"); };
    deps.results.save = async () => { saved = true; return stored; };
    await expect(analyzeDocument({ model: "read", source: "https://example.com/doc.pdf" }, deps)).rejects.toThrow("Failed to analyze document");
    expect(saved).toBe(false);
  });

  test("S3 save failures do not return a dangling result ID", async () => {
    const deps = dependencies();
    deps.results.save = async () => { throw new Error("SECRET credential"); };
    await expect(analyzeDocument({ model: "read", source: "https://example.com/doc.pdf" }, deps)).rejects.toThrow("could not be saved");
  });

  test("download validation rejects invalid IDs and sanitizes storage failures", async () => {
    const results: ResultStore = { save: async () => stored, download: async () => { throw new Error("SECRET credential"); } };
    await expect(downloadResult({ resultId: "../secret" }, results)).rejects.toThrow("valid resultId");
    await expect(downloadResult({ resultId: id }, results)).rejects.toThrow("Unable to generate");
  });
});

test("Streamable HTTP enforces authentication and exposes both tools end to end", async () => {
  // Bind a free loopback port for an actual HTTP protocol test, without Azure/S3 network calls.
  const probe = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
  const port = probe.port!;
  await probe.stop(true);
  const config = loadConfig({ MCP_AUTH_TOKEN: "test-token", MCP_PORT: String(port), S3_BUCKET: "results",
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: "https://azure.example.com", AZURE_DOCUMENT_INTELLIGENCE_KEY: "key" });
  const server = createServer(config, dependencies());
  const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
  await startServer(server, config);
  const url = new URL(`http://127.0.0.1:${port}/mcp`);
  try {
    const requestBody = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
      protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1" },
    } });
    const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
    for (const authorization of [undefined, "Bearer wrong"]) {
      const response = await fetch(url, { method: "POST", headers: { ...headers, ...(authorization ? { Authorization: authorization } : {}) }, body: requestBody });
      expect(response.status).toBe(401);
    }
    const browser = await fetch(url, { method: "POST", headers: { ...headers, Authorization: "Bearer test-token", Origin: "https://evil.example" }, body: requestBody });
    expect(browser.status).toBe(403);
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: "Bearer test-token" } } }));
    expect((await client.listTools()).tools.map((tool) => tool.name).sort()).toEqual(["analyze_document", "download_result"]);
    const result = await client.callTool({ name: "analyze_document", arguments: { model: "layout", source: "https://example.com/doc.pdf" } });
    const text = (result.content as { type: string; text: string }[])[0]!.text;
    expect(JSON.parse(text)).toEqual(stored);
    const link = await client.callTool({ name: "download_result", arguments: { resultId: id } });
    expect(JSON.parse((link.content as { type: string; text: string }[])[0]!.text)).toEqual(download);
    await expect(client.callTool({ name: "analyze_document", arguments: { model: "read", source: "/etc/passwd" } })).rejects.toThrow("parameter validation failed");
  } finally {
    await client.close();
    await server.stop();
  }
}, 15000);
