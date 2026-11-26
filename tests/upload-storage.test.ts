import { describe, expect, test } from "bun:test";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import type { HeadObjectCommandOutput } from "@aws-sdk/client-s3";
import { UploadStorage } from "../src/services/upload-storage.js";
import type { S3Config, FeatureConfig } from "../src/config.js";

const id = "70d6a4a5-9161-4ee3-98b0-591a754ec9ee";
const time = Date.parse("2026-01-02T12:00:00Z");
const config: S3Config = {
  bucket: "documents", region: "us-east-1", prefix: "test/results/", uploadPrefix: "test/uploads/",
  endpoint: "https://s3.example.com", forcePathStyle: true, accessKeyId: "key", secretAccessKey: "secret",
};

function fixture(overrides: Partial<HeadObjectCommandOutput> = {}, features: FeatureConfig = { resultRetentionDays: 7, presignedRetentionHours: 1 }, endpoint = config.endpoint) {
  const commands: unknown[] = [];
  const client = new S3Client({ region: config.region, endpoint, forcePathStyle: true,
    credentials: { accessKeyId: "key", secretAccessKey: "secret" }, requestChecksumCalculation: "WHEN_REQUIRED" });
  const head = {
    $metadata: {}, ContentLength: 123, ContentType: "application/pdf", LastModified: new Date(time - 86400_000),
    Metadata: { "retention-days": "7", "size-bytes": "123", "filename-base64": Buffer.from("invoice.pdf").toString("base64url") },
    ...overrides,
  };
  client.send = (async (command: unknown) => { commands.push(command); return head; }) as typeof client.send;
  return { store: new UploadStorage({ ...config, endpoint }, features, client, () => time), client, commands, head };
}

describe("presigned uploads", () => {
  test("returns a create-only signed PUT with exact size and signed retention metadata", async () => {
    // Exercise the production client configuration; creating URLs makes no network calls.
    const store = new UploadStorage(config, { resultRetentionDays: 7, presignedRetentionHours: 1 }, undefined, () => time);
    try {
      const result = await store.createUpload({ filename: "invoice.pdf", sizeBytes: 123 });
      const url = new URL(result.url);
      expect(result.method).toBe("PUT");
      expect(result.fileId).toMatch(/^[a-f0-9-]{36}$/);
      expect(url.pathname).toBe(`/documents/test/uploads/${result.fileId}`);
      expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
      expect(result.expiresAt).toBe(new Date(time + 3600_000).toISOString());
      expect(result.retentionDays).toBe(7);
      expect(result.headers["If-None-Match"]).toBe("*");
      expect(result.headers["Content-Length"]).toBe("123");
      expect(result.headers["Content-Type"]).toBe("application/pdf");
      expect(result.headers["x-amz-meta-retention-days"]).toBe("7");
      const signed = url.searchParams.get("X-Amz-SignedHeaders")!.split(";");
      for (const header of Object.keys(result.headers)) expect(signed).toContain(header.toLowerCase());
      expect(url.searchParams.get("x-amz-checksum-crc32")).toBeNull();
      expect(url.searchParams.get("x-amz-meta-retention-days")).toBeNull();
      expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
    } finally { store.close(); }
  });

  test("preserves UTF-8 filenames as ASCII signed metadata", async () => {
    const { store } = fixture();
    const result = await store.createUpload({ filename: "résumé.PDF", sizeBytes: 123 });
    expect(Buffer.from(result.headers["x-amz-meta-filename-base64"]!, "base64url").toString("utf8")).toBe("résumé.PDF");
    expect(result.headers["Content-Type"]).toBe("application/pdf");
  });

  for (const filename of ["../../invoice.pdf", "C:\\invoice.pdf", "invoice.exe", "bad\nname.pdf", "", "invoice.__proto__"]) {
    test(`rejects unsupported or unsafe filename: ${JSON.stringify(filename)}`, async () => {
      await expect(fixture().store.createUpload({ filename, sizeBytes: 1 })).rejects.toThrow("supported document");
    });
  }

  for (const sizeBytes of [0, -1, 1.5, 500 * 1024 * 1024 + 1]) {
    test(`rejects invalid size ${sizeBytes}`, async () => {
      await expect(fixture().store.createUpload({ filename: "invoice.pdf", sizeBytes })).rejects.toThrow("sizeBytes");
    });
  }

  test("resolves a completed upload to an internal GET URL without resetting retention", async () => {
    const { store, commands } = fixture();
    const doc = await store.resolve(id);
    const url = new URL(doc.url);
    expect(doc.fileId).toBe(id);
    expect(doc.filename).toBe("invoice.pdf");
    expect(doc.uploadedAt).toBe(new Date(time - 86400_000).toISOString());
    expect(doc.expiresAt).toBe(new Date(time + 6 * 86400_000).toISOString());
    expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(commands[0]).toBeInstanceOf(HeadObjectCommand);
    expect((commands[0] as HeadObjectCommand).input.Key).toBe(`test/uploads/${id}`);
  });

  test("delayed uploads start retention on S3 LastModified, not URL creation", async () => {
    const { store } = fixture({ LastModified: new Date(time) });
    expect((await store.resolve(id)).expiresAt).toBe(new Date(time + 7 * 86400_000).toISOString());
  });

  test("caps Azure GET link lifetime by the remaining source retention", async () => {
    const { store } = fixture({ LastModified: new Date(time - 7 * 86400_000 + 30_900) });
    const doc = await store.resolve(id);
    expect(new URL(doc.url).searchParams.get("X-Amz-Expires")).toBe("30");
  });

  test("rejects sources at exact retention expiry", async () => {
    await expect(fixture({ LastModified: new Date(time - 7 * 86400_000) }).store.resolve(id)).rejects.toThrow("expired");
  });

  test("reducing retention restricts existing files, increasing it does not extend them", async () => {
    await expect(fixture({}, { resultRetentionDays: 1, presignedRetentionHours: 1 }).store.resolve(id)).rejects.toThrow("expired");
    const result = await fixture({}, { resultRetentionDays: 30, presignedRetentionHours: 1 }).store.resolve(id);
    expect(result.expiresAt).toBe(new Date(time + 6 * 86400_000).toISOString());
  });

  const invalidHeads: Partial<HeadObjectCommandOutput>[] = [
    { Metadata: undefined }, { LastModified: undefined }, { LastModified: new Date(NaN) },
    { ContentLength: 122 }, { ContentType: "text/plain" },
    { Metadata: { "retention-days": "NaN", "size-bytes": "123", "filename-base64": "aW52b2ljZS5wZGY" } },
  ];
  for (const [i, head] of invalidHeads.entries()) {
    test(`fails closed on invalid or mismatched upload metadata ${i}`, async () => {
      await expect(fixture(head).store.resolve(id)).rejects.toThrow("invalid");
    });
  }

  test("invalid IDs cannot access arbitrary keys or result objects", async () => {
    const { store, commands } = fixture();
    for (const fileId of ["../results/id", "x", "70d6a4a5-9161-5ee3-98b0-591a754ec9ee"]) {
      await expect(store.resolve(fileId)).rejects.toThrow("Invalid file ID");
    }
    expect(commands).toHaveLength(0);
  });

  test("rejects missing uploads and preserves underlying permission failures", async () => {
    const { store, client } = fixture();
    client.send = (async () => { throw { name: "NotFound", $metadata: { httpStatusCode: 404 } }; }) as typeof client.send;
    await expect(store.resolve(id)).rejects.toThrow("Complete the upload");
    client.send = (async () => { throw new Error("AccessDenied"); }) as typeof client.send;
    await expect(store.resolve(id)).rejects.toThrow("AccessDenied");
  });

  test("requires an HTTPS endpoint for Azure to read private uploads", async () => {
    const { store } = fixture({}, undefined, "http://localhost:9000");
    await expect(store.resolve(id)).rejects.toThrow("HTTPS S3 endpoint");
  });
});
