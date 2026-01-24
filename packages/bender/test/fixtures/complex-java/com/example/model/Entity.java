package com.example.model;

/**
 * Base entity interface for all domain objects.
 */
public interface Entity {
    Long getId();
    void setId(Long id);
    boolean isValid();
}
