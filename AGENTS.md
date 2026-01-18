# AGENTS.md

Guide for agentic coding agents working in this repository.

## Project Structure

Monorepo using pnpm workspaces. Main package:
- `packages/core`: Java code parser and analyzer using tree-sitter

## Build, Lint, and Test Commands

### From repository root:
```bash
# No root-level build commands; work within packages/core
```

### From packages/core directory:

**Run all tests:**
```bash
pnpm test
```

**Run tests in watch mode:**
```bash
pnpm test:watch
```

**Run a single test file:**
```bash
pnpm test extractor.test.ts
```

**Run tests matching a pattern:**
```bash
pnpm test --grep "getImports"
```

**Extract Java project data:**
```bash
pnpm extract                    # Test project
pnpm sshd-core                  # Apache SSHD project
pnpm jsch                       # JSch project
```

**Linting:**
OxLint is configured (.oxlintrc.json is empty, using defaults). Run via IDE integration or build tools.

## Code Style Guidelines

### TypeScript and Formatting
- **TypeScript required**: All code must be TypeScript with strict mode enabled
- **Indentation**: 2 spaces (not tabs)
- **Quotes**: Double quotes for strings
- **Semicolons**: Required at end of statements
- **Line width**: No strict limit, but aim for readability

### Imports
- Use ES modules (`import`/`export`)
- Prefer named imports and exports over default exports
- Order imports: node builtins, external packages, relative paths
- Use `type` keyword for type-only imports: `import type { MyType } from "..."` 
- Imports with side effects should be explicit and clearly commented
- Example:
  ```typescript
  import fs from "node:fs/promises";
  import path from "node:path";
  import { Parser } from "web-tree-sitter";
  import type { FileData, ClassInfo } from "./types";
  import { log } from "./logger";
  ```

### Naming Conventions
- **Functions/Variables**: camelCase
- **Classes/Interfaces**: PascalCase
- **Constants**: CONSTANT_CASE (for compile-time constants)
- **Private members**: Prefix with underscore (e.g., `_privateField`)
- **Booleans**: Start with `is`, `has`, `can`, etc. (e.g., `isDirectory`, `hasContent`)
- **Handler functions**: Prefix with `handle`, `on` (e.g., `handleError`, `onNodeVisit`)

### Types
- **Strict mode enabled**: All code must pass TypeScript strict checks
- **Use interface for object shapes**, type for unions and aliases
- **Explicit return types** on exported functions and complex logic
- **Avoid `any`**: Use unknown, generics, or proper types
- **Use satisfies operator** for type narrowing when appropriate
- Unused locals/parameters are compilation errors - remove or prefix with `_` if intentional

### Error Handling
- Use explicit error handling, don't suppress exceptions
- Log errors with context using the `log` utility (see logger.ts)
- Catch and rethrow with additional context when appropriate
- Example:
  ```typescript
  try {
    const content = await fs.readFile(fullPath, "utf-8");
  } catch (error) {
    log.error(`Error parsing file ${fullPath}:`, error);
    throw error;  // or handle gracefully
  }
  ```

### Nullish Coalescing
- **Prefer nullish coalescing (`??`) over logical OR (`||`)** for default values
- `??` only falls back for `null`/`undefined`, not falsy values
- Example: `value ?? defaultValue` (not `value || defaultValue`)

### TSDoc Comments
- Add TSDoc comments to public functions and complex logic
- **Copilot-generated code**: Include `@author GitHub Copilot` tag
- Use `@param`, `@returns`, `@throws` for documentation
- Example:
  ```typescript
  /**
   * Find the first node of a specific type.
   * @author GitHub Copilot
   * @param node Root node to search from
   * @returns First matching node or null
   */
  export function findFirstNodeOfType(node: Node, type: string): Node | null {
  ```

### Tree-Sitter Usage
- **Prefer `tree.walk()` over `node.descendantsOfType()`** when traversing AST
- Use the provided `walkGenerator` utility for efficient traversal
- Handle both Node and Tree types in functions that accept roots

### Test Structure (Vitest)
- Use `describe`, `it`, `expect` from vitest
- Test file naming: `*.test.ts`
- Clear test names describing behavior
- Use `expect().toEqual()`, `toHaveLength()`, `.not.toBeNull()`, etc.
- Example:
  ```typescript
  describe("extractor", () => {
    it("getImports extracts all imports", async () => {
      const parser = await createJavaParser();
      const imports = getImports(tree.rootNode);
      expect(imports).toHaveLength(3);
    });
  });
  ```

### Logging
- Use the exported `log` utility (from logger.ts)
- Methods: `log.debug()`, `log.info()`, `log.warn()`, `log.error()`
- Logs include ISO timestamp and level prefix
- Pass objects as second parameter: `log.error("message", { key: value })`

## Compiler Options

- **Target**: ES2020
- **Module**: ESNext  
- **Resolution**: bundler
- **Declaration**: Emit .d.ts files
- **Strict mode**: All strict checks enabled
- **No unused locals/parameters**: Enforced
- **No unchecked side effect imports**: Enforced

## Important Conventions

1. **Use `node:` prefix** for Node.js built-in modules (fs, path, etc.)
2. **Async/await**: Preferred over callbacks or promise chains
3. **Tree-sitter parsing**: Java files only; initialized with `createJavaParser()`
4. **Project data format**: JSON with relative file paths as keys (see types.ts)
5. **File operations**: Use `node:fs/promises` for non-blocking I/O

## Configuration Files

- `tsconfig.json`: Strict TypeScript compilation (packages/core/)
- `.oxlintrc.json`: Empty (default linting rules)
- `vite.config.ts`: Build and test configuration
- `.github/copilot-instructions.md`: See this file for Copilot-specific guidelines

## Key Files to Know

- `packages/core/src/types.ts`: Core type definitions
- `packages/core/src/logger.ts`: Centralized logging utility
- `packages/core/src/extractor2.ts`: Main tree-sitter parsing logic
- `packages/core/test/extractor.test.ts`: Test examples
