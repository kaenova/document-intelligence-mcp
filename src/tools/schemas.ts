import { z } from "zod";

export const AnalyzeDocumentSchema = z.object({
  model: z.enum(["read", "layout"]).describe(
    "Analysis model: 'read' for OCR-only text extraction, " +
      "'layout' for rich structure including tables and selection marks. " +
      "Use 'read' for simple text content, 'layout' for documents with tables or complex structure."
  ),
  source: z.string().min(1).describe(
    "Document source: a local file path (e.g., '/path/to/doc.pdf') " +
      "or a publicly accessible URL (e.g., 'https://example.com/doc.pdf'). " +
      "The server auto-detects whether it's a file path or URL."
  ),
}).refine(
  (data) => {
    const isUrl = /^https?:\/\//i.test(data.source);
    if (isUrl) return true;
    // For local paths, we will validate existence at runtime in the tool handler
    return true;
  },
  {
    message: "Source must be a valid URL (starting with http:// or https://) or a local file path.",
  }
);

export type AnalyzeDocumentInput = z.infer<typeof AnalyzeDocumentSchema>;