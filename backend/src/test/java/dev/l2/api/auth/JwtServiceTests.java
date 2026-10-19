package dev.l2.api.auth;

import dev.l2.api.config.AppProperties;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTests {

	private static final String SECRET = Base64.getEncoder()
			.encodeToString("chave-de-teste-com-32-bytes-ok!!".getBytes(StandardCharsets.UTF_8));

	private static final String OTHER_SECRET = Base64.getEncoder()
			.encodeToString("outra-chave-de-teste-com-32-byte".getBytes(StandardCharsets.UTF_8));

	private static final UUID USER_ID = UUID.fromString("0192f0a0-0000-7000-8000-000000000001");

	private JwtService service(String secret, Duration ttl) {
		return service(secret, ttl, Clock.systemUTC());
	}

	private JwtService service(String secret, Duration ttl, Clock clock) {
		return new JwtService(new AppProperties("https://l2.to", new AppProperties.Jwt(secret, ttl), null, new AppProperties.Session(true), null, null), clock);
	}

	private String issue(JwtService service) {
		return service.issue(USER_ID, "ana@example.com", "Ana");
	}

	@Test
	void issuesTokenThatItCanRead() {
		JwtService service = service(SECRET, Duration.ofHours(8));

		Jwt jwt = service.verify(issue(service));

		assertThat(jwt.getSubject()).isEqualTo(USER_ID.toString());
		assertThat(jwt.getClaimAsString("email")).isEqualTo("ana@example.com");
		assertThat(jwt.getClaimAsString("name")).isEqualTo("Ana");
		assertThat(jwt.getIssuedAt()).isBeforeOrEqualTo(Instant.now());
	}

	@Test
	void tokenExpiresAfterTheConfiguredTtl() {
		JwtService service = service(SECRET, Duration.ofHours(8));

		Jwt jwt = service.verify(issue(service));

		assertThat(Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt())).isEqualTo(Duration.ofHours(8));
	}

	/** Uma hora atras com TTL de um minuto: passa longe dos 60 s de desvio que o decoder tolera. */
	@Test
	void rejectsExpiredToken() {
		Clock anHourAgo = Clock.fixed(Instant.now().minus(Duration.ofHours(1)), ZoneOffset.UTC);
		String expired = issue(service(SECRET, Duration.ofMinutes(1), anHourAgo));

		assertThatThrownBy(() -> service(SECRET, Duration.ofHours(8)).verify(expired))
				.isInstanceOf(JwtException.class);
	}

	@Test
	void rejectsTokenSignedWithAnotherSecret() {
		String foreign = issue(service(OTHER_SECRET, Duration.ofHours(8)));

		assertThatThrownBy(() -> service(SECRET, Duration.ofHours(8)).verify(foreign))
				.isInstanceOf(JwtException.class);
	}

	@Test
	void rejectsTamperedToken() {
		JwtService service = service(SECRET, Duration.ofHours(8));
		String token = issue(service);
		String tampered = token.substring(0, token.lastIndexOf('.') + 1) + "YWJjZGVm";

		assertThatThrownBy(() -> service.verify(tampered)).isInstanceOf(JwtException.class);
	}

	@Test
	void expiresInReportsTtlInSeconds() {
		assertThat(service(SECRET, Duration.ofHours(8)).expiresInSeconds()).isEqualTo(28800);
	}

}
