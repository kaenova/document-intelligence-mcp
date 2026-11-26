import { describe, expect, test } from "bun:test";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import type { HeadObjectCommandOutput } from "@aws-sdk/client-s3";
import { ResultStorage } from "../src/services/result-storage.js";
import type { S3Config, FeatureConfig } from "../src/config.js";

const id = "70d6a4a5-9161-4ee3-98b0-591a754ec9ee";
const time = Date.parse("2026-01-02T12:00:00Z");
const config: S3Config = {
  bucket: "results", region: "us-east-1", prefix: "test/results/", forcePathStyle: true,
  endpoint: "https://s3.example.com", accessKeyId: "test-key", secretAccessKey: "test-secret",
};

function fixture(head?: Partial<HeadObjectCommandOutput>, features: FeatureConfig = { resultRetentionDays: 7, presignedRetentionHours: 1 }) {
  const commands: unknown[] = [];
  const client = new S3Client({ region: config.region, endpoint: config.endpoint, forcePathStyle: true,
    credentials: { accessKeyId: "test-key", secretAccessKey: "test-secret" } });
  // Keep the real client configuration for offline AWS SigV4 signing; mock only network operations.
  client.send = (async (command: unknown) => {
    commands.push(command);
    if (command instanceof HeadObjectCommand) {
      return { $metadata: {}, Metadata: {
        "created-at": new Date(time - 86400_000).toISOString(),
        "expires-at": new Date(time + 6 * 86400_000).toISOString(),
      }, ...head };
    }
    return { $metadata: {} };
  }) as typeof client.send;
  return { store: new ResultStorage(config, features, client, () => time), client, commands };
}

describe("S3 result storage", () => {
  test("stores private UTF-8 Markdown with fixed retention metadata", async () => {
    const { store, commands } = fixture();
    const result = await store.save("# Héllo", "layout");
    expect(result.resultId).toMatch(/^[a-f0-9-]{36}$/);
    expect(result.sizeBytes).toBe(Buffer.byteLength("# Héllo"));
    expect(result.createdAt).toBe(new Date(time).toISOString());
    expect(result.expiresAt).toBe(new Date(time + 7 * 86400_000).toISOString());
    const command = commands[0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input.Key).toBe(`test/results/${result.resultId}.md`);
    expect(command.input.Body).toBe("# Héllo");
    expect(command.input.ACL).toBeUndefined();
    expect(command.input.Metadata?.["expires-at"]).toBe(result.expiresAt);
    expect(command.input.CacheControl).toBe("private, no-store");
  });

  test("signs a GET download with attachment headers and configured lifetime", async () => {
    const { store, commands } = fixture();
    const result = await store.download(id);
    const url = new URL(result.url);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
    expect(url.searchParams.get("response-content-disposition")).toBe(`attachment; filename="${id}.md"`);
    expect(result.expiresAt).toBe(new Date(time + 3600_000).toISOString());
    expect((commands[0] as HeadObjectCommand).input.Key).toBe(`test/results/${id}.md`);
  });

  test("caps link lifetime by remaining result retention", async () => {
    const { store } = fixture({ Metadata: {
      "created-at": new Date(time - 86400_000).toISOString(),
      "expires-at": new Date(time + 90_900).toISOString(),
    } });
    const result = await store.download(id);
    expect(new URL(result.url).searchParams.get("X-Amz-Expires")).toBe("90");
    expect(Date.parse(result.expiresAt)).toBe(time + 90_000);
    expect(Date.parse(result.resultExpiresAt)).toBe(time + 90_900);
  });

  test("applies a reduced retention to existing results", async () => {
    const { store } = fixture(undefined, { resultRetentionDays: 1, presignedRetentionHours: 1 });
    await expect(store.download(id)).rejects.toThrow("expired");
  });

  test("retention does not extend when a longer policy is configured", async () => {
    const { store } = fixture({ Metadata: {
      "created-at": new Date(time - 86400_000).toISOString(), "expires-at": new Date(time + 1000).toISOString(),
    } }, { resultRetentionDays: 30, presignedRetentionHours: 168 });
    expect(new URL((await store.download(id)).url).searchParams.get("X-Amz-Expires")).toBe("1");
  });

  const invalidMetadata: (Record<string, string> | undefined)[] = [undefined, {}, { "created-at": "bad", "expires-at": "bad" }];
  for (const metadata of invalidMetadata) {
    test(`rejects missing/invalid retention metadata: ${JSON.stringify(metadata)}`, async () => {
      const { store } = fixture({ Metadata: metadata });
      await expect(store.download(id)).rejects.toThrow("metadata is invalid");
    });
  }

  test("rejects expired results at the exact boundary", async () => {
    const { store } = fixture({ Metadata: {
      "created-at": new Date(time - 86400_000).toISOString(), "expires-at": new Date(time).toISOString(),
    } });
    await expect(store.download(id)).rejects.toThrow("expired");
  });

  test("rejects path traversal and arbitrary object keys before S3 access", async () => {
    const { store, commands } = fixture();
    await expect(store.download("../../secret")).rejects.toThrow("Invalid result ID");
    expect(commands).toHaveLength(0);
  });

  test("distinguishes missing objects from permission/service failures", async () => {
    const { store, client } = fixture();
    client.send = (async () => { throw { name: "NotFound", $metadata: { httpStatusCode: 404 } }; }) as typeof client.send;
    await expect(store.download(id)).rejects.toThrow("not found");
    client.send = (async () => { throw new Error("AccessDenied"); }) as typeof client.send;
    await expect(store.download(id)).rejects.toThrow("AccessDenied");
  });
});
