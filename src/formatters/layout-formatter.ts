import type { AnalyzeResult, DocumentTable, DocumentSelectionMark } from "@azure/ai-form-recognizer";

export function formatLayoutResult(result: AnalyzeResult, source: string): string {
  const lines: string[] = [];

  lines.push(`# Document Analysis — Layout Model`);
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
      lines.push(`- Page ${pageNum}: ${width}×${height} ${unit}`);
    }
  } else {
    lines.push("- No page information available.");
  }
  lines.push("");

  // Tables
  if (result.tables && result.tables.length > 0) {
    lines.push("## Tables");
    result.tables.forEach((table, idx) => {
      lines.push(formatTable(table, idx + 1));
      lines.push("");
    });
  }

  // Selection Marks
  if ((result as any).selectionMarks && (result as any).selectionMarks.length > 0) {
    lines.push("## Selection Marks");
    (result as any).selectionMarks.forEach((mark: any, idx: number) => {
      lines.push(formatSelectionMark(mark, idx + 1));
    });
    lines.push("");
  }

  return lines.join("\n");
}

function formatTable(table: DocumentTable, tableNum: number): string {
  const lines: string[] = [];

  const rowCount = table.rowCount ?? 0;
  const colCount = table.columnCount ?? 0;
  lines.push(`### Table ${tableNum} (${colCount} columns × ${rowCount} rows)`);

  // Build markdown table
  const cells: string[][] = Array.from({ length: rowCount }, () => Array(colCount).fill(""));

  if (table.cells) {
    for (const cell of table.cells) {
      const rowIdx = cell.rowIndex ?? 0;
      const colIdx = cell.columnIndex ?? 0;
      const content = cell.content ?? "";
      if (cells[rowIdx]) {
        cells[rowIdx][colIdx] = content.replace(/\n/g, " ").trim();
      }
    }
  }

  if (cells.length > 0 && cells[0]) {
    // Header row
    lines.push("| " + cells[0].join(" | ") + " |");
    lines.push("| " + cells[0].map(() => "---").join(" | ") + " |");

    // Data rows
    for (let i = 1; i < cells.length; i++) {
      const row = cells[i];
      if (row) {
        lines.push("| " + row.join(" | ") + " |");
      }
    }
  } else {
    lines.push("_Empty table_");
  }

  return lines.join("\n");
}

function formatSelectionMark(mark: any, markNum: number): string {
  const state = mark.state === "selected" ? "[x]" : "[ ]";
  const confidence = mark.confidence !== undefined 
    ? ` (confidence: ${(mark.confidence * 100).toFixed(1)}%)` 
    : "";
  return `- ${state} Selection mark ${markNum}${confidence}`;
}