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
  comment?: string;
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
