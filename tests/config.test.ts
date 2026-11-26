import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config.js";

const env = {
  AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: "https://azure.example.com/",
  AZURE_DOCUMENT_INTELLIGENCE_KEY: "azure-key",
  MCP_AUTH_TOKEN: "test-token",
  S3_BUCKET: "results",
};

describe("configuration", () => {
  test("defaults support IAM roles, private binding, and separate lifetimes", () => {
    const config = loadConfig(env);
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(8080);
    expect(config.features).toEqual({ resultRetentionDays: 7, presignedRetentionHours: 1 });
    expect(config.s3.accessKeyId).toBeUndefined();
    expect(config.s3.prefix).toBe("document-intelligence/results/");
    expect(config.s3.uploadPrefix).toBe("document-intelligence/uploads/");
  });

  test("accepts S3-compatible configuration and temporary credentials", () => {
    const config = loadConfig({ ...env, S3_ENDPOINT: "http://localhost:9000", S3_FORCE_PATH_STYLE: "true",
      S3_ACCESS_KEY_ID: "key", S3_SECRET_ACCESS_KEY: "secret", S3_SESSION_TOKEN: "session",
      S3_PREFIX: "/custom/results/", FEATURE_PRESIGNED_RETENTION_HOURS: "0.5" });
    expect(config.s3.endpoint).toBe("http://localhost:9000/");
    expect(config.s3.forcePathStyle).toBe(true);
    expect(config.s3.sessionToken).toBe("session");
    expect(config.s3.prefix).toBe("custom/results/");
    expect(config.features.presignedRetentionHours).toBe(0.5);
  });

  for (const name of ["AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "AZURE_DOCUMENT_INTELLIGENCE_KEY", "MCP_AUTH_TOKEN", "S3_BUCKET"]) {
    test(`requires ${name}`, () => {
      expect(() => loadConfig({ ...env, [name]: "" })).toThrow(name);
    });
  }

  for (const [name, values] of Object.entries({
    FEATURE_RESULT_RETENTION_DAYS: ["0", "-1", "1.5", "NaN", "", "Infinity", "36501"],
    FEATURE_PRESIGNED_RETENTION_HOURS: ["0", "-1", "169", "NaN", "", "0.00001"],
    MCP_PORT: ["0", "65536", "1.5", "123abc"],
    S3_FORCE_PATH_STYLE: ["yes"],
    S3_PREFIX: ["", "/", "a/../b", "a//b"],
    S3_UPLOAD_PREFIX: ["", "/", "a/../b", "a//b"],
  })) {
    for (const value of values) {
      test(`rejects ${name}=${JSON.stringify(value)}`, () => {
        expect(() => loadConfig({ ...env, [name]: value })).toThrow(name);
      });
    }
  }

  test("normalizes upload prefixes and rejects overlapping namespaces", () => {
    expect(loadConfig({ ...env, S3_UPLOAD_PREFIX: "/custom/uploads/" }).s3.uploadPrefix).toBe("custom/uploads/");
    for (const prefix of ["document-intelligence/results", "document-intelligence", "document-intelligence/results/nested"]) {
      expect(() => loadConfig({ ...env, S3_UPLOAD_PREFIX: prefix })).toThrow("must not overlap");
    }
  });

  test("rejects partial S3 credentials", () => {
    expect(() => loadConfig({ ...env, S3_ACCESS_KEY_ID: "key" })).toThrow("supplied together");
    expect(() => loadConfig({ ...env, S3_SECRET_ACCESS_KEY: "secret" })).toThrow("supplied together");
    expect(() => loadConfig({ ...env, S3_SESSION_TOKEN: "session" })).toThrow("supplied together");
  });

  test("rejects unsafe URLs and bearer tokens", () => {
    expect(() => loadConfig({ ...env, S3_ENDPOINT: "ftp://localhost" })).toThrow("S3_ENDPOINT");
    expect(() => loadConfig({ ...env, S3_ENDPOINT: "https://key:secret@localhost" })).toThrow("S3_ENDPOINT");
    expect(() => loadConfig({ ...env, AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: "http://azure.example.com" })).toThrow("HTTPS");
    expect(() => loadConfig({ ...env, MCP_AUTH_TOKEN: "two tokens" })).toThrow("whitespace");
  });
});
