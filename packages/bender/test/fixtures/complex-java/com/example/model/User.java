package com.example.model;

/**
 * User domain model extending BaseModel.
 * Demonstrates inheritance hierarchy.
 */
public class User extends BaseModel {
    private String username;
    private String email;
    private UserRole role;
    private UserStatus status;

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    public UserStatus getStatus() {
        return status;
    }

    public void setStatus(UserStatus status) {
        this.status = status;
    }

    @Override
    public boolean isValid() {
        return super.isValid() && username != null && email != null;
    }

    /**
     * Nested builder for User.
     */
    public static class UserBuilder extends BaseModel.Builder<User> {
        public UserBuilder() {
            instance = new User();
        }

        public UserBuilder withUsername(String username) {
            instance.setUsername(username);
            return this;
        }

        public UserBuilder withEmail(String email) {
            instance.setEmail(email);
            return this;
        }

        public UserBuilder withRole(UserRole role) {
            instance.setRole(role);
            return this;
        }

        @Override
        public User build() {
            return instance;
        }
    }
}
