package com.example.nested;

/**
 * Demonstrates nested and inner classes.
 */
public class Container {
    private String containerName;
    
    /**
     * Static nested class.
     */
    public static class StaticNested {
        private int value;
        
        public StaticNested(int value) {
            this.value = value;
        }
        
        public int getValue() {
            return this.value;
        }
    }
    
    /**
     * Inner class (non-static).
     */
    public class Inner {
        private String innerData;
        
        public Inner(String data) {
            this.innerData = data;
        }
        
        public String getData() {
            // Can access outer class members
            return this.containerName + ": " + this.innerData;
        }
    }
    
    /**
     * Method with local class.
     */
    public void processData() {
        /**
         * Local class inside method.
         */
        class LocalProcessor {
            void process() {
                System.out.println("Processing in local class");
            }
        }
        
        LocalProcessor processor = new LocalProcessor();
        processor.process();
    }
}
