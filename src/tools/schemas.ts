import { z } from "zod";

export const DOCUMENT_CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", bmp: "image/bmp",
  tif: "image/tiff", tiff: "image/tiff", heif: "image/heif",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const FileIdSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  "fileId must be the UUID returned by create_upload_url"
);

export const CreateUploadSchema = z.object({
  filename: z.string().min(1).max(255).refine((value) => {
    const ext = value.split(".").pop()?.toLowerCase() ?? "";
    return !/[\\/\x00-\x1f\x7f]/.test(value) && Object.hasOwn(DOCUMENT_CONTENT_TYPES, ext);
  }, "Provide a filename (not a path) with a supported document extension").describe("Document filename, e.g. invoice.pdf; not a local path."),
  sizeBytes: z.number().int().positive().max(500 * 1024 * 1024).describe("Exact file size in bytes, up to 500 MiB. Azure model limits also apply."),
});

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
  ).optional(),
  fileId: FileIdSchema.optional().describe("The fileId returned by create_upload_url, after a successful PUT. Provide this OR source, not both."),
}).refine((params) => (params.source !== undefined) !== (params.fileId !== undefined), {
  message: "Provide exactly one of source (HTTPS URL) or fileId (completed upload)",
});

export const DownloadResultSchema = z.object({
  resultId: z.string().uuid().describe("The resultId returned by analyze_document."),
});

export type CreateUploadInput = z.infer<typeof CreateUploadSchema>;
export type AnalyzeDocumentInput = z.infer<typeof AnalyzeDocumentSchema>;
export type DownloadResultInput = z.infer<typeof DownloadResultSchema>;
