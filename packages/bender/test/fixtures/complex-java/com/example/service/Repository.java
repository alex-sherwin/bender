package com.example.service;

import java.util.List;
import java.util.Optional;

/**
 * Generic repository interface for CRUD operations.
 */
public interface Repository<T, ID> {
    Optional<T> findById(ID id);
    List<T> findAll();
    T save(T entity);
    void delete(T entity);
    void deleteById(ID id);
    boolean existsById(ID id);
    long count();
}
