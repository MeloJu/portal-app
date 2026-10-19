package dev.l2.api.account;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccountCodeRepository extends JpaRepository<AccountCode, UUID> {

	Optional<AccountCode> findFirstByUserIdAndPurposeOrderByCreatedAtDesc(UUID userId, AccountCodePurpose purpose);

	List<AccountCode> findByUserIdAndPurposeAndCreatedAtAfterOrderByCreatedAtAsc(UUID userId,
			AccountCodePurpose purpose, Instant since);

	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("update AccountCode c set c.usedAt = :now where c.user.id = :userId and c.purpose = :purpose and c.usedAt is null")
	int invalidateActive(@Param("userId") UUID userId, @Param("purpose") AccountCodePurpose purpose,
			@Param("now") Instant now);

	@Modifying(flushAutomatically = true)
	@Query("update AccountCode c set c.usedAt = :now where c.id = :id and c.usedAt is null and c.attempts < :maxAttempts and c.expiresAt > :now")
	int markUsedIfUnused(@Param("id") UUID id, @Param("now") Instant now, @Param("maxAttempts") int maxAttempts);

	@Modifying
	@Query("update AccountCode c set c.attempts = c.attempts + 1 where c.id = :id and c.attempts < :maxAttempts")
	int incrementAttempts(@Param("id") UUID id, @Param("maxAttempts") int maxAttempts);

	@Query("select c.attempts from AccountCode c where c.id = :id")
	int attemptsOf(@Param("id") UUID id);

	@Query(value = "select 1 from (select pg_advisory_xact_lock(hashtextextended(:key, 0))) as locked", nativeQuery = true)
	int lockIssuance(@Param("key") String key);

	@Modifying
	@Query("update AccountCode c set c.usedAt = :now where c.id = :id and c.attempts >= :maxAttempts and c.usedAt is null")
	int invalidateIfExhausted(@Param("id") UUID id, @Param("maxAttempts") int maxAttempts, @Param("now") Instant now);

}
