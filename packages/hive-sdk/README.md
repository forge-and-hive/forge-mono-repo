# Hive SDK

A TypeScript/JavaScript SDK for interacting with the Forge Hive logging and task invocation platform.

## Quick Start

Create a client from forge.json (recommended):
```typescript
import { createClientFromForgeConf } from '@forgehive/hive-sdk'

// Create client from forge.json (recommended)
const client = createClientFromForgeConf('./forge.json', {
  metadata: {
    environment: 'production',
    version: '1.0.0'
  }
})

// Run a task and send log
const [result, error, record] = await someTask.safeRun(args)
await client.sendLog(record, { environment: 'production' })
```

Or create with explicit configuration:
```typescript
import { createHiveLogClient } from '@forgehive/hive-sdk'

const client = createHiveLogClient({
  projectName: 'My Project',
  projectUuid: 'your-project-uuid',
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret'
})
```

## Installation

```bash
npm install @forgehive/hive-sdk
```

or with pnpm:

```bash
pnpm add @forgehive/hive-sdk
```

## Core Concepts

The Hive SDK provides two main clients:

1. **HiveLogClient** - For logging task execution records to Hive
2. **HiveClient** - For invoking tasks remotely

## HiveLogClient - Logging Task Executions

### Configuration Options

#### Option A: From forge.json (Recommended)

```typescript
import { createClientFromForgeConf } from '@forgehive/hive-sdk'

// Use default forge.json path (./forge.json)
const client = createClientFromForgeConf()

// Use custom forge.json path
const client = createClientFromForgeConf('./config/forge.json')

// Add additional config
const client = createClientFromForgeConf('./forge.json', {
  metadata: {
    environment: 'production',
    version: '1.0.0'
  }
})
```

**Benefits:**
- Automatically loads project name and UUID from forge.json
- Automatically loads task UUIDs for logging
- Supports task verification with `testConfig()`
- Reduces configuration boilerplate

#### Option B: Explicit Configuration

```typescript
import { createHiveLogClient } from '@forgehive/hive-sdk'

const client = createHiveLogClient({
  projectName: 'My Project',
  projectUuid: 'your-project-uuid',  // Required for sendLog
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret',
  host: 'https://www.forgehive.cloud', // Optional
  metadata: { // Optional base metadata
    environment: 'production',
    version: '1.2.0'
  }
})
```

#### Option C: Environment Variables

Set environment variables and omit credentials:

```bash
HIVE_API_KEY=your_api_key_here
HIVE_API_SECRET=your_api_secret_here
HIVE_HOST=https://www.forgehive.cloud  # Optional
```

```typescript
import { createHiveLogClient } from '@forgehive/hive-sdk'

// Uses environment variables for credentials
const client = createHiveLogClient({
  projectName: 'My Project',
  projectUuid: 'your-project-uuid',
  metadata: {
    environment: 'production'
  }
})
```

You can get your API credentials at [https://www.forgehive.cloud](https://www.forgehive.cloud).

### Basic Usage

#### Manual Logging

```typescript
import { createClientFromForgeConf } from '@forgehive/hive-sdk'
import { myTask } from './tasks/myTask'

// Create client
const client = createClientFromForgeConf('./forge.json')

// Run task
const [result, error, record] = await myTask.safeRun({ input: 'data' })

// Manually send log
if (record) {
  const status = await client.sendLog(record, {
    environment: 'production',
    requestId: 'req-123'
  })
  console.log('Log status:', status) // 'success', 'error', or 'silent'
}
```

#### Automatic Logging with Global Listener

```typescript
import { Task } from '@forgehive/task'
import { createClientFromForgeConf } from '@forgehive/hive-sdk'

// Create client
const client = createClientFromForgeConf('./forge.json')

// Set up global listener - automatically logs ALL task executions
Task.listenExecutionRecords(client.getListener())

// All task executions will now be automatically logged
const [result1] = await task1.safeRun(args)  // Automatically logged
const [result2] = await task2.safeRun(args)  // Automatically logged
```

## API Reference - HiveLogClient

### `createClientFromForgeConf(forgeConfigPath?: string, additionalConfig?: Partial<HiveLogClientConfig>): HiveLogClient`

Creates a Hive log client automatically configured from your forge.json file.

**Parameters:**
- `forgeConfigPath` (optional): Path to forge.json file (defaults to './forge.json')
- `additionalConfig` (optional): Additional config to override forge.json values

**Returns:** `HiveLogClient`

### `createHiveLogClient(config: HiveLogClientConfig): HiveLogClient`

Factory function that creates a new Hive log client instance.

**Configuration Object:**
- `projectName` (required): Name of your project
- `projectUuid` (optional but recommended): UUID of your project
- `apiKey` (optional): API key (falls back to `HIVE_API_KEY` env var)
- `apiSecret` (optional): API secret (falls back to `HIVE_API_SECRET` env var)
- `host` (optional): Hive instance URL (defaults to `https://www.forgehive.cloud`)
- `metadata` (optional): Base metadata included with every log
- `forgeConfigPath` (optional): Path to forge.json file (defaults to './forge.json')

**Returns:** `HiveLogClient`

### `client.sendLog(record: ExecutionRecord, metadata?: Metadata): Promise<'success' | 'error' | 'silent' | LogApiSuccess>`

Sends a log entry to Hive. Requires `projectUuid` to be set in client configuration.

```typescript
const [result, error, record] = await myTask.safeRun(args)

if (record) {
  const status = await client.sendLog(record, {
    environment: 'production',
    requestId: 'req-123'
  })

  switch (status) {
    case 'success':
      console.log('Log sent successfully')
      break
    case 'error':
      console.error('Failed to send log')
      break
    case 'silent':
      console.log('Running in silent mode - no credentials')
      break
  }
}
```

**Parameters:**
- `record`: ExecutionRecord from task execution
- `metadata` (optional): Additional metadata for this log

**Returns:**
- `'success'` - Log sent successfully
- `'error'` - Network or API error
- `'silent'` - Client not initialized (no credentials)
- `LogApiSuccess` - Full API response with log details

### `client.getListener(): (record: ExecutionRecord) => Promise<void>`

Returns a listener function that can be passed to `Task.listenExecutionRecords()` for automatic logging.

```typescript
import { Task } from '@forgehive/task'

// Set up global automatic logging
Task.listenExecutionRecords(client.getListener())
```

### `client.testConfig(): Promise<TestConfigResult>`

Tests the client configuration by verifying credentials, project access, and task synchronization.

```typescript
const result = await client.testConfig()
console.log('Config test:', result)
// Returns: {
//   success: boolean
//   teamName?: string
//   userName?: string
//   projectName?: string
//   projectExists?: boolean
//   tasksVerified?: { total: number, found: number, missing: string[] }
//   error?: string
// }
```

### `client.getConf(): Record<string, unknown>`

Returns the client configuration with masked secrets (shows first 4 + last 4 characters).

```typescript
const config = client.getConf()
console.log('Client config:', config)
// Returns: { projectName, projectUuid, host, apiKey: 'abcd****wxyz', ... }
```

### `client.isActive(): boolean`

Check if the client is properly initialized with credentials.

```typescript
if (client.isActive()) {
  console.log('Client is initialized with credentials')
} else {
  console.log('Client is in silent mode')
}
```

### `client.getLog(taskName: string, uuid: string): Promise<LogApiResult | null>`

Retrieves a specific log entry from Hive.

```typescript
const logData = await client.getLog('stock:getPrice', 'log-uuid-123')

if (logData && !isApiError(logData)) {
  console.log('Log retrieved:', logData.logItem)
} else if (logData && isApiError(logData)) {
  console.error('API Error:', logData.error)
}
```

**Parameters:**
- `taskName`: Name of the task
- `uuid`: Unique identifier of the log entry

**Returns:** `Promise<LogApiResult | null>`

**Throws:** Error when credentials are missing

### `client.setQuality(taskName: string, uuid: string, quality: Quality): Promise<boolean>`

Sets a quality assessment for a specific log entry.

```typescript
import { Quality } from '@forgehive/hive-sdk'

const quality: Quality = {
  score: 8.5,
  reason: 'Good performance with minor improvements needed',
  suggestions: 'Consider optimizing the database query'
}

const success = await client.setQuality('stock:getPrice', 'log-uuid-123', quality)
```

**Parameters:**
- `taskName`: Name of the task
- `uuid`: Unique identifier of the log entry
- `quality`: Quality assessment object

**Returns:** `Promise<boolean>` - `true` if successful, `false` if failed

**Throws:** Error when credentials are missing

## HiveClient - Task Invocation

### Configuration

```typescript
import { createHiveClient } from '@forgehive/hive-sdk'

const client = createHiveClient({
  projectUuid: 'your-project-uuid',
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret',
  host: 'https://www.forgehive.cloud' // Optional
})
```

**Configuration Object:**
- `projectUuid` (required): UUID of your project
- `apiKey` (optional): API key (falls back to `HIVE_API_KEY` env var)
- `apiSecret` (optional): API secret (falls back to `HIVE_API_SECRET` env var)
- `host` (optional): Hive instance URL (defaults to `https://forgehive.dev`)

### `client.invoke(taskUuid: string, payload: unknown): Promise<InvokeResult | null>`

Invokes a task remotely on the Hive platform.

```typescript
import { createHiveClient, isInvokeError } from '@forgehive/hive-sdk'

const client = createHiveClient({
  projectUuid: process.env.HIVE_PROJECT_UUID || ''
})

const result = await client.invoke('task-uuid-here', {
  ticker: 'AAPL'
})

if (isInvokeError(result)) {
  console.error('Error invoking task:', result.error)
} else {
  console.log('Success:', result.responsePayload)
}
```

**Parameters:**
- `taskUuid`: UUID of the task to invoke
- `payload`: Input data for the task

**Returns:** `Promise<InvokeResult | null>`
- `{ responsePayload: unknown }` - Success response
- `{ error: string }` - Error response
- `null` - Network error

### `client.testConfig(): Promise<TestConfigResult>`

Tests the client configuration by verifying credentials and project access.

### `client.getConf(): Record<string, unknown>`

Returns the client configuration with masked secrets.

## Metadata System

The Hive SDK supports a flexible metadata system with a clear priority order:

### Metadata Priority (highest to lowest)

1. **sendLog metadata** - Metadata passed directly to `sendLog()`
2. **Record metadata** - Metadata in the ExecutionRecord
3. **Client base metadata** - Metadata set when creating the client

### Example

```typescript
// Create client with base metadata
const client = createHiveLogClient({
  projectName: 'My Project',
  projectUuid: 'uuid-here',
  metadata: {
    environment: 'production',
    version: '1.0.0'
  }
})

// Record with metadata
const record = {
  taskName: 'myTask',
  input: {},
  output: {},
  type: 'success',
  boundaries: {},
  metadata: {
    sessionId: 'session-123',
    version: '1.1.0'  // Overrides client version
  }
}

// Send log with metadata
await client.sendLog(record, {
  requestId: 'req-456',
  version: '1.2.0'  // Overrides all (highest priority)
})

// Final metadata sent:
// {
//   environment: 'production',  // from client
//   sessionId: 'session-123',   // from record
//   version: '1.2.0',           // from sendLog (highest priority)
//   requestId: 'req-456'        // from sendLog
// }
```

## Types

### `HiveLogClientConfig`

```typescript
interface HiveLogClientConfig {
  projectName: string
  projectUuid?: string       // Recommended
  apiKey?: string
  apiSecret?: string
  host?: string
  metadata?: Metadata
  forgeConfigPath?: string
}
```

### `HiveClientConfig`

```typescript
interface HiveClientConfig {
  projectUuid: string        // Required
  apiKey?: string
  apiSecret?: string
  host?: string
}
```

### `Metadata`

```typescript
interface Metadata {
  [key: string]: string
}
```

### `Quality`

```typescript
interface Quality {
  score: number        // Quality score (typically 0-10)
  reason: string       // Explanation for the score
  suggestions: string  // Suggestions for improvement
}
```

### `InvokeResponse`

```typescript
interface InvokeResponse {
  responsePayload: unknown
}
```

### `InvokeError`

```typescript
interface InvokeError {
  error: string
}
```

### `ApiError`

```typescript
interface ApiError {
  error: string
}
```

## Type Guards

### `isApiError(response: unknown): response is ApiError`

Check if a response is an API error:

```typescript
import { isApiError } from '@forgehive/hive-sdk'

const result = await client.getLog('task-name', 'log-uuid')

if (result && isApiError(result)) {
  console.error('Error:', result.error)
} else if (result) {
  console.log('Success:', result.logItem)
}
```

### `isInvokeError(response: unknown): response is InvokeError`

Check if an invoke response is an error:

```typescript
import { isInvokeError } from '@forgehive/hive-sdk'

const result = await client.invoke('task-uuid', payload)

if (isInvokeError(result)) {
  console.error('Error:', result.error)
} else {
  console.log('Success:', result.responsePayload)
}
```

## Debugging

The SDK uses the `debug` package for internal logging. To enable debug logs:

```bash
# Enable all hive-sdk debug logs
DEBUG=hive-sdk node your-app.js

# Enable all debug logs
DEBUG=* node your-app.js
```

Example debug output:

```
hive-sdk Creating HiveLogClient for project "My Project" +0ms
hive-sdk HiveLogClient initialized for project "My Project" with host "https://www.forgehive.cloud" +2ms
hive-sdk Sending log for task "stock:getPrice" (UUID: xxx) to https://www.forgehive.cloud/api/log-ingest +100ms
hive-sdk Success: Sent log for task "stock:getPrice" (UUID: xxx) +250ms
```

## Error Handling

The SDK handles errors gracefully:

- **Network errors**: Logged via debug, methods return `'error'` or `false`
- **Authentication errors**: Logged via debug, methods return `'error'` or `false`
- **Missing credentials**:
  - `sendLog`: Returns `'silent'` (no errors thrown)
  - `getLog` and `setQuality`: Throw errors
  - `invoke`: Requires credentials, throws if missing

### Silent Mode

When credentials are missing, the client runs in "silent mode":

```typescript
const client = createHiveLogClient({
  projectName: 'My Project'
  // No credentials - will use env vars or go silent
})

const status = await client.sendLog(record)
if (status === 'silent') {
  console.log('Running in silent mode - logs not sent')
}

// Check before calling methods that throw
if (client.isActive()) {
  await client.getLog('task', 'uuid')
}
```

## Complete Example

```typescript
import { createClientFromForgeConf, Quality } from '@forgehive/hive-sdk'
import { Task } from '@forgehive/task'
import { getPrice } from './tasks/stock/getPrice'

// Create client from forge.json
const client = createClientFromForgeConf('./forge.json', {
  metadata: {
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  }
})

// Test configuration
const configTest = await client.testConfig()
if (!configTest.success) {
  console.error('Config error:', configTest.error)
  process.exit(1)
}

console.log('Connected as:', configTest.userName)
console.log('Team:', configTest.teamName)
console.log('Project:', configTest.projectName)

// Option 1: Manual logging
const [result, error, record] = await getPrice.safeRun({ ticker: 'AAPL' })

if (error) {
  console.error('Task failed:', error)
} else {
  console.log('Result:', result)

  // Send log manually
  const status = await client.sendLog(record, {
    requestId: 'req-123',
    userId: 'user-456'
  })
  console.log('Log sent:', status)
}

// Option 2: Automatic logging with global listener
Task.listenExecutionRecords(client.getListener())

// All subsequent task executions are automatically logged
await getPrice.safeRun({ ticker: 'GOOGL' })  // Automatically logged
await getPrice.safeRun({ ticker: 'MSFT' })   // Automatically logged
```

## License

ISC
