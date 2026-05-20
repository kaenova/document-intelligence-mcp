/**
 * Shared TypeScript types for the Document Intelligence MCP server.
 */

export type AnalysisModel = "read" | "layout";

export interface AnalyzeDocumentParams {
  model: AnalysisModel;
  source: string;
}

export interface AnalysisResult {
  model: AnalysisModel;
  source: string;
  sourceType: "file" | "url";
  contentHash: string;
  markdown: string;
  cached: boolean;
}

export interface CacheEntry {
  cacheKey: string;
  model: AnalysisModel;
  sourceType: "file" | "url";
  contentHash: string;
  result: string;
  createdAt: string;
  accessedAt: string;
}