package com.example.service;

import com.example.model.Entity;
import java.util.List;
import java.util.Optional;

/**
 * Abstract base service with common functionality.
 */
public abstract class AbstractService<T extends Entity, ID> {
    protected final Repository<T, ID> repository;

    protected AbstractService(Repository<T, ID> repository) {
        this.repository = repository;
    }

    public boolean exists(ID id) {
        return repository.existsById(id);
    }

    public long count() {
        return repository.count();
    }

    protected void validateEntity(T entity) {
        if (entity == null) {
            throw new IllegalArgumentException("Entity cannot be null");
        }
        if (!entity.isValid()) {
            throw new IllegalArgumentException("Entity validation failed");
        }
    }

    protected List<T> findAllEntities() {
        return repository.findAll();
    }

    protected Optional<T> findEntity(ID id) {
        return repository.findById(id);
    }
}
