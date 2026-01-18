import { describe, it, expect } from 'vitest';

import { getImports, findLastNodeOfType, parseJavaFile, createJavaParser, findFirstNodeOfType, getFullyQualifiedImport, getFilePackage, getClasses, getJavaMethods, getJavaFields, getFunctionParameters } from "../src/java-parser";
import type { Import, JavaMethod, JavaField } from '../src/types';


describe('java-parser', () => {

  it('getClasses', async () => {

    const comment = `/**
 * First block line
 * <br/>
 * This is another line
 */`;

    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import javax.net.wild.*;

${comment}
@SuppressWarnings("unchecked")
public class Test123 { }
`)!;

    const classes = getClasses(tree.rootNode);


    expect(classes).toHaveLength(1);
    expect(classes[0].name).toEqual("Test123");
    expect(classes[0].type).toEqual("class");
    expect(classes[0].comment).toEqual(comment);
    // expect(imports[0]).toEqual({ pkg: "javax.net.ssl", type: "TrustManager", wildcard: false } satisfies Import);
    // expect(imports[1]).toEqual({ pkg: "javax.net.ssl", type: "X509TrustManager", wildcard: false } satisfies Import);
    // expect(imports[2]).toEqual({ pkg: "javax.net.wild", type: "*", wildcard: true } satisfies Import);

  });

  it('getImports', async () => {

    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import javax.net.wild.*;

public class Test { }
`)!;

    const imports = getImports(tree.rootNode);

    expect(imports).toHaveLength(3);
    expect(imports[0]).toEqual({ pkg: "javax.net.ssl", type: "TrustManager", wildcard: false } satisfies Import);
    expect(imports[1]).toEqual({ pkg: "javax.net.ssl", type: "X509TrustManager", wildcard: false } satisfies Import);
    expect(imports[2]).toEqual({ pkg: "javax.net.wild", type: "*", wildcard: true } satisfies Import);

  });

  it('findFirstNodeOfType: package (found)', async () => {

    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

public class Test { }
`)!;

    const node = findFirstNodeOfType(tree, "package_declaration");
    expect(node?.type).toEqual("package_declaration");

  });

  it('findFirstNodeOfType: import (missing)', async () => {

    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

public class Test { }
`)!;

    const node = findFirstNodeOfType(tree, "import_declaration");
    expect(node?.type ?? null).toBeNull()

  });

  it('findFirstNodeOfType: import (found)', async () => {

    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

public class Test { }
`)!;

    const node = findFirstNodeOfType(tree, "import_declaration");
    expect(node).not.toBeNull();
    expect(node?.type).toEqual("import_declaration")
  });

  it('getFullyQualifiedImport', async () => {

    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

public class Test { }
`)!;

    const node = findFirstNodeOfType(tree, "import_declaration");

    expect(node).not.toBeNull();
    expect(node?.type).toEqual("import_declaration")

    expect(getFullyQualifiedImport(node!)).toEqual("javax.net.ssl.TrustManager");

  });

  it('getFilePackage', async () => {

    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

public class Test { }
`)!;

    expect(getFilePackage(tree)).toEqual("com.example.test");

  });

  // Method/Function Tests
  it('getJavaMethods: single public method', async () => {
    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

public class Calculator {
  public int add(int a, int b) {
    return a + b;
  }
}
`)!;

    const classNode = getClasses(tree.rootNode)[0];
    expect(classNode).not.toBeNull();
    
    const methods = getJavaMethods(tree.rootNode.descendantsOfType("class_declaration")[0]);
    expect(methods).toHaveLength(1);
    expect(methods[0].name).toEqual("add");
    expect(methods[0].returnType).toEqual("int");
    expect(methods[0].static).toBe(false);
  });

  it('getJavaMethods: multiple methods', async () => {
    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

public class Calculator {
  public int add(int a, int b) {
    return a + b;
  }
  
  public int subtract(int a, int b) {
    return a - b;
  }
  
  public static void main(String[] args) {
    System.out.println("Test");
  }
}
`)!;

    const classDecl = tree.rootNode.descendantsOfType("class_declaration")[0];
    const methods = getJavaMethods(classDecl);
    
    expect(methods).toHaveLength(3);
    expect(methods[0].name).toEqual("add");
    expect(methods[1].name).toEqual("subtract");
    expect(methods[2].name).toEqual("main");
  });

  it('getJavaMethods: no methods in class', async () => {
    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

public class EmptyClass {
}
`)!;

    const classDecl = tree.rootNode.descendantsOfType("class_declaration")[0];
    const methods = getJavaMethods(classDecl);
    
    expect(methods).toHaveLength(0);
  });

  // Function Parameters Tests
  it('getFunctionParameters: single parameter', async () => {
    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

public class Test {
  public void greet(String name) {
    System.out.println("Hello " + name);
  }
}
`)!;

    const methodNode = tree.rootNode.descendantsOfType("method_declaration")[0];
    const params = getFunctionParameters(methodNode);
    
    expect(params).toHaveLength(1);
    expect(params[0].name).toEqual("name");
    expect(params[0].type).toEqual("String");
  });

  it('getFunctionParameters: multiple parameters', async () => {
    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

public class Calculator {
  public int calculate(int a, int b, String operation) {
    return a + b;
  }
}
`)!;

    const methodNode = tree.rootNode.descendantsOfType("method_declaration")[0];
    const params = getFunctionParameters(methodNode);
    
    expect(params).toHaveLength(3);
    expect(params[0].name).toEqual("a");
    expect(params[0].type).toEqual("int");
    expect(params[1].name).toEqual("b");
    expect(params[1].type).toEqual("int");
    expect(params[2].name).toEqual("operation");
    expect(params[2].type).toEqual("String");
  });

  it('getFunctionParameters: no parameters', async () => {
    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

public class Test {
  public void noArgs() {
    System.out.println("Test");
  }
}
`)!;

    const methodNode = tree.rootNode.descendantsOfType("method_declaration")[0];
    const params = getFunctionParameters(methodNode);
    
    expect(params).toHaveLength(0);
  });

  it('getFunctionParameters: complex types', async () => {
    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

import java.util.List;
import java.util.Map;

public class Test {
  public void complexTypes(List<String> items, Map<String, Object> config) {
    System.out.println(items);
  }
}
`)!;

    const methodNode = tree.rootNode.descendantsOfType("method_declaration")[0];
    const params = getFunctionParameters(methodNode);
    
    expect(params).toHaveLength(2);
    expect(params[0].name).toEqual("items");
    expect(params[0].type).toContain("List");
    expect(params[1].name).toEqual("config");
    expect(params[1].type).toContain("Map");
  });

  // Field Extraction Tests
  it('getJavaFields: single field', async () => {
    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

public class User {
  private String name;
}
`)!;

    const classDecl = tree.rootNode.descendantsOfType("class_declaration")[0];
    const fields = getJavaFields(classDecl);
    
    expect(fields).toHaveLength(1);
    expect(fields[0].name).toEqual("name");
    expect(fields[0].type.name).toEqual("String");
    expect(fields[0].static).toBe(false);
  });

  it('getJavaFields: multiple fields', async () => {
    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

public class User {
  private String name;
  private int age;
  protected String email;
}
`)!;

    const classDecl = tree.rootNode.descendantsOfType("class_declaration")[0];
    const fields = getJavaFields(classDecl);
    
    expect(fields).toHaveLength(3);
    expect(fields[0].name).toEqual("name");
    expect(fields[0].type.name).toEqual("String");
    expect(fields[1].name).toEqual("age");
    expect(fields[1].type.name).toEqual("int");
    expect(fields[2].name).toEqual("email");
    expect(fields[2].type.name).toEqual("String");
  });

  it('getJavaFields: static fields', async () => {
    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

public class Config {
  public static final String VERSION = "1.0";
  private static int counter;
}
`)!;

    const classDecl = tree.rootNode.descendantsOfType("class_declaration")[0];
    const fields = getJavaFields(classDecl);
    
    expect(fields).toHaveLength(2);
    expect(fields[0].name).toEqual("VERSION");
    expect(fields[1].name).toEqual("counter");
  });

  it('getJavaFields: no fields in class', async () => {
    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

public class StatelessClass {
  public void doSomething() {
    // logic here
  }
}
`)!;

    const classDecl = tree.rootNode.descendantsOfType("class_declaration")[0];
    const fields = getJavaFields(classDecl);
    
    expect(fields).toHaveLength(0);
  });

  it('getJavaFields: primitive and complex types', async () => {
    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

import java.util.List;

public class DataHolder {
  private int count;
  private String label;
  private List<String> items;
  private boolean active;
}
`)!;

    const classDecl = tree.rootNode.descendantsOfType("class_declaration")[0];
    const fields = getJavaFields(classDecl);
    
    expect(fields).toHaveLength(4);
    expect(fields[0].type.name).toEqual("int");
    expect(fields[1].type.name).toEqual("String");
    expect(fields[2].type.name).toContain("List");
    expect(fields[3].type.name).toEqual("boolean");
  });

  it('comprehensive class analysis: methods and fields', async () => {
    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.service;

public class UserService {
  private String dbUrl;
  private int maxConnections;
  
  public void createUser(String name, String email) {
    // implementation
  }
  
  public void deleteUser(int userId) {
    // implementation
  }
  
  private String generateId() {
    return "id-123";
  }
}
`)!;

    const classDecl = tree.rootNode.descendantsOfType("class_declaration")[0];
    const methods = getJavaMethods(classDecl);
    const fields = getJavaFields(classDecl);
    
    expect(methods).toHaveLength(3);
    expect(methods[0].name).toEqual("createUser");
    expect(methods[1].name).toEqual("deleteUser");
    expect(methods[2].name).toEqual("generateId");
    
    expect(fields).toHaveLength(2);
    expect(fields[0].name).toEqual("dbUrl");
    expect(fields[1].name).toEqual("maxConnections");
    
    // Verify we can also get parameters
    const createUserMethod = methods[0];
    const methodNode = classDecl.descendantsOfType("method_declaration")[0];
    const params = getFunctionParameters(methodNode);
    expect(params).toHaveLength(2);
    expect(params[0].name).toEqual("name");
    expect(params[1].name).toEqual("email");
  });

});

