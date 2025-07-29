# Maintaining the LLM Task Guide

This document explains how to keep the `llm.md` guide up-to-date for future releases.

## When to Update

Update the LLM guide when:

1. **Package versions change** - CLI or task package versions are bumped
2. **CLI commands change** - Task creation, running, or management commands are modified
3. **Task template changes** - The generated task template structure is updated
4. **API changes** - Task creation API or boundaries pattern changes
5. **New features** - New task management features are added

## Update Process

### 1. Version Management

**Update the guide version in the title:**
```markdown
# LLM Guide: ForgeHive Task Management (v1)
```

**Update package versions:**
1. Check current versions:
   ```bash
   cat apps/cli/package.json | grep '"version"'
   cat packages/task/package.json | grep '"version"'
   ```

2. Update the version section:
   ```markdown
   **Package Versions:**
   - `@forgehive/forge-cli`: v0.x.x
   - `@forgehive/task`: v0.x.x
   ```

### 2. CLI Command Updates

**Check for changes in task creation:**
1. Review `apps/cli/src/tasks/task/createTask.ts`
2. Look for changes in:
   - Command syntax
   - Template structure (TASK_TEMPLATE constant)
   - File naming conventions
   - Configuration updates

**Update the guide if needed:**
- Command examples in "Basic Task Creation" section
- Generated template code block
- File structure explanations

### 3. Template Structure Changes

**Monitor the TASK_TEMPLATE constant in `createTask.ts`:**
```typescript
const TASK_TEMPLATE = `// TASK: {{ taskName }}
// Run this task with:
// forge task:run {{ taskDescriptor }}

import { createTask } from '@forgehive/task'
// ... rest of template
```

**Update guide sections:**
- Show the current generated template
- Update example modifications
- Ensure consistency with actual CLI output

### 4. API Changes

**Check for changes in:**
1. `@forgehive/task` package API
2. Schema definition patterns
3. Boundary function signatures
4. Task execution methods

**Key files to monitor:**
- `packages/task/src/index.ts`
- `packages/task/src/createTask.ts`
- `packages/schema/src/index.ts`

### 5. Testing Updates

**Verify examples work:**
1. Run CLI commands from the guide:
   ```bash
   forge task:create user:testTask
   ```

2. Check generated files match documentation

3. Test task execution examples

## Maintenance Checklist

### Before Each Release

- [ ] Check package versions in `package.json` files
- [ ] Review CLI command implementations
- [ ] Test task creation process
- [ ] Verify generated templates match documentation
- [ ] Update version number in guide title
- [ ] Update package version numbers
- [ ] Test all code examples
- [ ] Check for new CLI features or commands

### After Breaking Changes

- [ ] Update API examples
- [ ] Review boundary patterns
- [ ] Check schema usage examples
- [ ] Update best practices section
- [ ] Add migration notes if needed

### Documentation Standards

**Keep these principles:**
1. **CLI-first approach** - Always show CLI commands before manual coding
2. **Real templates** - Use actual generated templates, not idealized examples
3. **Version tracking** - Always include package versions
4. **Complete examples** - Show full task implementations
5. **Best practices** - Include testing and boundary isolation guidance

## File Locations

**Key files to monitor:**
```
apps/cli/package.json                    # CLI version
packages/task/package.json               # Task package version
apps/cli/src/tasks/task/createTask.ts    # Task creation logic & template
docs/llm.md                              # The guide itself
docs/llm-guide-maintenance.md           # This maintenance guide
```

## Automation Ideas

**Future improvements:**
1. Script to check version mismatches
2. Automated template extraction from CLI code
3. Integration tests for documentation examples
4. Version bump hooks to update documentation

## Communication

**When updating:**
1. Document changes in commit messages
2. Note breaking changes in release notes
3. Update team on significant changes
4. Consider backward compatibility impact

This ensures the LLM guide remains accurate and helpful for future development work.