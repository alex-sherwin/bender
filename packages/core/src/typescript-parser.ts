import { Parser, Language, Node, Tree } from 'web-tree-sitter';

import { log } from "./logger";

import type { TypeScriptFunction, TypeScriptInterface, TypeScriptType, TypeScriptClass, TypeScriptParameter, TypeScriptInterfaceMember, TypeScriptFileData, Import } from './types';

/**
 * Find the first node of a specific type in the syntax tree.
 * 
 * @param target The root node or tree to start searching from
 * @param type The node type to search for
 * @returns The first node of the specified type, or null if not found
 */
export function findFirstNodeOfType(target: Node | Tree | null | undefined, type: string): Node | null {
  if (!target) {
    return null;
  }

  const node = target instanceof Tree ? target.rootNode as Node : target;

  if (node.type === type) {
    return node;
  }

  const results = node.descendantsOfType(type);

  return results[0] ?? null;
}

/**
 * Find the last node of a specific type in the syntax tree.
 * 
 * @param target The root node or tree to start searching from
 * @param type The node type to search for
 * @returns The last node of the specified type, or null if not found
 */
export function findLastNodeOfType(target: Node | Tree | null | undefined, type: string): Node | null {
  if (!target) {
    return null;
  }

  const node = target instanceof Tree ? target.rootNode as Node : target;

  if (node.type === type) {
    return node;
  }

  const results = node.descendantsOfType(type);

  return results.at(-1) ?? null;
}

/**
 * Get the block comment immediately preceding a node.
 * 
 * @param node The node to get the comment for
 * @returns The block comment as a string, or null if not found
 */
export function getBlockComment(node: Node): string | null {
  // Check if there's a comment before this node
  const parent = node.parent;
  if (!parent) {
    return null;
  }

  const nodeIndex = (node as any).index ?? 0;
  if (nodeIndex === 0) {
    return null;
  }

  const previousNode = parent.child(nodeIndex - 1);
  if (previousNode && (previousNode.type === "comment" || previousNode.type === "line_comment")) {
    return previousNode.text;
  }

  return null;
}

/**
 * Create a TypeScript parser with support for parsing .ts and .tsx files.
 * 
 * @returns A configured Parser instance ready to parse TypeScript code
 */
export async function createTypeScriptParser(): Promise<Parser> {
  await Parser.init();

  const TypeScript = await Language.load('public/tree-sitter-typescript.wasm');

  const parser = new Parser();
  parser.setLanguage(TypeScript);

  return parser;
}

/**
 * Get all interfaces from a TypeScript file.
 * 
 * @param tree The parse tree of a TypeScript file
 * @returns An array of TypeScriptInterface models
 */
export function getInterfaces(tree: Tree): TypeScriptInterface[] {
  const interfaces: TypeScriptInterface[] = [];

  const interfaceDeclarations = tree.rootNode.descendantsOfType("interface_declaration");

  for (const interfaceNode of interfaceDeclarations) {
    const iface = getInterface(interfaceNode);
    if (iface) {
      interfaces.push(iface);
    }
  }

  return interfaces;
}

/**
 * Extract a single TypeScript interface from an interface_declaration node.
 * 
 * @param interfaceNode An interface_declaration node from the AST
 * @returns The populated TypeScriptInterface model or null if extraction fails
 */
export function getInterface(interfaceNode: Node): TypeScriptInterface | null {
  if (interfaceNode.type !== "interface_declaration") {
    return null;
  }

  const nameNode = interfaceNode.childForFieldName("name");
  if (!nameNode) {
    return null;
  }

  const name = nameNode.text;
  const comment = getBlockComment(interfaceNode);

  // Get interface members
  const objectNode = interfaceNode.childForFieldName("body");
  const members = objectNode ? getInterfaceMembers(objectNode) : [];

  return {
    name,
    members,
    comment: comment ?? undefined,
  };
}

/**
 * Get all members from an interface body.
 * 
 * @param bodyNode The object_type or interface body node
 * @returns An array of TypeScriptInterfaceMember models
 */
export function getInterfaceMembers(bodyNode: Node): TypeScriptInterfaceMember[] {
  const members: TypeScriptInterfaceMember[] = [];

  // Get property signatures from the body
  const propertySignatures = bodyNode.descendantsOfType("property_signature");
  const methodSignatures = bodyNode.descendantsOfType("method_signature");

  for (const propNode of propertySignatures) {
    const member = getInterfaceMember(propNode);
    if (member) {
      members.push(member);
    }
  }

  for (const methodNode of methodSignatures) {
    const member = getInterfaceMember(methodNode);
    if (member) {
      members.push(member);
    }
  }

  return members;
}

/**
 * Extract a single member from an interface.
 * 
 * @param memberNode A property_signature or method_signature node
 * @returns The populated TypeScriptInterfaceMember model or null if extraction fails
 */
export function getInterfaceMember(memberNode: Node): TypeScriptInterfaceMember | null {
  if (memberNode.type !== "property_signature" && memberNode.type !== "method_signature") {
    return null;
  }

  const nameNode = memberNode.childForFieldName("name");
  if (!nameNode) {
    return null;
  }

  const name = nameNode.text;

  // Check if optional (has ?)
  const optional = memberNode.text.includes("?");

  // Get type
  const typeNode = memberNode.childForFieldName("type");
  const type = typeNode?.text ?? "any";

  return {
    name,
    type,
    optional,
    comment: undefined,
  };
}

/**
 * Get all type aliases from a TypeScript file.
 * 
 * @param tree The parse tree of a TypeScript file
 * @returns An array of TypeScriptType models
 */
export function getTypes(tree: Tree): TypeScriptType[] {
  const types: TypeScriptType[] = [];

  const typeAliases = tree.rootNode.descendantsOfType("type_alias_declaration");

  for (const typeNode of typeAliases) {
    const type = getType(typeNode);
    if (type) {
      types.push(type);
    }
  }

  return types;
}

/**
 * Extract a single type alias from a type_alias_declaration node.
 * 
 * @param typeNode A type_alias_declaration node from the AST
 * @returns The populated TypeScriptType model or null if extraction fails
 */
export function getType(typeNode: Node): TypeScriptType | null {
  if (typeNode.type !== "type_alias_declaration") {
    return null;
  }

  const nameNode = typeNode.childForFieldName("name");
  if (!nameNode) {
    return null;
  }

  const name = nameNode.text;
  const comment = getBlockComment(typeNode);

  // Get type members if it's an object type
  const valueNode = typeNode.childForFieldName("value");
  let members: TypeScriptInterfaceMember[] = [];

  if (valueNode && valueNode.type === "object_type") {
    members = getInterfaceMembers(valueNode);
  }

  return {
    name,
    members,
    comment: comment ?? undefined,
  };
}

/**
 * Get all classes from a TypeScript file.
 * 
 * @param tree The parse tree of a TypeScript file
 * @returns An array of TypeScriptClass models
 */
export function getClasses(tree: Tree): TypeScriptClass[] {
  const classes: TypeScriptClass[] = [];

  const classDeclarations = tree.rootNode.descendantsOfType("class_declaration");

  for (const classNode of classDeclarations) {
    const cls = getClass(classNode);
    if (cls) {
      classes.push(cls);
    }
  }

  return classes;
}

/**
 * Extract a single class from a class_declaration node.
 * 
 * @param classNode A class_declaration node from the AST
 * @returns The populated TypeScriptClass model or null if extraction fails
 */
export function getClass(classNode: Node): TypeScriptClass | null {
  if (classNode.type !== "class_declaration") {
    return null;
  }

  const nameNode = classNode.childForFieldName("name");
  if (!nameNode) {
    return null;
  }

  const name = nameNode.text;
  const comment = getBlockComment(classNode);

  // Get class methods
  const methods = getClassMethods(classNode);

  // Get class properties
  const properties = getClassProperties(classNode);

  return {
    name,
    methods,
    properties,
    comment: comment ?? undefined,
  };
}

/**
 * Get all methods from a class.
 * 
 * @param classNode A class_declaration node
 * @returns An array of TypeScriptFunction models
 */
export function getClassMethods(classNode: Node): TypeScriptFunction[] {
  const methods: TypeScriptFunction[] = [];

  const methodDefinitions = classNode.descendantsOfType("method_definition");

  for (const methodNode of methodDefinitions) {
    const method = getClassMethod(methodNode);
    if (method) {
      methods.push(method);
    }
  }

  return methods;
}

/**
 * Extract a single method from a class.
 * 
 * @param methodNode A method_definition node from the AST
 * @returns The populated TypeScriptFunction model or null if extraction fails
 */
export function getClassMethod(methodNode: Node): TypeScriptFunction | null {
  if (methodNode.type !== "method_definition") {
    return null;
  }

  const nameNode = methodNode.childForFieldName("name");
  if (!nameNode) {
    return null;
  }

  const name = nameNode.text;
  const comment = getBlockComment(methodNode);

  // Get parameters
  const parametersNode = methodNode.childForFieldName("parameters");
  const parameters = parametersNode ? getFunctionParameters(parametersNode) : [];

  // Get return type if available
  const returnTypeNode = methodNode.childForFieldName("return_type");
  const returnType = returnTypeNode?.text ?? "void";

  return {
    name,
    signature: methodNode.text,
    returnType,
    parameters,
    comment: comment ?? undefined,
  };
}

/**
 * Get all properties from a class.
 * 
 * @param classNode A class_declaration node
 * @returns An array of TypeScriptInterfaceMember models
 */
export function getClassProperties(classNode: Node): TypeScriptInterfaceMember[] {
  const properties: TypeScriptInterfaceMember[] = [];

  const propertyDefinitions = classNode.descendantsOfType("public_field_definition");
  const privatePropertyDefinitions = classNode.descendantsOfType("private_property_definition");

  for (const propNode of propertyDefinitions) {
    const property = getClassProperty(propNode);
    if (property) {
      properties.push(property);
    }
  }

  for (const propNode of privatePropertyDefinitions) {
    const property = getClassProperty(propNode);
    if (property) {
      properties.push(property);
    }
  }

  return properties;
}

/**
 * Extract a single property from a class.
 * 
 * @param propNode A public_field_definition or private_property_definition node
 * @returns The populated TypeScriptInterfaceMember model or null if extraction fails
 */
export function getClassProperty(propNode: Node): TypeScriptInterfaceMember | null {
  if (propNode.type !== "public_field_definition" && propNode.type !== "private_property_definition") {
    return null;
  }

  const nameNode = propNode.childForFieldName("name");
  if (!nameNode) {
    return null;
  }

  const name = nameNode.text;

  // Get type
  const typeNode = propNode.childForFieldName("type");
  const type = typeNode?.text ?? "any";

  return {
    name,
    type,
    optional: false,
    comment: undefined,
  };
}

/**
 * Get all top-level functions from a TypeScript file.
 * 
 * @param tree The parse tree of a TypeScript file
 * @returns An array of TypeScriptFunction models
 */
export function getFunctions(tree: Tree): TypeScriptFunction[] {
  const functions: TypeScriptFunction[] = [];

  const functionDeclarations = tree.rootNode.descendantsOfType("function_declaration");

  for (const functionNode of functionDeclarations) {
    const func = getFunction(functionNode);
    if (func) {
      functions.push(func);
    }
  }

  return functions;
}

/**
 * Extract a single function from a function_declaration node.
 * 
 * @param functionNode A function_declaration node from the AST
 * @returns The populated TypeScriptFunction model or null if extraction fails
 */
export function getFunction(functionNode: Node): TypeScriptFunction | null {
  if (functionNode.type !== "function_declaration") {
    return null;
  }

  const nameNode = functionNode.childForFieldName("name");
  if (!nameNode) {
    return null;
  }

  const name = nameNode.text;
  const comment = getBlockComment(functionNode);

  // Get parameters
  const parametersNode = functionNode.childForFieldName("parameters");
  const parameters = parametersNode ? getFunctionParameters(parametersNode) : [];

  // Get return type if available
  const returnTypeNode = functionNode.childForFieldName("return_type");
  const returnType = returnTypeNode?.text ?? "any";

  return {
    name,
    signature: functionNode.text,
    returnType,
    parameters,
    comment: comment ?? undefined,
  };
}

/**
 * Get all parameters from a function or method.
 * 
 * @param parametersNode The formal_parameters node
 * @returns An array of TypeScriptParameter models
 */
export function getFunctionParameters(parametersNode: Node): TypeScriptParameter[] {
  const parameters: TypeScriptParameter[] = [];

  // Get required_parameter nodes
  const requiredParams = parametersNode.descendantsOfType("required_parameter");
  const optionalParams = parametersNode.descendantsOfType("optional_parameter");
  const restParams = parametersNode.descendantsOfType("rest_parameter");

  for (const paramNode of requiredParams) {
    const param = extractParameter(paramNode, false);
    if (param) {
      parameters.push(param);
    }
  }

  for (const paramNode of optionalParams) {
    const param = extractParameter(paramNode, true);
    if (param) {
      parameters.push(param);
    }
  }

  for (const paramNode of restParams) {
    const param = extractParameter(paramNode, false);
    if (param) {
      parameters.push(param);
    }
  }

  return parameters;
}

/**
 * Extract parameter information from a parameter node.
 * 
 * @param paramNode A parameter node
 * @param optional Whether the parameter is optional
 * @returns The populated TypeScriptParameter model or null if extraction fails
 */
export function extractParameter(paramNode: Node, optional: boolean): TypeScriptParameter | null {
  const nameNode = paramNode.childForFieldName("name") || paramNode.childForFieldName("pattern");
  if (!nameNode) {
    return null;
  }

  const name = nameNode.text;

  // Get parameter type if available
  const typeNode = paramNode.childForFieldName("type");
  const type = typeNode?.text ?? "any";

  return {
    name,
    type,
    optional,
  };
}

/**
 * Parse a TypeScript file and extract all relevant information.
 * 
 * @param parser The TypeScript parser instance
 * @param relativePath The relative path of the file
 * @param filename The filename
 * @param sourceCode The source code to parse
 * @returns The extracted TypeScript file data or null if parsing fails
 */
export function parseTypeScriptFile(parser: Parser, relativePath: string, filename: string, sourceCode: string): TypeScriptFileData | null {
  const tree: Tree | null = parser.parse(sourceCode);

  if (!tree) {
    return null;
  }

  const interfaces = getInterfaces(tree);
  const types = getTypes(tree);
  const classes = getClasses(tree);
  const functions = getFunctions(tree);
  const imports = getImports(tree.rootNode);

  const fileData: TypeScriptFileData = {
    filePath: relativePath,
    filename,
    interfaces,
    types,
    classes,
    functions,
    imports,
  };

  return fileData;
}

/**
 * Get all import statements from a TypeScript file.
 * 
 * @param node The root node to search from
 * @returns An array of Import models
 */
export function getImports(node: Node): Import[] {
  const imports: Import[] = [];

  const importStatements = node.descendantsOfType("import_statement");

  for (const importNode of importStatements) {
    const importData = getImport(importNode);
    if (importData) {
      imports.push(importData);
    }
  }

  return imports;
}

/**
 * Extract a single import statement.
 * 
 * @param importNode An import_statement node
 * @returns The populated Import model or null if extraction fails
 */
export function getImport(importNode: Node): Import | null {
  if (importNode.type !== "import_statement") {
    return null;
  }

  // Get the source module name
  const sourceNode = importNode.descendantsOfType("string")[0];
  if (!sourceNode) {
    return null;
  }

  // Remove quotes from source string
  const source = sourceNode.text.replace(/['"`]/g, "");

  return {
    type: "*",
    pkg: source,
    wildcard: true,
  };
}
