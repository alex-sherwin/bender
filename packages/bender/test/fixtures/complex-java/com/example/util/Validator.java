package com.example.util;

import com.example.model.Entity;

/**
 * Utility class for entity validation.
 */
public class Validator {
    
    public <T extends Entity> void validate(T entity) throws ValidationException {
        if (entity == null) {
            throw new ValidationException("Entity cannot be null");
        }
        
        if (!entity.isValid()) {
            throw new ValidationException("Entity validation failed");
        }
    }

    public void validateNotNull(Object obj, String fieldName) throws ValidationException {
        if (obj == null) {
            throw new ValidationException(fieldName + " cannot be null");
        }
    }

    public void validateString(String str, String fieldName) throws ValidationException {
        validateNotNull(str, fieldName);
        if (str.trim().isEmpty()) {
            throw new ValidationException(fieldName + " cannot be empty");
        }
    }

    public void validateEmail(String email) throws ValidationException {
        validateString(email, "Email");
        if (!email.contains("@")) {
            throw new ValidationException("Invalid email format");
        }
    }
}
