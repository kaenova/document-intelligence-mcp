export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  forcePathStyle: boolean;
  prefix: string;
}

export interface FeatureConfig {
  resultRetentionDays: number;
  presignedRetentionHours: number;
}

export interface ServerConfig {
  host: string;
  port: number;
  authToken: string;
  azure: { endpoint: string; key: string };
  s3: S3Config;
  features: FeatureConfig;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function positiveNumber(env: NodeJS.ProcessEnv, name: string, fallback: number, max: number, integer = false): number {
  const raw = env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${name} must be a positive ${integer ? "integer" : "number"} no greater than ${max}`);
  }
  return value;
}

function httpUrl(value: string, name: string, httpsOnly = false): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid ${httpsOnly ? "HTTPS" : "HTTP(S)"} URL`);
  }
  if ((url.protocol !== "https:" && (httpsOnly || url.protocol !== "http:")) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must be an ${httpsOnly ? "HTTPS" : "HTTP(S)"} URL without credentials, query, or fragment`);
  }
  return url.toString();
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim() || undefined;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim() || undefined;
  const sessionToken = env.S3_SESSION_TOKEN?.trim() || undefined;
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey) || (sessionToken && !accessKeyId)) {
    throw new Error("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be supplied together; S3_SESSION_TOKEN requires both");
  }
  const forcePathStyle = env.S3_FORCE_PATH_STYLE ?? "false";
  if (forcePathStyle !== "true" && forcePathStyle !== "false") {
    throw new Error("S3_FORCE_PATH_STYLE must be 'true' or 'false'");
  }
  const prefix = (env.S3_PREFIX ?? "document-intelligence/results").replace(/^\/+|\/+$/g, "");
  if (!prefix || prefix.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("S3_PREFIX must be a non-empty object prefix without empty, '.' or '..' segments");
  }
  const authToken = required(env, "MCP_AUTH_TOKEN");
  if (/\s/.test(authToken)) throw new Error("MCP_AUTH_TOKEN must not contain whitespace");

  const presignedRetentionHours = positiveNumber(env, "FEATURE_PRESIGNED_RETENTION_HOURS", 1, 168);
  if (presignedRetentionHours * 3600 < 1) {
    throw new Error("FEATURE_PRESIGNED_RETENTION_HOURS must represent at least one second");
  }

  return {
    host: env.MCP_HOST?.trim() || "127.0.0.1",
    port: positiveNumber(env, "MCP_PORT", 8080, 65535, true),
    authToken,
    azure: {
      endpoint: httpUrl(required(env, "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT"), "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", true),
      key: required(env, "AZURE_DOCUMENT_INTELLIGENCE_KEY"),
    },
    s3: {
      bucket: required(env, "S3_BUCKET"),
      region: env.S3_REGION?.trim() || "us-east-1",
      endpoint: env.S3_ENDPOINT ? httpUrl(env.S3_ENDPOINT, "S3_ENDPOINT") : undefined,
      accessKeyId,
      secretAccessKey,
      sessionToken,
      forcePathStyle: forcePathStyle === "true",
      prefix: `${prefix}/`,
    },
    features: {
      resultRetentionDays: positiveNumber(env, "FEATURE_RESULT_RETENTION_DAYS", 7, 36500, true),
      // AWS Signature V4 allows at most seven days, regardless of result retention.
      presignedRetentionHours,
    },
  };
}
