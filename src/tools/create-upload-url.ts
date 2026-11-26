import { UserError } from "fastmcp";
import { CreateUploadSchema } from "./schemas.js";
import type { CreateUploadInput } from "./schemas.js";
import type { UploadStore } from "../services/upload-storage.js";
import type { UploadUrl } from "../types.js";

export async function createUploadUrl(params: CreateUploadInput, uploads: UploadStore): Promise<UploadUrl> {
  const parsed = CreateUploadSchema.safeParse(params);
  if (!parsed.success) throw new UserError("Provide a supported filename and an exact positive sizeBytes up to 500 MiB");
  try {
    return await uploads.createUpload(parsed.data);
  } catch (error) {
    if (error instanceof UserError) throw error;
    throw new UserError("Unable to create an upload URL. Check the server's S3 configuration and credentials.");
  }
}
