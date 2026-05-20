# Document Intelligence MCP Server — Implementation Plan

**Date:** 2026-05-20  
**Repository:** `https://github.com/kaenova/document-intelligence-mcp`  
**Runtime:** Bun (with Node.js-compatible packages for portability)  
**Framework:** FastMCP (stdio transport)  
**Azure SDK:** `@azure/ai-form-recognizer` v5.1.0  
**Cache:** SQLite via `better-sqlite3` npm package

---

## 1. Overview

Build an MCP server that exposes Azure AI Document Intelligence capabilities as MCP tools. The server lets an AI agent submit a document file (PDF, image, Office doc) and choose between two analysis models:

| Model | Model ID | Purpose | Output |
|-------|----------|---------|--------|
| **Read** | `prebuilt-read` | OCR-only — extract raw text, words, lines, language info | Plain text / structured OCR data |
| **Layout** | `prebuilt-layout` | Rich document understanding — extract tables, selection marks, bounding regions, plus all OCR | Markdown-friendly output (tables, structure) |

The agent selects the model based on the document type:
- **Read** → simple text extraction, invoices with minimal structure, language detection
- **Layout** → documents with complex tables, forms, selection marks, structured layout

---

## 2. Tech Stack

| Component | Choice | Justification |
|-----------|--------|---------------|
| Runtime | **Bun** | Fast JS runtime, native TS support, fast package installs |
| MCP Framework | **FastMCP** | Clean API, stdio support, Zod schema validation |
| Azure SDK | `@azure/ai-form-recognizer` | Official JS SDK for Document Intelligence v4.0 |
| Auth | `AzureKeyCredential` | Simple API key auth for local/agent use |
| Validation | **Zod** | Native FastMCP integration via Standard Schema |
| Cache DB | **SQLite** (`better-sqlite3`) | Lightweight npm package, works across Node/Bun/Deno |
| Hashing | **SHA-256** (`crypto` Node.js built-in) | Built into Node.js/Bun/Deno — zero extra deps |
| Package Mgr | **bun** (built-in) | No extra tooling needed |

---

## 3. Architecture

```
┌─────────────────────────────────────────┐
│          AI Agent (MCP Client)          │
│         (e.g. Claude, Cursor, pi)       │
└──────────────┬──────────────────────────┘
               │  stdio transport
               ▼
┌─────────────────────────────────────────────┐
│      Document Intelligence MCP Server        │
│        (FastMCP + Bun / portable to Node)     │
│                                               │
│  Tools:                                       │
│   • analyze_document                          │
│     └─ model: "read" | "layout"              │
│     └─ source: string (file_path or URL)     │
│                                               │
│  ┌──────────────────────┐  ┌────────────────┐ │
│  │  Cache Layer          │  │  Azure DI Client│ │
│  │  (better-sqlite3)     │  │  DocumentAnalysis│ │
│  │  • hash(model+doc)   │  │  Client          │ │
│  │  • store/retrieve    │  │  • beginAnalyze()│ │
│  │  • TTL management    │  │  • pollUntilDone()│ │
│  └──────────────────────┘  └────────────────┘ │
└─────────────────────────────────────────────┘
```

### MCP Tools

Only **one tool** is exposed:

| Tool | Parameters | Returns |
|------|-----------|---------|
| `analyze_document` | `model: "read" \| "layout"` <br> `source: string` (local path **or** URL) | Cached or fresh markdown result |

---

## 4. Cache Design

### 4.1 Schema

```sql
CREATE TABLE IF NOT EXISTS analysis_cache (
  cache_key TEXT PRIMARY KEY,           -- SHA-256(model + "|" + content_hash)
  model TEXT NOT NULL,                  -- "read" | "layout"
  source_type TEXT NOT NULL,            -- "file" | "url"
  content_hash TEXT NOT NULL,           -- SHA-256 of file content (or URL string for URLs)
  result TEXT NOT NULL,                 -- Formatted markdown output
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  accessed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 4.2 Cache Key Derivation

- **Local files:** Read file → SHA-256 of file bytes → cache_key = `SHA-256(model + "|" + file_hash)`
- **URLs:** SHA-256 of the URL string itself → cache_key = `SHA-256(model + "|" + url_hash)`

> For URLs, we use the URL as the hash input rather than fetching + hashing content, because:
> 1. We'd need to fetch the document body to hash it, which defeats the purpose of caching
> 2. A URL typically points to a stable resource; if content changes, the user can request eviction
> 3. URL-based caching is a common pattern (HTTP ETag-like semantics)

### 4.3 Cache Flow

```
analyze_document(source, model)
  │
  ├─ Determine source_type (file path or URL)
  ├─ Compute cache_key from content/model
  │
  ├─ Cache HIT ──→ return cached result
  │
  └─ Cache MISS ──→ read file / accept URL
                      → call Azure DI API
                      → format result as markdown
                      → store in cache
                      → return result
```

### 4.4 Cache Invalidation

- No TTL-based expiry in v1 (document content is immutable)
- Cache can be manually cleared by deleting the SQLite DB file
- Future: add a `clear_cache` tool or max-age option

---

## 5. Tools Detail

### 5.1 `analyze_document`

**Purpose:** Analyze a document using either the Read or Layout prebuilt model.

**Parameters (Zod):**

```ts
z.object({
  model: z.enum(["read", "layout"]).describe(
    "Analysis model: 'read' for OCR-only text extraction, " +
    "'layout' for rich structure including tables and selection marks. " +
    "Use 'read' for simple text content, 'layout' for documents with tables or complex structure."
  ),
  source: z.string().describe(
    "Document source: a local file path (e.g., '/path/to/doc.pdf') " +
    "or a publicly accessible URL (e.g., 'https://example.com/doc.pdf'). " +
    "The server auto-detects whether it's a file path or URL."
  ),
})
```

**Validation rules:**
- `source` must be non-empty
- If it's a local path, the file must exist and be readable
- File extension checked for supported types (PDF, JPG/JPEG, PNG, BMP, TIFF, HEIF, DOCX, PPTX, XLS)
- URL must start with `http://` or `https://`
- Ambiguous cases: if a string matches neither an existing file nor a valid URL, return a clear error

**Source detection logic:**
1. If `source` starts with `http://` or `https://` → treat as URL
2. Else → treat as file path (validate existence)

**Execution flow:**

1. Detect source type (file vs URL)
2. Compute cache key:
   - File: read file bytes → SHA-256 hash → `SHA-256(model + "|" + file_hash)`
   - URL: `SHA-256(model + "|" + source)`
3. Check SQLite cache — if found, return cached markdown
4. If cache miss:
   - File: create read stream, call `beginAnalyzeDocument()`
   - URL: call `beginAnalyzeDocumentFromUrl()`
5. Poll `poller.pollUntilDone()` with progress logging
6. Format result into markdown via the appropriate formatter
7. Store in SQLite cache with cache key
8. Return markdown string

**Output format (markdown):**

For **Read** model:
```markdown
# Document Analysis — Read Model
**Source:** `path/to/file.pdf`

## Content
[raw text content of the document]

## Pages
- Page 1: (width×height unit), [word count] words, [line count] lines
- Page 2: ...

## Languages
- [locale] (confidence: [%])
```

For **Layout** model:
```markdown
# Document Analysis — Layout Model
**Source:** `path/to/file.pdf`

## Content
[raw text content]

## Pages
[page info with dimensions]

## Tables
### Table 1 (3 columns × 5 rows)
| Col A | Col B | Col C |
|-------|-------|-------|
| cell  | cell  | cell  |
...

## Selection Marks
- [x] Checked option
- [ ] Unchecked option
```

---

## 6. Project Structure

```
document-intelligence-mcp/
├── .agent/
│   ├── docs/                    # Reference docs (existing)
│   ├── task/
│   │   └── 20260520-scaffold/
│   │       └── plan.md          # ← This file
├── src/
│   ├── index.ts                 # Entry point — FastMCP server setup
│   ├── tools/
│   │   ├── analyze-document.ts  # analyze_document tool implementation
│   │   └── schemas.ts           # Zod schemas for tool parameters
│   ├── services/
│   │   ├── document-intelligence.ts  # Azure DI client wrapper
│   │   └── cache.ts                 # SQLite cache layer
│   ├── formatters/
│   │   ├── read-formatter.ts    # Format Read model results → markdown
│   │   └── layout-formatter.ts  # Format Layout model results → markdown with tables
│   └── types.ts                 # Shared TypeScript types
├── test/
│   └── fixtures/                # Sample documents for testing
├── .env.example                 # Environment variable template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## 7. Configuration & Environment

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | Yes | — | Azure Cognitive Services endpoint URL |
| `AZURE_DOCUMENT_INTELLIGENCE_KEY` | Yes | — | API key for the resource |
| `AZURE_DOCUMENT_INTELLIGENCE_API_VERSION` | No | `2024-11-30` | API version |
| `DI_CACHE_PATH` | No | `./.cache/di-cache.sqlite` | SQLite database file path |

**.env.example:**
```env
# Azure Document Intelligence
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://<your-resource>.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=<your-api-key>
AZURE_DOCUMENT_INTELLIGENCE_API_VERSION=2024-11-30

# Cache
DI_CACHE_PATH=./.cache/di-cache.sqlite
```

---

## 8. Implementation Tasks (Ordered)

### Phase 1: Scaffold & Core

- [ ] **Task 1.1** — Initialize Bun project (`bun init`), create `package.json` with dependencies
- [ ] **Task 1.2** — Create `tsconfig.json` (strict mode, ESM)
- [ ] **Task 1.3** — Create `.env.example`, `.gitignore`
- [ ] **Task 1.4** — Implement `src/types.ts` (shared types: model enum, analysis result, cache types)
- [ ] **Task 1.5** — Implement `src/tools/schemas.ts` (Zod parameter schemas with `.refine()` for source validation)
- [ ] **Task 1.6** — Implement `src/services/document-intelligence.ts`:
  - Azure client initialization
  - `analyzeDocument(source, model)` — handles both file & URL paths
  - Long-running operation polling with progress
  - Error handling & retry logic
- [ ] **Task 1.7** — Implement `src/services/cache.ts`:
  - SQLite database initialization (create tables on startup via `better-sqlite3`)
  - `computeCacheKey(source, model)` — SHA-256 hashing via Node.js `crypto` module
  - `get(cacheKey)` — retrieve cached result
  - `set(cacheKey, model, sourceType, contentHash, result)` — store result
  - Support for both file content hashing and URL string hashing
- [ ] **Task 1.8** — Implement `src/formatters/read-formatter.ts` (Read model → markdown)
- [ ] **Task 1.9** — Implement `src/formatters/layout-formatter.ts` (Layout model → markdown with tables)
- [ ] **Task 1.10** — Implement `src/tools/analyze-document.ts`:
  - Parameter validation via schemas
  - Source type detection (file vs URL)
  - Cache check → Azure call → cache store cycle
  - Dispatch to appropriate formatter
- [ ] **Task 1.11** — Implement `src/index.ts` (FastMCP server, register tool, start stdio transport)

### Phase 2: Testing

- [ ] **Task 2.1** — Create test fixtures (small sample PDFs with known content)
- [ ] **Task 2.2** — Write unit tests for formatters (given mock Azure data, verify markdown output)
- [ ] **Task 2.3** — Write unit tests for cache layer (set, get, miss, key derivation)

### Phase 3: Documentation & Deployment

- [ ] **Task 3.1** — Write `README.md` with setup instructions, usage examples, MCP client config
- [ ] **Task 3.2** — Push to GitHub and verify

---

## 9. Key Design Decisions

### 9.1 Single tool with unified `source` parameter

**Decision:** ONE parameter `source: string` that accepts either a local file path or URL.

**How it works:**
- `source` starts with `http://` or `https://` → treated as URL → uses `beginAnalyzeDocumentFromUrl()`
- Anything else → treated as local file path → validates existence → uses `beginAnalyzeDocument()`

**Rationale:**
- Simplest API for the agent — one parameter for the document, one for the model
- No mutually-exclusive parameter confusion
- Consistent with caching model (single cache key derivation path)
- The agent just passes whatever reference it has

### 9.2 SQLite for caching via `better-sqlite3`

**Decision:** Use `better-sqlite3` npm package instead of Bun-native `bun:sqlite`.

**Rationale:**
- Portable — works with Node.js, Bun, Deno
- Well-maintained, popular SQLite library for JavaScript
- Synchronous API makes cache lookups simple and fast
- Keeps the project runtime-agnostic

### 9.3 Cache key = SHA-256 of content + model

- Uses Node.js built-in `crypto.createHash('sha256')` (available in Bun, Deno, Node.js)
- Separate cache entries for different models on the same document (e.g., user first calls `read`, then `layout` on same PDF)
- For files: hash changes when file content changes → automatic cache invalidation
- For URLs: hash of the URL string means the same URL always hits cache (until DB cleared)

### 9.4 Markdown output

All results returned as markdown strings because:
- MCP tools return `string` → rendered as text content
- Markdown is universally understood by LLMs and renders cleanly in chat UIs
- Layout model tables are naturally expressed as markdown tables

### 9.5 Error handling

- **File not found** → `UserError` with clear message
- **Azure API error** → Caught, logged, re-thrown as `UserError`
- **Invalid model** → Zod schema validation catches before execution
- **Unsupported file type** → Check extension before sending to Azure
- **Cache corruption** → Delete entry, fall through to fresh analysis

### 9.6 Retry & throttling

Based on the limitations doc:
- Implement exponential backoff on GET (polling) operations
- Respect `retry-after` header from Azure responses
- Default to polling every 2 seconds max (best practice to avoid 429s)

---

## 10. Dependencies

```json
{
  "dependencies": {
    "fastmcp": "^1.0.0",
    "@azure/ai-form-recognizer": "^5.1.0",
    "zod": "^3.23.0",
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/bun": "latest",
    "typescript": "^5.5.0"
  }
}
```

Hashing via Node.js built-in `crypto` module — no extra dependency needed.

---

## 11. MCP Client Configuration Example

For **Claude Desktop**, **Cursor**, or **pi**:

```json
{
  "mcpServers": {
    "document-intelligence": {
      "command": "bun",
      "args": ["run", "src/index.ts"],
      "env": {
        "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT": "https://<resource>.cognitiveservices.azure.com/",
        "AZURE_DOCUMENT_INTELLIGENCE_KEY": "<key>"
      }
    }
  }
}
```

---

## 12. Future Enhancements (Out of Scope for Now)

- `clear_cache` tool to manually invalidate cache
- TTL-based cache expiry / max-age config
- Support for `prebuilt-document` (key-value pairs)
- Support for prebuilt invoice/receipt/id document models
- Custom model support (loaded by model ID)
- Document classification (`beginClassifyDocument`)
- Batch document analysis
- HTTP streaming transport option
- `@azure/identity` (DefaultAzureCredential) as alternative auth
- Support for password-protected PDFs

---

*Plan approved. Proceed with Phase 1 implementation.*