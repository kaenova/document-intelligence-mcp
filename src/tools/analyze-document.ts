import { UserError } from "fastmcp";
import { AnalyzeDocumentSchema } from "./schemas.js";
import type { AnalyzeDocumentInput } from "./schemas.js";
import type { DocumentIntelligenceService } from "../services/document-intelligence.js";
import type { ResultStore } from "../services/result-storage.js";
import { formatReadResult } from "../formatters/read-formatter.js";
import { formatLayoutResult } from "../formatters/layout-formatter.js";
import type { StoredResult } from "../types.js";

export interface AnalysisDependencies {
  documentIntelligence: Pick<DocumentIntelligenceService, "analyzeDocument">;
  results: ResultStore;
}

/** Analyze an HTTPS document and persist the formatted result before returning its ID. */
export async function analyzeDocument(params: AnalyzeDocumentInput, dependencies: AnalysisDependencies): Promise<StoredResult> {
  const parsed = AnalyzeDocumentSchema.safeParse(params);
  if (!parsed.success) throw new UserError("Provide a supported model and a valid HTTPS document URL");
  const { model, source } = parsed.data;
  let analysis;
  try {
    analysis = await dependencies.documentIntelligence.analyzeDocument(source, model);
  } catch {
    // Azure errors can include the full input URL, including presigned credentials.
    throw new UserError("Failed to analyze document. Check that Azure can access the HTTPS URL and that the document is supported.");
  }
  const safeSource = new URL(source);
  safeSource.search = ""; // Never persist input URL query credentials in the output file.
  const markdown = model === "read"
    ? formatReadResult(analysis, safeSource.toString())
    : formatLayoutResult(analysis, safeSource.toString());
  try {
    return await dependencies.results.save(markdown, model);
  } catch {
    throw new UserError("Document analyzed, but its result could not be saved to S3. Check the server's storage configuration.");
  }
}
