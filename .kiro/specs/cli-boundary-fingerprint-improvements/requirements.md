# Requirements Document

## Introduction

This feature enhances the CLI's boundary system and fingerprinting capabilities to improve task analysis, error handling, and publishing workflows. The improvements focus on moving fingerprint storage from the global .forge folder to a project-local fingerprints folder, standardizing boundary input/output as objects, collecting file errors during fingerprinting, and integrating fingerprint generation into the publish task workflow.

## Requirements

### Requirement 1

**User Story:** As a CLI user, I want fingerprints to be stored in a dedicated fingerprints folder within my project (similar to logs and fixtures) instead of the global .forge folder, so that fingerprint files are project-specific and easily accessible.

#### Acceptance Criteria

1. WHEN the CLI generates fingerprints THEN the system SHALL store them in a `fingerprints` folder within the project directory instead of the global .forge folder
2. WHEN the fingerprints folder does not exist THEN the system SHALL create it automatically
3. WHEN the forge.json configuration is updated THEN the system SHALL include fingerprints folder configuration alongside logs and fixtures
4. WHEN the bundle:fingerprint task runs THEN the system SHALL save fingerprint files to the project fingerprints folder instead of .forge folder
5. WHEN fingerprint files are created THEN the system SHALL use consistent naming conventions within the fingerprints folder

### Requirement 2

**User Story:** As a CLI developer, I want all boundaries to have their input and output structured as objects, so that the system has consistent data handling and better type safety.

#### Acceptance Criteria

1. WHEN a boundary function is defined THEN the system SHALL require input parameters to be wrapped in an object structure
2. WHEN a boundary function returns data THEN the system SHALL require output to be wrapped in an object structure
3. WHEN existing boundaries are updated THEN the system SHALL maintain backward compatibility during the transition
4. WHEN boundary objects are processed THEN the system SHALL validate the object structure before execution

### Requirement 3

**User Story:** As a CLI user, I want the fingerprint flow to collect and report possible errors in files, so that I can identify and fix issues before task execution.

#### Acceptance Criteria

1. WHEN the fingerprint process analyzes a file THEN the system SHALL capture any parsing or analysis errors encountered
2. WHEN errors are detected during fingerprinting THEN the system SHALL include error details in the main fingerprint output
3. WHEN boundary analysis encounters errors THEN the system SHALL include boundary-specific error information in the fingerprint
4. WHEN multiple files contain errors THEN the system SHALL aggregate all errors in a structured format
5. WHEN no errors are found THEN the system SHALL indicate successful analysis in the fingerprint output

### Requirement 4

**User Story:** As a CLI user, I want the publish task to automatically generate fingerprints and send them to the server, so that task metadata is complete and up-to-date during publishing.

#### Acceptance Criteria

1. WHEN the publish task is executed THEN the system SHALL automatically generate a fingerprint for the task being published
2. WHEN fingerprint generation is complete THEN the system SHALL include the fingerprint data in the server payload
3. WHEN fingerprint generation fails THEN the system SHALL report the error and halt the publish process
4. WHEN the server receives the publish request THEN the system SHALL include both task bundle and fingerprint metadata
5. WHEN fingerprint data is sent to the server THEN the system SHALL include error information if any were collected during analysis