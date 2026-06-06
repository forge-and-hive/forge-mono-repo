# Build and Run

This document describes how the forge CLI builds (bundles) task files and executes them locally, including how execution records are captured and sent to the Hive server.

---

## Build (Bundling)

Before a task can be run, described, or published, its TypeScript source must be compiled into a single JavaScript file. The CLI uses **esbuild** for this.

### Output location

```
~/.forge/builds/{descriptor}.js
~/.forge/builds/{descriptor}.js.map
```

The descriptor is the task's key in `forge.json` (e.g. `stock:getPrice`).

### esbuild configuration

```typescript
{
  entryPoints: [entryPoint],   // e.g. src/tasks/stock/getPrice.ts
  outfile: outputFile,         // ~/.forge/builds/stock:getPrice.js
  bundle: true,
  minify: true,
  platform: 'node',
  sourcemap: true,
  external: externalPackages   // from forge.json build.externalPackages
}
```

External packages are excluded from the bundle (not inlined). Configure them in `forge.json`:

```json
{
  "build": {
    "externalPackages": ["pg", "aws-sdk"]
  }
}
```

### `forge.json` task descriptor

```typescript
interface TaskDescriptor {
  path: string      // Relative path to .ts source file
  handler: string   // Named export to use as the task (e.g. "getPrice")
  uuid?: string     // Optional — required for remote logging
}
```

### Bundle loading

After building, the CLI dynamically imports the bundle:

```typescript
const bundle = await import(bundlePath)
const task = bundle[taskDescriptor.handler]  // e.g. bundle.getPrice
```

The exported value must be a task instance created with `createTask()`.

### Zip archive (publish only)

For `task:publish`, the bundle is zipped before upload:

| File in archive | Source |
|----------------|--------|
| `index.js` | The compiled bundle |
| `index.js.map` | Source map |
| `forge.json` | Project config (optional) |

Compression: zlib level 9.

---

## Run

### Entry point

`forge task:run <descriptor> [--input <json>] [key=value ...]`

Input can be provided as:
- `--input '{"key":"value"}'` — full JSON string (takes precedence)
- `key=value` positional args — parsed into an object

### Execution flow

```
1. Load forge.json → get task descriptor (path, handler, uuid)
2. Load active profile from ~/.forge/profiles.json (optional)
3. Ensure log directory exists: {paths.logs}/{descriptor}/
4. Bundle task → ~/.forge/builds/{descriptor}.js
5. Dynamically import bundle → extract task handler
6. Load existing log file if present (for rotation)
7. Execute: task.safeRun(args)
   └─ Returns [result, error, ExecutionRecord]
8. Append ExecutionRecord to tape (rotate if > 10 entries)
9. Save tape to disk: {paths.logs}/{descriptor}.log
10. If profile + taskUuid present → POST record to Hive API
11. Print result
```

### Log file

- **Location**: `{paths.logs}/{descriptor}.log`
- **Format**: NDJSON — one complete JSON object per line
- **Max entries**: 10 (oldest line removed when limit is reached)

Example:
```
{"uuid":"...","input":{...},"output":{...},"type":"success","boundaries":{...},"taskName":"stock:getPrice","timing":{...}}
{"uuid":"...","input":{...},"error":"Invalid input","type":"error","boundaries":{...},"taskName":"stock:getPrice","timing":{...}}
```

---

## Task execution internals

Tasks are created with `createTask()` from `@forgehive/task`. The key method for CLI use is `safeRun`.

### `safeRun(args)`

Runs the task and never throws — returns a tuple:

```typescript
const [result, error, record] = await task.safeRun(args)
// result: OutputType | null
// error:  Error | null
// record: ExecutionRecord
```

### ExecutionRecord

Every execution produces one record:

```typescript
interface ExecutionRecord {
  uuid?: string                            // UUID v7, generated if missing
  input: unknown                           // Args passed in
  output?: unknown | null                  // Return value (null on error)
  error?: string                           // Error message (undefined on success)
  taskName?: string                        // Task name
  type: 'success' | 'error' | 'pending'
  boundaries: {
    [boundaryName: string]: BoundaryRecord[]
  }
  metadata?: Record<string, string>        // From setMetadata() calls
  metrics?: Metric[]                       // From setMetrics() calls
  timing?: {
    startTime: number    // Unix ms
    endTime: number      // Unix ms
    duration?: number    // ms
  }
}
```

### Built-in boundaries

Two boundaries are always available to any task — no explicit declaration needed:

```typescript
// Set arbitrary string metadata on the record
await setMetadata('userId', '12345')

// Append a metric to the record
await setMetrics({ type: 'performance', name: 'api_call_time', value: 250 })
```

---

## Boundaries

Boundaries are the task's interfaces to the outside world (APIs, databases, etc.). They are wrapped by the runtime to support recording, mocking, and replay.

### Execution modes

| Mode | Behavior |
|------|----------|
| `proxy` | Execute normally, record result (default) |
| `replay` | Return cached result, throw if not found |
| `proxy-pass` | Return cached result if available, otherwise execute |
| `proxy-catch` | Execute normally; on error, fall back to cached result |

### Boundary record

Each boundary call produces one record:

```typescript
// Success
{ input: unknown[], output: unknown, timing: TimingInfo }

// Error
{ input: unknown[], error: string, timing: TimingInfo }
```

### Cache matching (replay / proxy-pass / proxy-catch)

When looking up a cached result the runtime uses deep equality on `input`:

```
for each record in cache:
  if deepEqual(record.input, args): return record
```

---

## Replay

`forge task:replay <descriptor> --path <fixture> [--cache <boundaries>]`

Reruns a task using a previously recorded fixture. Boundaries listed in `--cache` use recorded responses instead of executing.

### Fixture format

```typescript
interface Fixture {
  fixtureUUID: string
  taskName: string
  projectName: string
  type: 'success' | 'error'
  input: Record<string, unknown>          // Original task input
  output: Record<string, unknown>         // Original task output
  boundaries: Record<string, unknown[]>   // Recorded boundary calls
  context: Record<string, unknown>
}
```

### Replay flow

```
1. Read fixture file from --path
2. Parse --cache → list of boundary names to replay
3. Build boundaryConfig: { [name]: 'replay' } for each cached boundary
4. Call task.safeReplay(
     { input, output, boundaries },   // from fixture
     { boundaries: boundaryConfig }
   )
   ├─ Cached boundaries: match input args → return recorded output
   └─ Other boundaries: execute normally
5. Save new ExecutionRecord to log (with replayFrom: fixtureUUID in metadata)
6. Send to Hive API if profile is configured
```

---

## Hive API integration

After every local execution (run or replay), if an auth profile and task UUID are present, the record is sent to the Hive server.

```
POST {profile.url}/api/log-ingest
Authorization: Bearer {apiKey}:{apiSecret}
Content-Type: application/json

{
  "projectUuid": "...",
  "taskUuid": "...",
  "logItem": "<JSON.stringify(ExecutionRecord)>"
}
```

See [`hive-server.md`](./hive-server.md) for the full server API spec and [`fingerprint.md`](./fingerprint.md) for how fingerprints are generated and attached during publish.

---

## Full pipeline summary

```
task.ts (TypeScript source)
    ↓  esbuild (bundle + minify)
~/.forge/builds/{descriptor}.js
    ↓  dynamic import
task instance (createTask export)
    ↓  safeRun(args)
ExecutionRecord { input, output, boundaries, timing, ... }
    ↓  RecordTape.push + save
{paths.logs}/{descriptor}.log  (NDJSON, max 10 lines)
    ↓  HiveLogClient.sendLog   (if profile + uuid present)
POST /api/log-ingest
```
