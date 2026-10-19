package dev.l2.api.account;

import dev.l2.api.EmailVerification;
import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.auth.SessionCookie;
import dev.l2.api.auth.verification.MutableClock;
import dev.l2.api.config.AppProperties;
import dev.l2.api.mail.OutgoingEmail;
import dev.l2.api.mail.RecordingEmailSender;
import dev.l2.api.mail.TestEmailConfiguration;
import dev.l2.api.user.User;
import dev.l2.api.user.UserRepository;
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
import org.springframework.transaction.PlatformTransactionManager;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import({ TestcontainersConfiguration.class, TestEmailConfiguration.class, AccountFlowTests.ControlledClock.class })
@AutoConfigureMockMvc
@SpringBootTest(properties = "app.rate-limit.enabled=false")
class AccountFlowTests {

	private static final String PASSWORD = "senha-bem-grande";

	private static final String NEW_PASSWORD = "outra-senha-grande";

	private static final String WRONG_PASSWORD = "errada-errada";

	private static final Pattern SIX_DIGITS = Pattern.compile("(?m)^(\\d{6})$");

	@Autowired
	private MockMvc mvc;

	@Autowired
	private RecordingEmailSender mailbox;

	@Autowired
	private MutableClock clock;

	@Autowired
	private UserRepository users;

	@BeforeEach
	void startClean() {
		this.mailbox.clear();
		this.clock.reset(Instant.now());
	}

	@Test
	void emailChangeFlowMovesTheAccountToTheNewAddress() throws Exception {
		Account account = verifiedAccount();
		String newEmail = unique() + "@example.com";
		this.mailbox.clear();

		requestEmailCode(account.cookie(), newEmail.toUpperCase()).andExpect(status().isNoContent());
		String code = awaitCodeSentTo(newEmail);
		assertThat(this.mailbox.all()).extracting(OutgoingEmail::to).containsOnly(newEmail);

		ResultActions confirmed = changeEmail(account.cookie(), newEmail, code, PASSWORD);

		confirmed.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value(newEmail))
				.andExpect(jsonPath("$.emailVerified").value(true))
				.andExpect(header().string(HttpHeaders.SET_COOKIE, startsWith(SessionCookie.NAME + "=")));
		Cookie fresh = confirmed.andReturn().getResponse().getCookie(SessionCookie.NAME);
		this.mvc.perform(get("/api/me").cookie(fresh))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value(newEmail));
		login(newEmail, PASSWORD).andExpect(status().isOk());
		login(account.email(), PASSWORD).andExpect(status().isUnauthorized());
		await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> assertThat(this.mailbox.all())
				.anySatisfy(mail -> {
					assertThat(mail.to()).isEqualTo(account.email());
					assertThat(mail.textBody()).contains(newEmail).doesNotContain(code);
				}));
	}

	@Test
	void passwordChangeFlowReplacesTheCredentials() throws Exception {
		Account account = verifiedAccount();
		this.mailbox.clear();

		requestPasswordCode(account.cookie()).andExpect(status().isNoContent());
		String code = awaitCodeSentTo(account.email());

		ResultActions confirmed = changePassword(account.cookie(), code, PASSWORD, NEW_PASSWORD);

		confirmed.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value(account.email()))
				.andExpect(header().exists(HttpHeaders.SET_COOKIE));
		login(account.email(), NEW_PASSWORD).andExpect(status().isOk());
		login(account.email(), PASSWORD)
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
	}

	@Test
	void unverifiedAccountIsBlockedOnEveryAccountRoute() throws Exception {
		Cookie cookie = register(unique() + "@example.com");

		requestPasswordCode(cookie)
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
		changeEmail(cookie, unique() + "@example.com", "123456", PASSWORD)
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
		changePassword(cookie, "123456", PASSWORD, NEW_PASSWORD)
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
	}

	@Test
	void withoutSessionEveryAccountRouteIsUnauthorized() throws Exception {
		this.mvc.perform(post("/api/account/codes").contentType(MediaType.APPLICATION_JSON)
				.content("{\"purpose\":\"PASSWORD_CHANGE\"}")).andExpect(status().isUnauthorized());
		this.mvc.perform(post("/api/account/email").contentType(MediaType.APPLICATION_JSON)
				.content("{\"newEmail\":\"a@example.com\",\"code\":\"123456\",\"currentPassword\":\"x\"}"))
				.andExpect(status().isUnauthorized());
		this.mvc.perform(post("/api/account/password").contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"123456\",\"currentPassword\":\"x\",\"newPassword\":\"12345678\"}"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void wrongCurrentPasswordIsForbiddenAndKeepsTheCodeUsable() throws Exception {
		Account account = verifiedAccount();
		this.mailbox.clear();
		requestPasswordCode(account.cookie()).andExpect(status().isNoContent());
		String code = awaitCodeSentTo(account.email());

		for (int attempt = 0; attempt < 6; attempt++) {
			changePassword(account.cookie(), code, WRONG_PASSWORD, NEW_PASSWORD)
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("WRONG_PASSWORD"));
		}

		changePassword(account.cookie(), code, PASSWORD, NEW_PASSWORD).andExpect(status().isOk());
	}

	@Test
	void wrongCurrentPasswordOnEmailChangeIsForbiddenAndKeepsTheCodeUsable() throws Exception {
		Account account = verifiedAccount();
		String newEmail = unique() + "@example.com";
		this.mailbox.clear();
		requestEmailCode(account.cookie(), newEmail).andExpect(status().isNoContent());
		String code = awaitCodeSentTo(newEmail);

		changeEmail(account.cookie(), newEmail, code, WRONG_PASSWORD)
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("WRONG_PASSWORD"));

		changeEmail(account.cookie(), newEmail, code, PASSWORD).andExpect(status().isOk());
	}

	@Test
	void fiveWrongCodesExhaustTheAttempts() throws Exception {
		Account account = verifiedAccount();
		this.mailbox.clear();
		requestPasswordCode(account.cookie()).andExpect(status().isNoContent());
		String code = awaitCodeSentTo(account.email());
		String wrong = otherThan(code);

		for (int attempt = 0; attempt < 5; attempt++) {
			changePassword(account.cookie(), wrong, PASSWORD, NEW_PASSWORD)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.code").value("CODE_INVALID"));
		}

		changePassword(account.cookie(), code, PASSWORD, NEW_PASSWORD)
				.andExpect(status().isTooManyRequests())
				.andExpect(jsonPath("$.code").value("CODE_ATTEMPTS_EXCEEDED"));
		login(account.email(), PASSWORD).andExpect(status().isOk());
	}

	@Test
	void expiredCodeIsRejected() throws Exception {
		Account account = verifiedAccount();
		this.mailbox.clear();
		requestPasswordCode(account.cookie()).andExpect(status().isNoContent());
		String code = awaitCodeSentTo(account.email());

		this.clock.advance(Duration.ofMinutes(11));

		changePassword(account.cookie(), code, PASSWORD, NEW_PASSWORD)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("CODE_EXPIRED"));
	}

	@Test
	void usedCodeCannotBeReused() throws Exception {
		Account account = verifiedAccount();
		this.mailbox.clear();
		requestPasswordCode(account.cookie()).andExpect(status().isNoContent());
		String code = awaitCodeSentTo(account.email());
		changePassword(account.cookie(), code, PASSWORD, NEW_PASSWORD).andExpect(status().isOk());

		changePassword(account.cookie(), code, NEW_PASSWORD, PASSWORD)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("CODE_INVALID"));
		login(account.email(), NEW_PASSWORD).andExpect(status().isOk());
	}

	@Test
	void codeIssuedForOneEmailDoesNotWorkForAnother() throws Exception {
		Account account = verifiedAccount();
		String requested = unique() + "@example.com";
		String other = unique() + "@example.com";
		this.mailbox.clear();
		requestEmailCode(account.cookie(), requested).andExpect(status().isNoContent());
		String code = awaitCodeSentTo(requested);

		changeEmail(account.cookie(), other, code, PASSWORD)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("CODE_INVALID"));

		assertThat(this.users.findByEmail(account.email())).isPresent();
		assertThat(this.users.findByEmail(other)).isEmpty();
	}

	@Test
	void takenEmailIsRejectedOnRequestAndOnConfirmation() throws Exception {
		Account account = verifiedAccount();
		Account holder = verifiedAccount();
		requestEmailCode(account.cookie(), holder.email())
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));

		String contested = unique() + "@example.com";
		this.mailbox.clear();
		requestEmailCode(account.cookie(), contested).andExpect(status().isNoContent());
		String code = awaitCodeSentTo(contested);
		register(contested);

		changeEmail(account.cookie(), contested, code, PASSWORD)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
		login(account.email(), PASSWORD).andExpect(status().isOk());
	}

	@Test
	void secondCodeRequestInsideTheCooldownIsRateLimited() throws Exception {
		Account account = verifiedAccount();
		requestPasswordCode(account.cookie()).andExpect(status().isNoContent());

		requestPasswordCode(account.cookie())
				.andExpect(status().isTooManyRequests())
				.andExpect(header().exists(HttpHeaders.RETRY_AFTER))
				.andExpect(jsonPath("$.code").value("RATE_LIMIT"));

		this.clock.advance(Duration.ofSeconds(61));
		requestPasswordCode(account.cookie()).andExpect(status().isNoContent());
	}

	@Test
	void requestCodeValidatesTheNewEmail() throws Exception {
		Account account = verifiedAccount();
		this.mailbox.clear();

		postJson("/api/account/codes", account.cookie(), "{\"purpose\":\"EMAIL_CHANGE\"}")
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		postJson("/api/account/codes", account.cookie(), "{\"purpose\":\"EMAIL_CHANGE\",\"newEmail\":\"nao-e-email\"}")
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		postJson("/api/account/codes", account.cookie(),
				"{\"purpose\":\"EMAIL_CHANGE\",\"newEmail\":\"" + account.email().toUpperCase() + "\"}")
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		postJson("/api/account/codes", account.cookie(), "{\"purpose\":\"OUTRO\"}")
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		assertThat(this.mailbox.all()).isEmpty();
	}

	@Test
	void passwordChangeIgnoresTheNewEmailAndMailsTheCurrentAddress() throws Exception {
		Account account = verifiedAccount();
		this.mailbox.clear();

		postJson("/api/account/codes", account.cookie(),
				"{\"purpose\":\"PASSWORD_CHANGE\",\"newEmail\":\"" + unique() + "@example.com\"}")
				.andExpect(status().isNoContent());

		awaitCodeSentTo(account.email());
		assertThat(this.mailbox.all()).hasSize(1);
	}

	@Test
	void newPasswordMustDifferFromTheCurrentAndRespectTheSize() throws Exception {
		Account account = verifiedAccount();
		this.mailbox.clear();
		requestPasswordCode(account.cookie()).andExpect(status().isNoContent());
		String code = awaitCodeSentTo(account.email());

		changePassword(account.cookie(), code, PASSWORD, PASSWORD)
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		changePassword(account.cookie(), code, PASSWORD, "curta")
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

		changePassword(account.cookie(), code, PASSWORD, NEW_PASSWORD).andExpect(status().isOk());
	}

	@Test
	void theTargetUserAlwaysComesFromTheSession() throws Exception {
		Account attacker = verifiedAccount();
		Account victim = verifiedAccount();
		User victimBefore = this.users.findByEmail(victim.email()).orElseThrow();
		String hijacked = unique() + "@example.com";
		this.mailbox.clear();
		requestPasswordCode(attacker.cookie()).andExpect(status().isNoContent());
		String attackerCode = awaitCodeSentTo(attacker.email());

		postJson("/api/account/password", attacker.cookie(), """
				{"userId":"%s","email":"%s","code":"%s","currentPassword":"%s","newPassword":"%s"}"""
				.formatted(victimBefore.getId(), victim.email(), attackerCode, PASSWORD, NEW_PASSWORD))
				.andExpect(status().isOk());

		login(victim.email(), PASSWORD).andExpect(status().isOk());
		login(attacker.email(), NEW_PASSWORD).andExpect(status().isOk());
		assertThat(this.users.findById(victimBefore.getId()).orElseThrow().getPasswordHash())
				.isEqualTo(victimBefore.getPasswordHash());

		changePassword(victim.cookie(), attackerCode, PASSWORD, NEW_PASSWORD)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("CODE_INVALID"));
		changeEmail(victim.cookie(), hijacked, attackerCode, PASSWORD)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("CODE_INVALID"));
		login(victim.email(), PASSWORD).andExpect(status().isOk());
	}

	private Account verifiedAccount() throws Exception {
		String email = unique() + "@example.com";
		Cookie cookie = register(email);
		EmailVerification.verify(this.users, email);
		return new Account(email, cookie);
	}

	private Cookie register(String email) throws Exception {
		return this.mvc.perform(post("/api/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"name":"Ana","email":"%s","password":"%s"}""".formatted(email, PASSWORD)))
				.andExpect(status().isCreated())
				.andReturn()
				.getResponse()
				.getCookie(SessionCookie.NAME);
	}

	private ResultActions login(String email, String password) throws Exception {
		return this.mvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"email":"%s","password":"%s"}""".formatted(email, password)));
	}

	private ResultActions requestEmailCode(Cookie cookie, String newEmail) throws Exception {
		return postJson("/api/account/codes", cookie,
				"{\"purpose\":\"EMAIL_CHANGE\",\"newEmail\":\"" + newEmail + "\"}");
	}

	private ResultActions requestPasswordCode(Cookie cookie) throws Exception {
		return postJson("/api/account/codes", cookie, "{\"purpose\":\"PASSWORD_CHANGE\"}");
	}

	private ResultActions changeEmail(Cookie cookie, String newEmail, String code, String currentPassword)
			throws Exception {
		return postJson("/api/account/email", cookie, """
				{"newEmail":"%s","code":"%s","currentPassword":"%s"}""".formatted(newEmail, code, currentPassword));
	}

	private ResultActions changePassword(Cookie cookie, String code, String currentPassword, String newPassword)
			throws Exception {
		return postJson("/api/account/password", cookie, """
				{"code":"%s","currentPassword":"%s","newPassword":"%s"}"""
				.formatted(code, currentPassword, newPassword));
	}

	private ResultActions postJson(String path, Cookie cookie, String json) throws Exception {
		return this.mvc.perform(post(path)
				.cookie(cookie)
				.contentType(MediaType.APPLICATION_JSON)
				.content(json));
	}

	private String awaitCodeSentTo(String address) {
		String[] found = new String[1];
		await().atMost(Duration.ofSeconds(5)).until(() -> {
			List<OutgoingEmail> mails = this.mailbox.all().stream().filter(mail -> mail.to().equals(address)).toList();
			if (mails.isEmpty()) {
				return false;
			}
			Matcher matcher = SIX_DIGITS.matcher(mails.get(mails.size() - 1).textBody());
			if (!matcher.find()) {
				return false;
			}
			found[0] = matcher.group(1);
			return true;
		});
		return found[0];
	}

	private static String otherThan(String code) {
		return "000000".equals(code) ? "111111" : "000000";
	}

	private static String unique() {
		return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
	}

	private record Account(String email, Cookie cookie) {

	}

	@TestConfiguration(proxyBeanMethods = false)
	static class ControlledClock {

		@Bean
		@Primary
		MutableClock controlledClock() {
			return new MutableClock(Instant.now());
		}

		@Bean
		@Primary
		AccountCodeService controlledCodeService(AccountCodeRepository codes, CodeHasher hasher,
				AppProperties properties, PlatformTransactionManager transactionManager, MutableClock clock) {
			return new AccountCodeService(codes, hasher, properties, transactionManager, clock, new SecureRandom());
		}

	}

}
