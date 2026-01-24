package com.example.model;

/**
 * Enum representing user roles with associated permissions.
 */
public enum UserRole {
    ADMIN("Administrator", 100),
    MODERATOR("Moderator", 50),
    USER("Regular User", 10),
    GUEST("Guest", 0);

    private final String displayName;
    private final int permissionLevel;

    UserRole(String displayName, int permissionLevel) {
        this.displayName = displayName;
        this.permissionLevel = permissionLevel;
    }

    public String getDisplayName() {
        return displayName;
    }

    public int getPermissionLevel() {
        return permissionLevel;
    }

    public boolean hasPermission(int requiredLevel) {
        return permissionLevel >= requiredLevel;
    }

    public boolean isAdmin() {
        return this == ADMIN;
    }

    public static UserRole fromString(String role) {
        for (UserRole r : values()) {
            if (r.name().equalsIgnoreCase(role)) {
                return r;
            }
        }
        return GUEST;
    }
}
