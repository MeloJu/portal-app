package dev.l2.api.security;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface BlockedEventRepository extends JpaRepository<BlockedEvent, UUID> {

}
