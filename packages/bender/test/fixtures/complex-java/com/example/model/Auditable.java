package com.example.model;

import java.time.Instant;

/**
 * Interface for entities that track creation and modification times.
 */
public interface Auditable {
    Instant getCreatedAt();
    void setCreatedAt(Instant createdAt);
    Instant getUpdatedAt();
    void setUpdatedAt(Instant updatedAt);
}
