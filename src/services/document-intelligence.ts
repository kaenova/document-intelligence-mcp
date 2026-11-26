import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";
import type { AnalyzeResult } from "@azure/ai-form-recognizer";
import type { AnalysisModel } from "../types.js";

export class DocumentIntelligenceService {
  private readonly client: DocumentAnalysisClient;

  constructor(config: { endpoint: string; key: string }) {
    this.client = new DocumentAnalysisClient(config.endpoint, new AzureKeyCredential(config.key));
  }

  /** Azure fetches the document directly; the MCP server never reads local files. */
  async analyzeDocument(source: string, model: AnalysisModel): Promise<AnalyzeResult> {
    const url = new URL(source);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) {
      throw new Error("Only HTTPS document URLs without embedded credentials or fragments are supported");
    }
    const modelId = model === "read" ? "prebuilt-read" : "prebuilt-layout";
    const poller = await this.client.beginAnalyzeDocumentFromUrl(modelId, source);
    return await poller.pollUntilDone();
  }
}
