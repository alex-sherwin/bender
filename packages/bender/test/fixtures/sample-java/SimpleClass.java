package com.example.simple;

/**
 * A simple calculator class.
 * Demonstrates basic class structure with fields and methods.
 */
public class Calculator {
    // Constants
    private static final double PI = 3.14159;
    
    // Instance fields
    private int value;
    private String name;
    
    /**
     * Constructor for Calculator.
     */
    public Calculator(String name) {
        this.name = name;
        this.value = 0;
    }
    
    /**
     * Adds two numbers.
     * @param a first number
     * @param b second number
     * @return sum of a and b
     */
    public int add(int a, int b) {
        int result = a + b;
        return result;
    }
    
    /**
     * Multiplies two numbers.
     */
    public int multiply(int x, int y) {
        return x * y;
    }
    
    // Getter for value
    public int getValue() {
        return this.value;
    }
    
    // Setter for value
    public void setValue(int newValue) {
        this.value = newValue;
    }
}
