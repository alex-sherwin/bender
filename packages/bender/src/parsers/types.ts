/**
 * Types for parser output following SCIP (SCIP Code Intelligence Protocol) conventions.
 * @author GitHub Copilot
 */

/**
 * Location information for a symbol or occurrence in source code.
 * @author GitHub Copilot
 */
export interface Location {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

/**
 * Represents a symbol definition (class, method, field, variable, etc.).
 * @author GitHub Copilot
 */
export interface ParsedSymbol {
  /** Fully qualified name uniquely identifying the symbol */
  qualifiedName: string;
  /** Simple name of the symbol */
  symbolName: string;
  /** Kind of symbol (class, method, field, local_variable, etc.) */
  kind: string;
  /** Optional signature (for methods, includes parameters and return type) */
  signature?: string;
  /** Optional parent symbol qualified name (for nested symbols) */
  parentSymbolId?: string;
  /** Location in source file */
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

/**
 * Represents a usage/reference of a symbol.
 * @author GitHub Copilot
 */
export interface ParsedOccurrence {
  /** Qualified name of the symbol being referenced */
  symbolQualifiedName: string;
  /** Role of this occurrence (definition, reference, call) */
  role: "definition" | "reference" | "call";
  /** Location in source file */
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

/**
 * Represents a relationship between two symbols.
 * @author GitHub Copilot
 */
export interface ParsedRelationship {
  /** Qualified name of the source symbol */
  fromQualifiedName: string;
  /** Qualified name of the target symbol */
  toQualifiedName: string;
  /** Kind of relationship (extends, implements, calls, contains) */
  kind: "extends" | "implements" | "calls" | "contains";
}

/**
 * Represents documentation attached to a symbol.
 * @author GitHub Copilot
 */
export interface ParsedDocumentation {
  /** Qualified name of the symbol this documentation describes */
  symbolQualifiedName: string;
  /** Type of documentation (javadoc, line_comment, block_comment) */
  docType: "javadoc" | "line_comment" | "block_comment";
  /** Content of the documentation */
  content: string;
  /** Starting line of the documentation */
  startLine: number;
}

/**
 * Complete parse result for a file.
 * @author GitHub Copilot
 */
export interface ParseResult {
  /** All symbols defined in the file */
  symbols: ParsedSymbol[];
  /** All occurrences (definitions and references) */
  occurrences: ParsedOccurrence[];
  /** Relationships between symbols */
  relationships: ParsedRelationship[];
  /** Documentation for symbols */
  documentation: ParsedDocumentation[];
}
