package com.example.service;

import com.example.model.User;
import com.example.model.UserRole;
import com.example.model.UserStatus;
import com.example.util.ValidationException;
import com.example.util.Validator;
import java.util.List;
import java.util.Optional;

/**
 * Service class for user management operations.
 * Demonstrates deep inheritance and interface implementation.
 */
public class UserService extends AbstractService<User, Long> implements CrudService<User, Long> {
    private final UserRepository repository;
    private final Validator validator;

    public UserService(UserRepository repository, Validator validator) {
        super(repository);
        this.repository = repository;
        this.validator = validator;
    }

    @Override
    public User create(User user) throws ValidationException {
        validator.validate(user);
        
        if (repository.findByUsername(user.getUsername()).isPresent()) {
            throw new ValidationException("Username already exists");
        }
        
        if (repository.findByEmail(user.getEmail()).isPresent()) {
            throw new ValidationException("Email already exists");
        }
        
        user.setStatus(UserStatus.ACTIVE);
        return repository.save(user);
    }

    @Override
    public User update(Long id, User user) throws ValidationException {
        validator.validate(user);
        
        User existing = repository.findById(id)
            .orElseThrow(() -> new ValidationException("User not found"));
        
        existing.setUsername(user.getUsername());
        existing.setEmail(user.getEmail());
        existing.setRole(user.getRole());
        
        return repository.save(existing);
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    @Override
    public Optional<User> findById(Long id) {
        return repository.findById(id);
    }

    @Override
    public List<User> findAll() {
        return repository.findAll();
    }

    public Optional<User> findByUsername(String username) {
        return repository.findByUsername(username);
    }

    public List<User> findUsersByRole(UserRole role) {
        return repository.findByRole(role.name());
    }

    public void activateUser(Long id) throws ValidationException {
        User user = repository.findById(id)
            .orElseThrow(() -> new ValidationException("User not found"));
        user.setStatus(UserStatus.ACTIVE);
        repository.save(user);
    }

    public void suspendUser(Long id) throws ValidationException {
        User user = repository.findById(id)
            .orElseThrow(() -> new ValidationException("User not found"));
        user.setStatus(UserStatus.SUSPENDED);
        repository.save(user);
    }
}
