import { z } from "zod";

export const AnalyzeDocumentSchema = z.object({
  model: z.enum(["read", "layout"]).describe(
    "Use 'read' for OCR-only text extraction, or 'layout' for tables and rich document structure."
  ),
  source: z.string().url().refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && !url.hash;
    } catch {
      return false;
    }
  }, "Source must be an HTTPS URL without embedded credentials or a fragment").describe(
    "An HTTPS document URL accessible to Azure, including a presigned URL. Local file paths are not supported."
  ),
});

export const DownloadResultSchema = z.object({
  resultId: z.string().uuid().describe("The resultId returned by analyze_document."),
});

export type AnalyzeDocumentInput = z.infer<typeof AnalyzeDocumentSchema>;
export type DownloadResultInput = z.infer<typeof DownloadResultSchema>;
