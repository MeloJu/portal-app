package dev.l2.api.auth.oauth;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserIdentityRepository extends JpaRepository<UserIdentity, UUID> {

	@EntityGraph(attributePaths = "user")
	Optional<UserIdentity> findByProviderAndProviderUserId(OAuthProvider provider, String providerUserId);

}
