#!/usr/bin/env bun
import { FastMCP } from "fastmcp";
import { z } from "zod";
import { AnalyzeDocumentSchema } from "./tools/schemas.js";
import { analyzeDocument } from "./tools/analyze-document.js";

const server = new FastMCP({
  name: "document-intelligence",
  version: "0.1.0",
});

server.addTool({
  name: "analyze_document",
  description: 
    "Analyze a document using Azure AI Document Intelligence. " +
    "Choose 'read' for OCR-only text extraction or 'layout' for rich structure including tables and selection marks. " +
    "The 'source' parameter accepts either a local file path or a public URL (auto-detected). " +
    "Results are cached for faster subsequent calls on unchanged documents.",
  parameters: AnalyzeDocumentSchema,
  execute: async (args, { log }) => {
    log.info("Starting document analysis", { model: args.model, source: args.source });
    
    const result = await analyzeDocument(args);
    
    log.info("Document analysis completed", { 
      model: args.model, 
      source: args.source,
      resultLength: result.length 
    });
    
    return result;
  },
});

server.start({
  transportType: "stdio",
});

console.error("Document Intelligence MCP Server started (stdio mode)");