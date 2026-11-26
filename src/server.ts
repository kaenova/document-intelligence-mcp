import { createHash, timingSafeEqual } from "node:crypto";
import { FastMCP } from "fastmcp";
import type { ServerConfig } from "./config.js";
import { AnalyzeDocumentSchema, DownloadResultSchema } from "./tools/schemas.js";
import { analyzeDocument } from "./tools/analyze-document.js";
import type { AnalysisDependencies } from "./tools/analyze-document.js";
import { downloadResult } from "./tools/download-result.js";

export function isAuthorized(authorization: string | string[] | undefined, expectedToken: string): boolean {
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) return false;
  const actual = createHash("sha256").update(authorization.slice(7)).digest();
  const expected = createHash("sha256").update(expectedToken).digest();
  return timingSafeEqual(actual, expected);
}

export function createServer(config: ServerConfig, dependencies: AnalysisDependencies) {
  const server = new FastMCP({
    name: "document-intelligence",
    version: "0.1.0",
    authenticate: async (request) => {
      if (!isAuthorized(request.headers.authorization, config.authToken)) {
        throw new Response(null, {
          status: 401,
          headers: { "WWW-Authenticate": "Bearer" },
        });
      }
      // This server supports non-browser MCP clients. Reject browser-origin
      // requests instead of relying on FastMCP's permissive default CORS.
      if (request.headers.origin) {
        throw new Response(null, { status: 403, statusText: "Browser origins are not permitted" });
      }
      return { authenticated: true };
    },
    instructions: "Analyze HTTPS documents to create retained Markdown result files. " +
      "Use download_result with the returned resultId for a temporary S3 download link. " +
      "All clients using the shared bearer token share access to results; keep IDs and links private.",
  });

  server.addTool({
    name: "analyze_document",
    description: "Analyze an HTTPS document using Azure AI Document Intelligence. " +
      "Choose 'read' for OCR text or 'layout' for tables and rich structure. " +
      "Saves a private Markdown file to S3 and returns JSON with resultId and retention expiry. " +
      "Use download_result to retrieve a temporary download link. Local file paths are not accepted.",
    parameters: AnalyzeDocumentSchema,
    execute: async (args, { log }) => {
      log.info("Starting document analysis", { model: args.model });
      const result = await analyzeDocument(args, dependencies);
      log.info("Document analysis stored", { model: args.model, resultId: result.resultId });
      return JSON.stringify(result);
    },
  });

  server.addTool({
    name: "download_result",
    description: "Return JSON containing a presigned download URL for a retained Markdown result. " +
      "The URL lifetime is limited by FEATURE_PRESIGNED_RETENTION_HOURS and remaining result retention. " +
      "Expired or missing results cannot be downloaded. Treat the URL as a secret.",
    parameters: DownloadResultSchema,
    execute: async (args) => JSON.stringify(await downloadResult(args, dependencies.results)),
  });

  return server;
}

export function startServer(server: ReturnType<typeof createServer>, config: ServerConfig): Promise<void> {
  return server.start({
    transportType: "httpStream",
    httpStream: {
      host: config.host,
      port: config.port,
      endpoint: "/mcp",
      stateless: true,
      enableJsonResponse: true,
    },
  });
}
