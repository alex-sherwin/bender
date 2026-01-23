package com.example.inheritance;

/**
 * Base interface for shapes.
 */
public interface Shape {
    /**
     * Calculate the area of the shape.
     * @return area value
     */
    double getArea();
    
    /**
     * Get the name of the shape.
     */
    String getName();
}

/**
 * Interface for drawable objects.
 */
interface Drawable {
    void draw();
}

/**
 * Abstract base class for geometric shapes.
 */
abstract class GeometricShape implements Shape {
    protected String color;
    
    public GeometricShape(String color) {
        this.color = color;
    }
    
    public String getColor() {
        return this.color;
    }
}

/**
 * Rectangle implementation.
 * Extends GeometricShape and implements Drawable.
 */
public class Rectangle extends GeometricShape implements Drawable {
    private double width;
    private double height;
    
    /**
     * Constructor for Rectangle.
     */
    public Rectangle(String color, double width, double height) {
        super(color);
        this.width = width;
        this.height = height;
    }
    
    @Override
    public double getArea() {
        return this.width * this.height;
    }
    
    @Override
    public String getName() {
        return "Rectangle";
    }
    
    @Override
    public void draw() {
        System.out.println("Drawing a " + this.color + " rectangle");
    }
}
