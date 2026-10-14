package dev.l2.api.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

@Validated
@ConfigurationProperties("app")
public record AppProperties(

		@NotBlank
		@Pattern(regexp = "^https?://.+", message = "deve comecar com http:// ou https://")
		String publicBaseUrl,

		@NotNull @Valid Jwt jwt) {

	private static final int MINIMUM_SECRET_BYTES = 32;

	public record Jwt(@NotBlank String secret, @DefaultValue("8h") Duration ttl) {

		@AssertTrue(message = "deve ter no minimo 256 bits (openssl rand -base64 32)")
		public boolean isSecretStrongEnough() {
			return secret != null && secretBytes().length >= MINIMUM_SECRET_BYTES;
		}

		public byte[] secretBytes() {
			try {
				return Base64.getDecoder().decode(secret);
			}
			catch (IllegalArgumentException notBase64) {
				return secret.getBytes(StandardCharsets.UTF_8);
			}
		}

	}

}
