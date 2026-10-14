package dev.l2.api.auth;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class SessionCookieTests {

	private final SessionCookie cookie = new SessionCookie(Duration.ofHours(8), true);

	@Test
	void issuesTheFlagsThatTheContractDocuments() {
		String header = this.cookie.issue("um.jwt.qualquer").toString();

		assertThat(header).startsWith(SessionCookie.NAME + "=um.jwt.qualquer");
		assertThat(header).contains("Path=/");
		assertThat(header).contains("Max-Age=28800");
		assertThat(header).contains("HttpOnly");
		assertThat(header).contains("Secure");
		assertThat(header).contains("SameSite=Strict");
	}

	@Test
	void expiredCookieHasNoValueAndMaxAgeZero() {
		String header = this.cookie.expired().toString();

		assertThat(header).startsWith(SessionCookie.NAME + "=;");
		assertThat(header).contains("Max-Age=0");
		assertThat(header).contains("HttpOnly");
		assertThat(header).contains("SameSite=Strict");
	}

	@Test
	void dropsSecureOnlyWhenDevelopmentTurnsItOff() {
		String header = new SessionCookie(Duration.ofHours(8), false).issue("um.jwt.qualquer").toString();

		assertThat(header).doesNotContain("Secure");
		assertThat(header).contains("HttpOnly");
		assertThat(header).contains("SameSite=Strict");
	}

}
