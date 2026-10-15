package dev.l2.api.link;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface LinkRepository extends JpaRepository<Link, UUID> {

	String OPEN = "l.closedAt is null"
			+ " and (l.expiresAt is null or l.expiresAt > :now)"
			+ " and (l.maxTravels is null or l.travelCount < l.maxTravels)";

	String OWNED = "l.owner.id = :ownerId";

	Optional<Link> findByCode(String code);

	Optional<Link> findByCodeAndOwnerId(String code, UUID ownerId);

	boolean existsByCode(String code);

	Page<Link> findByOwnerId(UUID ownerId, Pageable pageable);

	@Query("select l from Link l where " + OWNED + " and " + OPEN + " and l.paused = false")
	Page<Link> findActiveByOwnerId(@Param("ownerId") UUID ownerId, @Param("now") Instant now, Pageable pageable);

	@Query("select l from Link l where " + OWNED + " and " + OPEN + " and l.paused = true")
	Page<Link> findPausedByOwnerId(@Param("ownerId") UUID ownerId, @Param("now") Instant now, Pageable pageable);

	@Query("select l from Link l where " + OWNED + " and not (" + OPEN + ")")
	Page<Link> findClosedByOwnerId(@Param("ownerId") UUID ownerId, @Param("now") Instant now, Pageable pageable);

}
