import { Parser, Language, Node, Tree, TreeCursor } from 'web-tree-sitter';

import { log } from "./logger";

import type { FileData, ClassInfo, JavaMethod, JavaField, Import, Type } from './types';
import { fail } from 'node:assert';



export interface Walker {
  current: Node;
  cursor: TreeCursor
  root: Node | Tree;
}

export function* walkGenerator(root: Node | Tree): Generator<Walker> {

  const cursor = root.walk();

  let reachedRoot = false;
  while (!reachedRoot) {
    let currentNode = cursor.currentNode as unknown;
    // TreeCursor.currentNode is a property in Node but a function in the browser
    // https://github.com/tree-sitter/tree-sitter/issues/2195
    if (typeof currentNode === "function") {
      currentNode = currentNode();
    }
    yield { current: currentNode as Node, cursor, root };

    if (cursor.gotoFirstChild()) {
      continue;
    }

    if (cursor.gotoNextSibling()) {
      continue;
    }

    let retracing = true;
    while (retracing) {
      if (!cursor.gotoParent()) {
        retracing = false;
        reachedRoot = true;
      }

      if (cursor.gotoNextSibling()) {
        retracing = false;
      }
    }
  }
}

/**
 * Find the first node of a specific type in the syntax tree.
 * 
 * @author GitHub Copilot
 * @param node The root node to start searching from
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
 * @author GitHub Copilot
 * @param node The root node to start searching from
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

export function getClasses(node: Node): ClassInfo[] {

  const classes: ClassInfo[] = [];

  const walkerGen = walkGenerator(node);

  for (const walker of walkerGen) {
    if (walker.current.type === "class_declaration" || walker.current.type === "interface_declaration") {
      const classInfo = getClass(walker);
      if (classInfo) {
        classes.push(classInfo);
      }
    }
  }

  return classes;
}

/**
 * Given a {@link Walker}, copy the current {@link Cursor} and walk backwards to the previous sibling,
 * and look for a block comment there.
 * 
 * @param walker The {@link Walker} instance to use for traversing the AST.  I
 * @returns The block comment as a string, or null if not found.
 */
export function getBlockCommentForCurrentNode(walker: Walker): string | null {

  // look for block comments for this class
  const cursorCopy = walker.cursor.copy();
  cursorCopy.resetTo(walker.cursor);
  
  if (cursorCopy.gotoPreviousSibling()) {
    if (cursorCopy.currentNode.type === "block_comment") {
      const text = cursorCopy.currentNode.text;
      return text;
    }
  }

  return null;
}

export function getRequiredFieldNameValueForNode(node: Node, fieldName: string): string {
  const result = getFieldNameValueForNode(node, fieldName);
  if (!result) {
    throw new Error(`Required field [${fieldName}] not found in node: ${node.type}`);
  }
  return result;
}

export function getFieldNameValueForNode(node: Node, fieldName: string): string | null {

  const fieldNode = node.childForFieldName(fieldName);

  if (!fieldNode) {
    log.error(`Could not find field [${fieldName}] in node: ${node.type}`);
    return null;
  }

  return fieldNode.text;
}

export function getClass(walker: Walker): ClassInfo | null {

   if (walker.current.type !== "class_declaration" && walker.current.type !== "interface_declaration") {
     return null;
   }

   const name = getRequiredFieldNameValueForNode(walker.current, "name");
   const comment = getBlockCommentForCurrentNode(walker);
   const type: ClassInfo["type"] = walker.current.type === "class_declaration" ? "class" : "interface";

   return {
     name,
     fields: [],
     methods: [],
     type,
     comment,
   }
}

/**
 * Get all Java methods from a class or interface node.
 * 
 * @param classNode A `class_declaration` or `interface_declaration` node
 * @returns An array of {@link JavaMethod} models representing the methods found
 */
export function getJavaMethods(classNode: Node): JavaMethod[] {
  const methods: JavaMethod[] = [];
  
  if (classNode.type !== "class_declaration" && classNode.type !== "interface_declaration") {
    return methods;
  }

  const methodDeclarations = classNode.descendantsOfType("method_declaration");
  
  for (const methodNode of methodDeclarations) {
    const method = getJavaMethodInfo(methodNode);
    if (method) {
      methods.push(method);
    }
  }
  
  return methods;
}

/**
 * Extract a single Java method from a method_declaration node.
 * 
 * @param methodNode A `method_declaration` node from the AST
 * @returns The populated {@link JavaMethod} model or null if extraction fails
 */
export function getJavaMethodInfo(methodNode: Node): JavaMethod | null {
  if (methodNode.type !== "method_declaration") {
    return null;
  }

  const nameNode = methodNode.childForFieldName("name");
  if (!nameNode) {
    return null;
  }

  const name = nameNode.text;
  const returnTypeNode = methodNode.childForFieldName("type");
  const returnType = returnTypeNode?.text ?? "void";
  
  // Check for modifiers to determine if static
  let isStatic = false;
  const modifierNodes = methodNode.descendantsOfType("modifier");
  for (const mod of modifierNodes) {
    if (mod.text === "static") {
      isStatic = true;
      break;
    }
  }

  return {
    name,
    returnType,
    static: isStatic,
    signature: methodNode.text,
    typeReferences: [],
    comment: undefined,
  };
}

/**
 * Get all parameters from a Java method.
 * 
 * @param methodNode A `method_declaration` node from the AST
 * @returns An array of parameter names and types
 */
export function getFunctionParameters(methodNode: Node): Array<{ name: string; type: string }> {
  const parameters: Array<{ name: string; type: string }> = [];
  
  if (methodNode.type !== "method_declaration") {
    return parameters;
  }

  const formalParametersNode = methodNode.childForFieldName("parameters");
  if (!formalParametersNode) {
    return parameters;
  }

  const formalParameterNodes = formalParametersNode.descendantsOfType("formal_parameter");
  
  for (const paramNode of formalParameterNodes) {
    const typeNode = paramNode.childForFieldName("type");
    const nameNode = paramNode.childForFieldName("name");
    
    if (typeNode && nameNode) {
      parameters.push({
        type: typeNode.text,
        name: nameNode.text,
      });
    }
  }
  
  return parameters;
}

/**
 * Get all fields from a class or interface node.
 * 
 * @param classNode A `class_declaration` or `interface_declaration` node
 * @returns An array of {@link JavaField} models representing the fields found
 */
export function getJavaFields(classNode: Node): JavaField[] {
  const fields: JavaField[] = [];
  
  if (classNode.type !== "class_declaration" && classNode.type !== "interface_declaration") {
    return fields;
  }

  const fieldDeclarations = classNode.descendantsOfType("field_declaration");
  
  for (const fieldNode of fieldDeclarations) {
    const field = getJavaField(fieldNode);
    if (field) {
      fields.push(field);
    }
  }
  
  return fields;
}

/**
 * Extract a single Java field from a field_declaration node.
 * 
 * @param fieldNode A `field_declaration` node from the AST
 * @returns The populated {@link JavaField} model or null if extraction fails
 */
export function getJavaField(fieldNode: Node): JavaField | null {
  if (fieldNode.type !== "field_declaration") {
    return null;
  }

  const typeNode = fieldNode.childForFieldName("type");
  if (!typeNode) {
    return null;
  }

  const fieldType = typeNode.text;

  // Get field names - there can be multiple fields declared on one line
  const declarators = fieldNode.descendantsOfType("variable_declarator");
  
  if (declarators.length === 0) {
    return null;
  }

  // For simplicity, extract the first declarator
  const firstDeclarator = declarators[0];
  const nameNode = firstDeclarator.childForFieldName("name");
  
  if (!nameNode) {
    return null;
  }

  const name = nameNode.text;
  
  // Check for modifiers to determine if static
  let isStatic = false;
  const modifierNodes = fieldNode.descendantsOfType("modifier");
  for (const mod of modifierNodes) {
    if (mod.text === "static") {
      isStatic = true;
      break;
    }
  }

  return {
    name,
    type: {
      name: fieldType,
    },
    signature: fieldNode.text,
    static: isStatic,
  };
}


/**
 * Get all imports from a given AST node.
 * 
 * @param node Finds all `import_declaration` nodes in the provided AST node and returns an array of {@link Import} models.
 * @returns An array of {@link Import} models representing the imports found in the node.
 */
export function getImports(node: Node): Import[] {
  const importDeclarations = node.descendantsOfType("import_declaration");
  const imports = importDeclarations.map(getImport).filter(o => o !== null);
  return imports;
}

/**
 * Get a populated {@link Import} model from a {@link Node} representing an import declaration.
 * 
 * @param node A `import_declaration` {@link Node} from the AST
 * @returns The populated {@link Import} model or null if the node is not an import declaration
 */
export function getImport(node: Node | null | undefined): Import | null {

  if (node?.type !== "import_declaration") {
    return null;
  }

  const wildcard = findFirstNodeOfType(node, "asterisk") !== null;
  const simpleType = wildcard ? "*" : findLastNodeOfType(node, "identifier")?.text ?? null;
  let fullType = findFirstNodeOfType(node, "scoped_identifier")?.text ?? null;

  if (!simpleType) {
    throw new Error("Could not determine simple type from import_declaration node");
  }

  let pkg = null;

  if (fullType && wildcard) {
    pkg = fullType;
  } else if (fullType && !wildcard) {
    pkg = fullType.substring(0, fullType.lastIndexOf(`.${simpleType}`));
  } else {
    throw new Error("Could not determine package from import_declaration node");
  }

  if (fullType && wildcard) {
    fullType = `${fullType}.*`;
  }

  return {
    type: simpleType,
    pkg,
    wildcard
  };

}

/**
 * Get the fully qualified import from a node.  
 * 
 * The provided {@link Node} should be a `import_declaration` node.
 * 
 * @param node A `import_declaration` {@link Node} from the AST
 * @returns The fully qualified import as a string, or null if not found
 */
export function getFullyQualifiedImport(node: Node): string | null {
  return findFirstNodeOfType(node!, "scoped_identifier")?.text ?? null;
}

/**
 * Get the package name from a given Java file
 * 
 * @param tree A {@link Tree} representing the Java file
 * @returns The package name of the Java file, or null if not found
 */
export function getFilePackage(tree: Tree): string | null {
  return findFirstNodeOfType(findFirstNodeOfType(tree, "package_declaration"), "scoped_identifier")?.text ?? null;
}

export function parseJavaFile(parser: Parser, relativePath: string, filename: string, sourceCode: string): FileData | null {

  const tree: Tree | null = parser.parse(sourceCode);

  if (!tree) {
    return null;
  }

  const pkg = getFilePackage(tree);
  const imports = getImports(tree.rootNode);

  // const generator = traverseTree(tree);

  // for (const node of generator) {
  //   // log.info(`Visited node: ${node.type} at (${node.startPosition.row}, ${node.startPosition.column})`);

  //   if (node.type === "package_declaration") {
  //     log.info(`Found package declaration: ${node.text}`);
  //   }

  //   if (node.type === "package") {
  //     log.info(`Found package: ${node.text}`);
  //   }

  // }

  const fileData: FileData = {
    filePath: relativePath,
    filename,
    pkg,
    imports,
    definedClasses: [],
  };

  return fileData;
}

// Create a parser with Java language support
export async function createJavaParser(): Promise<Parser> {

  await Parser.init();

  const Java = await Language.load('public/tree-sitter-java.wasm');

  const parser = new Parser();
  parser.setLanguage(Java);

  return parser;
}

// Helper function to get text of a node
// function getNodeText(node: Node | null | undefined, sourceCode: string): string {
//   if (!node) return '';
//   return sourceCode.substring(node.startIndex, node.endIndex);
// }


/**
 * We consider a type reference "useful" if it has an associated package and the package does not begin
 * with well known built-in packages.
 */
function addTypeReferenceIfUseful(refs: Type[], type: Type) {
  if (type.package && !isWellKnownBuiltinPackage(type.package)) {
    refs.push(type);
  }
}

const IGNORED_JAVA_PACKAGE_PREFIXES = [
  'java.',
  'javax.',
  'org.w3c.',
  'org.xml.',
  'com.sun.',
  'com.oracle.',
  'org.junit',
  'junit.',
  'org.hamcrest.',
  'ch.qos',
  'org.testcontainers',
  'org.slf4j',
  'org.apache.logging',
];

function isWellKnownBuiltinPackage(pkg: string): boolean {
  return IGNORED_JAVA_PACKAGE_PREFIXES.some(prefix => pkg.startsWith(prefix));
}

function isPrimitiveType(typeName: string): boolean {
  const primitiveTypes = new Set([
    'boolean', 'byte', 'char', 'short', 'int', 'long', 'float', 'double', 'void',
    'Boolean', 'Byte', 'Character', 'Short', 'Integer', 'Long', 'Float', 'Double',
    'String', 'Object'
  ]);
  return primitiveTypes.has(typeName);
}

function isCommonKeyword(word: string): boolean {
  const keywords = new Set([
    'this', 'super', 'null', 'true', 'false', 'return', 'if', 'else', 'for', 'while',
    'do', 'switch', 'case', 'default', 'break', 'continue', 'try', 'catch', 'finally',
    'throw', 'throws', 'public', 'private', 'protected', 'static', 'final', 'abstract',
    'synchronized', 'volatile', 'transient', 'native', 'strictfp', 'class', 'interface',
    'extends', 'implements', 'import', 'package', 'new', 'instanceof'
  ]);
  return keywords.has(word);
}
