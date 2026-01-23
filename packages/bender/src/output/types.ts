/**
 * Output data structures for formatted query results
 * @author GitHub Copilot
 */

/**
 * Occurrence of a symbol in a file
 */
export interface OutputOccurrence {
  role: "definition" | "reference" | "import";
  file: string;
  line: number;
  column: number;
}

/**
 * Relationship to another symbol
 */
export interface OutputRelationship {
  symbol: string;
  kind: "extends" | "implements" | "calls" | "references" | "contains";
  distance: number;
}

/**
 * Documentation entry for a symbol
 */
export interface OutputDocumentation {
  type: "javadoc" | "inline" | "block";
  content: string;
}

/**
 * Source code snippet
 */
export interface OutputSource {
  file: string;
  startLine: number;
  endLine: number;
  code: string;
}

/**
 * Formatted symbol output with optional enrichments
 */
export interface OutputSymbol {
  qualifiedName: string;
  symbolName: string;
  kind: "class" | "method" | "field" | "variable" | "parameter";
  signature?: string;
  line?: number;
  file?: string;
  occurrences?: OutputOccurrence[];
  relationships?: OutputRelationship[];
  documentation?: OutputDocumentation[];
  source?: OutputSource;
}

/**
 * Complete query output
 */
export interface QueryOutput {
  symbols: OutputSymbol[];
  totalMatches: number;
}

/**
 * Options for building query output
 */
export interface OutputOptions {
  includeOccurrences?: boolean;
  includeRelationships?: boolean;
  radius?: number;
  includeDocumentation?: boolean;
  includeSources?: boolean;
  contextLines?: number;
}
