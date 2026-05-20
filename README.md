# document-intelligence-mcp

MCP server for Azure AI Document Intelligence. Exposes a single `analyze_document` tool that lets agents choose between:

- **`read`** — OCR-only text extraction (fast, lightweight)
- **`layout`** — Rich document understanding with tables, selection marks, and structure (recommended for complex documents)

Results are automatically cached using SQLite (via `better-sqlite3`) for fast repeated analysis of the same document.

---

## Quick Start

### 1. Prerequisites

- Bun runtime
- Azure Document Intelligence resource (create one in Azure Portal if you don't have it)

### 2. Install Dependencies

```bash
bun install
```

### 3. Configure Environment

Copy the example env file and fill in your Azure credentials:

```bash
cp .env.example .env
```

Edit `.env` with your Azure endpoint and key:

```env
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=your-api-key-here
```

### 4. Run the Server

```bash
bun run dev
```

The server runs in stdio mode and is ready to be used by any MCP-compatible client.

---

## Configuration in Agent Harness (Pi)

Add this MCP server to your Pi agent by editing the configuration file:

```bash
~/.pi/agent/mcp.json
```

### Option 1: Using the Published Package (Recommended)

```json
{
  "mcpServers": {
    "document-intelligence": {
      "command": "bunx",
      "args": ["@kaenova/document-intelligence-mcp"],
      "env": {
        "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT": "https://your-resource.cognitiveservices.azure.com/",
        "AZURE_DOCUMENT_INTELLIGENCE_KEY": "your-api-key"
      }
    }
  }
}
```

### Option 2: Local Development (Cloned Repository)

```json
{
  "mcpServers": {
    "document-intelligence": {
      "command": "bun",
      "args": ["run", "src/index.ts"],
      "cwd": "/absolute/path/to/your/document-intelligence-mcp",
      "env": {
        "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT": "https://your-resource.cognitiveservices.azure.com/",
        "AZURE_DOCUMENT_INTELLIGENCE_KEY": "your-api-key"
      }
    }
  }
}
```

### Option 3: Using npx

```json
{
  "mcpServers": {
    "document-intelligence": {
      "command": "npx",
      "args": ["-y", "@kaenova/document-intelligence-mcp"],
      "env": {
        "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT": "https://your-resource.cognitiveservices.azure.com/",
        "AZURE_DOCUMENT_INTELLIGENCE_KEY": "your-api-key"
      }
    }
  }
}
```

### Notes

- After editing `mcp.json`, restart your Pi agent or reload the MCP configuration.
- For local development, make sure to replace the `cwd` path with the actual location of your cloned repository.
- You can also load credentials from a `.env` file instead of hardcoding them in `mcp.json`.

---

## Installation via npm (Recommended for most users)

Once published, you can use the package **without cloning** the repository.

> **Note:** This package uses **date-based versioning** (`YYYYMMDD-HHmm`) in GMT+7 timezone. Example version: `20260520-1530`

### Using with `bunx` (recommended if you have Bun)

```json
{
  "mcpServers": {
    "document-intelligence": {
      "command": "bunx",
      "args": ["@kaenova/document-intelligence-mcp"],
      "env": {
        "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT": "https://your-resource.cognitiveservices.azure.com/",
        "AZURE_DOCUMENT_INTELLIGENCE_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Using with `npx`

```json
{
  "mcpServers": {
    "document-intelligence": {
      "command": "npx",
      "args": ["-y", "@kaenova/document-intelligence-mcp"],
      "env": {
        "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT": "https://your-resource.cognitiveservices.azure.com/",
        "AZURE_DOCUMENT_INTELLIGENCE_KEY": "your-api-key-here"
      }
    }
  }
}
```

---

## Usage

### The `analyze_document` Tool

This MCP server exposes a single powerful tool:

```json
analyze_document(model, source)
```

#### Parameters

| Parameter | Type                    | Description                                                                 |
|-----------|-------------------------|-----------------------------------------------------------------------------|
| `model`   | `"read"` \| `"layout"` | The analysis model to use                                                   |
| `source`  | `string`                | Local file path **or** public HTTPS URL (automatically detected)            |

#### Choosing the Right Model

| Model    | Best For                                      | Output Highlights                     | Speed     |
|----------|-----------------------------------------------|---------------------------------------|-----------|
| `read`   | Simple text extraction, language detection    | Raw text, pages, detected languages   | Fast      |
| `layout` | Documents with tables, forms, structure       | Tables, selection marks, rich layout  | Slightly slower |

**Recommendation:** Use `layout` unless you specifically only need raw OCR text.

#### Examples

**Local PDF file with layout analysis:**

```json
{
  "model": "layout",
  "source": "/Users/me/invoices/Q2-report.pdf"
}
```

**Public URL with read-only OCR:**

```json
{
  "model": "read",
  "source": "https://example.com/annual-report-2025.pdf"
}
```

**Image file:**

```json
{
  "model": "layout",
  "source": "./screenshots/contract-page1.png"
}
```

### Caching

- Results are automatically cached based on the **file content hash** + model.
- If you analyze the same file again with the same model, you get the cached result instantly.
- Cache is stored in SQLite (`.cache/di-cache-YYYYMMDD-HHmm.sqlite` in GMT+7).

### Supported File Types

- **PDF**
- **Images**: JPG, JPEG, PNG, BMP, TIFF, HEIF
- **Office Documents**: DOCX, PPTX, XLSX

---

The tool returns a well-formatted Markdown document with extracted content, tables (when using `layout`), pages, and language information. Results are cached based on file content hash + model.

---

## Development

```bash
# Watch mode
bun run dev

# Type checking
bun run typecheck

# Build for production
bun run build
```

---

## License

MIT

---

*Built with FastMCP and the official Azure AI Form Recognizer SDK.*