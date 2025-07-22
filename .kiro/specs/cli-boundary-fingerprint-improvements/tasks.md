# Implementation Plan

- [x] 1. Update forge.json configuration to include fingerprints folder
  - Add fingerprints path to the paths configuration in forge.json
  - Ensure the path follows the same pattern as logs and fixtures
  - Modify apps/cli/src/tasks/bundle/fingerprint.ts to use project fingerprints folder instead of .forge folder
  - _Requirements: 1.3, 1.4_

- [ ] 2. Create project fingerprints folder utilities
  - [x] 2.1 Add ensureFingerprintsFolder boundary to bundle:fingerprint task
    - Replace ensureForgeFolder with ensureFingerprintsFolder function that takes (cwd, conf) as arguments
    - Create fingerprints folder in project directory using forge.json paths config passed as parameter
    - Add error handling for folder creation failures
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Update fingerprint file paths in bundle:fingerprint task
    - Change fingerprintsFile path from .forge folder to project fingerprints folder
    - Update console logging to show correct fingerprint save location
    - Ensure consistent naming conventions for fingerprint files
    - _Requirements: 1.1, 1.5_

- [x] 3. Enhance error collection in task analysis
  - [x] 3.1 Update TaskFingerprintOutput interface to include errors
    - Modify the interface to include FingerprintError array
    - Add analysisMetadata with success status and timestamp
    - Update all references to use the enhanced interface
    - _Requirements: 2.1, 2.4_

  - [x] 3.2 Implement error collection in analyzeTaskFile function
    - Add try-catch blocks around parsing operations
    - Collect TypeScript AST parsing errors
    - Collect schema analysis errors
    - Collect boundary analysis errors
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Create error aggregation and reporting utilities
    - Write function to aggregate errors by type
    - Implement error severity classification
    - Add structured error reporting format
    - _Requirements: 2.4, 2.5_

- [x] 4. Update boundary analysis for object structure detection
  - [x] 4.1 Enhance boundary fingerprinting to detect object patterns
    - Enhanced analyzeBoundariesWithTypes to extract detailed object structures
    - Added detection for input/output object structures with child properties
    - Implemented detailed boundary return type analysis with property tracking
    - _Requirements: 2.1, 2.2_

  - [x] 4.2 Create boundary signature analysis utilities
    - Enhanced analyzeBoundaryReturnType to extract detailed object structures
    - Implemented parseObjectTypeFromString for type pattern parsing
    - Added enhanced variable type tracking for boundary call results
    - Enhanced property access detection (e.g., result1.result)
    - _Requirements: 2.3, 2.4_

- [ ] 5. Update fingerprint tasks to use new storage system
  - [x] 5.1 Modify task:fingerprint to use fingerprints folder
    - Update fingerprint task to use FingerprintStorageService
    - Change output location from .forge to project fingerprints folder
    - Update file naming conventions for consistency
    - _Requirements: 1.1, 1.4, 1.5_

  - [x] 5.2 Modify bundle:fingerprint to use fingerprints folder
    - Update bundle fingerprint task to use new storage system
    - Ensure bundle fingerprints are stored in fingerprints folder
    - Update fingerprint file organization and naming
    - _Requirements: 1.1, 1.4, 1.5_

- [x] 6. Integrate fingerprint generation into publish task
  - [x] 6.1 Add fingerprint generation to publish workflow
    - Imported and integrated bundleFingerprint task into publish workflow
    - Added fingerprint generation step before bundle creation
    - Implemented comprehensive error handling for fingerprint generation failures
    - Added detailed error logging with line/column information display
    - _Requirements: 4.1, 4.3_

  - [x] 6.2 Enhance publish payload with fingerprint data
    - Enhanced publish payload to include complete fingerprint data
    - Added conditional fingerprint inclusion (only when generation succeeds)
    - Integrated fingerprint with existing task metadata in server request
    - Added fingerprint metadata with error counts and runtime error detection
    - _Requirements: 4.2, 4.4, 4.5_

  - [x] 6.3 Add error handling for fingerprint failures in publish
    - Implemented graceful error handling when fingerprint generation fails
    - Added proper warning messages without halting publish process
    - Enhanced return value to include fingerprint generation status
    - Ensured publish continues even if fingerprint generation fails
    - _Requirements: 4.3_

- [ ] 7. Create boundary object conversion utilities
  - [ ] 7.1 Create boundary conversion helper functions
    - Write utilities to convert legacy boundaries to object format
    - Implement validation for object-based boundary signatures
    - Add backward compatibility checking functions
    - _Requirements: 2.1, 2.3, 2.4_

  - [ ] 7.2 Update existing boundaries to use object format
    - Convert key boundaries in fingerprint and publish tasks
    - Update boundary function signatures to use objects
    - Maintain functionality while changing structure
    - _Requirements: 2.1, 2.2_

- [x] 8. Add comprehensive error reporting to fingerprint output
  - [x] 8.1 Enhance fingerprint output format with error details
    - Updated fingerprint file format to include error information
    - Added error summary and detailed error list with FingerprintError type
    - Implemented structured error categorization (parsing, analysis, boundary, schema)
    - Enhanced fingerprint output with analysisMetadata including success status
    - _Requirements: 2.4, 2.5_

  - [x] 8.2 Create error visualization utilities for CLI output
    - Enhanced CLI output to display error counts and success status
    - Implemented error collection and aggregation in analyzeTaskFile
    - Added structured error reporting with location and details
    - _Requirements: 2.5_

- [x] 8.3 Enhanced boundary type analysis for detailed child types
    - Implemented detailed boundary return type parsing from TypeScript annotations
    - Enhanced property access expression analysis (e.g., result1.result)
    - Added support for complex object structure detection in return types
    - Fixed schema analysis to properly detect optional properties with chained methods
    - Enhanced variable type tracking to preserve boundary call result structures
    - _Requirements: 2.1, 2.2_

- [x] 8.4 Implement runtime error collection system
  - [x] 8.4.1 Add main task function error detection
    - Implemented analyzeMainTaskFunctionErrors function to detect throw statements in main task functions
    - Added support for template literal error messages (e.g., `User with ID ${userId} not found`)
    - Integrated main function error collection into task fingerprinting workflow
    - _Requirements: 2.1, 2.3_

  - [x] 8.4.2 Enhance boundary error collection
    - Enhanced boundary error detection to capture throw statements in boundary functions
    - Added support for both string literal and template expression error messages
    - Integrated boundary error collection into boundary fingerprinting
    - _Requirements: 2.1, 2.2_

  - [x] 8.4.3 Improve error formatting and location tracking
    - Added precise line and column position tracking for all errors using TypeScript AST
    - Removed details object from error format for cleaner output
    - Implemented consistent error location format across all error types
    - Fixed error type classification (main function errors as 'analysis', boundary errors as 'boundary')
    - _Requirements: 2.4, 2.5_

  - [x] 8.4.4 Fix error duplication issues
    - Implemented deduplication logic to prevent same createTask node from being processed twice
    - Removed duplicate backward compatibility function causing error duplication
    - Added processedNodes tracking to prevent duplicate error collection
    - _Requirements: 2.3, 2.4_

  - [x] 8.4.5 Update fingerprint specification documentation
    - Updated fingerprint.md with comprehensive error collection documentation
    - Added detailed error type explanations and examples
    - Updated core interfaces to reflect new error collection structure
    - Documented location tracking and error categorization features
    - _Requirements: 2.5_

- [x] 8.5 Refactor publish integration and code quality improvements
  - [x] 8.5.1 Integrate fingerprint generation into publish workflow
    - Refactored publish task to use file-based fingerprint approach
    - Added fingerprint generation after bundle and zip steps
    - Implemented readFingerprintFile boundary for clean separation of concerns
    - Added proper error handling with graceful fallback when fingerprint generation fails
    - Enhanced return value to include simple boolean fingerprint success indicator
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 8.5.2 Fix TypeScript and ESLint issues across fingerprint system
    - Replaced all `any` types with proper TypeScript interfaces throughout codebase
    - Fixed unused variable warnings by prefixing with underscore or removing unused functions
    - Moved inner function declarations to top-level to comply with linting rules
    - Enhanced type safety for boundary type analysis and variable type inference
    - Added proper error handling with specific types for axios errors and unknown errors
    - Updated function signatures to use proper return types and parameter types
    - _Requirements: 2.5, code quality_

  - [x] 8.5.3 Update task documentation and specification
    - Updated fingerprint.md implementation checklist to reflect completed publish integration
    - Added publish integration section to mark completed features
    - Updated tasks.md to document all refactoring and code quality improvements
    - Documented file-based fingerprint approach and clean boundary separation
    - _Requirements: 2.5_

- [ ] 9. Update configuration loading to support fingerprints path
  - [x] 9.1 Modify conf:load task to include fingerprints path
    - Update configuration loading to read fingerprints path
    - Add validation for fingerprints path configuration
    - Ensure default path is provided if not configured
    - _Requirements: 1.3_

  - [x] 9.2 Add fingerprints path to configuration info display
    - Updated conf:info task to display comprehensive fingerprints path information
    - Added fingerprints folder status validation (configured, exists, isDirectory)
    - Implemented path checking boundary to validate folder accessibility
    - Enhanced info display with both relative and absolute path information
    - Added graceful error handling for missing or invalid forge.json configuration
    - _Requirements: 1.3_

- [ ] 10. Create integration tests for enhanced fingerprinting workflow
  - [ ] 10.1 Write tests for fingerprint storage service
    - Test fingerprint saving and loading functionality
    - Test folder creation and error handling
    - Test fingerprint file naming and organization
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [ ] 10.2 Write tests for error collection during fingerprinting
    - Test error capture during file analysis
    - Test error aggregation and reporting
    - Test fingerprint generation with various error scenarios
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 10.3 Write tests for publish workflow with fingerprints
    - Test fingerprint generation during publish
    - Test publish payload enhancement with fingerprint data
    - Test error handling and publish failure scenarios
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_