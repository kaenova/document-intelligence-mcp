/** Shared types for the HTTP Document Intelligence MCP server. */
export type AnalysisModel = "read" | "layout";

export interface AnalyzeDocumentParams {
  model: AnalysisModel;
  source: string;
}

export interface StoredResult {
  resultId: string;
  model: AnalysisModel;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string;
}

export interface DownloadResult {
  resultId: string;
  filename: string;
  url: string;
  expiresAt: string;
  resultExpiresAt: string;
}
