# Design Document

## Overview

This design enhances the CLI's existing fingerprinting capabilities by migrating from global .forge folder storage to project-local fingerprints folder, standardizing boundary input/output as objects, enhancing error collection during fingerprinting, and integrating fingerprint generation into the publish workflow.

The design builds upon the existing fingerprinting infrastructure in `bundle:fingerprint` and `task:fingerprint` tasks while introducing structured improvements that enhance type safety, error handling, and project organization.

## Architecture

### Fingerprints Folder Structure

The system will introduce a new `fingerprints` folder alongside existing `logs` and `fixtures` folders:

```
project-root/
├── logs/
├── fixtures/
├── fingerprints/          # New folder
│   ├── task-name.json     # Individual task fingerprints
│   ├── bundle-name.json   # Bundle fingerprints
│   └── errors/            # Error-specific fingerprints
└── src/
```

### Boundary Object Structure

All boundaries will be updated to use object-based input/output:

```typescript
// Current boundary pattern
boundary: async (param1: string, param2: number): Promise<string> => { ... }

// New boundary pattern
boundary: async (input: { param1: string; param2: number }): Promise<{ result: string }> => { ... }
```

### Enhanced Fingerprinting with Error Collection

The fingerprinting system will be enhanced to capture and report errors during analysis:

```typescript
interface EnhancedFingerprint {
  taskFingerprint: TaskFingerprintOutput
  errors: FingerprintError[]
  analysisMetadata: {
    timestamp: string
    filePath: string
    success: boolean
  }
}
```

## Components and Interfaces

### 1. Forge Configuration Updates

**File:** `forge.json`

Add fingerprints path configuration:

```json
{
  "paths": {
    "logs": "logs/",
    "fixtures": "fixtures",
    "fingerprints": "fingerprints/",  // New path
    "tasks": "src/tasks/",
    "runners": "src/runners/",
    "tests": "src/tests/"
  }
}
```

### 2. Enhanced Boundary Interface

**File:** `src/types/boundary.ts` (new)

```typescript
// Simple object-based boundary interface for fingerprinting
export type BoundaryFunction<TInput, TOutput> = (
  input: TInput
) => Promise<TOutput>

// Example boundary conversion:
// Before: async (filePath: string): Promise<string>
// After:  async (input: { filePath: string }): Promise<{ content: string }>

export interface BoundarySignature {
  inputType: Record<string, unknown>
  outputType: Record<string, unknown>
}
```

### 3. Enhanced Fingerprint Types

**File:** `src/utils/taskAnalysis.ts` (updated)

```typescript
export interface FingerprintError {
  type: 'parsing' | 'analysis' | 'boundary' | 'schema'
  message: string
  location?: {
    file: string
    line?: number
    column?: number
  }
  details?: Record<string, unknown>
}

export interface EnhancedTaskFingerprintOutput extends TaskFingerprintOutput {
  errors: FingerprintError[]
  analysisMetadata: {
    timestamp: string
    filePath: string
    success: boolean
    analysisVersion: string
  }
}
```

### 4. Migration from .forge to Project Fingerprints Folder

**Current Implementation:** The existing `bundle:fingerprint` task uses:
- `ensureForgeFolder()` - creates `~/.forge` directory
- Saves fingerprints to `~/.forge/{taskName}.fingerprints.json`

**New Implementation:** Update to use project-local storage:
- `ensureFingerprintsFolder()` - creates `{project}/fingerprints` directory
- Save fingerprints to `{project}/fingerprints/{taskName}.fingerprints.json`

**Files to Update:**
- `apps/cli/src/tasks/bundle/fingerprint.ts` - Replace .forge storage with project fingerprints folder
- `apps/cli/src/tasks/task/fingerprint.ts` - Replace .forge storage with project fingerprints folder

## Data Models

### Enhanced Task Fingerprint

```typescript
interface EnhancedTaskFingerprintOutput {
  description?: string
  inputSchema: InputSchema
  outputType: OutputType
  boundaries: BoundaryFingerprint[]  // Enhanced with object structure info
  errors: FingerprintError[]
  analysisMetadata: {
    timestamp: string
    filePath: string
    success: boolean
    analysisVersion: string
  }
}

interface BoundaryFingerprint {
  name: string
  inputType: 'object' | 'legacy'
  outputType: 'object' | 'legacy'
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  errors?: FingerprintError[]
}
```

### Publish Payload Enhancement

```typescript
interface PublishPayload {
  // Existing fields
  taskName: string
  handler: string
  projectName: string
  description: string
  schemaDescriptor: string
  boundaries: string[]
  sourceCode: string
  bundleSize: number
  
  // New fields
  fingerprint: EnhancedTaskFingerprintOutput
  fingerprintVersion: string
}
```

## Error Handling

### Error Collection Strategy

1. **Parsing Errors**: Captured during TypeScript AST analysis
2. **Schema Analysis Errors**: Captured during schema extraction
3. **Boundary Analysis Errors**: Captured during boundary function analysis
4. **File System Errors**: Captured during file operations

### Error Reporting

```typescript
interface ErrorReport {
  taskName: string
  totalErrors: number
  errorsByType: Record<string, number>
  criticalErrors: FingerprintError[]
  warnings: FingerprintError[]
}
```

## Testing Strategy

### Unit Tests

1. **Boundary Object Conversion Tests**
   - Test conversion of existing boundaries to object format
   - Test backward compatibility scenarios
   - Test validation of object structures

2. **Enhanced Fingerprinting Tests**
   - Test error collection during analysis
   - Test fingerprint storage and retrieval
   - Test error aggregation and reporting

3. **Publish Integration Tests**
   - Test fingerprint generation during publish
   - Test payload enhancement with fingerprint data
   - Test error handling in publish workflow

### Integration Tests

1. **End-to-End Fingerprinting**
   - Test complete fingerprinting workflow with error collection
   - Test fingerprint storage in dedicated folder
   - Test fingerprint retrieval and usage

2. **Publish Workflow**
   - Test complete publish workflow with fingerprint generation
   - Test server payload with enhanced fingerprint data
   - Test error scenarios and rollback behavior

### Error Scenario Tests

1. **File Analysis Errors**
   - Test handling of malformed TypeScript files
   - Test handling of missing dependencies
   - Test handling of invalid schema definitions

2. **Boundary Conversion Errors**
   - Test handling of complex boundary signatures
   - Test handling of incompatible boundary types
   - Test graceful degradation for unconvertible boundaries

## Migration Strategy

### Phase 1: Infrastructure Setup
- Add fingerprints folder configuration to forge.json
- Create fingerprint storage service
- Enhance error collection in task analysis

### Phase 2: Boundary Object Conversion
- Update boundary interface definitions
- Convert existing boundaries to object format
- Maintain backward compatibility layer

### Phase 3: Enhanced Fingerprinting
- Integrate error collection into fingerprinting workflow
- Update fingerprint storage to use dedicated folder
- Enhance fingerprint output format

### Phase 4: Publish Integration
- Integrate fingerprint generation into publish task
- Update server payload format
- Add error reporting to publish workflow