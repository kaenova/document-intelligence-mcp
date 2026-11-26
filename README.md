# document-intelligence-mcp

Bun + FastMCP **Streamable HTTP** server for Azure AI Document Intelligence. Analyze HTTPS documents or privately uploaded source files, store Markdown results in S3, and retrieve temporary presigned download links.

- **`read`** — OCR text extraction, pages, and languages.
- **`layout`** — Text, tables, selection marks, and document structure.
- **`create_upload_url`** returns a presigned PUT URL and file ID for uploading a document directly to S3.
- **`analyze_document`** accepts an HTTPS URL or uploaded file ID and returns result metadata, not the full document.
- **`download_result`** returns a presigned S3 download URL for that result ID.

## Quick start

Requires Bun >= 1.3.8, an Azure Document Intelligence resource, and a private S3 or S3-compatible bucket.

```bash
bun install
cp .env.example .env
# Edit .env with Azure, S3, and bearer-token configuration.
bun run start
```

Bun loads `.env` automatically. The MCP endpoint defaults to `http://127.0.0.1:8080/mcp`. `bun run dev` enables watch mode. This server no longer runs over stdio.

Generate a strong shared token, for example with `openssl rand -hex 32`. Every MCP request must include:

```http
Authorization: Bearer <MCP_AUTH_TOKEN>
```

For remote deployment, use a TLS reverse proxy and forward the Authorization header. Set `MCP_HOST=0.0.0.0` only when needed for containers or private-network access. Configure proxy/client timeouts for long-running Azure analysis and apply rate/concurrency limits at the proxy. The server rejects requests with an `Origin` header; direct browser clients are not supported. FastMCP's `/health` and `/ready` endpoints are public liveness/status checks, not credential or S3-connectivity checks.

## Environment variables

See [`.env.example`](.env.example) for a complete example.

| Variable | Default | Purpose |
| --- | --- | --- |
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | required | Azure HTTPS endpoint |
| `AZURE_DOCUMENT_INTELLIGENCE_KEY` | required | Azure API key |
| `MCP_AUTH_TOKEN` | required | Shared bearer token, no whitespace |
| `MCP_HOST` | `127.0.0.1` | HTTP bind address |
| `MCP_PORT` | `8080` | HTTP port |
| `S3_BUCKET` | required | Existing private bucket for results and uploaded source files |
| `S3_REGION` | `us-east-1` | Signing/storage region |
| `S3_ENDPOINT` | AWS regional endpoint | Custom HTTP(S) endpoint for S3-compatible storage |
| `S3_ACCESS_KEY_ID` | AWS provider chain | Optional explicit access key; requires secret key |
| `S3_SECRET_ACCESS_KEY` | AWS provider chain | Optional explicit secret key; requires access key |
| `S3_SESSION_TOKEN` | unset | Optional temporary-credential token; requires both explicit keys |
| `S3_FORCE_PATH_STYLE` | `false` | Set `true` for providers such as MinIO when needed |
| `S3_PREFIX` | `document-intelligence/results` | Dedicated result-object prefix |
| `S3_UPLOAD_PREFIX` | `document-intelligence/uploads` | Source-document prefix; must not overlap `S3_PREFIX` |
| `FEATURE_RESULT_RETENTION_DAYS` | `7` | Positive whole days of retention for both source files and results |
| `FEATURE_PRESIGNED_RETENTION_HOURS` | `1` | Positive hours (fractions allowed), at least one second and at most 168 hours |

Without explicit S3 credentials, the AWS SDK uses its default credential provider chain, including IAM workload roles and standard AWS environment credentials. A custom `S3_ENDPOINT` also appears in presigned upload/download URLs: it must be reachable by clients, not just from inside a container. Uploaded-file analysis requires an HTTPS endpoint reachable by Azure. Do not rewrite the host/path/query of a signed URL.

The server validates configuration at startup but does not provision the bucket or verify cloud access until tools are called. Azure SDK API version selection remains the SDK default; the previously documented `AZURE_DOCUMENT_INTELLIGENCE_API_VERSION` variable was unused and has been removed.

## Connect an MCP client

Configure your MCP client for Streamable HTTP with URL `http://127.0.0.1:8080/mcp` (or your TLS proxy URL) and an Authorization header. Many clients use a configuration shaped like:

```json
{
  "mcpServers": {
    "document-intelligence": {
      "url": "http://127.0.0.1:8080/mcp",
      "headers": {
        "Authorization": "Bearer <your-shared-bearer-token>"
      }
    }
  }
}
```

Exact configuration keys and environment-variable substitution depend on your client. Start this server separately; it is not a client-launched stdio command.

## Tools

### `create_upload_url`

Request an upload URL for a local document:

```json
{
  "filename": "invoice.pdf",
  "sizeBytes": 12345
}
```

`filename` is a supported document filename, not a filesystem path. `sizeBytes` is the exact size of the file (positive integer, up to 500 MiB; Azure model limits also apply). The server infers the content type from the extension. It returns JSON as MCP text content:

```json
{
  "fileId": "70d6a4a5-9161-4ee3-98b0-591a754ec9ee",
  "filename": "invoice.pdf",
  "method": "PUT",
  "url": "https://your-bucket.s3.amazonaws.com/...?...",
  "headers": {
    "Content-Type": "application/pdf",
    "Content-Length": "12345",
    "If-None-Match": "*",
    "Cache-Control": "private, no-store",
    "x-amz-meta-filename-base64": "aW52b2ljZS5wZGY",
    "x-amz-meta-retention-days": "7",
    "x-amz-meta-size-bytes": "12345"
  },
  "expiresAt": "2026-01-01T01:00:00.000Z",
  "retentionDays": 7
}
```

The ID is issued **before** upload; creating a URL does not create or upload the document. PUT the exact raw bytes to the returned URL using **all** returned headers (no multipart/form-data, no MCP Authorization header). For example, when the tool response is saved as `upload.json`:

```python
import json
import urllib.request

with open("upload.json", encoding="utf-8") as response_file:
    upload = json.load(response_file)
with open("invoice.pdf", "rb") as document:
    request = urllib.request.Request(
        upload["url"], data=document.read(), method=upload["method"],
        headers=upload["headers"],
    )
with urllib.request.urlopen(request) as response:
    assert response.status == 200
# Only now pass upload["fileId"] to analyze_document.
```

S3 returns a successful PUT response, not a custom file ID; use the `fileId` already returned by the tool. Retention starts at S3's successful upload timestamp (`LastModified`). `expiresAt` is **upload-link expiry**, not file-retention expiry. The link lifetime uses `FEATURE_PRESIGNED_RETENTION_HOURS` and does not shorten the stored file lifetime.

Uploads use signed `If-None-Match: *` and are create-only: retrying after a successful upload returns `412 Precondition Failed` (concurrent writes can also return `409`). A timeout may occur after a successful write; `analyze_document` checks object existence, size, and metadata. If it reports no file, request a new upload URL and ID. S3-compatible providers must support conditional PUT and signed headers; do not remove the create-only condition. File extensions/content types are not malware or content validation—Azure determines whether the uploaded bytes are a supported document. Apply storage quotas and upload-rate limits at your deployment boundary.

### `analyze_document`

```json
{
  "model": "layout",
  "source": "https://example.com/report.pdf"
}
```

Or analyze a completed upload:

```json
{
  "model": "layout",
  "fileId": "70d6a4a5-9161-4ee3-98b0-591a754ec9ee"
}
```

`model` is `read` or `layout`. Provide **exactly one** of `source` or `fileId`. `source` must be an HTTPS document URL accessible to Azure, including a presigned document URL. With `fileId`, the server checks S3 object existence, exact size, signed metadata, and retention before generating an internal presigned GET URL for Azure. Missing, incomplete, or expired files cannot reach Azure analysis. Local filesystem paths, embedded URL credentials, and fragments are rejected. Azure fetches the document directly; the MCP server does not fetch URLs or read local files. Supported documents include PDF, images (JPG, PNG, BMP, TIFF, HEIF), and Office documents (DOCX, PPTX, XLSX), subject to Azure model limits.

The tool returns JSON as MCP text content:

```json
{
  "resultId": "70d6a4a5-9161-4ee3-98b0-591a754ec9ee",
  "model": "layout",
  "filename": "70d6a4a5-9161-4ee3-98b0-591a754ec9ee.md",
  "contentType": "text/markdown; charset=utf-8",
  "sizeBytes": 12345,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "expiresAt": "2026-01-08T00:00:00.000Z"
}
```

Each successful analysis writes a new object under `<S3_PREFIX>/<resultId>.md`. Results contain formatted Markdown, not raw Azure JSON; uploaded source documents are stored separately under `<S3_UPLOAD_PREFIX>/<fileId>`. Input URL query parameters are stripped from Markdown attribution; uploaded-file attribution uses the file ID without revealing the internal S3 URL. A result ID is returned only after the S3 write succeeds.

### `download_result`

```json
{
  "resultId": "70d6a4a5-9161-4ee3-98b0-591a754ec9ee"
}
```

Returns JSON as MCP text content:

```json
{
  "resultId": "70d6a4a5-9161-4ee3-98b0-591a754ec9ee",
  "filename": "70d6a4a5-9161-4ee3-98b0-591a754ec9ee.md",
  "url": "https://your-bucket.s3.amazonaws.com/...?...",
  "expiresAt": "2026-01-02T01:00:00.000Z",
  "resultExpiresAt": "2026-01-08T00:00:00.000Z"
}
```

The server checks object existence and retention metadata before signing a GET URL with attachment download headers. Link lifetime is the minimum of `FEATURE_PRESIGNED_RETENTION_HOURS`, the result's remaining retention, and the AWS SigV4 seven-day limit (rounded down to whole seconds). Expired/missing results cannot get new links. `expiresAt` is the signed URL's maximum validity: temporary signing credentials, object deletion, or bucket policies can make it fail sooner.

Presigned URLs allow anyone holding the link to download without the MCP bearer token. Keep links private. Clients using the shared MCP token share result access; this is not tenant-isolated storage. Changing retention or rotating the MCP token does not revoke already-issued links. Use object deletion or an appropriate bucket policy if immediate revocation is necessary.

## Result retention and S3 lifecycle

Three lifetimes apply:

1. **Source-file retention:** `FEATURE_RESULT_RETENTION_DAYS` from successful upload (`LastModified`). The original retention policy is signed into upload metadata. Analyzing does not extend it, and expired files cannot be analyzed by ID. Reducing configured retention also restricts existing files; increasing it does not extend their original policy.
2. **Result retention:** the same number of days, independently from result creation; downloading never extends it. The MCP server refuses new links at expiry, even if the object has not yet been physically deleted. Reducing the configured retention also restricts existing results; increasing it does not extend their stored expiry. A result may remain available after its source expires.
3. **Link retention:** `FEATURE_PRESIGNED_RETENTION_HOURS` for upload PUTs, result-download GETs, and internal source GETs for Azure. GET links are additionally capped by the relevant object's remaining retention. Temporary credentials may expire sooner. Already-issued links are not revoked by changing configuration.

**Configure an S3 lifecycle rule yourself for physical deletion.** The server deliberately does not modify bucket lifecycle configuration or run a cleanup job. Use dedicated result and upload prefixes and match both expiration rules to `FEATURE_RESULT_RETENTION_DAYS`:

```json
{
  "Rules": [
    {
      "ID": "document-intelligence-result-retention",
      "Status": "Enabled",
      "Filter": { "Prefix": "document-intelligence/results/" },
      "Expiration": { "Days": 7 }
    },
    {
      "ID": "document-intelligence-upload-retention",
      "Status": "Enabled",
      "Filter": { "Prefix": "document-intelligence/uploads/" },
      "Expiration": { "Days": 7 }
    }
  ]
}
```

Merge these rules into your existing bucket lifecycle configuration; do not replace unrelated rules. S3 lifecycle expiration uses day boundaries and physical deletion is asynchronous. Object metadata does not delete files automatically. Update both lifecycle rules when changing retention or either prefix. Files uploaded but never analyzed still require lifecycle deletion; requesting a URL without uploading creates no S3 object. For S3-compatible services, configure the equivalent lifecycle policy supported by that provider.

If bucket versioning is enabled, also configure noncurrent-version expiration and expired-delete-marker cleanup; expiring the current object alone can leave historical document data in the bucket. Object Lock or legal holds may prevent physical deletion. Keep S3 Block Public Access enabled and configure bucket encryption as required by your deployment. The server never requests a public ACL.

### Permissions

The runtime identity needs `s3:PutObject` and `s3:GetObject` for **both** prefixes (`HeadObject` uses `GetObject` permission). Presigning does not grant the signing identity additional permissions. For example:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": [
        "arn:aws:s3:::YOUR_BUCKET/document-intelligence/results/*",
        "arn:aws:s3:::YOUR_BUCKET/document-intelligence/uploads/*"
      ]
    }
  ]
}
```

`ListBucket` is optional. Without it, AWS may report a missing object as `403` rather than `404`; the tool then returns a generic storage error instead of “not found.” The runtime needs neither `DeleteObject` nor lifecycle-administration permissions. A deployment/admin identity configures lifecycle separately. SSE-KMS buckets require the appropriate KMS permissions as well.

## Migration from stdio

- Replace command/args MCP configuration with the HTTP URL and bearer header.
- Replace local source paths with HTTPS URLs, or use `create_upload_url`, upload the bytes directly, then analyze by `fileId`.
- Call `download_result` after `analyze_document` rather than expecting inline Markdown.
- SQLite caching and `DI_CACHE_PATH` are removed. Repeated analysis invokes Azure and creates a fresh result; there is no local document-result cache.
- Old `.cache/di-cache.sqlite` files are **not deleted automatically**. Remove historical cache files yourself if required by your data-retention policy.

## Development

```bash
bun test
bun run typecheck
bun run build
```

Tests cover configuration validation, HTTPS/file-ID inputs, bearer authentication, real Streamable HTTP client calls for all three tools, signed create-only upload headers, size/metadata checks, S3 result writes, offline AWS presigning, source/result expiry boundaries, and failure handling. Azure/S3 network operations are mocked in tests; live deployment requires valid cloud credentials and lifecycle configuration.

## License

MIT
