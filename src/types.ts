/** Shared types for the HTTP Document Intelligence MCP server. */
export type AnalysisModel = "read" | "layout";

export interface AnalyzeDocumentParams {
  model: AnalysisModel;
  source?: string;
  fileId?: string;
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

export interface UploadUrl {
  fileId: string;
  filename: string;
  method: "PUT";
  url: string;
  headers: Record<string, string>;
  /** Upload-link expiry, not source-file retention expiry. */
  expiresAt: string;
  retentionDays: number;
}

export interface UploadedDocument {
  fileId: string;
  filename: string;
  /** Internal presigned GET for Azure; never included in analysis output. */
  url: string;
  uploadedAt: string;
  expiresAt: string;
}

export interface DownloadResult {
  resultId: string;
  filename: string;
  url: string;
  expiresAt: string;
  resultExpiresAt: string;
}
