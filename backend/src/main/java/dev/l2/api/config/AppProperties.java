package dev.l2.api.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.stream.Stream;

@Validated
@ConfigurationProperties("app")
public record AppProperties(

		@NotBlank
		@Pattern(regexp = "^https?://.+", message = "deve comecar com http:// ou https://")
		String publicBaseUrl,

		@NotNull @Valid Jwt jwt,

		@NotNull @Valid Codes codes,

		@DefaultValue @Valid Session session,

		@DefaultValue @Valid RateLimit rateLimit,

		@DefaultValue @Valid Mail mail) {

	private static final int MINIMUM_SECRET_BYTES = 32;

	static final String DEFAULT_MAIL_FROM = "no-reply@lumi.local";

	public record Mail(

			@DefaultValue("false") boolean enabled,

			@DefaultValue(DEFAULT_MAIL_FROM) String from) {

		public Mail {
			if (from == null || from.isBlank()) {
				from = DEFAULT_MAIL_FROM;
			}
		}

	}

	public record Session(@DefaultValue("true") boolean secureCookie) {

	}

	public record RateLimit(

			@DefaultValue("true") boolean enabled,

			@DefaultValue @Valid Rule login,

			@DefaultValue @Valid Rule register,

			@DefaultValue @Valid Rule travel,

			@Valid Rule verifyEmail,

			@Valid Rule accountCode,

			@Valid Rule accountChange,

			@Valid Rule accountProfile,

			@Valid Rule oauth) {

		static final Rule DEFAULT_VERIFY_EMAIL = new Rule(20, Duration.ofMinutes(1));

		static final Rule DEFAULT_ACCOUNT = new Rule(10, Duration.ofMinutes(1));

		static final Rule DEFAULT_ACCOUNT_PROFILE = new Rule(20, Duration.ofMinutes(1));

		static final Rule DEFAULT_OAUTH = new Rule(20, Duration.ofMinutes(1));

		public RateLimit {
			if (verifyEmail == null) {
				verifyEmail = DEFAULT_VERIFY_EMAIL;
			}
			if (accountCode == null) {
				accountCode = DEFAULT_ACCOUNT;
			}
			if (accountChange == null) {
				accountChange = DEFAULT_ACCOUNT;
			}
			if (accountProfile == null) {
				accountProfile = DEFAULT_ACCOUNT_PROFILE;
			}
			if (oauth == null) {
				oauth = DEFAULT_OAUTH;
			}
		}

		public Duration longestWindow() {
			return Stream.of(this.login, this.register, this.travel, this.verifyEmail, this.accountCode,
					this.accountChange, this.accountProfile, this.oauth)
					.map(Rule::window)
					.max(Duration::compareTo)
					.orElseThrow();
		}

		public record Rule(

				@DefaultValue("60") @Min(1) int capacity,

				@DefaultValue("1m") @NotNull Duration window) {

		}

	}

	private static byte[] decode(String value) {
		try {
			return Base64.getDecoder().decode(value);
		}
		catch (IllegalArgumentException notBase64) {
			return value.getBytes(StandardCharsets.UTF_8);
		}
	}

	public record Jwt(@NotBlank String secret, @DefaultValue("8h") Duration ttl) {

		@AssertTrue(message = "deve ter no minimo 256 bits (openssl rand -base64 32)")
		public boolean isSecretStrongEnough() {
			return secret != null && secretBytes().length >= MINIMUM_SECRET_BYTES;
		}

		public byte[] secretBytes() {
			return decode(secret);
		}

	}

	public record Codes(

			@NotBlank String pepper,

			@DefaultValue("10m") @NotNull Duration ttl,

			@DefaultValue("5") @Min(1) int maxAttempts,

			@DefaultValue("60s") @NotNull Duration resendCooldown,

			@DefaultValue("5") @Min(1) int maxPerHour) {

		@AssertTrue(message = "deve ter no minimo 256 bits (openssl rand -base64 32)")
		public boolean isPepperStrongEnough() {
			return pepper != null && pepperBytes().length >= MINIMUM_SECRET_BYTES;
		}

		@AssertTrue(message = "ttl deve ser positivo")
		public boolean isTtlPositive() {
			return ttl != null && ttl.isPositive();
		}

		@AssertTrue(message = "resend-cooldown nao pode ser negativo")
		public boolean isResendCooldownNotNegative() {
			return resendCooldown != null && !resendCooldown.isNegative();
		}

		public byte[] pepperBytes() {
			return decode(pepper);
		}

	}

}
