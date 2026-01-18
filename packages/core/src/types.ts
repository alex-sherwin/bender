export interface Type {
  name: string;
  package?: string;
}

export interface JavaMethod {
  name: string;
  signature: string;
  static: boolean;
  returnType: string;
  typeReferences: Type[];
  comment?: string;
}

export interface JavaField {
  name: string;
  type: Type;
  signature: string;
  static: boolean;
}

export interface ClassInfo {
  name: string;
  fields: JavaField[];
  methods: JavaMethod[];
  type: "class" | "interface";
  comment: string | null;
}

export interface Import {
  wildcard: boolean;
  pkg: string;
  type: string;
}

export interface FileData {
  filePath: string;
  filename: string;
  pkg: string | null;
  imports: Import[];
  definedClasses: ClassInfo[];
}

export type ProjectData = Record<string, FileData>;

// TypeScript-specific types
export interface TypeScriptParameter {
  name: string;
  type: string;
  optional: boolean;
}

export interface TypeScriptFunction {
  name: string;
  signature: string;
  returnType: string;
  parameters: TypeScriptParameter[];
  comment?: string;
}

export interface TypeScriptInterfaceMember {
  name: string;
  type: string;
  optional: boolean;
  comment?: string;
}

export interface TypeScriptInterface {
  name: string;
  members: TypeScriptInterfaceMember[];
  comment?: string;
}

export interface TypeScriptType {
  name: string;
  members: TypeScriptInterfaceMember[];
  comment?: string;
}

export interface TypeScriptClass {
  name: string;
  methods: TypeScriptFunction[];
  properties: TypeScriptInterfaceMember[];
  comment?: string;
}

export interface TypeScriptFileData {
  filePath: string;
  filename: string;
  interfaces: TypeScriptInterface[];
  types: TypeScriptType[];
  classes: TypeScriptClass[];
  functions: TypeScriptFunction[];
  imports: Import[];
}

// JSX/TSX-specific types
export interface JsxAttribute {
  name: string;
  value?: string;
}

export interface JsxElement {
  tag: string;
  attributes: JsxAttribute[];
  children: (JsxElement | string)[];
  selfClosing: boolean;
  text: string;
}


// New types for the unified parser architecture

export interface SymbolData {
  id?: string;
  kind: string;
  name: string;
  qualifiedName: string;
  signature?: string;
  location: {
    file: string;
    line: number;
    column: number;
  };
  parentId?: string;
  metadata?: Record<string, any>;
}

export interface ReferenceData {
  fromSymbolId?: string;
  toQualifiedName: string;
  toSymbolId?: string;
  refKind: 'call' | 'field_access' | 'type_reference' | 'import';
  location: {
    file: string;
    line: number;
    column: number;
  };
}

export interface ImportData {
  source: string;
  wildcard: boolean;
  importedNames?: string[];
}

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

export interface LanguageParser {
  parseFile(filePath: string, content: string): ParsedFileData;
}