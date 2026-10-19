package dev.l2.api.auth.verification;

import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.auth.SessionCookie;
import dev.l2.api.mail.OutgoingEmail;
import dev.l2.api.mail.RecordingEmailSender;
import dev.l2.api.mail.TestEmailConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import({ TestcontainersConfiguration.class, TestEmailConfiguration.class,
		VerificationFlowTests.ControlledClockConfiguration.class })
@AutoConfigureMockMvc
@SpringBootTest(properties = {
		"app.rate-limit.enabled=false",
		"app.public-base-url=https://lumi.test/" })
class VerificationFlowTests {

	private static final Pattern TOKEN_IN_LINK = Pattern.compile("https://lumi\\.test/verificar-email\\?token=(\\S+)");

	@Autowired
	private MockMvc mvc;

	@Autowired
	private RecordingEmailSender mailbox;

	@Autowired
	private MutableClock clock;

	@Autowired
	private EmailVerificationTokenRepository tokens;

	@BeforeEach
	void startFromACleanMailbox() {
		this.mailbox.clear();
		this.clock.reset(Instant.now());
	}

	@Test
	void registerSendsExactlyOneEmailWithTheLinkAndStoresOnlyTheHash() throws Exception {
		String email = unique() + "@example.com";
		register(email);

		String token = awaitTokenFor(email);

		assertThat(this.mailbox.all()).hasSize(1);
		assertThat(token).hasSize(43).matches("[A-Za-z0-9_-]+");
		assertThat(this.tokens.findByTokenHash(token)).isEmpty();
		assertThat(this.tokens.findByTokenHash(VerificationTokenService.hash(token))).hasValueSatisfying(stored -> {
			assertThat(stored.getTokenHash()).isNotEqualTo(token).hasSize(64);
			assertThat(stored.getExpiresAt())
					.isCloseTo(this.clock.instant().plus(Duration.ofMinutes(30)), within(1, ChronoUnit.MILLIS));
		});
	}

	@Test
	void verifyConfirmsTheEmailAndASecondUseIsInvalid() throws Exception {
		String email = unique() + "@example.com";
		Cookie session = register(email);
		String token = awaitTokenFor(email);

		me(session).andExpect(jsonPath("$.emailVerified").value(false));

		verify(token).andExpect(status().isNoContent());

		me(session).andExpect(jsonPath("$.emailVerified").value(true));
		verify(token)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("TOKEN_INVALID"));
	}

	@Test
	void tokenExpiresAfterThirtyMinutes() throws Exception {
		String email = unique() + "@example.com";
		register(email);
		String token = awaitTokenFor(email);

		this.clock.advance(Duration.ofMinutes(31));

		verify(token)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("TOKEN_EXPIRED"));
	}

	@Test
	void tokenStillWorksBeforeThirtyMinutes() throws Exception {
		String email = unique() + "@example.com";
		register(email);
		String token = awaitTokenFor(email);

		this.clock.advance(Duration.ofMinutes(29));

		verify(token).andExpect(status().isNoContent());
	}

	@Test
	void unknownOrTamperedTokenIsInvalid() throws Exception {
		String email = unique() + "@example.com";
		register(email);
		String token = awaitTokenFor(email);
		String tampered = token.substring(0, token.length() - 1) + (token.endsWith("A") ? "B" : "A");

		verify(tampered).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("TOKEN_INVALID"));
		verify("inexistente").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("TOKEN_INVALID"));
	}

	@Test
	void verifyRejectsBlankAndOversizedTokens() throws Exception {
		verify("").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		verify("a".repeat(101)).andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void resendInvalidatesThePreviousToken() throws Exception {
		String email = unique() + "@example.com";
		Cookie session = register(email);
		String first = awaitTokenFor(email);

		this.clock.advance(Duration.ofSeconds(61));
		resend(session).andExpect(status().isNoContent());
		String second = awaitLastTokenFor(email, first);

		assertThat(this.mailbox.all()).hasSize(2);
		verify(first).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("TOKEN_INVALID"));
		verify(second).andExpect(status().isNoContent());
	}

	@Test
	void resendWithinTheCooldownIsRejectedWithRetryAfter() throws Exception {
		Cookie session = register(unique() + "@example.com");

		this.clock.advance(Duration.ofSeconds(30));

		resend(session)
				.andExpect(status().isTooManyRequests())
				.andExpect(header().exists(HttpHeaders.RETRY_AFTER))
				.andExpect(jsonPath("$.code").value("RATE_LIMIT"));
		await().during(Duration.ofMillis(300)).atMost(Duration.ofSeconds(2))
				.untilAsserted(() -> assertThat(this.mailbox.all()).hasSize(1));
	}

	@Test
	void sixthSendWithinAnHourIsRejected() throws Exception {
		Cookie session = register(unique() + "@example.com");

		for (int resend = 0; resend < 4; resend++) {
			this.clock.advance(Duration.ofSeconds(61));
			resend(session).andExpect(status().isNoContent());
		}
		this.clock.advance(Duration.ofSeconds(61));

		resend(session)
				.andExpect(status().isTooManyRequests())
				.andExpect(header().exists(HttpHeaders.RETRY_AFTER))
				.andExpect(jsonPath("$.code").value("RATE_LIMIT"));

		this.clock.advance(Duration.ofMinutes(56));
		resend(session).andExpect(status().isNoContent());
	}

	@Test
	void resendForAVerifiedUserIsAConflict() throws Exception {
		String email = unique() + "@example.com";
		Cookie session = register(email);
		verify(awaitTokenFor(email)).andExpect(status().isNoContent());

		this.clock.advance(Duration.ofSeconds(61));

		resend(session)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("ALREADY_VERIFIED"));
	}

	@Test
	void resendWithoutSessionIsUnauthorized() throws Exception {
		this.mvc.perform(post("/api/auth/resend-verification")).andExpect(status().isUnauthorized());
	}

	@Test
	void unverifiedAccountCanLogInAndUseTheApi() throws Exception {
		String email = unique() + "@example.com";
		register(email);

		Cookie session = this.mvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"email":"%s","password":"senha-bem-grande"}""".formatted(email)))
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getCookie(SessionCookie.NAME);

		me(session).andExpect(status().isOk()).andExpect(jsonPath("$.emailVerified").value(false));
	}

	private Cookie register(String email) throws Exception {
		return this.mvc.perform(post("/api/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"name":"Ana","email":"%s","password":"senha-bem-grande"}""".formatted(email)))
				.andExpect(status().isCreated())
				.andReturn()
				.getResponse()
				.getCookie(SessionCookie.NAME);
	}

	private ResultActions verify(String token) throws Exception {
		return this.mvc.perform(post("/api/auth/verify-email")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"token":"%s"}""".formatted(token)));
	}

	private ResultActions resend(Cookie session) throws Exception {
		return this.mvc.perform(post("/api/auth/resend-verification").cookie(session));
	}

	private ResultActions me(Cookie session) throws Exception {
		return this.mvc.perform(get("/api/me").cookie(session));
	}

	private String awaitTokenFor(String email) {
		return awaitLastTokenFor(email, null);
	}

	private String awaitLastTokenFor(String email, String different) {
		String[] found = new String[1];
		await().atMost(Duration.ofSeconds(5)).until(() -> {
			List<OutgoingEmail> mails = this.mailbox.all().stream().filter(mail -> mail.to().equals(email)).toList();
			if (mails.isEmpty()) {
				return false;
			}
			Matcher matcher = TOKEN_IN_LINK.matcher(mails.get(mails.size() - 1).textBody());
			if (!matcher.find() || matcher.group(1).equals(different)) {
				return false;
			}
			found[0] = matcher.group(1);
			return true;
		});
		return found[0];
	}

	private static String unique() {
		return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class ControlledClockConfiguration {

		@Bean
		@Primary
		MutableClock controlledClock() {
			return new MutableClock(Instant.now());
		}

	}

}
