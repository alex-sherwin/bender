package com.example.service;

import com.example.util.ValidationException;
import java.util.List;
import java.util.Optional;

/**
 * Generic CRUD service interface.
 */
public interface CrudService<T, ID> {
    T create(T entity) throws ValidationException;
    T update(ID id, T entity) throws ValidationException;
    void delete(ID id);
    Optional<T> findById(ID id);
    List<T> findAll();
}
