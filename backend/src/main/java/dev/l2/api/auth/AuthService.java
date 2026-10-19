package dev.l2.api.auth;

import dev.l2.api.auth.verification.VerificationTokenService;
import dev.l2.api.user.User;
import dev.l2.api.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

	private static final String ABSENT_USER_HASH = "$2a$10$7EqJtq98hPqEX7fNZaFWoOhi5sCJ3xQ5Bq3n3D5hXy1bGQPbQGhQe";

	private final UserRepository users;

	private final PasswordEncoder passwordEncoder;

	private final VerificationTokenService verification;

	public AuthService(UserRepository users, PasswordEncoder passwordEncoder,
			VerificationTokenService verification) {
		this.users = users;
		this.passwordEncoder = passwordEncoder;
		this.verification = verification;
	}

	@Transactional
	public User register(String name, String email, String rawPassword) {
		String normalized = normalize(email);
		if (this.users.existsByEmail(normalized)) {
			throw new EmailAlreadyUsedException();
		}
		User user = this.users.save(new User(normalized, this.passwordEncoder.encode(rawPassword), name));
		this.verification.issueAndNotify(user);
		return user;
	}

	@Transactional(readOnly = true)
	public User login(String email, String rawPassword) {
		User user = this.users.findByEmail(normalize(email)).orElse(null);
		String hash = user == null ? ABSENT_USER_HASH : user.getPasswordHash();
		boolean matches = this.passwordEncoder.matches(rawPassword, hash);
		if (user == null || !matches) {
			throw new InvalidCredentialsException();
		}
		return user;
	}

	@Transactional(readOnly = true)
	public User require(UUID id) {
		return this.users.findById(id).orElseThrow(InvalidCredentialsException::new);
	}

	private String normalize(String email) {
		return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
	}

}
