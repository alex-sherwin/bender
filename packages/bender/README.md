# Bender

A fast, SCIP-inspired code indexer for Java with powerful querying capabilities. Index your codebase once, query it many times with regex patterns, relationship traversal, and enriched output formats.

## Features

- 🚀 **Fast Java Indexing**: Parse and index Java codebases using tree-sitter
- 🗄️ **SCIP-Inspired Schema**: Clean, normalized SQLite database with 6 tables (snapshots, documents, symbols, occurrences, relationships, documentation)
- 🔍 **Regex Pattern Queries**: Find symbols using regular expressions with type filtering
- 🌳 **Relationship Traversal**: Explore inheritance hierarchies, method calls, and field references
- 📸 **Snapshot Management**: Time-travel through codebase versions with named snapshots
- 📝 **Rich Output**: YAML or JSON output with optional source code snippets and documentation
- ⚡ **Built on Bun**: Leverages Bun's native SQLite for optimal performance

## Installation

### Prerequisites

- [Bun](https://bun.sh) (recommended for best performance)
- Alternatively: Node.js with pnpm

### Install with pnpm

```bash
# From the repository root
pnpm install

# Navigate to bender package
cd packages/bender

# Post-install automatically copies tree-sitter WASM files
```

### Install with bun

```bash
# From the repository root
bun install

# Navigate to bender package
cd packages/bender
```

## Quick Start

### 1. Index Your Java Project

```bash
# Basic indexing
bun run src/cli/index.ts index ./src/my-java-project ./codebase.db

# With custom snapshot name
bun run src/cli/index.ts index ./src ./codebase.db -n "main-branch"

# With description
bun run src/cli/index.ts index ./src ./codebase.db -n "v1.0" -d "Release 1.0"

# Replace existing snapshot
bun run src/cli/index.ts index ./src ./codebase.db -n "main" --replace
```

### 2. Query the Index

```bash
# Find all classes with "User" in the name
bun run src/cli/index.ts query ".*User.*" ./codebase.db --type class

# Find all methods with "save" in the name
bun run src/cli/index.ts query ".*save.*" ./codebase.db --type method

# Get full context with source code and comments
bun run src/cli/index.ts query "UserService" ./codebase.db \
  --sources --comments --source-dir ./src

# Explore relationships (inheritance, calls)
bun run src/cli/index.ts query "UserService" ./codebase.db --radius 2
```

## Command Reference

### `bender index`

Index a source directory and create a snapshot.

```bash
bender index <source-dir> <db-path> [options]
```

**Arguments:**
- `source-dir`: Path to the source directory to index
- `db-path`: Path to SQLite database file (created if doesn't exist)

**Options:**
- `-n, --name <name>`: Snapshot name (default: git branch name or "default")
- `-d, --description <desc>`: Snapshot description
- `--replace`: Replace existing snapshot with the same name
- `--verbose`: Enable verbose logging
- `-v, --verbose`: Enable verbose logging (global flag)

**Examples:**

```bash
# Index with auto-generated snapshot name
bun run src/cli/index.ts index ./src ./project.db

# Named snapshot with description
bun run src/cli/index.ts index ./src ./project.db \
  -n "feature-auth" -d "Authentication feature branch"

# Replace existing snapshot
bun run src/cli/index.ts index ./src ./project.db -n "main" --replace

# Verbose output
bun run src/cli/index.ts index ./src ./project.db --verbose
```

### `bender query`

Query indexed symbols by pattern.

```bash
bender query <pattern> <db-path> [options]
```

**Arguments:**
- `pattern`: Regular expression pattern to match symbol qualified names
- `db-path`: Path to SQLite database file

**Options:**
- `--format <yaml|json>`: Output format (default: yaml)
- `--sources`: Include source code snippets
- `--radius <N>`: Include symbols within N relationship hops
- `--comments`: Include associated Javadoc comments
- `--type <type>`: Filter by symbol type (class|method|field|variable|parameter)
- `--snapshot <name>`: Query specific snapshot (default: latest)
- `--context <N>`: Source context lines (default: 3)
- `--source-dir <dir>`: Source directory (required for --sources flag)
- `--verbose`: Enable verbose logging

**Flag Explanations:**

- `--sources`: Enriches output with actual source code snippets around each occurrence. Requires `--source-dir` to be specified.
- `--radius <N>`: Includes related symbols up to N hops away in the relationship graph (e.g., parent classes, called methods, implemented interfaces).
- `--comments`: Adds Javadoc documentation to each symbol in the output.
- `--type <type>`: Filters results to specific symbol kinds. Useful for narrowing searches to classes, methods, or fields only.
- `--snapshot <name>`: Queries a specific named snapshot instead of the latest. Useful for comparing different versions.
- `--context <N>`: When `--sources` is enabled, controls how many lines of context to show before and after the occurrence (default: 3).

## Query Examples

### Simple Class Search

Find all classes with "Service" in the name:

```bash
bun run src/cli/index.ts query ".*Service.*" ./codebase.db --type class
```

**Output (YAML):**

```yaml
- qualified_name: com.example.calls.UserService
  symbol_name: UserService
  kind: class
  signature: 'public class UserService'
  occurrences:
    - document_path: test/fixtures/sample-java/MethodCalls.java
      role: definition
      location:
        start_line: 6
        start_col: 13
        end_line: 6
        end_col: 24
```

### Method Pattern Search

Find all methods starting with "get":

```bash
bun run src/cli/index.ts query ".*\\.get.*" ./codebase.db --type method
```

### Using --type Filter

Filter to only field symbols:

```bash
bun run src/cli/index.ts query ".*user.*" ./codebase.db --type field
```

This narrows results to fields (class member variables) containing "user" in their qualified name.

### Using --radius for Relationships

Explore inheritance hierarchies and method calls:

```bash
bun run src/cli/index.ts query "Rectangle" ./codebase.db --radius 2
```

**Output includes:**

```yaml
- qualified_name: com.example.inheritance.Rectangle
  kind: class
  relationships:
    - kind: extends
      target_qualified_name: com.example.inheritance.GeometricShape
      target_kind: class
    - kind: implements
      target_qualified_name: com.example.inheritance.Drawable
      target_kind: class
    - kind: calls
      target_qualified_name: java.io.PrintStream.println
      target_kind: method
```

The `--radius` parameter controls how many "hops" to traverse:
- `--radius 1`: Direct relationships only (extends, implements, direct calls)
- `--radius 2`: Includes relationships of related symbols
- `--radius 3+`: Deeper exploration (can be slow on large codebases)

### Using --sources and --comments

Get full context with source code and documentation:

```bash
bun run src/cli/index.ts query "UserService\\.saveUser" ./codebase.db \
  --sources --comments --source-dir ./test/fixtures/sample-java
```

**Output includes:**

```yaml
- qualified_name: com.example.calls.UserService.saveUser
  symbol_name: saveUser
  kind: method
  signature: 'public boolean saveUser(User user)'
  documentation:
    - text: |
        Saves a user to the database.
        @param user The user to save
        @return true if successful
      location:
        start_line: 15
        end_line: 18
  occurrences:
    - role: definition
      location:
        start_line: 20
        start_col: 20
      source_snippet: |
        17: /**
        18:  * Saves a user to the database.
        19:  * @param user The user to save
        20:  * @return true if successful
        21:  */
        22: public boolean saveUser(User user) {
        23:     // Log the operation
        24:     this.logger.info("Saving user: " + user.getName());
```

### Different Output Formats

**YAML (default):**

```bash
bun run src/cli/index.ts query "Calculator" ./codebase.db --format yaml
```

**JSON:**

```bash
bun run src/cli/index.ts query "Calculator" ./codebase.db --format json
```

JSON output is useful for programmatic processing or integration with other tools.

## SCIP Schema Documentation

Bender uses a SCIP-inspired (Source Code Information Protocol) normalized relational schema with 6 tables:

### 1. **snapshots**

Represents a version of the indexed codebase.

```sql
CREATE TABLE snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  description TEXT,
  git_branch TEXT,
  git_commit TEXT,
  is_latest INTEGER NOT NULL DEFAULT 0
);
```

- Multiple snapshots enable time-travel analysis
- Only one snapshot marked as `is_latest = 1` at a time
- Queries default to the latest snapshot

### 2. **documents**

Represents source files in the codebase.

```sql
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  language TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
  UNIQUE(snapshot_id, path)
);
```

- Each document belongs to a snapshot
- `content_hash` enables change detection
- Currently supports `language = 'java'`

### 3. **symbols**

Represents named entities in the code (classes, methods, fields, etc.).

```sql
CREATE TABLE symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  qualified_name TEXT NOT NULL,
  symbol_name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('class', 'method', 'field', 'variable', 'parameter')),
  signature TEXT NOT NULL,
  parent_symbol_id INTEGER,
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  UNIQUE(snapshot_id, qualified_name)
);
```

- **Qualified Name Examples:**
  - Class: `com.example.Calculator`
  - Method: `com.example.Calculator.add`
  - Field: `com.example.Calculator.value`
- `parent_symbol_id` links methods/fields to their containing class

### 4. **occurrences**

Represents locations where symbols appear in source code.

```sql
CREATE TABLE occurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  symbol_id INTEGER NOT NULL,
  document_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('definition', 'reference', 'import')),
  start_line INTEGER NOT NULL,
  start_col INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  end_col INTEGER NOT NULL,
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);
```

- **definition**: Where the symbol is declared
- **reference**: Where the symbol is used
- **import**: Where the symbol is imported
- Line and column numbers are 1-indexed

### 5. **relationships**

Represents connections between symbols.

```sql
CREATE TABLE relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  from_symbol_id INTEGER NOT NULL,
  to_symbol_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('extends', 'implements', 'calls', 'references', 'contains')),
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (from_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  FOREIGN KEY (to_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
);
```

- **extends**: Class inheritance
- **implements**: Interface implementation
- **calls**: Method invocations
- **references**: Field accesses
- **contains**: Parent-child relationships (e.g., class contains method)

### 6. **documentation**

Stores Javadoc comments associated with symbols.

```sql
CREATE TABLE documentation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  symbol_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
);
```

- Stores full Javadoc text including `@param`, `@return`, etc.
- Multiple documentation blocks per symbol are supported

### Data Flow

```
Source Files → Parser (tree-sitter)
                  ↓
         Extract Symbols & Relationships
                  ↓
         Normalize & Store in SQLite
                  ↓
         Query with Regex Patterns
                  ↓
         Enrich with Sources/Comments
                  ↓
         Format as YAML/JSON
```

## Snapshot Management Workflow

Snapshots enable version comparison and time-travel analysis.

### Creating Snapshots

```bash
# Create initial snapshot
bun run src/cli/index.ts index ./src ./project.db -n "initial"

# Make code changes...

# Create new snapshot after changes
bun run src/cli/index.ts index ./src ./project.db -n "after-refactor"
```

### Querying Specific Snapshots

```bash
# Query the latest snapshot (default)
bun run src/cli/index.ts query "UserService" ./project.db

# Query a specific snapshot
bun run src/cli/index.ts query "UserService" ./project.db --snapshot "initial"

# Query another snapshot
bun run src/cli/index.ts query "UserService" ./project.db --snapshot "after-refactor"
```

### Replacing Snapshots

Use `--replace` to update an existing snapshot:

```bash
# Update the "main" snapshot with current code
bun run src/cli/index.ts index ./src ./project.db -n "main" --replace
```

This is useful for continuously updating a snapshot as code evolves on a branch.

### Snapshot Comparison Workflow

```bash
# 1. Index baseline
bun run src/cli/index.ts index ./src ./project.db -n "v1.0"

# 2. Make changes to code

# 3. Index new version
bun run src/cli/index.ts index ./src ./project.db -n "v2.0"

# 4. Compare: Query same pattern in different snapshots
bun run src/cli/index.ts query "UserService" ./project.db \
  --snapshot "v1.0" > v1.yaml

bun run src/cli/index.ts query "UserService" ./project.db \
  --snapshot "v2.0" > v2.yaml

# 5. Diff the outputs
diff v1.yaml v2.yaml
```

## Advanced Usage Tips

### 1. Regex Pattern Tips

- Use `.*` for wildcard matching: `".*Service.*"` matches any symbol with "Service"
- Anchor patterns: `"^com\\.example\\..*"` matches symbols starting with `com.example.`
- Method-specific: `".*\\.save.*"` matches methods with "save" in the name
- Escape dots in package names: `"com\\.example\\.Calculator"`

### 2. Efficient Queries

- Use `--type` to narrow results: `--type method` is faster than searching all symbols
- Start with simple queries before adding `--radius` (relationship traversal can be expensive)
- Use `--snapshot` to compare specific versions without re-indexing

### 3. Integration with CI/CD

```bash
#!/bin/bash
# Example: Index on every commit
git_commit=$(git rev-parse HEAD)
git_branch=$(git branch --show-current)

bun run src/cli/index.ts index ./src ./codebase.db \
  -n "$git_branch" \
  -d "Commit: $git_commit" \
  --replace
```

### 4. Combining Flags

Most flags can be combined for rich output:

```bash
bun run src/cli/index.ts query "UserService" ./codebase.db \
  --type class \
  --sources \
  --comments \
  --radius 2 \
  --format json \
  --source-dir ./src \
  --context 5
```

This gives you:
- Only class symbols
- With source code (5 lines of context)
- With Javadoc comments
- Including related symbols (2 hops)
- In JSON format

### 5. Large Codebases

For very large codebases:
- Index once, query many times (indexing is the slow part)
- Use specific patterns instead of `".*"` to avoid huge result sets
- Limit `--radius` to 1 or 2 to avoid deep traversals
- Consider creating multiple snapshots for different modules

## Troubleshooting

### "Database file does not exist"

**Problem:** Query command can't find the database.

**Solution:**
```bash
# Verify the path is correct
ls -l ./codebase.db

# Re-run index command to create it
bun run src/cli/index.ts index ./src ./codebase.db
```

### "Source directory does not exist" (when using --sources)

**Problem:** The `--source-dir` path is incorrect or missing.

**Solution:**
```bash
# Ensure --source-dir points to the same directory you indexed
bun run src/cli/index.ts query "UserService" ./codebase.db \
  --sources --source-dir ./src
```

### "No symbols found"

**Problem:** Pattern doesn't match any symbols.

**Solution:**
- Check your regex pattern is correct
- Try a broader pattern: `".*"` to see all symbols
- Verify the snapshot contains data: `--verbose` shows symbol counts
- Check symbol type: remove `--type` filter to see all kinds

### "Invalid regular expression pattern"

**Problem:** Regex syntax error.

**Solution:**
- Escape special characters: `\.` for dots, `\*` for asterisks
- Test pattern in a regex tester first
- Common mistake: `"com.example.*"` should be `"com\\.example\\..*"`

### Tree-sitter WASM files missing

**Problem:** `web-tree-sitter.wasm` or `tree-sitter-java.wasm` not found.

**Solution:**
```bash
# Re-run postinstall script
cd packages/bender
pnpm run postinstall

# Or manually copy files
mkdir -p public
cp node_modules/web-tree-sitter/web-tree-sitter.wasm ./public/
cp node_modules/tree-sitter-java/tree-sitter-java.wasm ./public/
```

### Slow queries with --radius

**Problem:** Queries with `--radius 3+` are very slow.

**Solution:**
- Reduce radius to 1 or 2
- Use more specific patterns to reduce initial result set
- Consider indexing only relevant parts of codebase

### Snapshot conflicts

**Problem:** `Snapshot name already exists` error.

**Solution:**
```bash
# Use --replace to update existing snapshot
bun run src/cli/index.ts index ./src ./codebase.db -n "main" --replace

# Or use a different name
bun run src/cli/index.ts index ./src ./codebase.db -n "main-v2"
```

## Development

### Running Tests

```bash
cd packages/bender
bun test
```

### Type Checking

```bash
cd packages/bender
bun run tsc
```

### Linting

Configured with OxLint (default rules). Check your IDE for integration.

## License

See the LICENSE file in the repository root.

## Contributing

This is a monorepo project. See the main repository README for contribution guidelines.
