# Hive Server API Spec

This document describes the API contract between the forge CLI / hive-sdk clients and the Hive server. Use it as a reference for implementing a compatible server for execution records.

## Hosts

| Client | Default Host | Env Override |
|--------|-------------|--------------|
| `HiveLogClient` (log ingest) | `https://www.forgehive.cloud` | `HIVE_HOST` |
| `HiveClient` (task invocation) | `https://forgehive.dev` | `HIVE_HOST` |

Both clients accept a host override via constructor config or `HIVE_HOST` environment variable.

## Authentication

All requests use Bearer token authentication:

```
Authorization: Bearer <apiKey>:<apiSecret>
Content-Type: application/json
```

Credentials are sourced from:
- Environment variables: `HIVE_API_KEY`, `HIVE_API_SECRET`
- Profile file: `~/.forge/profiles.json`

## Data Structures

### ExecutionRecord

The core payload for all log ingest operations. Sent as a JSON-stringified string in `logItem`.

```typescript
interface ExecutionRecord {
  uuid?: string                              // UUID v7, generated if missing
  input: unknown                             // Task input payload
  output?: unknown | null                    // Task output (null on error)
  error?: string                             // Error message if type === 'error'
  taskName?: string                          // Task name identifier
  type: 'success' | 'error' | 'pending'
  boundaries: {
    [boundaryName: string]: BoundaryTimingRecord
  }
  metadata?: Record<string, string>
  metrics?: Metric[]
  timing?: TimingInfo
}

interface BoundaryTimingRecord {
  input: unknown[]
  output?: unknown
  error?: string
  timing: {
    startTime: number    // Unix milliseconds
    endTime: number      // Unix milliseconds
    duration?: number    // Milliseconds
  }
}

interface Metric {
  type: string     // Category, e.g. "performance"
  name: string     // Metric name, e.g. "response_time"
  value: number
}

interface TimingInfo {
  startTime: number    // Unix milliseconds
  endTime: number      // Unix milliseconds
  duration?: number    // Milliseconds
}
```

### ApiError

Standard error response shape used across all endpoints:

```typescript
interface ApiError {
  error: string
  status: number
}
```

## Endpoints

### Auth

#### `GET /api/me`

Verify credentials and return team/user info. Used by the CLI during `auth:add` profile setup.

**Response:**
```typescript
{
  team: { name: string, uuid: string },
  user: { name: string }
}
```

---

### Execution Log Ingest

#### `POST /api/log-ingest`

Ingest a single task execution record. This is the primary endpoint called by `HiveLogClient.sendLog()`.

**Request body:**
```typescript
{
  projectUuid: string,
  taskUuid: string,
  logItem: string    // JSON.stringify(ExecutionRecord)
}
```

**Response:**
```typescript
{
  uuid: string,
  taskName: string,
  projectName: string,
  logItem: string,
  replayFrom: string,
  createdAt: string
}
```

#### `GET /api/tasks/{taskName}/logs/{uuid}`

Retrieve a previously stored execution record.

**Path parameters:** `taskName`, `uuid`

**Response:** The saved `ExecutionRecord` or `ApiError`.

#### `POST /api/tasks/{taskName}/logs/{uuid}/set-quality`

Attach a quality score to a stored execution record.

**Path parameters:** `taskName`, `uuid`

**Request body:**
```typescript
{
  quality: {
    score: number,
    reason: string,
    suggestions: string
  }
}
```

**Response:**
```typescript
{ success: boolean }
```

---

### Project Management

#### `GET /api/projects/{projectUuid}`

Fetch project details and its registered task list.

**Response:**
```typescript
{
  project: {
    uuid: string,
    projectName: string,
    description?: string,
    tasks: Array<{ uuid: string, [key: string]: unknown }>
  }
}
```

#### `POST /api/projects`

Create a new project. UUID is generated client-side.

**Request body:**
```typescript
{
  projectName: string,
  description: string,
  uuid: string
}
```

**Response:**
```typescript
{
  project: {
    uuid: string,
    projectName: string
  }
}
```

#### `POST /api/projects/{projectUuid}/sync`

Sync the full task list for a project (upsert semantics).

**Request body:**
```typescript
{
  projectName: string,
  description?: string,
  tasks: Array<{ uuid: string, name: string }>
}
```

**Response:**
```typescript
{
  projectUuid: string,
  projectName: string,
  summary: {
    total: number,
    created: number,
    updated: number,
    errors: number
  },
  results: {
    created: Array<{ uuid: string, taskName: string, action: string }>,
    updated: Array<{ uuid: string, taskName: string, previousName: string, action: string }>,
    errors: Array<{ uuid: string, taskName: string, error: string }>
  }
}
```

---

### Task Management

#### `POST /api/projects/{projectUuid}/tasks/{taskUuid}`

Register a task under a project.

**Request body:**
```typescript
{
  taskName: string,
  description: string
}
```

#### `POST /api/projects/{projectUuid}/tasks/{taskUuid}/publish`

Publish a compiled task bundle. The server returns a presigned S3 URL for the actual binary upload.

**Request body:**
```typescript
{
  taskName: string,
  handler: string,
  projectName: string,
  description: string,
  schemaDescriptor: string,   // JSON string
  boundaries: string[],
  sourceCode: string,
  bundleSize: number,
  fingerprint?: TaskFingerprintOutput,
  uuid: string
}
```

**Response:**
```typescript
{ bundleUploadUrl: string }
```

#### `PUT {bundleUploadUrl}`

Upload the compiled task bundle binary to the presigned S3 URL returned by the publish endpoint.

**Headers:** `Content-Type: application/octet-stream`

**Body:** Binary bundle content.

#### `POST /api/tasks/download`

Download the source code for a published task.

**Request body:**
```typescript
{ uuid: string }
```

**Response:**
```typescript
{
  handler: string,
  sourceCode: string,
  [key: string]: unknown
}
```

---

### Fixtures

#### `GET /api/fixture/{uuid}`

Fetch a stored fixture (boundary mock data) by UUID.

**Response:**
```typescript
{
  fixture: {
    name: string,
    taskName: string,
    boundaries: Record<string, unknown>,
    [key: string]: unknown
  }
}
```

---

### Task Invocation

#### `POST /api/projects/{projectUuid}/tasks/{taskUuid}/invoke`

Remotely invoke a published task. Used by `HiveClient`.

**Request body:**
```typescript
{ payload: unknown }
```

**Response:**
```typescript
{ responsePayload: unknown }
```

---

## Minimum Viable Server for Execution Records

To replicate only the log ingest flow, implement these three endpoints:

| Priority | Method | Path | Purpose |
|----------|--------|------|---------|
| Required | `GET` | `/api/me` | Auth verification |
| Required | `POST` | `/api/log-ingest` | Store execution records |
| Required | `GET` | `/api/tasks/{taskName}/logs/{uuid}` | Retrieve execution records |
| Optional | `POST` | `/api/tasks/{taskName}/logs/{uuid}/set-quality` | Quality scoring |

Storage key: `projectUuid + taskUuid + record.uuid`.

## Error Handling

- **401** — Invalid or missing credentials
- **404** — Resource not found
- **500** — Server error

When credentials are missing client-side, `HiveLogClient` operates in "silent mode" — it skips all network calls and returns `'silent'` without throwing.
