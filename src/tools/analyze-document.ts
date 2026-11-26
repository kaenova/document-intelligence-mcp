import { UserError } from "fastmcp";
import { AnalyzeDocumentSchema } from "./schemas.js";
import type { AnalyzeDocumentInput } from "./schemas.js";
import type { DocumentIntelligenceService } from "../services/document-intelligence.js";
import type { ResultStore } from "../services/result-storage.js";
import type { UploadStore } from "../services/upload-storage.js";
import { formatReadResult } from "../formatters/read-formatter.js";
import { formatLayoutResult } from "../formatters/layout-formatter.js";
import type { StoredResult } from "../types.js";

export interface AnalysisDependencies {
  documentIntelligence: Pick<DocumentIntelligenceService, "analyzeDocument">;
  results: ResultStore;
  uploads: UploadStore;
}

/** Analyze an HTTPS URL or retained uploaded file, then persist its formatted result. */
export async function analyzeDocument(params: AnalyzeDocumentInput, dependencies: AnalysisDependencies): Promise<StoredResult> {
  const parsed = AnalyzeDocumentSchema.safeParse(params);
  if (!parsed.success) throw new UserError("Provide a supported model and exactly one of a valid HTTPS source URL or fileId");
  const { model, fileId } = parsed.data;
  let source = parsed.data.source;
  let attribution: string;
  if (fileId) {
    let uploaded;
    try {
      uploaded = await dependencies.uploads.resolve(fileId);
    } catch (error) {
      if (error instanceof UserError) throw error;
      throw new UserError("Unable to access the uploaded file. Check the server's S3 configuration and permissions.");
    }
    source = uploaded.url;
    attribution = `Uploaded file ${fileId}`;
  } else {
    const safeSource = new URL(source!);
    safeSource.search = ""; // Never persist input URL query credentials.
    attribution = safeSource.toString();
  }
  let analysis;
  try {
    analysis = await dependencies.documentIntelligence.analyzeDocument(source!, model);
  } catch {
    // Azure errors can include the full input URL, including presigned credentials.
    throw new UserError("Failed to analyze document. Check that Azure can access the HTTPS URL and that the document is supported.");
  }
  const markdown = model === "read"
    ? formatReadResult(analysis, attribution)
    : formatLayoutResult(analysis, attribution);
  try {
    return await dependencies.results.save(markdown, model);
  } catch {
    throw new UserError("Document analyzed, but its result could not be saved to S3. Check the server's storage configuration.");
  }
}
