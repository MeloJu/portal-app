package dev.l2.api.auth.oauth;

import dev.l2.api.config.AppProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.Optional;

@Component
public class OAuthStateCookie {

	public static final String NAME = "lumi_oauth_state";

	static final Duration TTL = Duration.ofMinutes(10);

	private static final String PATH = "/api/auth/oauth";

	private static final String MAC_ALGORITHM = "HmacSHA256";

	private static final int STATE_BYTES = 32;

	private final byte[] key;

	private final boolean secure;

	private final Clock clock;

	private final SecureRandom random = new SecureRandom();

	@Autowired
	public OAuthStateCookie(AppProperties properties, Clock clock) {
		this(properties.jwt().secretBytes(), properties.session().secureCookie(), clock);
	}

	OAuthStateCookie(byte[] key, boolean secure, Clock clock) {
		this.key = key.clone();
		this.secure = secure;
		this.clock = clock;
	}

	public Started start(OAuthProvider provider) {
		byte[] bytes = new byte[STATE_BYTES];
		this.random.nextBytes(bytes);
		String state = encode(bytes);
		long expiresAt = this.clock.instant().plus(TTL).getEpochSecond();
		String value = state + "." + expiresAt + "." + signature(provider, state, expiresAt);
		return new Started(state, challengeOf(verifierOf(provider, state)), cookie(value, TTL));
	}

	public Optional<String> verifiedCodeVerifier(OAuthProvider provider, String cookieValue, String stateParameter) {
		if (cookieValue == null || stateParameter == null) {
			return Optional.empty();
		}
		String[] parts = cookieValue.split("\\.", -1);
		if (parts.length != 3) {
			return Optional.empty();
		}
		long expiresAt;
		try {
			expiresAt = Long.parseLong(parts[1]);
		}
		catch (NumberFormatException malformed) {
			return Optional.empty();
		}
		String state = parts[0];
		boolean authentic = sameBytes(signature(provider, state, expiresAt), parts[2]);
		boolean fresh = expiresAt > this.clock.instant().getEpochSecond();
		boolean sameRound = sameBytes(state, stateParameter);
		if (!authentic || !fresh || !sameRound) {
			return Optional.empty();
		}
		return Optional.of(verifierOf(provider, state));
	}

	public ResponseCookie expired() {
		return cookie("", Duration.ZERO);
	}

	private ResponseCookie cookie(String value, Duration maxAge) {
		return ResponseCookie.from(NAME, value)
				.path(PATH)
				.httpOnly(true)
				.secure(this.secure)
				.sameSite("Lax")
				.maxAge(maxAge)
				.build();
	}

	private String signature(OAuthProvider provider, String state, long expiresAt) {
		return mac("oauth-state|" + provider.slug() + "|" + state + "|" + expiresAt);
	}

	private String verifierOf(OAuthProvider provider, String state) {
		return mac("oauth-pkce|" + provider.slug() + "|" + state);
	}

	private String mac(String message) {
		try {
			Mac mac = Mac.getInstance(MAC_ALGORITHM);
			mac.init(new SecretKeySpec(this.key, MAC_ALGORITHM));
			return encode(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
		}
		catch (GeneralSecurityException unavailable) {
			throw new IllegalStateException(unavailable);
		}
	}

	private static String challengeOf(String verifier) {
		try {
			return encode(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));
		}
		catch (GeneralSecurityException unavailable) {
			throw new IllegalStateException(unavailable);
		}
	}

	private static boolean sameBytes(String expected, String actual) {
		return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
				actual.getBytes(StandardCharsets.UTF_8));
	}

	private static String encode(byte[] bytes) {
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	public record Started(String state, String codeChallenge, ResponseCookie cookie) {

	}

}
