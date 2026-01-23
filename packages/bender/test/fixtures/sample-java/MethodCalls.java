package com.example.calls;

/**
 * Demonstrates method calls and field accesses.
 */
public class UserService {
    private DatabaseConnection db;
    private Logger logger;
    
    public UserService(DatabaseConnection db, Logger logger) {
        this.db = db;
        this.logger = logger;
    }
    
    /**
     * Saves a user to the database.
     * @param user The user to save
     * @return true if successful
     */
    public boolean saveUser(User user) {
        // Log the operation
        this.logger.info("Saving user: " + user.getName());
        
        // Validate user
        if (!this.validateUser(user)) {
            this.logger.error("Invalid user data");
            return false;
        }
        
        // Save to database
        boolean success = this.db.insert(user);
        
        if (success) {
            this.logger.info("User saved successfully");
            user.setId(this.db.getLastInsertId());
        }
        
        return success;
    }
    
    /**
     * Validates user data.
     */
    private boolean validateUser(User user) {
        String name = user.getName();
        String email = user.getEmail();
        
        // Check for null values
        if (name == null || email == null) {
            return false;
        }
        
        // Check name length
        if (name.length() < 2) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Retrieves a user by ID.
     */
    public User getUserById(int id) {
        this.logger.debug("Fetching user with id: " + id);
        User user = this.db.findById(id);
        return user;
    }
}

class User {
    private int id;
    private String name;
    private String email;
    
    public int getId() { return this.id; }
    public void setId(int id) { this.id = id; }
    
    public String getName() { return this.name; }
    public void setName(String name) { this.name = name; }
    
    public String getEmail() { return this.email; }
    public void setEmail(String email) { this.email = email; }
}

class DatabaseConnection {
    public boolean insert(User user) { return true; }
    public User findById(int id) { return null; }
    public int getLastInsertId() { return 1; }
}

class Logger {
    public void info(String msg) {}
    public void error(String msg) {}
    public void debug(String msg) {}
}
