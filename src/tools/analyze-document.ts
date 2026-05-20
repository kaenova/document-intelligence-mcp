import { UserError } from "fastmcp";
import { z } from "zod";
import { AnalyzeDocumentSchema } from "./schemas.js";
import { DocumentIntelligenceService } from "../services/document-intelligence.js";
import { AnalysisCache } from "../services/cache.js";
import { formatReadResult } from "../formatters/read-formatter.js";
import { formatLayoutResult } from "../formatters/layout-formatter.js";
import type { AnalysisModel } from "../types.js";
import * as fs from "fs";

let diService: DocumentIntelligenceService | null = null;
let cache: AnalysisCache | null = null;

function getDIService(): DocumentIntelligenceService {
  if (!diService) {
    diService = new DocumentIntelligenceService();
  }
  return diService;
}

function getCache(): AnalysisCache {
  if (!cache) {
    const cachePath = process.env.DI_CACHE_PATH;
    cache = new AnalysisCache(cachePath);
  }
  return cache;
}

/**
 * Main tool handler for analyze_document.
 */
export async function analyzeDocument(params: z.infer<typeof AnalyzeDocumentSchema>): Promise<string> {
  const { model, source } = params;

  const cacheService = getCache();
  const diService = getDIService();

  // Determine source type
  const isUrl = /^https?:\/\//i.test(source);
  const sourceType: "file" | "url" = isUrl ? "url" : "file";

  // Validate local file exists
  if (!isUrl) {
    if (!fs.existsSync(source)) {
      throw new UserError(`File not found: ${source}`);
    }
    // Basic extension check
    const ext = source.toLowerCase().split(".").pop();
    const supported = ["pdf", "jpg", "jpeg", "png", "bmp", "tiff", "tif", "heif", "docx", "pptx", "xlsx"];
    if (ext && !supported.includes(ext)) {
      throw new UserError(
        `Unsupported file type: .${ext}. Supported: PDF, images (JPG, PNG, BMP, TIFF, HEIF), DOCX, PPTX, XLSX`
      );
    }
  }

  // Compute content hash / cache key
  let contentHash: string;
  if (isUrl) {
    contentHash = cacheService.computeUrlHash(source);
  } else {
    contentHash = await cacheService.computeFileHash(source);
  }

  const cacheKey = cacheService.computeCacheKey(model as AnalysisModel, contentHash);

  // Check cache
  const cachedResult = cacheService.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // Cache miss — call Azure
  try {
    const analysisResult = await diService.analyzeDocument(source, model as AnalysisModel);

    // Format based on model
    let markdown: string;
    if (model === "read") {
      markdown = formatReadResult(analysisResult, source);
    } else {
      markdown = formatLayoutResult(analysisResult, source);
    }

    // Store in cache
    cacheService.set(cacheKey, model as AnalysisModel, sourceType, contentHash, markdown);

    return markdown;
  } catch (error: any) {
    if (error instanceof UserError) throw error;
    console.error("Azure Document Intelligence error:", error);
    throw new UserError(
      `Failed to analyze document: ${error.message || "Unknown error"}`
    );
  }
}