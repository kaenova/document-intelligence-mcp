#!/usr/bin/env bun
import { loadConfig } from "./config.js";
import { DocumentIntelligenceService } from "./services/document-intelligence.js";
import { ResultStorage } from "./services/result-storage.js";
import { UploadStorage } from "./services/upload-storage.js";
import { createServer, startServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const results = new ResultStorage(config.s3, config.features);
  const uploads = new UploadStorage(config.s3, config.features);
  const server = createServer(config, {
    documentIntelligence: new DocumentIntelligenceService(config.azure),
    results,
    uploads,
  });
  try {
    await startServer(server, config);
  } catch (error) {
    results.close();
    uploads.close();
    throw error;
  }
  console.error(`Document Intelligence MCP listening at http://${config.host}:${config.port}/mcp`);

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    try {
      await server.stop();
    } finally {
      results.close();
      uploads.close();
    }
  };
  process.once("SIGINT", () => { void shutdown(); });
  process.once("SIGTERM", () => { void shutdown(); });
}

main().catch((error: unknown) => {
  console.error("Document Intelligence MCP failed to start:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
