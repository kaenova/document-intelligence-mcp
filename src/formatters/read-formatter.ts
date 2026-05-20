import type { AnalyzeResult } from "@azure/ai-form-recognizer";

export function formatReadResult(result: AnalyzeResult, source: string): string {
  const lines: string[] = [];

  lines.push(`# Document Analysis — Read Model`);
  lines.push(`**Source:** \`${source}\``);
  lines.push("");

  // Content
  lines.push("## Content");
  if (result.content) {
    lines.push(result.content);
  } else {
    lines.push("_No text content extracted._");
  }
  lines.push("");

  // Pages
  lines.push("## Pages");
  if (result.pages && result.pages.length > 0) {
    for (const page of result.pages) {
      const pageNum = page.pageNumber ?? "?";
      const width = page.width ?? "?";
      const height = page.height ?? "?";
      const unit = page.unit ?? "pixel";
      const wordCount = page.words?.length ?? 0;
      const lineCount = page.lines?.length ?? 0;

      lines.push(
        `- Page ${pageNum}: ${width}×${height} ${unit}, ${wordCount} words, ${lineCount} lines`
      );
    }
  } else {
    lines.push("- No page information available.");
  }
  lines.push("");

  // Languages
  lines.push("## Languages");
  if (result.languages && result.languages.length > 0) {
    for (const lang of result.languages) {
      const locale = lang.locale ?? "unknown";
      const confidence = lang.confidence !== undefined 
        ? `${(lang.confidence * 100).toFixed(1)}%` 
        : "N/A";
      lines.push(`- ${locale} (confidence: ${confidence})`);
    }
  } else {
    lines.push("- No language information detected.");
  }

  return lines.join("\n");
}