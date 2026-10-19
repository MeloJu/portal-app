package dev.l2.api.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.validation.autoconfigure.ValidationAutoConfiguration;
import org.springframework.context.annotation.Configuration;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A app precisa morrer na subida quando o JWT_SECRET falta ou e curto demais:
 * o modo de falha que nao queremos e rodar em producao com segredo de desenvolvimento
 * (backend/docs/SECURITY.md, secao 5).
 */
class AppPropertiesTest {

	private static final String STRONG_SECRET = Base64.getEncoder()
			.encodeToString("chave-de-teste-com-32-bytes-ok!!".getBytes(StandardCharsets.UTF_8));

	private static final String STRONG_PEPPER = Base64.getEncoder()
			.encodeToString("pepper-de-teste-com-32-bytes-ok!".getBytes(StandardCharsets.UTF_8));

	private final ApplicationContextRunner runner = new ApplicationContextRunner()
			.withConfiguration(AutoConfigurations.of(ValidationAutoConfiguration.class))
			.withUserConfiguration(TestConfig.class);

	@Test
	void bindsWhenSecretIsStrongEnough() {
		runner.withPropertyValues(
				"app.public-base-url=https://l2.to",
				"app.jwt.secret=" + STRONG_SECRET,
				"app.codes.pepper=" + STRONG_PEPPER)
				.run(context -> {
					assertThat(context).hasNotFailed();
					AppProperties properties = context.getBean(AppProperties.class);
					assertThat(properties.publicBaseUrl()).isEqualTo("https://l2.to");
					assertThat(properties.jwt().secret()).isEqualTo(STRONG_SECRET);
					assertThat(properties.codes().pepper()).isEqualTo(STRONG_PEPPER);
				});
	}

	@Test
	void failsWhenSecretIsMissing() {
		runner.withPropertyValues("app.public-base-url=https://l2.to")
				.run(context -> assertThat(context).hasFailed());
	}

	@Test
	void failsWhenSecretIsShorterThan256Bits() {
		runner.withPropertyValues(
				"app.public-base-url=https://l2.to",
				"app.jwt.secret=segredo-curto",
				"app.codes.pepper=" + STRONG_PEPPER)
				.run(context -> assertThat(context).hasFailed());
	}

	@Test
	void failsWhenPepperIsMissing() {
		runner.withPropertyValues(
				"app.public-base-url=https://l2.to",
				"app.jwt.secret=" + STRONG_SECRET)
				.run(context -> assertThat(context).hasFailed());
	}

	@Test
	void failsWhenPepperIsShorterThan256Bits() {
		runner.withPropertyValues(
				"app.public-base-url=https://l2.to",
				"app.jwt.secret=" + STRONG_SECRET,
				"app.codes.pepper=pepper-curto")
				.run(context -> assertThat(context).hasFailed());
	}

	@Test
	void failsWhenPublicBaseUrlIsMissing() {
		runner.withPropertyValues("app.jwt.secret=" + STRONG_SECRET,
				"app.codes.pepper=" + STRONG_PEPPER)
				.run(context -> assertThat(context).hasFailed());
	}

	@Test
	void failsWhenPublicBaseUrlIsNotHttp() {
		runner.withPropertyValues(
				"app.public-base-url=javascript:alert(1)",
				"app.jwt.secret=" + STRONG_SECRET,
				"app.codes.pepper=" + STRONG_PEPPER)
				.run(context -> assertThat(context).hasFailed());
	}

	@Test
	void mailDefaultsToDisabledWithLocalSender() {
		runner.withPropertyValues(
				"app.public-base-url=https://l2.to",
				"app.jwt.secret=" + STRONG_SECRET,
				"app.codes.pepper=" + STRONG_PEPPER)
				.run(context -> {
					AppProperties.Mail mail = context.getBean(AppProperties.class).mail();
					assertThat(mail.enabled()).isFalse();
					assertThat(mail.from()).isEqualTo("no-reply@lumi.local");
				});
	}

	@Test
	void blankMailFromFallsBackToDefault() {
		runner.withPropertyValues(
				"app.public-base-url=https://l2.to",
				"app.jwt.secret=" + STRONG_SECRET,
				"app.codes.pepper=" + STRONG_PEPPER,
				"app.mail.from=")
				.run(context -> {
					assertThat(context).hasNotFailed();
					assertThat(context.getBean(AppProperties.class).mail().from()).isEqualTo("no-reply@lumi.local");
				});
	}

	@Test
	void mailBindsOverrides() {
		runner.withPropertyValues(
				"app.public-base-url=https://l2.to",
				"app.jwt.secret=" + STRONG_SECRET,
				"app.codes.pepper=" + STRONG_PEPPER,
				"app.mail.enabled=true",
				"app.mail.from=lumi@example.com")
				.run(context -> {
					AppProperties.Mail mail = context.getBean(AppProperties.class).mail();
					assertThat(mail.enabled()).isTrue();
					assertThat(mail.from()).isEqualTo("lumi@example.com");
				});
	}

	@Test
	void codesDefaultToTenMinutesFiveAttemptsSixtySecondsAndFivePerHour() {
		runner.withPropertyValues(
				"app.public-base-url=https://l2.to",
				"app.jwt.secret=" + STRONG_SECRET,
				"app.codes.pepper=" + STRONG_PEPPER)
				.run(context -> {
					AppProperties.Codes codes = context.getBean(AppProperties.class).codes();
					assertThat(codes.ttl()).isEqualTo(Duration.ofMinutes(10));
					assertThat(codes.maxAttempts()).isEqualTo(5);
					assertThat(codes.resendCooldown()).isEqualTo(Duration.ofSeconds(60));
					assertThat(codes.maxPerHour()).isEqualTo(5);
				});
	}

	@Test
	void codesBindOverrides() {
		runner.withPropertyValues(
				"app.public-base-url=https://l2.to",
				"app.jwt.secret=" + STRONG_SECRET,
				"app.codes.pepper=" + STRONG_PEPPER,
				"app.codes.ttl=15m",
				"app.codes.max-attempts=3",
				"app.codes.resend-cooldown=30s",
				"app.codes.max-per-hour=10")
				.run(context -> {
					AppProperties.Codes codes = context.getBean(AppProperties.class).codes();
					assertThat(codes.ttl()).isEqualTo(Duration.ofMinutes(15));
					assertThat(codes.maxAttempts()).isEqualTo(3);
					assertThat(codes.resendCooldown()).isEqualTo(Duration.ofSeconds(30));
					assertThat(codes.maxPerHour()).isEqualTo(10);
				});
	}

	@Test
	void failsWhenCodeLimitsAreInvalid() {
		for (String invalid : new String[] { "app.codes.max-attempts=0", "app.codes.max-per-hour=0",
				"app.codes.ttl=0s", "app.codes.resend-cooldown=-1s" }) {
			runner.withPropertyValues(
					"app.public-base-url=https://l2.to",
					"app.jwt.secret=" + STRONG_SECRET,
					"app.codes.pepper=" + STRONG_PEPPER,
					invalid)
					.run(context -> assertThat(context).hasFailed());
		}
	}

	@Configuration(proxyBeanMethods = false)
	@EnableConfigurationProperties(AppProperties.class)
	static class TestConfig {

	}

}
