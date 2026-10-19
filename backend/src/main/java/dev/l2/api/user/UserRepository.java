package dev.l2.api.user;

import dev.l2.api.auth.EmailNotVerifiedException;
import dev.l2.api.auth.InvalidCredentialsException;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

	Optional<User> findByEmail(String email);

	boolean existsByEmail(String email);

	default User requireVerified(UUID userId) {
		User user = findById(userId).orElseThrow(InvalidCredentialsException::new);
		if (!user.isEmailVerified()) {
			throw new EmailNotVerifiedException();
		}
		return user;
	}

}
