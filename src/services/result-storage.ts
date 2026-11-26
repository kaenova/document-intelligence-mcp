import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { UserError } from "fastmcp";
import type { S3Config, FeatureConfig } from "../config.js";
import type { AnalysisModel, StoredResult, DownloadResult } from "../types.js";

const CONTENT_TYPE = "text/markdown; charset=utf-8";
const RESULT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface ResultStore {
  save(markdown: string, model: AnalysisModel): Promise<StoredResult>;
  download(resultId: string): Promise<DownloadResult>;
}

export class ResultStorage implements ResultStore {
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
      // Omit credentials to support the default AWS provider chain (e.g. an IAM role).
      credentials: config.accessKeyId && config.secretAccessKey ? {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken,
      } : undefined,
    });
  }

  private key(resultId: string): string {
    if (!RESULT_ID_PATTERN.test(resultId)) throw new UserError("Invalid result ID");
    return `${this.config.prefix}${resultId}.md`;
  }

  async save(markdown: string, model: AnalysisModel): Promise<StoredResult> {
    const resultId = randomUUID();
    const createdAt = new Date(this.now());
    const expiresAt = new Date(createdAt.getTime() + this.features.resultRetentionDays * 86400_000);
    const filename = `${resultId}.md`;
    const sizeBytes = Buffer.byteLength(markdown, "utf8");
    await this.client.send(new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: this.key(resultId),
      Body: markdown,
      ContentType: CONTENT_TYPE,
      ContentDisposition: `attachment; filename="${filename}"`,
      CacheControl: "private, no-store",
      Metadata: {
        "created-at": createdAt.toISOString(),
        "expires-at": expiresAt.toISOString(),
        model,
      },
    }));
    return {
      resultId,
      model,
      filename,
      contentType: CONTENT_TYPE,
      sizeBytes,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async download(resultId: string): Promise<DownloadResult> {
    const key = this.key(resultId);
    let head;
    try {
      head = await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
    } catch (error) {
      const s3Error = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (s3Error.name === "NotFound" || s3Error.name === "NoSuchKey" || s3Error.$metadata?.httpStatusCode === 404) {
        throw new UserError("Result not found or no longer retained");
      }
      // A 403 may also mean a missing object when ListBucket is not permitted;
      // do not mask credential/configuration failures as a successful lookup.
      throw error;
    }
    const createdAt = Date.parse(head.Metadata?.["created-at"] ?? "");
    const storedExpiry = Date.parse(head.Metadata?.["expires-at"] ?? "");
    if (!Number.isFinite(createdAt) || !Number.isFinite(storedExpiry) || storedExpiry <= createdAt) {
      throw new UserError("Result retention metadata is invalid; cannot issue a download link");
    }
    // Reducing the configured retention also restricts previously stored results.
    const resultExpiry = Math.min(storedExpiry, createdAt + this.features.resultRetentionDays * 86400_000);
    const signingTime = new Date(this.now());
    const remainingSeconds = Math.floor((resultExpiry - signingTime.getTime()) / 1000);
    if (remainingSeconds < 1) throw new UserError("Result has expired and is no longer available");
    const expiresIn = Math.min(Math.floor(this.features.presignedRetentionHours * 3600), remainingSeconds, 604800);
    if (expiresIn < 1) throw new UserError("Configured presigned link lifetime must be at least one second");
    const filename = `${resultId}.md`;
    const url = await getSignedUrl(this.client, new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ResponseContentType: CONTENT_TYPE,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
      ResponseCacheControl: "private, no-store",
    }), { expiresIn, signingDate: signingTime });
    return {
      resultId,
      filename,
      url,
      expiresAt: new Date(signingTime.getTime() + expiresIn * 1000).toISOString(),
      resultExpiresAt: new Date(resultExpiry).toISOString(),
    };
  }

  close(): void {
    this.client.destroy();
  }
}
