# Hive SDK

A TypeScript/JavaScript SDK for interacting with the Forge Hive logging and quality assessment platform.

## ⚠️ Deprecation Notices

- **`sendLog()` method**: Deprecated. Use `sendLogByName()` or `sendLogByUuid()` instead.
- **`projectName`-only configuration**: Deprecated. Use `createClientFromForgeConf()` or include `projectUuid` in your configuration.

Future versions will require `projectUuid` and remove support for the legacy `sendLog()` method and name-based project identification.

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
```

Or create with explicit configuration:
```typescript
import { HiveLogClient } from '@forgehive/hive-sdk'

// Create client with explicit configuration
const client = new HiveLogClient({
  projectName: 'My Project',
  projectUuid: 'your-project-uuid',
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret'
})
```

On your app

```typescript
// Run a task
const [res, error, record] = await someTask.safeRun(args)

// Send a log using task name (recommended)
await client.sendLogByName('stock:getPrice', record)
```

## Installation

```bash
npm install @forgehive/hive-sdk
```

or with pnpm:

```bash
pnpm add @forgehive/hive-sdk
```

## Setup

### 1. Configuration Options

The Hive SDK can be configured in two ways:

#### Option A: Explicit Configuration (Recommended)

```typescript
import { HiveLogClient, createHiveLogClient } from '@forgehive/hive-sdk'

// Direct configuration with credentials
const config = {
  projectName: 'My Project',
  apiKey: 'your_api_key_here',
  apiSecret: 'your_api_secret_here',
  host: 'https://your-hive-instance.com', // Optional, defaults to https://www.forgehive.cloud
  metadata: { // Optional base metadata
    environment: 'production',
    version: '1.2.0'
  }
}

const hiveLogger = new HiveLogClient(config)
// or using the factory function
const hiveLogger2 = createHiveLogClient(config)
```

#### Option B: Environment Variables (Fallback)

If you prefer environment variables, the SDK will automatically use them when no explicit credentials are provided:

```bash
HIVE_API_KEY=your_api_key_here
HIVE_API_SECRET=your_api_secret_here
HIVE_HOST=https://your-hive-instance.com  # Optional, defaults to https://www.forgehive.cloud
```

```typescript
import { HiveLogClient } from '@forgehive/hive-sdk'

// Uses environment variables for credentials
const hiveLogger = new HiveLogClient({
  projectName: 'My Project',
  metadata: {
    environment: 'production',
    version: '1.2.0'
  }
})
```

You can get your API credentials at [https://www.forgehive.cloud](https://www.forgehive.cloud).

### 2. Basic Usage

```typescript
import { HiveLogClient, createHiveLogClient } from '@forgehive/hive-sdk'

// Create client with explicit config
const hiveLogger = new HiveLogClient({
  projectName: 'Personal Knowledge Management System',
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret',
  metadata: {
    environment: 'production',
    version: '1.2.0',
    team: 'backend'
  }
})

// Or using factory function
const hiveLogger2 = createHiveLogClient({
  projectName: 'Personal Knowledge Management System',
  metadata: {
    environment: 'production',
    version: '1.2.0',
    team: 'backend'
  }
})
```

## API Methods

### `new HiveLogClient(config: HiveLogClientConfig): HiveLogClient`

Creates a new Hive log client instance with configuration object.

```typescript
import { HiveLogClient, HiveLogClientConfig, Metadata } from '@forgehive/hive-sdk'

// Minimal configuration (uses environment variables for credentials)
const client = new HiveLogClient({
  projectName: 'My Project'
})

// Full configuration with explicit credentials
const config: HiveLogClientConfig = {
  projectName: 'My Project',
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret',
  host: 'https://your-hive-instance.com', // Optional, defaults to https://www.forgehive.cloud
  metadata: {
    environment: 'production',
    version: '2.1.0',
    datacenter: 'us-east-1'
  }
}
const clientWithConfig = new HiveLogClient(config)
```

**Configuration Object:**
- `projectName`: Name of your project (required, ⚠️ deprecated - use `createClientFromForgeConf` instead)
- `projectUuid`: UUID of your project (recommended for new implementations)
- `apiKey`: API key (optional, falls back to `HIVE_API_KEY` environment variable)
- `apiSecret`: API secret (optional, falls back to `HIVE_API_SECRET` environment variable)
- `host`: Hive instance URL (optional, falls back to `HIVE_HOST` environment variable, then defaults to `https://www.forgehive.cloud`)
- `metadata`: Base metadata that will be included with every log (optional)
- `forgeConfigPath`: Path to forge.json file (optional, defaults to './forge.json')

**Returns:** `HiveLogClient` - Configured client instance

### `createClientFromForgeConf(forgeConfigPath?: string, additionalConfig?: Partial<HiveLogClientConfig>): HiveLogClient` (Recommended)

Creates a Hive log client automatically configured from your forge.json file. This is the recommended way to create clients as it automatically loads project name, UUID, and task configurations.

```typescript
import { createClientFromForgeConf } from '@forgehive/hive-sdk'

// Use default forge.json path (./forge.json)
const client = createClientFromForgeConf()

// Use custom forge.json path
const client = createClientFromForgeConf('./config/forge.json')

// Use default path with additional config
const client = createClientFromForgeConf(undefined, {
  metadata: {
    environment: 'production',
    version: '1.0.0'
  }
})

// Use custom path with additional config
const client = createClientFromForgeConf('./forge.json', {
  apiKey: 'override-key', // Override any forge.json values
  metadata: {
    environment: 'production'
  }
})
```

**Parameters:**
- `forgeConfigPath` (optional): Path to forge.json file (defaults to './forge.json')
- `additionalConfig` (optional): Additional config to override forge.json values

**Returns:** `HiveLogClient` - Configured client with project name, UUID, and task mappings from forge.json

**Benefits:**
- Automatically loads project name and UUID from forge.json
- Enables `sendLogByName()` method for easy task logging
- Supports task verification with `testConfig()`
- Reduces configuration boilerplate

### `createHiveLogClient(config: HiveLogClientConfig): HiveLogClient`

Factory function that creates a new Hive log client instance with explicit configuration.

```typescript
import { createHiveLogClient } from '@forgehive/hive-sdk'

const client = createHiveLogClient({
  projectName: 'My Project',
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret',
  metadata: {
    environment: 'production',
    team: 'backend'
  }
})
```

**Parameters:** Same as `HiveLogClient` constructor
**Returns:** `HiveLogClient` - Configured client instance

### `sendLog(record: ExecutionRecord, metadata?: Metadata): Promise<'success' | 'error' | 'silent' | LogApiSuccess>` ⚠️ DEPRECATED

> **⚠️ DEPRECATION WARNING**: `sendLog()` is deprecated and will be removed in a future version. Use `sendLogByName()` or `sendLogByUuid()` instead for better performance and enhanced features.

Sends a log entry to Hive using the legacy endpoint. This method still works but lacks the enhanced features of the newer UUID-based endpoints.

```typescript
// DEPRECATED - Use sendLogByName() instead
const status = await client.sendLog(record, metadata)

// RECOMMENDED - Use sendLogByName() for automatic UUID lookup
const status = await client.sendLogByName('stock:getPrice', record, metadata)
```

### `sendLogByName(taskName: string, record: ExecutionRecord, metadata?: Metadata): Promise<'success' | 'error' | 'silent' | LogApiSuccess>` (Recommended)

Sends a log entry to Hive using task name for automatic UUID lookup. Requires `projectUuid` to be set and forge.json to be loaded.

```typescript
// Run a task and send log by name
const [result, error, record] = await myTask.safeRun(args)
const status = await client.sendLogByName('stock:getPrice', record, {
  environment: 'production',
  requestId: 'req-123'
})
```

### `sendLogByUuid(record: ExecutionRecord, taskUuid: string, metadata?: Metadata): Promise<'success' | 'error' | 'silent' | LogApiSuccess>`

Sends a log entry to Hive using explicit task UUID. Requires `projectUuid` to be set in client config.

```typescript
const status = await client.sendLogByUuid(record, 'a45aafe3-8b01-4b58-b15d-9a96274858ee', metadata)
```

### `testConfig(): Promise<TestConfigResult>`

Tests the client configuration by verifying credentials, project access, and task synchronization.

```typescript
const result = await client.testConfig()
console.log('Config test:', result)
// Returns: { success, teamName, userName, projectName, projectExists, tasksVerified, error? }
```

### `getConf(): Record<string, unknown>`

Returns the client configuration with masked secrets (shows first 4 + last 4 characters).

```typescript
const config = client.getConf()
console.log('Client config:', config)
// Returns: { projectName, projectUuid, host, apiKey: 'abcd****wxyz', ... }
```

### `isActive(): boolean`

Check if the client is properly initialized with credentials.

```typescript
const hiveLogger = new HiveLogClient({
  projectName: 'My Project',
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret'
})

if (hiveLogger.isActive()) {
  console.log('Client is initialized with credentials')
  // Safe to call getLog and setQuality without try/catch
} else {
  console.log('Client is in silent mode')
  // Only sendLog will work (returns 'silent')
}
```

**Returns:** `boolean` - `true` if credentials are available, `false` if in silent mode

### `sendLog(taskName: string, logItem: LogItemInput, metadata?: Metadata): Promise<'success' | 'error' | 'silent'>`

Sends a log entry to Hive for a specific task with optional metadata. Accepts both manual log items and task execution records.

```typescript
// Using a manual log item
const status = await hiveLogger.sendLogByName('user-authentication', {
  input: { username: 'john_doe', timestamp: Date.now() },
  output: { success: true, userId: 12345 },
  boundaries: {
    database: [
      {
        input: 'SELECT * FROM users WHERE username = ?',
        output: [{ id: 12345, username: 'john_doe' }],
        error: null
      }
    ]
  }
}, {
  // This metadata has highest priority
  requestId: 'req-123',
  userId: 'user-456'
})

// Using a task execution record directly
const [result, error, record] = await someTask.safeRun(args)
await hiveLogger.sendLogByName('task-name', record, {
  environment: 'production'
})

switch (status) {
  case 'success':
    console.log('Log sent successfully')
    break
  case 'error':
    console.error('Failed to send log - network or API error')
    break
  case 'silent':
    console.log('Running in silent mode - no credentials configured')
    break
}
```

**Parameters:**
- `taskName`: Name of the task being logged
- `logItem`: LogItemInput object (supports both manual log items and task execution records)
- `metadata` (optional): Additional metadata for this specific log

**Returns:** `Promise<'success' | 'error' | 'silent'>` - Status of the operation

### `getLog(taskName: string, uuid: string): Promise<LogApiResult | null>`

Retrieves a specific log entry from Hive.

```typescript
try {
  const logData = await hiveLogger.getLog('user-authentication', 'log-uuid-123')

  if (logData && !isApiError(logData)) {
    console.log('Log retrieved:', logData.logItem)
    console.log('Log metadata:', logData.logItem.metadata)
  } else if (logData && isApiError(logData)) {
    console.error('API Error:', logData.error)
  } else {
    console.error('Failed to retrieve log')
  }
} catch (error) {
  console.error('Missing credentials:', error.message)
}
```

**Parameters:**
- `taskName`: Name of the task
- `uuid`: Unique identifier of the log entry

**Returns:** `Promise<LogApiResult | null>` - Log data, error object, or `null` if failed
**Throws:** Error when credentials are missing

### `setQuality(taskName: string, uuid: string, quality: Quality): Promise<boolean>`

Sets a quality assessment for a specific log entry.

```typescript
import { Quality } from '@forgehive/hive-sdk'

const quality: Quality = {
  score: 8.5,
  reason: 'Good performance with minor improvements needed',
  suggestions: 'Consider optimizing the database query for better performance'
}

try {
  const success = await hiveLogger.setQuality('user-authentication', 'log-uuid-123', quality)

  if (success) {
    console.log('Quality assessment saved')
  } else {
    console.error('Failed to save quality assessment')
  }
} catch (error) {
  console.error('Missing credentials:', error.message)
}
```

**Parameters:**
- `taskName`: Name of the task
- `uuid`: Unique identifier of the log entry
- `quality`: Quality assessment object with score (number), reason (string), and suggestions (string)

**Returns:** `Promise<boolean>` - `true` if successful, `false` if failed
**Throws:** Error when credentials are missing

## Metadata System

The Hive SDK supports a flexible metadata system that allows you to attach contextual information to your logs. Metadata can be provided at three levels with a clear priority system.

### Metadata Priority System

Metadata is merged using the following priority order (highest to lowest):

1. **sendLogByName metadata** - Metadata passed directly to the `sendLogByName` method
2. **logItem metadata** - Metadata already present in the `logItem` object
3. **Client base metadata** - Metadata set when creating the client

```typescript
// Create client with base metadata
const client = new HiveLogClient({
  projectName: 'My Project',
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret',
  metadata: {
    environment: 'production',
    version: '1.0.0',
    team: 'backend'
  }
})

// logItem with metadata
const logItem = {
  input: 'test input',
  output: 'test output',
  metadata: {
    sessionId: 'session-123',
    version: '1.1.0'  // This overrides client version
  }
}

// Send log with additional metadata
await client.sendLogByName('task-name', logItem, {
  requestId: 'req-456',
  version: '1.2.0'  // This overrides both logItem and client version
})

// Final metadata sent will be:
// {
//   environment: 'production',  // from client
//   team: 'backend',            // from client
//   sessionId: 'session-123',   // from logItem
//   version: '1.2.0',           // from sendLogByName (highest priority)
//   requestId: 'req-456'        // from sendLogByName
// }
```

### Metadata Usage Examples

**Base metadata for all logs:**
```typescript
const client = new HiveLogClient({
  projectName: 'My Service',
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret',
  metadata: {
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION,
    datacenter: 'us-west-2'
  }
})
```

**Request-specific metadata:**
```typescript
app.post('/api/users', async (req, res) => {
  const result = await client.sendLogByName('create-user', {
    input: req.body,
    output: newUser
  }, {
    requestId: req.headers['x-request-id'],
    userId: req.user?.id,
    ipAddress: req.ip
  })
})
```

**logItem with embedded metadata:**
```typescript
const logItem = {
  input: { query: 'search term' },
  output: { results: [...] },
  metadata: {
    searchDuration: '245',  // ms
    resultCount: '15',
    algorithm: 'fuzzy-v2'
  }
}

await client.sendLogByName('search', logItem)
```

## Types

### `HiveLogClientConfig`

```typescript
interface HiveLogClientConfig {
  projectName: string        // ⚠️ DEPRECATED - use createClientFromForgeConf() instead
  projectUuid?: string       // Recommended for new implementations
  apiKey?: string
  apiSecret?: string
  host?: string
  metadata?: Metadata
  forgeConfigPath?: string   // Path to forge.json file
}
```

**⚠️ Migration Guide:**
```typescript
// OLD (deprecated) - projectName only
const client = new HiveLogClient({
  projectName: 'My Project'
})

// NEW (recommended) - use createClientFromForgeConf
const client = createClientFromForgeConf('./forge.json')

// NEW (alternative) - explicit projectUuid
const client = new HiveLogClient({
  projectName: 'My Project',
  projectUuid: 'your-project-uuid'
})
```

### `LogItemInput` (also exported as `LogItem`)

```typescript
interface LogItemInput {
  input: unknown
  output?: unknown
  error?: unknown
  boundaries?: unknown // Flexible to accept different boundary structures
  metadata?: Metadata
  taskName?: string
  type?: string
  [key: string]: unknown // Allows task execution records and other additional properties
}
```

### `Metadata`

```typescript
interface Metadata {
  [key: string]: string
}
```

### `LogApiResponse`

```typescript
interface LogApiResponse {
  uuid: string
  taskName: string
  projectName: string
  logItem: {
    input: unknown
    output?: unknown
    error?: unknown
    boundaries?: Record<string, Array<{ input: unknown; output: unknown, error: unknown }>>
    metadata?: Metadata
  }
  replayFrom?: string
  createdAt: string
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

### `ApiError`

```typescript
interface ApiError {
  error: string
}
```

## Type Guards

### `isApiError(response: unknown): response is ApiError`

Use this type guard to check if a response is an error:

```typescript
import { isApiError } from '@forgehive/hive-sdk'

const result = await hiveLogger.getLog('task-name', 'log-uuid')

if (result && isApiError(result)) {
  console.error('Error:', result.error)
} else if (result) {
  console.log('Success:', result.logItem)
}
```

## Debugging

The SDK uses the `debug` package for internal logging. To enable debug logs, set the `DEBUG` environment variable:

```bash
# Enable all hive-sdk debug logs
DEBUG=hive-sdk node your-app.js

# Enable all debug logs
DEBUG=* node your-app.js

# Enable hive-sdk logs along with other specific loggers
DEBUG=hive-sdk,express:* node your-app.js
```

When debugging is enabled, you'll see detailed logs like:

```
# Normal mode (with credentials)
hive-sdk Creating HiveLogClient for project "Personal Knowledge Management System" +0ms
hive-sdk HiveLogClient initialized for project "Personal Knowledge Management System" with host "https://your-hive-instance.com" +2ms
hive-sdk Sending log for task "user-authentication" to https://your-hive-instance.com/api/tasks/log-ingest +100ms
hive-sdk Success: Sent log for task "user-authentication" +250ms

# Silent mode (missing credentials)
hive-sdk Creating HiveLogClient for project "Personal Knowledge Management System" +0ms
hive-sdk HiveLogClient in silent mode for project "Personal Knowledge Management System" - missing credentials (get them at https://www.forgehive.cloud) +2ms
hive-sdk Silent mode: Skipping sendLog for task "user-authentication" - client not initialized +100ms
hive-sdk Error: getLog for task "user-task" with uuid "some-uuid" - missing credentials +150ms

# Error handling
hive-sdk Error: Failed to send log for task "another-task": Network timeout +300ms
```

## Error Handling

The SDK handles errors gracefully:

- **Network errors**: Logged via debug, methods return `'error'` or `false`
- **Authentication errors**: Logged via debug, methods return `'error'` or `false`
- **API errors**: Returned as `ApiError` objects (for `getLog`) or logged via debug (for other methods)
- **Missing credentials**:
  - `sendLog`: Returns `'silent'` (no errors thrown)
  - `getLog` and `setQuality`: Throw errors

```typescript
// sendLog works even without credentials (returns 'silent')
const hiveLogger = new HiveLogClient({
  projectName: 'My Project'
  // No credentials provided - will use environment variables or go silent
})

const status = await hiveLogger.sendLogByName('task-name', { data: 'example' })
if (status === 'error') {
  console.error('Network or API error')
} else if (status === 'silent') {
  console.log('Running in silent mode - no credentials')
}
```

### Error Handling Patterns

**Check credentials before API calls:**
```typescript
const hiveLogger = new HiveLogClient({
  projectName: 'My Project'
  // Credentials will be loaded from environment variables or explicit config
})

if (hiveLogger.isActive()) {
  // Safe to use all methods
  const logData = await hiveLogger.getLog('task', 'uuid')
  await hiveLogger.setQuality('task', 'uuid', quality)
} else {
  console.log('Running in silent mode')
}
```

**sendLogByName** - Returns status strings (never throws):
```typescript
const status = await hiveLogger.sendLogByName('task', { data: 'test' })
// Returns: 'success', 'error', or 'silent'
```

**getLog and setQuality** - Throw errors when credentials missing:
```typescript
try {
  await hiveLogger.getLog('task', 'uuid')
  await hiveLogger.setQuality('task', 'uuid', quality)
} catch (error) {
  console.error('Missing credentials:', error.message)
}
```

## Examples

### Complete Example

```typescript
import { HiveLogClient, isApiError, Quality, Metadata, LogItemInput } from '@forgehive/hive-sdk'

async function main() {
  // Initialize the client with configuration object
  const hiveLogger = new HiveLogClient({
    projectName: 'Personal Knowledge Management System',
    apiKey: 'your_api_key_here',
    apiSecret: 'your_api_secret_here',
    host: 'https://your-hive-instance.com', // Optional, defaults to https://www.forgehive.cloud
    metadata: {
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      service: 'document-search-service'
    }
  })

  // Send a log with logItem containing metadata
  const logData = {
    input: { query: 'search for AI papers', userId: 123 },
    output: { results: ['paper1.pdf', 'paper2.pdf'], count: 2 },
    metadata: {
      searchAlgorithm: 'semantic-search-v2',
      processingTime: '245', // ms
      cacheHit: 'false'
    },
    boundaries: {
      search_engine: [
        {
          input: 'AI papers filetype:pdf',
          output: { hits: 150, results: ['...'] },
          error: null
        }
      ]
    }
  }

  // Send log with additional high-priority metadata
  const status = await hiveLogger.sendLogByName('document-search', logData, {
    requestId: 'req-123456',
    userId: 'user-789',
    sessionId: 'sess-abc123'
  })
  console.log('Log status:', status)

    // Retrieve a log
  try {
    const retrievedLog = await hiveLogger.getLog('document-search', 'some-uuid')
    if (retrievedLog && !isApiError(retrievedLog)) {
      console.log('Retrieved log:', retrievedLog.logItem)
      console.log('Log metadata:', retrievedLog.logItem.metadata)

      // Set quality assessment
      const quality: Quality = {
        score: 9.0,
        reason: 'Excellent search results with high relevance',
        suggestions: 'Consider adding result ranking by publication date'
      }

      const qualitySet = await hiveLogger.setQuality('document-search', retrievedLog.uuid, quality)
      console.log('Quality assessment saved:', qualitySet)
    }
  } catch (error) {
    console.error('Missing credentials for getLog/setQuality:', error.message)
  }
}

main().catch(console.error)
```

## License

ISC
