import { Database } from "bun:sqlite";
import { createHash } from "crypto";
import type { AnalysisModel } from "../types.js";
import * as fs from "fs";
import * as path from "path";

const DEFAULT_CACHE_PATH = "./.cache/di-cache.sqlite";

export class AnalysisCache {
  private db: Database;

  constructor(cachePath: string = DEFAULT_CACHE_PATH) {
    const dir = path.dirname(cachePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(cachePath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analysis_cache (
        cache_key TEXT PRIMARY KEY,
        model TEXT NOT NULL,
        source_type TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        result TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        accessed_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_accessed_at ON analysis_cache(accessed_at);
    `);
  }

  private hash(input: string | Uint8Array): string {
    return createHash("sha256").update(input).digest("hex");
  }

  computeCacheKey(model: AnalysisModel, contentHash: string): string {
    return this.hash(`${model}|${contentHash}`);
  }

  async computeFileHash(filePath: string): Promise<string> {
    const fileBuffer = await fs.promises.readFile(filePath);
    return this.hash(fileBuffer);
  }

  computeUrlHash(url: string): string {
    return this.hash(url);
  }

  get(cacheKey: string): string | null {
    const stmt = this.db.query("SELECT result FROM analysis_cache WHERE cache_key = ?");
    const row = stmt.get(cacheKey) as { result: string } | null;

    if (row) {
      const updateStmt = this.db.query(
        "UPDATE analysis_cache SET accessed_at = datetime('now') WHERE cache_key = ?"
      );
      updateStmt.run(cacheKey);
      return row.result;
    }

    return null;
  }

  set(
    cacheKey: string,
    model: AnalysisModel,
    sourceType: "file" | "url",
    contentHash: string,
    result: string
  ): void {
    const stmt = this.db.query(`
      INSERT OR REPLACE INTO analysis_cache
      (cache_key, model, source_type, content_hash, result, created_at, accessed_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    stmt.run(cacheKey, model, sourceType, contentHash, result);
  }

  close(): void {
    this.db.close();
  }
}
