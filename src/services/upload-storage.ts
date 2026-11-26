import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { UserError } from "fastmcp";
import type { S3Config, FeatureConfig } from "../config.js";
import type { CreateUploadInput } from "../tools/schemas.js";
import { CreateUploadSchema, DOCUMENT_CONTENT_TYPES } from "../tools/schemas.js";
import type { UploadUrl, UploadedDocument } from "../types.js";

const FILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface UploadStore {
  createUpload(params: CreateUploadInput): Promise<UploadUrl>;
  resolve(fileId: string): Promise<UploadedDocument>;
}

export class UploadStorage implements UploadStore {
  private readonly client: S3Client;

  constructor(
    private readonly config: S3Config,
    private readonly features: FeatureConfig,
    client?: S3Client,
    private readonly now: () => number = Date.now,
  ) {
    this.client = client ?? new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      // Do not automatically sign an empty-body checksum for a future upload.
      requestChecksumCalculation: "WHEN_REQUIRED",
      credentials: config.accessKeyId && config.secretAccessKey ? {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken,
      } : undefined,
    });
  }

  private key(fileId: string): string {
    if (!FILE_ID_PATTERN.test(fileId)) throw new UserError("Invalid file ID");
    return `${this.config.uploadPrefix}${fileId}`;
  }

  async createUpload(params: CreateUploadInput): Promise<UploadUrl> {
    const parsed = CreateUploadSchema.safeParse(params);
    if (!parsed.success) throw new UserError("Provide a supported document filename and a positive sizeBytes up to 500 MiB");
    const { filename, sizeBytes } = parsed.data;
    const ext = filename.split(".").pop()!.toLowerCase();
    const contentType = DOCUMENT_CONTENT_TYPES[ext]!;
    const fileId = randomUUID();
    const signingTime = new Date(this.now());
    const expiresIn = Math.min(Math.floor(this.features.presignedRetentionHours * 3600), 604800);
    if (expiresIn < 1) throw new UserError("Configured presigned link lifetime must be at least one second");
    const metadata = {
      "filename-base64": Buffer.from(filename, "utf8").toString("base64url"),
      "retention-days": String(this.features.resultRetentionDays),
      "size-bytes": String(sizeBytes),
    };
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Length": String(sizeBytes),
      "If-None-Match": "*",
      // RustFS rejects any Cache-Control value it normalises (e.g. "private, no-store",
      // "no-cache") with SignatureDoesNotMatch on presigned PUTs; "no-store" is kept verbatim.
      "Cache-Control": "no-store",
      ...Object.fromEntries(Object.entries(metadata).map(([key, value]) => [`x-amz-meta-${key}`, value])),
    };
    const signedHeaders = new Set(Object.keys(headers).map((key) => key.toLowerCase()));
    const url = await getSignedUrl(this.client, new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: this.key(fileId),
      ContentType: contentType,
      ContentLength: sizeBytes,
      IfNoneMatch: "*",
      CacheControl: "no-store",
      Metadata: metadata,
    }), {
      expiresIn,
      signingDate: signingTime,
      signableHeaders: signedHeaders,
      unhoistableHeaders: new Set(Object.keys(metadata).map((key) => `x-amz-meta-${key}`)),
    });
    return {
      fileId,
      filename,
      method: "PUT",
      url,
      headers,
      expiresAt: new Date(signingTime.getTime() + expiresIn * 1000).toISOString(),
      retentionDays: this.features.resultRetentionDays,
    };
  }

  /** Verify the completed object and issue an internal HTTPS GET URL for Azure. */
  async resolve(fileId: string): Promise<UploadedDocument> {
    const key = this.key(fileId);
    let head;
    try {
      head = await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
    } catch (error) {
      const s3Error = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (s3Error.name === "NotFound" || s3Error.name === "NoSuchKey" || s3Error.$metadata?.httpStatusCode === 404) {
        throw new UserError("Uploaded file not found. Complete the upload before analyzing; it may also have expired");
      }
      throw error;
    }
    const uploadedAt = head.LastModified?.getTime() ?? NaN;
    const storedRetention = Number(head.Metadata?.["retention-days"]);
    const expectedSize = Number(head.Metadata?.["size-bytes"]);
    const encodedFilename = head.Metadata?.["filename-base64"] ?? "";
    const filename = Buffer.from(encodedFilename, "base64url").toString("utf8");
    if (!Number.isFinite(uploadedAt) || !Number.isInteger(storedRetention) || storedRetention <= 0 || storedRetention > 36500 ||
        !CreateUploadSchema.safeParse({ filename, sizeBytes: expectedSize }).success ||
        Buffer.from(filename, "utf8").toString("base64url") !== encodedFilename ||
        head.ContentLength !== expectedSize ||
        head.ContentType !== DOCUMENT_CONTENT_TYPES[filename.split(".").pop()!.toLowerCase()]) {
      throw new UserError("Uploaded file metadata or size is invalid; create a new upload");
    }
    // Source retention starts at successful PUT, not when its upload link was issued.
    const fileExpiry = uploadedAt + Math.min(storedRetention, this.features.resultRetentionDays) * 86400_000;
    const signingTime = new Date(this.now());
    const remainingSeconds = Math.floor((fileExpiry - signingTime.getTime()) / 1000);
    if (remainingSeconds < 1) throw new UserError("Uploaded file has expired and is no longer available for analysis");
    const expiresIn = Math.min(Math.floor(this.features.presignedRetentionHours * 3600), remainingSeconds, 604800);
    if (expiresIn < 1) throw new UserError("Configured presigned link lifetime must be at least one second");
    const url = await getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.config.bucket, Key: key }), {
      expiresIn, signingDate: signingTime,
    });
    if (new URL(url).protocol !== "https:") {
      throw new UserError("Uploaded-file analysis requires an HTTPS S3 endpoint reachable by Azure");
    }
    return { fileId, filename, url, uploadedAt: new Date(uploadedAt).toISOString(), expiresAt: new Date(fileExpiry).toISOString() };
  }

  close(): void {
    this.client.destroy();
  }
}
