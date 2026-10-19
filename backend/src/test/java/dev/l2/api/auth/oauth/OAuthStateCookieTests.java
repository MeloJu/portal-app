package dev.l2.api.auth.oauth;

import dev.l2.api.auth.oauth.OAuthStateCookie.Started;
import dev.l2.api.auth.verification.MutableClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseCookie;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class OAuthStateCookieTests {

	private static final byte[] KEY = "chave-de-teste-com-32-bytes-ok!!".getBytes(StandardCharsets.UTF_8);

	private static final byte[] OTHER_KEY = "outra-chave-de-teste-32-bytes-ok".getBytes(StandardCharsets.UTF_8);

	private MutableClock clock;

	private OAuthStateCookie cookies;

	@BeforeEach
	void setUp() {
		this.clock = new MutableClock(Instant.parse("2026-10-19T12:00:00Z"));
		this.cookies = new OAuthStateCookie(KEY, true, this.clock);
	}

	@Test
	void issuesAShortLivedLaxHttpOnlyCookieScopedToTheOAuthRoutes() {
		ResponseCookie cookie = this.cookies.start(OAuthProvider.GOOGLE).cookie();

		assertThat(cookie.getName()).isEqualTo("lumi_oauth_state");
		assertThat(cookie.isHttpOnly()).isTrue();
		assertThat(cookie.isSecure()).isTrue();
		assertThat(cookie.getSameSite()).isEqualTo("Lax");
		assertThat(cookie.getPath()).isEqualTo("/api/auth/oauth");
		assertThat(cookie.getMaxAge()).isEqualTo(Duration.ofMinutes(10));
	}

	@Test
	void acceptsTheStateItIssuedAndDerivesAVerifierThatMatchesTheChallenge() {
		Started started = this.cookies.start(OAuthProvider.GOOGLE);

		Optional<String> verifier = this.cookies.verifiedCodeVerifier(OAuthProvider.GOOGLE,
				started.cookie().getValue(), started.state());

		assertThat(verifier).isPresent();
		assertThat(verifier.get()).hasSizeBetween(43, 128).matches("[A-Za-z0-9_-]+");
		assertThat(sha256Base64Url(verifier.get())).isEqualTo(started.codeChallenge());
	}

	@Test
	void eachStartProducesADifferentStateAndVerifier() {
		Started first = this.cookies.start(OAuthProvider.GOOGLE);
		Started second = this.cookies.start(OAuthProvider.GOOGLE);

		assertThat(first.state()).isNotEqualTo(second.state());
		assertThat(first.codeChallenge()).isNotEqualTo(second.codeChallenge());
	}

	@Test
	void refusesAMissingOrDifferentStateParameter() {
		Started started = this.cookies.start(OAuthProvider.GOOGLE);
		String value = started.cookie().getValue();

		assertThat(this.cookies.verifiedCodeVerifier(OAuthProvider.GOOGLE, value, null)).isEmpty();
		assertThat(this.cookies.verifiedCodeVerifier(OAuthProvider.GOOGLE, value, "")).isEmpty();
		assertThat(this.cookies.verifiedCodeVerifier(OAuthProvider.GOOGLE, value, "outro-state")).isEmpty();
	}

	@Test
	void refusesAMissingOrMalformedCookie() {
		Started started = this.cookies.start(OAuthProvider.GOOGLE);

		assertThat(this.cookies.verifiedCodeVerifier(OAuthProvider.GOOGLE, null, started.state())).isEmpty();
		assertThat(this.cookies.verifiedCodeVerifier(OAuthProvider.GOOGLE, "", started.state())).isEmpty();
		assertThat(this.cookies.verifiedCodeVerifier(OAuthProvider.GOOGLE, "a.b", started.state())).isEmpty();
		assertThat(this.cookies.verifiedCodeVerifier(OAuthProvider.GOOGLE, "a.b.c.d", started.state())).isEmpty();
		assertThat(this.cookies.verifiedCodeVerifier(OAuthProvider.GOOGLE, started.state() + ".x.y",
				started.state())).isEmpty();
	}

	@Test
	void refusesATamperedCookie() {
		Started started = this.cookies.start(OAuthProvider.GOOGLE);
		String[] parts = started.cookie().getValue().split("\\.");
		String forgedExpiry = parts[0] + "." + (Long.parseLong(parts[1]) + 3600) + "." + parts[2];
		String forgedSignature = parts[0] + "." + parts[1] + "." + "A".repeat(parts[2].length());

		assertThat(this.cookies.verifiedCodeVerifier(OAuthProvider.GOOGLE, forgedExpiry, started.state())).isEmpty();
		assertThat(this.cookies.verifiedCodeVerifier(OAuthProvider.GOOGLE, forgedSignature, started.state()))
				.isEmpty();
	}

	@Test
	void refusesACookieSignedWithAnotherKey() {
		Started foreign = new OAuthStateCookie(OTHER_KEY, true, this.clock).start(OAuthProvider.GOOGLE);

		assertThat(this.cookies.verifiedCodeVerifier(OAuthProvider.GOOGLE, foreign.cookie().getValue(),
				foreign.state())).isEmpty();
	}

	@Test
	void refusesACookieIssuedForAnotherProvider() {
		Started started = this.cookies.start(OAuthProvider.GOOGLE);

		assertThat(this.cookies.verifiedCodeVerifier(OAuthProvider.GITHUB, started.cookie().getValue(),
				started.state())).isEmpty();
	}

	@Test
	void refusesAnExpiredCookie() {
		Started started = this.cookies.start(OAuthProvider.GOOGLE);

		this.clock.advance(Duration.ofMinutes(9));
		assertThat(this.cookies.verifiedCodeVerifier(OAuthProvider.GOOGLE, started.cookie().getValue(),
				started.state())).isPresent();

		this.clock.advance(Duration.ofMinutes(1));
		assertThat(this.cookies.verifiedCodeVerifier(OAuthProvider.GOOGLE, started.cookie().getValue(),
				started.state())).isEmpty();
	}

	@Test
	void theVerifierDoesNotAppearInTheCookieOrInTheChallengeUrlParameters() {
		Started started = this.cookies.start(OAuthProvider.GITHUB);
		String verifier = this.cookies.verifiedCodeVerifier(OAuthProvider.GITHUB, started.cookie().getValue(),
				started.state()).orElseThrow();

		assertThat(started.cookie().getValue()).doesNotContain(verifier);
		assertThat(started.state()).doesNotContain(verifier);
		assertThat(started.codeChallenge()).isNotEqualTo(verifier);
	}

	@Test
	void expiredCookieClearsTheValue() {
		ResponseCookie expired = this.cookies.expired();

		assertThat(expired.getValue()).isEmpty();
		assertThat(expired.getMaxAge()).isEqualTo(Duration.ZERO);
		assertThat(expired.getPath()).isEqualTo("/api/auth/oauth");
	}

	private static String sha256Base64Url(String value) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.US_ASCII));
			return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
		}
		catch (java.security.NoSuchAlgorithmException unavailable) {
			throw new IllegalStateException(unavailable);
		}
	}

}
