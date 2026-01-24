package com.example.service;

import com.example.model.User;
import java.util.List;
import java.util.Optional;

/**
 * Repository interface for User entities with custom queries.
 */
public interface UserRepository extends Repository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    List<User> findByRole(String role);
    List<User> findActiveUsers();
}
