package dev.l2.api.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import dev.l2.api.config.AppProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
public class JwtService {

	private static final MacAlgorithm ALGORITHM = MacAlgorithm.HS256;

	private final JwtEncoder encoder;

	private final JwtDecoder decoder;

	private final Duration ttl;

	private final Clock clock;

	@Autowired
	public JwtService(AppProperties properties) {
		this(properties, Clock.systemUTC());
	}

	JwtService(AppProperties properties, Clock clock) {
		this.clock = clock;
		SecretKey key = new SecretKeySpec(properties.jwt().secretBytes(), ALGORITHM.getName());
		this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
		this.decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(ALGORITHM).build();
		this.ttl = properties.jwt().ttl();
	}

	public String issue(UUID userId, String email, String name) {
		Instant issuedAt = this.clock.instant().truncatedTo(ChronoUnit.SECONDS);
		JwtClaimsSet claims = JwtClaimsSet.builder()
				.subject(userId.toString())
				.issuedAt(issuedAt)
				.expiresAt(issuedAt.plus(this.ttl))
				.claim("email", email)
				.claim("name", name)
				.build();
		return this.encoder.encode(JwtEncoderParameters.from(JwsHeader.with(ALGORITHM).build(), claims))
				.getTokenValue();
	}

	public Jwt verify(String token) {
		return this.decoder.decode(token);
	}

	public long expiresInSeconds() {
		return this.ttl.toSeconds();
	}

}
