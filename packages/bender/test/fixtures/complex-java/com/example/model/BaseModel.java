package com.example.model;

import java.time.Instant;

/**
 * Abstract base class for all domain models.
 * Implements common entity functionality.
 */
public abstract class BaseModel implements Entity, Auditable {
    private Long id;
    private Instant createdAt;
    private Instant updatedAt;

    @Override
    public Long getId() {
        return id;
    }

    @Override
    public void setId(Long id) {
        this.id = id;
    }

    @Override
    public Instant getCreatedAt() {
        return createdAt;
    }

    @Override
    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public Instant getUpdatedAt() {
        return updatedAt;
    }

    @Override
    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    @Override
    public boolean isValid() {
        return id != null && createdAt != null;
    }

    /**
     * Static nested builder class.
     */
    public static abstract class Builder<T extends BaseModel> {
        protected T instance;

        public Builder<T> withId(Long id) {
            instance.setId(id);
            return this;
        }

        public Builder<T> withTimestamps(Instant created, Instant updated) {
            instance.setCreatedAt(created);
            instance.setUpdatedAt(updated);
            return this;
        }

        public abstract T build();
    }
}
