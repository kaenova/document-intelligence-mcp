import {
  DocumentAnalysisClient,
  AzureKeyCredential,
} from "@azure/ai-form-recognizer";
import type { AnalyzeResult } from "@azure/ai-form-recognizer";
import type { AnalysisModel } from "../types.js";
import { readFile } from "fs/promises";
import { Readable } from "stream";

const DEFAULT_API_VERSION = "2024-11-30";

export class DocumentIntelligenceService {
  private client: DocumentAnalysisClient;

  constructor() {
    const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
    const apiVersion = process.env.AZURE_DOCUMENT_INTELLIGENCE_API_VERSION || DEFAULT_API_VERSION;

    if (!endpoint || !key) {
      throw new Error(
        "Missing Azure Document Intelligence credentials. " +
          "Please set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY environment variables."
      );
    }

    this.client = new DocumentAnalysisClient(
      endpoint,
      new AzureKeyCredential(key)
    );
  }

  /**
   * Analyze a document using the specified model.
   * Supports both local file paths and public URLs.
   */
  async analyzeDocument(
    source: string,
    model: AnalysisModel
  ): Promise<AnalyzeResult> {
    const modelId = this.getModelId(model);

    if (/^https?:\/\//i.test(source)) {
      // URL source
      const poller = await this.client.beginAnalyzeDocumentFromUrl(modelId, source);
      return await poller.pollUntilDone();
    } else {
      // Local file source
      const fileBuffer = await readFile(source);
      const stream = Readable.from(fileBuffer);
      const poller = await this.client.beginAnalyzeDocument(modelId, stream);
      return await poller.pollUntilDone();
    }
  }

  private getModelId(model: AnalysisModel): string {
    switch (model) {
      case "read":
        return "prebuilt-read";
      case "layout":
        return "prebuilt-layout";
      default:
        throw new Error(`Unknown model: ${model}`);
    }
  }

  private getContentType(filePath: string): string {
    const ext = filePath.toLowerCase().split(".").pop() || "";
    switch (ext) {
      case "pdf":
        return "application/pdf";
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      case "bmp":
        return "image/bmp";
      case "tiff":
      case "tif":
        return "image/tiff";
      case "heif":
        return "image/heif";
      case "docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case "pptx":
        return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      case "xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      default:
        return "application/octet-stream";
    }
  }
}