package dev.l2.api.auth.verification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, UUID> {

	Optional<EmailVerificationToken> findByTokenHash(String tokenHash);

	List<EmailVerificationToken> findByUserIdAndUsedAtIsNull(UUID userId);

	List<EmailVerificationToken> findByUserIdAndCreatedAtAfterOrderByCreatedAtAsc(UUID userId, Instant since);

}
