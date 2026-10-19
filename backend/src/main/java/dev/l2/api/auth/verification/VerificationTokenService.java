package dev.l2.api.auth.verification;

import dev.l2.api.auth.InvalidCredentialsException;
import dev.l2.api.user.User;
import dev.l2.api.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
public class VerificationTokenService {

	static final int TOKEN_BYTES = 32;

	static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);

	static final Duration RESEND_WINDOW = Duration.ofHours(1);

	static final int MAX_SENDS_PER_WINDOW = 5;

	private final EmailVerificationTokenRepository tokens;

	private final UserRepository users;

	private final ApplicationEventPublisher events;

	private final Clock clock;

	private final Duration ttl;

	private final SecureRandom random = new SecureRandom();

	public VerificationTokenService(EmailVerificationTokenRepository tokens, UserRepository users,
			ApplicationEventPublisher events, Clock clock,
			@Value("${app.verification.token-ttl:30m}") Duration ttl) {
		this.tokens = tokens;
		this.users = users;
		this.events = events;
		this.clock = clock;
		this.ttl = ttl;
	}

	@Transactional
	public String issue(User user) {
		Instant now = this.clock.instant();
		this.tokens.findByUserIdAndUsedAtIsNull(user.getId()).forEach(previous -> previous.markUsed(now));
		String raw = generate();
		this.tokens.saveAndFlush(new EmailVerificationToken(user, hash(raw), now.plus(this.ttl)));
		return raw;
	}

	@Transactional
	public void issueAndNotify(User user) {
		String raw = issue(user);
		this.events.publishEvent(new VerificationEmailRequested(user.getEmail(), raw));
	}

	@Transactional
	public void verify(String rawToken) {
		EmailVerificationToken token = this.tokens.findByTokenHash(hash(rawToken))
				.orElseThrow(VerificationTokenInvalidException::new);
		if (token.getUsedAt() != null) {
			throw new VerificationTokenInvalidException();
		}
		Instant now = this.clock.instant();
		if (!token.getExpiresAt().isAfter(now)) {
			throw new VerificationTokenExpiredException();
		}
		token.markUsed(now);
		token.getUser().markEmailVerified(now);
	}

	@Transactional
	public void resend(UUID userId) {
		User user = this.users.findById(userId).orElseThrow(InvalidCredentialsException::new);
		if (user.isEmailVerified()) {
			throw new AlreadyVerifiedException();
		}
		Instant now = this.clock.instant();
		List<EmailVerificationToken> recent = this.tokens
				.findByUserIdAndCreatedAtAfterOrderByCreatedAtAsc(userId, now.minus(RESEND_WINDOW));
		if (!recent.isEmpty()) {
			Instant cooldownEnds = recent.get(recent.size() - 1).getCreatedAt().plus(RESEND_COOLDOWN);
			if (cooldownEnds.isAfter(now)) {
				throw new ResendTooSoonException(Duration.between(now, cooldownEnds));
			}
		}
		if (recent.size() >= MAX_SENDS_PER_WINDOW) {
			Instant windowOpens = recent.get(0).getCreatedAt().plus(RESEND_WINDOW);
			throw new ResendTooSoonException(Duration.between(now, windowOpens));
		}
		issueAndNotify(user);
	}

	private String generate() {
		byte[] bytes = new byte[TOKEN_BYTES];
		this.random.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	static String hash(String raw) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest);
		}
		catch (NoSuchAlgorithmException unavailable) {
			throw new IllegalStateException(unavailable);
		}
	}

}
