# Task Fingerprinting

A fingerprint is a structured static analysis of a task's TypeScript source. It captures the input schema, return type, boundary signatures, and thrown errors — without executing the task. Fingerprints are saved locally as JSON files and sent to the Hive server during `task:publish`.

## What it's used for

- **Change detection**: the hash field lets the server (or CI) detect when a task's interface has changed between publishes
- **Documentation**: the Hive server can render task schemas and boundary signatures from the fingerprint without running the code
- **Publish payload**: fingerprints are included in the `task:publish` API call so the server has type information at upload time

## How to generate one

```bash
forge task:fingerprint domain:taskName
```

This analyzes the source file statically and writes the result to `{paths.fingerprints}/{descriptor}.fingerprint.json`.

Fingerprints are also generated automatically during `task:publish` and included in the publish payload.

---

## Data structure

### Top-level `TaskFingerprintOutput`

```typescript
interface TaskFingerprintOutput {
  description?: string
  inputSchema: InputSchema
  outputType: OutputType
  boundaries: BoundaryFingerprint[]
  errors: FingerprintError[]
  analysisMetadata: {
    timestamp: string       // ISO 8601
    filePath: string        // Source file analyzed
    success: boolean        // False if analysis had critical failures
    analysisVersion: string // e.g. "1.0.0"
  }
}
```

### `InputSchema`

Mirrors the task's `new Schema({...})` definition as **JSON Schema** (draft 2020-12),
matching what `Schema.describe()` produces at runtime. Optionality is expressed by the
object-level `required` array (a field is optional when absent from it).

```typescript
interface InputSchema {
  type: "object"
  properties: Record<string, SchemaProperty>
  required?: string[]
}

interface SchemaProperty {
  name?: string
  type: string              // "string" | "number" | "boolean" | "array" | "object" | ...
  format?: string           // e.g. "date-time" (Schema.date()), "email", "uuid", "uri"
  description?: string      // from .describe('...')
  default?: string
  properties?: Record<string, SchemaProperty>  // for nested objects
  additionalProperties?: SchemaProperty | { anyOf: SchemaProperty[] }  // for records
}
```

### `OutputType`

The inferred or annotated return type of the main task function.

```typescript
interface OutputType {
  type: string                          // e.g. "object", "string", "array", "unknown"
  properties?: Record<string, SchemaProperty>  // for object types
  elementType?: OutputType              // for array types
}
```

### `BoundaryFingerprint`

One entry per boundary function defined in the task's boundaries object.

```typescript
interface BoundaryFingerprint {
  name: string                  // Boundary function name
  input: SchemaProperty[]       // Parameters (ordered), each with name and type
  output: OutputType            // Return type (Promise<T> is unwrapped to T)
  errors: FingerprintError[]    // throw statements detected in the boundary body
}
```

### `FingerprintError`

Errors detected statically — these are `throw` statements in source, not runtime crashes.

```typescript
interface FingerprintError {
  type: 'parsing' | 'analysis' | 'boundary' | 'schema'
  message: string
  location?: {
    file: string
    line?: number    // 1-based
    column?: number  // 1-based
  }
  details?: Record<string, unknown>
}
```

| Error type | Meaning |
|------------|---------|
| `parsing` | TypeScript compiler could not parse the file |
| `schema` | Malformed `new Schema({...})` definition |
| `boundary` | `throw` detected inside a boundary function body |
| `analysis` | `throw` detected inside the main task function body |

---

## How analysis works

The fingerprint engine is a multi-pass TypeScript AST analysis (no execution, no bundling).

### Pass 1 — Variable discovery
Scans the file for variable declarations named `schema` and `boundaries` and stores references to their AST nodes for later passes.

### Pass 2 — Task detection
Finds all `createTask()` call expressions. Only processes exported ones (e.g. `export const myTask = createTask(...)`). Deduplication prevents double-processing.

### Pass 3 — Schema extraction
Reads the `new Schema({...})` constructor argument and produces JSON Schema. Walks method
call chains to detect:
- Property types: `.string()`, `.number()`, `.boolean()`, `.array()`, `.object()`, the record
  helpers (`.stringRecord()` / `.numberRecord()` / `.booleanRecord()` / `.mixedRecord()`), and
  the string formats `.date()` (→ `format: "date-time"`), `.email()`, `.uuid()`, `.url()`
- Modifiers: `.describe('...')` (→ `description`), `.optional()` (→ omitted from `required`),
  `.default(value)`. Other modifiers (`.min()`, `.max()`, `.regex()`, ...) don't change the
  JSON Schema type and are skipped.

### Pass 4 — Boundary analysis
For each function in the boundaries object:
- Reads TypeScript parameter type annotations → `input[]`
- Reads the return type annotation, unwrapping `Promise<T>` → `output`
- Handles `T[]` and `Array<T>` syntax, extracting element types
- Walks the function body for `throw` statements → `errors[]`

### Pass 5 — Main function analysis
Analyzes the task's main async function:
- Uses explicit return type annotation if present
- Otherwise infers return type from `return` statements:
  - Tracks which variables came from boundary calls
  - Inspects object literals, property accesses, shorthand properties
- Scans for `throw` statements → adds to top-level `errors[]`

### Pass 6 — Hash generation

```typescript
function generateHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash  // 32-bit truncation
  }
  return Math.abs(hash).toString(36)
}

// Input string:
const hashInput = `${taskName}:${JSON.stringify(inputSchema)}:${JSON.stringify(boundaryNames)}`
```

The hash changes when the task name, input schema, or boundary names change. Output type and error changes do not affect the hash.

---

## File storage

| Path | Produced by |
|------|-------------|
| `{paths.fingerprints}/{descriptor}.fingerprint.json` | `task:fingerprint` command |
| `{paths.fingerprints}/{descriptor}.fingerprints.json` | `bundle:fingerprint` (used during publish) |

`paths.fingerprints` is configured in `forge.json` (default: `fingerprints/`).

### Single-task fingerprint file

```json
{
  "taskFingerprint": {
    "description": "...",
    "inputSchema": { ... },
    "outputType": { ... },
    "boundaries": [ ... ],
    "errors": [ ... ],
    "analysisMetadata": { ... }
  }
}
```

### Bundle fingerprint file (multi-task)

```json
{
  "tasks": [ /* array of TaskFingerprintOutput */ ],
  "buildInfo": {
    "entryPoint": "src/tasks/stock/getPrice.ts",
    "outputFile": "fingerprints/stock_getPrice.js",
    "fingerprintsFile": "fingerprints/stock_getPrice.fingerprints.json",
    "totalTasks": 1,
    "buildTimestamp": "2025-01-18T12:40:18.033Z"
  }
}
```

---

## Publish flow

During `task:publish`, the fingerprint is included in the POST body sent to the server:

```typescript
// POST /api/projects/{projectUuid}/tasks/{taskUuid}/publish
{
  taskName: string,
  handler: string,
  projectName: string,
  description: string,
  schemaDescriptor: string,       // JSON string
  boundaries: string[],
  sourceCode: string,
  bundleSize: number,
  fingerprint?: TaskFingerprintOutput  // Omitted if analysis failed
}
```

The `fingerprint` field is optional — if the static analysis fails, the publish still proceeds without it.

---

## Full example

Given a task like:

```typescript
export const getPortfolio = createTask(
  new Schema({ userId: schema.string() }),
  {
    getUserById: async (id: string): Promise<User | null> => {
      const user = await db.find(id)
      if (!user) throw new Error('User not found')
      return user
    },
    getPortfolio: async (userId: string): Promise<{ symbol: string, quantity: number, price: number }[]> => {
      return await api.fetchPortfolio(userId)
    }
  },
  async (input, boundaries): Promise<{ user: User, portfolio: Portfolio[] }> => {
    const user = await boundaries.getUserById(input.userId)
    const portfolio = await boundaries.getPortfolio(input.userId)
    return { user, portfolio }
  }
)
```

The fingerprint would be:

```json
{
  "description": null,
  "inputSchema": {
    "type": "object",
    "properties": {
      "userId": { "type": "string" }
    },
    "required": ["userId"]
  },
  "outputType": {
    "type": "object",
    "properties": {
      "user": { "type": "User" },
      "portfolio": {
        "type": "array",
        "elementType": {
          "type": "object",
          "properties": {
            "symbol": { "type": "string" },
            "quantity": { "type": "number" },
            "price": { "type": "number" }
          }
        }
      }
    }
  },
  "boundaries": [
    {
      "name": "getUserById",
      "input": [{ "name": "id", "type": "string" }],
      "output": { "type": "User | null" },
      "errors": [
        {
          "type": "boundary",
          "message": "User not found",
          "location": { "file": "src/tasks/stock/getPortfolio.ts", "line": 8, "column": 19 }
        }
      ]
    },
    {
      "name": "getPortfolio",
      "input": [{ "name": "userId", "type": "string" }],
      "output": {
        "type": "array",
        "elementType": {
          "type": "object",
          "properties": {
            "symbol": { "type": "string" },
            "quantity": { "type": "number" },
            "price": { "type": "number" }
          }
        }
      },
      "errors": []
    }
  ],
  "errors": [],
  "analysisMetadata": {
    "timestamp": "2025-01-18T12:40:18.033Z",
    "filePath": "src/tasks/stock/getPortfolio.ts",
    "success": true,
    "analysisVersion": "1.0.0"
  }
}
```

---

## Limitations

- Analysis is purely static — dynamic schema construction (e.g. schemas built at runtime) will not be captured
- Return type inference works best when the task function has an explicit return type annotation; without one, inference may produce `"unknown"`
- Template literal error messages are extracted as-is including interpolation placeholders (e.g. `` `User ${id} not found` ``)
- The hash only covers task name, input schema, and boundary names — output type changes do not affect the hash
