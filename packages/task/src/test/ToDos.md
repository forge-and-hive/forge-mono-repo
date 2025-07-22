# Test Refactoring ToDos

This document outlines the planned refactoring tasks for improving test organization across the ForgeHive monorepo.

## Phase 1: Standardization

### 1. Directory Structure Standardization
- [ ] Rename `packages/record-tape/src/tests/` to `packages/record-tape/src/test/`
- [ ] Verify all other packages use consistent `src/test/` structure

### 2. File Naming Convention Standardization
- [ ] Rename camelCase test files in `packages/hive-sdk/src/test/` to kebab-case:
  - [ ] `setQuality.test.ts` → `set-quality.test.ts`
  - [ ] `getLog.test.ts` → `get-log.test.ts`
  - [ ] `sendLog.test.ts` → `send-log.test.ts`
  - [ ] `invoke.test.ts` → `invoke.test.ts` (already correct)
  - [ ] `index.test.ts` → `index.test.ts` (already correct)
- [ ] Review and standardize mixed naming in `apps/sample-project/src/test/`

### 3. Jest Configuration Standardization
- [ ] Update `testMatch` patterns to use consistent `'**/test/**/*.test.ts'` across all packages:
  - [ ] `packages/record-tape/jest.config.js`
  - [ ] `apps/cli/jest.config.js`
  - [ ] Verify other packages follow the pattern

## Phase 2: Organization Improvements

### 4. Feature-Based Test Organization for Large Packages
- [ ] Reorganize `packages/task/src/test/` (22 files) into feature groups:
  - [ ] Create `boundaries/` subdirectory and move boundary-related tests
  - [ ] Create `execution/` subdirectory and move execution-related tests
  - [ ] Create `performance/` subdirectory and move performance tests
  - [ ] Create `validation/` subdirectory and move validation tests

### 5. Test Utility Consolidation
- [ ] Create shared `@forgehive/test-utils` package
- [ ] Extract common boundary mocking utilities from packages
- [ ] Standardize `testUtils.ts` patterns across apps
- [ ] Update imports across all test files

### 6. Integration Test Structure
- [ ] Create `src/test/integration/` directories where needed
- [ ] Separate complex workflow tests from unit tests
- [ ] Add integration tests for missing cross-package scenarios

## Phase 3: Enhanced Test Coverage

### 7. Test Gap Analysis
- [ ] Identify packages with insufficient integration tests
- [ ] Add missing test coverage for complex workflows
- [ ] Ensure boundary interactions are properly tested

### 8. Test Documentation
- [ ] Add README.md in test directories explaining test organization
- [ ] Document test utility usage patterns
- [ ] Create testing guidelines for contributors

## Implementation Notes

### Priority Order
1. **High Priority**: Standardization tasks (Phase 1) - these fix immediate inconsistencies
2. **Medium Priority**: Organization improvements (Phase 2) - these improve maintainability
3. **Low Priority**: Enhanced coverage (Phase 3) - these add value over time

### Dependencies
- Jest configuration changes should be tested to ensure no tests are broken
- File renames should be done with git mv to preserve history
- Shared test utilities package should be created before extracting utilities

### Risk Mitigation
- Run full test suite after each phase
- Update CI/CD configurations if test paths change
- Coordinate with team on naming convention decisions

## Current State Summary
- **Total test files**: 45 across 7 packages/apps
- **Largest test suite**: packages/task (22 files)
- **Main inconsistencies**: Directory naming, file naming, Jest config
- **Strengths to preserve**: Co-location, comprehensive coverage, boundary mocking utilities