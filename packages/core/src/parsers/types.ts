export interface ParsedFileData {
  file: {
    path: string;
    language: string;
    package?: string;
  };
  symbols: SymbolData[];
  references: ReferenceData[];
  imports: ImportData[];
}

export interface SymbolData {
  kind: string;
  name: string;
  qualified_name: string;
  signature: string;
  location: Location;
  parent?: string; // qualified name of parent symbol
  metadata?: Record<string, any>;
}

export interface ReferenceData {
  from_qualified_name: string; // qualified name
  to_qualified_name?: string; // qualified name if internal, undefined if external
  ref_kind: 'call' | 'field_access' | 'type_reference' | 'import';
  location: Location;
}

export interface ImportData {
  source_package: string; // module/package name
  imported_names: string[]; // imported names, empty for wildcard
  wildcard: boolean;
  location: Location;
}

export interface Location {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface LanguageParser {
  parseFile(filePath: string, content: string): ParsedFileData;
}