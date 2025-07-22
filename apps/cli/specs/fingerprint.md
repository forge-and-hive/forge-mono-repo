# Task Fingerprinting System Specification

## Overview

This specification describes a build-time code generation system that extracts comprehensive type information ("fingerprints") from TypeScript tasks during the esbuild bundling process. The system provides complete introspection capabilities for tasks created with the `@forgehive/task` library.

## Problem Statement

Currently, TypeScript task functions created with `createTask` have limited runtime introspection capabilities. We need a way to:

1. Extract complete type information about task inputs, outputs, and boundaries
2. Generate comprehensive task fingerprints during build time
3. Provide zero-runtime-overhead type introspection
4. Enable tooling, documentation generation, and runtime validation
5. Detect changes in task interfaces through hash-based fingerprinting

## Architecture

### Core Components

1. **esbuild Plugin**: `taskFingerprintPlugin` - Analyzes TypeScript AST during bundling
2. **Type Extractor**: Processes `createTask` calls and extracts type information
3. **Fingerprint Generator**: Creates comprehensive task metadata
4. **Bundle Task**: Enhanced version of existing bundle creation with fingerprinting

### Data Flow

```
TypeScript Source Files
    ↓
esbuild Plugin (AST Analysis)
    ↓
Task Discovery & Type Extraction
    ↓
Fingerprint Generation
    ↓
JSON Output + Bundle Creation
```

## Technical Requirements

### Dependencies

```typescript
import * as esbuild from 'esbuild'
import * as ts from 'typescript'
import * as fs from 'fs'
import * as path from 'path'
```

### Core Interfaces

#### TaskFingerprint
```typescript
interface TaskFingerprint {
  name: string
  description?: string
  location: {
    file: string
    line: number
    column: number
  }
  inputSchema: {
    type: string
    properties: Record<string, any>
  }
  outputType: {
    type: string
    properties?: Record<string, any>
    elementType?: OutputType
  }
  boundaries: BoundaryFingerprint[]
  hash: string
}

interface BoundaryFingerprint {
  name: string
  input: SchemaProperty[]
  output: OutputType
  errors: FingerprintError[]
}

interface OutputType {
  type: string
  properties?: Record<string, SchemaProperty>
  elementType?: OutputType
}

interface FingerprintError {
  type: 'parsing' | 'analysis' | 'boundary' | 'schema'
  message: string
  location?: {
    file: string
    line?: number
    column?: number
  }
}

interface SchemaProperty {
  name?: string
  type: string
  optional?: boolean
  default?: string
  properties?: Record<string, SchemaProperty>
}
```

#### TaskFingerprintOutput
```typescript
interface TaskFingerprintOutput {
  description?: string
  inputSchema: InputSchema
  outputType: OutputType
  boundaries: BoundaryFingerprint[]
  errors: FingerprintError[]
  analysisMetadata: {
    timestamp: string
    filePath: string
    success: boolean
    analysisVersion: string
  }
}

interface FingerprintResult {
  tasks: TaskFingerprintOutput[]
  buildInfo: {
    entryPoint: string
    outputFile: string
    fingerprintsFile?: string
    totalTasks: number
    buildTimestamp: string
  }
}
```

## Implementation Specification

### 1. esbuild Plugin (`taskFingerprintPlugin`)

**Purpose**: Integrate TypeScript AST analysis into the esbuild bundling process

**Key Functions**:
- `onLoad`: Analyze `.ts` files for `createTask` calls
- `onEnd`: Generate and write fingerprint JSON file
- Handle TypeScript compiler integration
- Extract comprehensive type information

**Configuration**:
```typescript
interface PluginOptions {
  tsConfigPath: string      // Path to tsconfig.json
  outputPath?: string       // Output file for fingerprints
}
```

### 2. Task Discovery Algorithm

**Detection Pattern**: Look for these patterns in TypeScript AST:
```typescript
// Direct calls
createTask(schema, boundaries, fn)

// Exported assignments
export const taskName = createTask(schema, boundaries, fn)
```

**AST Node Types to Process**:
- `ts.CallExpression` with identifier "createTask"
- `ts.VariableStatement` with exported createTask assignments

### 3. Type Extraction Specifications

#### Schema Analysis
- Detect `new Schema({ ... })` patterns
- Extract property definitions and types
- Handle Schema methods: `.string()`, `.number()`, `.boolean()`, `.optional()`, `.default()`
- Generate JSON Schema-compatible output

#### Boundary Analysis
- Extract function signatures from boundary object as detailed objects
- Parse parameter types into structured SchemaProperty arrays
- Parse return types with support for complex object structures  
- Handle async functions and Promise return types
- Collect runtime errors from throw statements in boundary functions
- Each boundary becomes a BoundaryFingerprint with name, input, output, and errors

#### Return Type Analysis
- Extract TypeScript return type annotations
- Parse Promise wrapper types
- Infer types from return statements when annotations missing
- Handle complex object return types
- Support for array element type detection with `elementType` property

#### Array Element Type Detection
The system now provides enhanced array type analysis:

**TypeScript Annotation Parsing**: 
```typescript
// Boundary function with array return type
getPortfolio: async (userUUID: string): Promise<{ symbol: string, quantity: number, price: number }[]>
```

**Generated Fingerprint**:
```json
{
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
```

**Supported Array Patterns**:
- `T[]` format: `{ symbol: string, quantity: number }[]`
- `Array<T>` format: `Array<{ symbol: string, quantity: number }>`
- Complex nested objects within arrays
- Propagation from boundary types to task output types

#### Error Collection
- **Boundary Errors**: Detect `throw` statements in boundary functions
- **Main Function Errors**: Detect `throw` statements in the main task function
- **Parsing Errors**: Capture TypeScript AST parsing failures
- **Schema Errors**: Capture schema analysis failures
- **Location Tracking**: Include precise line and column information for each error
- **Error Types**: Categorize errors as 'parsing', 'analysis', 'boundary', or 'schema'

### 4. Hash Generation Algorithm

```typescript
function generateHash(input: string): string {
  // Simple hash function for change detection
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}
```

**Hash Input**: Combination of task name, function source, and input schema

## Task Configuration Schema

### Enhanced Bundle Task Schema
```typescript
const schema = new Schema({
  entryPoint: Schema.string(),
  outputFile: Schema.string(),
  generateFingerprints: Schema.boolean().optional().default(true),
  fingerprintsOutputFile: Schema.string().optional(),
  tsConfigPath: Schema.string().optional().default('tsconfig.json')
})
```

### Boundaries
```typescript
const boundaries = {
  readFile: async (filePath: string): Promise<string> => { /* fs.readFile */ },
  writeFile: async (filePath: string, content: string): Promise<void> => { /* fs.writeFile */ },
  findTsFiles: async (dir: string): Promise<string[]> => { /* glob search */ }
}
```

## Output Specifications

### Generated Fingerprint File Structure

```json
{
  "taskFingerprint": {
    "description": "Test task with intentional runtime errors for error collection testing",
    "inputSchema": {
      "type": "object",
      "properties": {
        "userId": { "type": "string" }
      }
    },
    "outputType": {
      "type": "object",
      "properties": {
        "user": { "type": "object" },
        "profile": { "type": "string" },
        "lastLogin": { "type": "string" },
        "processed": { "type": "boolean" },
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
        "input": [
          {
            "type": "object",
            "properties": {
              "userId": { "type": "string" }
            },
            "name": "input"
          }
        ],
        "output": { "type": "User | null" },
        "errors": []
      },
      {
        "name": "getPortfolio",
        "input": [
          {
            "type": "string",
            "name": "userUUID"
          }
        ],
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
        "errors": [
          {
            "type": "boundary",
            "message": "Boundary function throws: User not found",
            "location": {
              "file": "/path/to/tasks/stock/getPortfolio.ts",
              "line": 19,
              "column": 7
            }
          }
        ]
      },
      {
        "name": "fetchUserProfile", 
        "input": [
          {
            "type": "object",
            "properties": {
              "userId": { "type": "string" }
            },
            "name": "input"
          }
        ],
        "output": {
          "type": "object",
          "properties": {
            "profile": { "type": "string" },
            "lastLogin": { "type": "string" }
          }
        },
        "errors": [
          {
            "type": "boundary",
            "message": "Boundary function throws: API temporarily unavailable",
            "location": {
              "file": "/path/to/tasks/test/errors.ts",
              "line": 40,
              "column": 7
            }
          },
          {
            "type": "boundary", 
            "message": "Boundary function throws: External API authentication failed",
            "location": {
              "file": "/path/to/tasks/test/errors.ts",
              "line": 44,
              "column": 7
            }
          }
        ]
      }
    ],
    "errors": [
      {
        "type": "analysis",
        "message": "Main task function throws: User with ID ${userId} not found",
        "location": {
          "file": "/path/to/tasks/test/errors.ts",
          "line": 65,
          "column": 7
        }
      }
    ],
    "analysisMetadata": {
      "timestamp": "2025-01-18T12:40:18.033Z",
      "filePath": "/path/to/tasks/test/errors.ts",
      "success": true,
      "analysisVersion": "1.0.0"
    }
  }
}
```

### Task Return Value
```typescript
{
  outputFile: string,
  fingerprintsFile?: string,
  errors: number,
  warnings: number,
  taskFingerprints?: {
    totalTasks: number,
    tasks: Array<{
      name: string,
      inputType: string,
      outputType: string,
      boundaryCount: number,
      hash: string
    }>
  }
}
```

## Usage Patterns

### CLI Integration
```bash
# Generate bundle with fingerprints
shadow-cli bundle:createWithFingerprints \
  --entryPoint src/index.ts \
  --outputFile dist/bundle.js

# Custom fingerprints location
shadow-cli bundle:createWithFingerprints \
  --entryPoint src/index.ts \
  --outputFile dist/bundle.js \
  --fingerprintsOutputFile dist/task-types.json

# Disable fingerprints
shadow-cli bundle:createWithFingerprints \
  --entryPoint src/index.ts \
  --outputFile dist/bundle.js \
  --generateFingerprints false
```

### Programmatic Usage
```typescript
import { createWithFingerprints } from './create-with-fingerprints'

const result = await createWithFingerprints.run({
  entryPoint: 'src/index.ts',
  outputFile: 'dist/bundle.js',
  generateFingerprints: true
})

console.log(`Generated ${result.taskFingerprints?.totalTasks} task fingerprints`)
```

## Error Handling

### Runtime Error Collection
The fingerprinting system now collects runtime errors from task code:

#### Error Types Collected
1. **Boundary Errors** (`type: "boundary"`): Thrown errors in boundary functions
   - Detects `throw new Error(...)` statements in boundary function bodies
   - Captures error messages from string literals and template expressions
   - Includes precise line and column location information

2. **Main Function Errors** (`type: "analysis"`): Thrown errors in main task functions  
   - Detects `throw new Error(...)` statements in the main task function
   - Supports template literal error messages like `\`User with ID ${userId} not found\``
   - Provides exact source code location

3. **Parsing Errors** (`type: "parsing"`): TypeScript AST parsing failures
   - Occurs when TypeScript compiler cannot parse source code
   - Includes error stack traces and detailed error information

4. **Schema Errors** (`type: "schema"`): Schema analysis failures
   - Captures errors during Schema object analysis
   - Reports issues with malformed schema definitions

#### Error Location Tracking
All errors include detailed location information:
```typescript
{
  type: "analysis",
  message: "Main task function throws: User with ID ${userId} not found", 
  location: {
    file: "/path/to/task/file.ts",
    line: 65,      // 1-based line number
    column: 7      // 1-based column number
  }
}
```

### Plugin Error Scenarios
1. **TypeScript Parsing Errors**: Log warning, continue processing other files
2. **Invalid createTask Calls**: Skip malformed calls, log warnings
3. **File System Errors**: Fail gracefully, provide meaningful error messages
4. **TypeScript Compiler Issues**: Use fallback type extraction methods

### Graceful Degradation
- If TypeScript analysis fails, include raw source code snippets
- Provide partial fingerprints when complete type information unavailable
- Continue build process even if fingerprint generation fails
- Error collection continues even when main analysis partially fails

## Performance Considerations

### Optimization Strategies
1. **File Filtering**: Only analyze files containing "createTask"
2. **Caching**: Avoid re-processing identical files
3. **Lazy Loading**: Import TypeScript compiler only when needed
4. **Parallel Processing**: Process multiple files concurrently where possible

### Memory Management
- Limit function source code storage (truncate long functions)
- Clean up TypeScript compiler instances after use
- Stream large file operations when possible

## Testing Strategy

### Unit Tests Required
1. **AST Parsing**: Test extraction from various createTask patterns
2. **Type Analysis**: Verify schema, boundary, and return type extraction
3. **Hash Generation**: Ensure consistent hash generation
4. **Plugin Integration**: Test esbuild plugin lifecycle

### Integration Tests
1. **End-to-End**: Full bundle creation with fingerprint generation
2. **Real Projects**: Test against actual task codebases
3. **Error Scenarios**: Verify graceful handling of malformed code

### Test Data Requirements
```typescript
// Sample task for testing
export const testTask = createTask(
  new Schema({
    input: Schema.string(),
    count: Schema.number().optional()
  }),
  {
    apiCall: async (data: string): Promise<{ result: number }> => ({ result: 42 })
  },
  async function ({ input, count }, { apiCall }): Promise<{ output: string }> {
    const { result } = await apiCall(input)
    return { output: `${input}-${result}` }
  }
)
```

## Future Enhancements

### Planned Features
1. **Watch Mode**: Incremental fingerprint updates during development
2. **Validation**: Runtime validation using generated fingerprints
3. **Documentation**: Auto-generate API docs from fingerprints
4. **IDE Integration**: TypeScript language service plugin
5. **Diff Detection**: Compare fingerprints across versions

### Extension Points
1. **Custom Extractors**: Plugin system for custom type extraction
2. **Output Formats**: Support for different output formats (YAML, XML)
3. **Integration Hooks**: Webhooks for fingerprint updates
4. **Analysis Tools**: CLI tools for fingerprint analysis and comparison

## Implementation Checklist

### Core Fingerprinting System
- [x] Implement `taskFingerprintPlugin` esbuild plugin
- [x] Create TypeScript AST analysis functions
- [x] Implement schema extraction logic
- [x] Implement boundary analysis logic
- [x] Implement return type extraction
- [x] Create hash generation function
- [x] Implement enhanced bundle task
- [x] Create CLI integration

### Enhanced Boundary Analysis
- [x] Convert boundaries from string arrays to detailed objects
- [x] Implement detailed boundary input/output type analysis
- [x] Add support for complex object structure detection
- [x] Enhance property access expression analysis (e.g., result1.result)
- [x] Add schema optional property detection with chained methods
- [x] Implement array element type detection with `elementType` support
- [x] Add support for complex array-of-objects type patterns
- [x] Enable type propagation from boundary arrays to task output arrays

### Runtime Error Collection System
- [x] Implement boundary error detection (throw statements in boundary functions)
- [x] Implement main task function error detection (throw statements in main function)
- [x] Add support for template literal error messages
- [x] Implement precise error location tracking (line and column numbers)
- [x] Create structured error categorization (parsing, analysis, boundary, schema)
- [x] Fix error duplication issues with deduplication logic
- [x] Clean up error format (remove details object, consistent location format)

### Error Handling and Metadata
- [x] Add comprehensive error handling and logging
- [x] Implement TaskFingerprintOutput interface with errors and metadata
- [x] Add analysisMetadata with timestamp, success status, and version
- [x] Implement graceful degradation for partial analysis failures

### Storage and Configuration
- [x] Update fingerprint storage to use project fingerprints folder
- [x] Add fingerprints path configuration support
- [x] Implement ensureFingerprintsFolder boundary
- [x] Update file naming conventions for consistency

### Documentation and Specification
- [x] Generate comprehensive specification documentation
- [x] Update core interfaces to reflect enhanced structure
- [x] Document error collection features and examples
- [x] Add implementation plan documentation

### Testing and Integration
- [ ] Write comprehensive unit tests for error collection
- [ ] Write integration tests for enhanced fingerprinting workflow
- [ ] Test error scenarios and edge cases
- [ ] Performance testing and optimization
- [ ] Add configuration validation tests

### Publish Integration
- [x] Integrate fingerprint generation into publish workflow
- [x] Add fingerprint data to publish payload
- [x] Implement error handling for fingerprint failures in publish
- [x] Add fingerprint status reporting in publish results

### Future Enhancements (Planned)
- [ ] Implement watch mode for incremental updates
- [ ] Create fingerprint comparison and diff tools
- [ ] Add IDE integration and language service plugin
- [ ] Add fingerprint validation and consistency checks

This specification provides a complete blueprint for implementing a sophisticated task fingerprinting system that operates at build time and provides comprehensive type introspection capabilities for TypeScript tasks.