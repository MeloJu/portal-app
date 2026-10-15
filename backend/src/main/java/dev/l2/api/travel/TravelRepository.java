package dev.l2.api.travel;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface TravelRepository extends JpaRepository<Travel, UUID> {

	long countByLinkId(UUID linkId);

	long countByLinkIdAndBot(UUID linkId, boolean bot);

}
