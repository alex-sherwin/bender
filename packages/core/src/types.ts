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


