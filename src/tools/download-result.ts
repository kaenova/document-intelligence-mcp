import { UserError } from "fastmcp";
import { DownloadResultSchema } from "./schemas.js";
import type { DownloadResultInput } from "./schemas.js";
import type { ResultStore } from "../services/result-storage.js";
import type { DownloadResult } from "../types.js";

export async function downloadResult(params: DownloadResultInput, results: ResultStore): Promise<DownloadResult> {
  const parsed = DownloadResultSchema.safeParse(params);
  if (!parsed.success) throw new UserError("Provide a valid resultId returned by analyze_document");
  try {
    return await results.download(parsed.data.resultId);
  } catch (error) {
    if (error instanceof UserError) throw error;
    throw new UserError("Unable to generate a download link. Check the server's S3 permissions and configuration.");
  }
}
