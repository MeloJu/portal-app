package dev.l2.api.auth.oauth;

import dev.l2.api.EmailVerification;
import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.account.AccountCode;
import dev.l2.api.account.AccountCodePurpose;
import dev.l2.api.account.AccountCodeRepository;
import dev.l2.api.auth.SessionCookie;
import dev.l2.api.auth.oauth.OAuthProviderClient.Exchange;
import dev.l2.api.auth.oauth.OAuthProviderClient.ProviderIdentity;
import dev.l2.api.auth.verification.EmailVerificationTokenRepository;
import dev.l2.api.user.User;
import dev.l2.api.user.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.util.MultiValueMap;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@AutoConfigureMockMvc
@SpringBootTest(properties = {
		"app.rate-limit.enabled=false",
		"app.oauth.google.client-id=google-client-id-for-tests",
		"app.oauth.google.client-secret=not-a-secret",
		"app.oauth.github.client-id=github-client-id-for-tests",
		"app.oauth.github.client-secret=not-a-secret" })
class OAuthFlowTests {

	private static final String BASE = "http://localhost:8080";

	private static final String PASSWORD = "senha-bem-grande";

	@Autowired
	private MockMvc mvc;

	@Autowired
	private UserRepository users;

	@Autowired
	private UserIdentityRepository identities;

	@Autowired
	private EmailVerificationTokenRepository verificationTokens;

	@Autowired
	private AccountCodeRepository accountCodes;

	@MockitoBean
	private OAuthProviderClient providers;

	@Test
	void googleAuthorizationRedirectsWithExactlyTheNameAndEmailScopes() throws Exception {
		MvcResult result = this.mvc.perform(get("/api/auth/oauth/google")).andExpect(status().isFound()).andReturn();

		URI location = URI.create(result.getResponse().getRedirectedUrl());
		MultiValueMap<String, String> query = UriComponentsBuilder.fromUri(location).build().getQueryParams();
		assertThat(location.getScheme() + "://" + location.getHost() + location.getPath())
				.isEqualTo("https://accounts.google.com/o/oauth2/v2/auth");
		assertThat(location.getRawQuery()).contains("scope=openid%20email%20profile&");
		assertThat(decoded(query, "scope")).isEqualTo("openid email profile");
		assertThat(decoded(query, "response_type")).isEqualTo("code");
		assertThat(decoded(query, "client_id")).isEqualTo("google-client-id-for-tests");
		assertThat(decoded(query, "redirect_uri")).isEqualTo(BASE + "/api/auth/oauth/callback/google");
		assertThat(decoded(query, "code_challenge_method")).isEqualTo("S256");
		assertThat(decoded(query, "code_challenge")).hasSize(43);
		assertThat(decoded(query, "state")).hasSizeGreaterThanOrEqualTo(40);
		assertThat(query.keySet()).containsExactlyInAnyOrder("response_type", "client_id", "redirect_uri", "scope",
				"state", "code_challenge", "code_challenge_method");
	}

	@Test
	void githubAuthorizationRedirectsWithExactlyTheNameAndEmailScopes() throws Exception {
		MvcResult result = this.mvc.perform(get("/api/auth/oauth/github")).andExpect(status().isFound()).andReturn();

		URI location = URI.create(result.getResponse().getRedirectedUrl());
		MultiValueMap<String, String> query = UriComponentsBuilder.fromUri(location).build().getQueryParams();
		assertThat(location.getHost()).isEqualTo("github.com");
		assertThat(location.getPath()).isEqualTo("/login/oauth/authorize");
		assertThat(decoded(query, "scope")).isEqualTo("read:user user:email");
		assertThat(decoded(query, "client_id")).isEqualTo("github-client-id-for-tests");
		assertThat(decoded(query, "redirect_uri")).isEqualTo(BASE + "/api/auth/oauth/callback/github");
		assertThat(decoded(query, "code_challenge_method")).isEqualTo("S256");
	}

	@Test
	void authorizationSetsTheShortLivedStateCookieAndDoesNotTouchTheSession() throws Exception {
		MvcResult result = this.mvc.perform(get("/api/auth/oauth/google")).andReturn();

		String header = result.getResponse().getHeader("Set-Cookie");
		assertThat(header).startsWith("lumi_oauth_state=")
				.contains("HttpOnly", "Secure", "SameSite=Lax", "Path=/api/auth/oauth", "Max-Age=600");
		assertThat(result.getResponse().getCookie(SessionCookie.NAME)).isNull();
		assertThat(result.getResponse().getHeader("Cache-Control")).contains("no-store");
	}

	@Test
	void newAccountIsCreatedVerifiedWithoutPasswordAndTheSessionIsIssued() throws Exception {
		String email = unique() + "@example.com";
		providerReturns(new ProviderIdentity(unique(), "Ana Souza", email, true));

		ResultActions callback = completeLogin("google");

		callback.andExpect(status().isFound());
		MvcResult result = callback.andReturn();
		assertThat(result.getResponse().getRedirectedUrl()).isEqualTo(BASE + "/dashboard");
		Cookie session = result.getResponse().getCookie(SessionCookie.NAME);
		assertThat(session).isNotNull();
		assertThat(session.isHttpOnly()).isTrue();
		assertThat(result.getResponse().getHeaders("Set-Cookie"))
				.anyMatch(header -> header.startsWith("lumi_session=") && header.contains("SameSite=Strict"))
				.anyMatch(header -> header.startsWith("lumi_oauth_state=;") || header.contains("Max-Age=0"));
		User created = this.users.findByEmail(email).orElseThrow();
		assertThat(created.getName()).isEqualTo("Ana Souza");
		assertThat(created.isEmailVerified()).isTrue();
		assertThat(created.hasPassword()).isFalse();
		assertThat(created.getPasswordHash()).startsWith("$2a$");
		this.mvc.perform(get("/api/me").cookie(session))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value(email))
				.andExpect(jsonPath("$.emailVerified").value(true))
				.andExpect(jsonPath("$.hasPassword").value(false));
	}

	@Test
	void providerEmailIsNormalizedLikeRegisterAndLogin() throws Exception {
		String local = unique();
		providerReturns(new ProviderIdentity(unique(), "Bia", "  " + local + "@Example.COM ", true));

		completeLogin("github").andExpect(status().isFound());

		assertThat(this.users.findByEmail(local + "@example.com")).isPresent();
	}

	@Test
	void anAccountWithoutProviderNameGetsTheEmailLocalPartAsName() throws Exception {
		String local = unique();
		providerReturns(new ProviderIdentity(unique(), null, local + "@example.com", true));

		completeLogin("github").andExpect(status().isFound());

		assertThat(this.users.findByEmail(local + "@example.com").orElseThrow().getName()).isEqualTo(local);
	}

	@Test
	void linksToAnExistingVerifiedAccountKeepingItsPassword() throws Exception {
		String email = unique() + "@example.com";
		register(email);
		EmailVerification.verify(this.users, email);
		User before = this.users.findByEmail(email).orElseThrow();
		String providerUserId = unique();
		providerReturns(new ProviderIdentity(providerUserId, "Outro Nome", email, true));

		MvcResult result = completeLogin("google").andExpect(status().isFound()).andReturn();

		assertThat(result.getResponse().getRedirectedUrl()).isEqualTo(BASE + "/dashboard");
		User after = this.users.findByEmail(email).orElseThrow();
		assertThat(after.getId()).isEqualTo(before.getId());
		assertThat(after.getName()).isEqualTo(before.getName());
		assertThat(after.hasPassword()).isTrue();
		assertThat(after.getPasswordHash()).isEqualTo(before.getPasswordHash());
		assertThat(this.identities.findByProviderAndProviderUserId(OAuthProvider.GOOGLE, providerUserId)).isPresent();
		login(email, PASSWORD).andExpect(status().isOk());
	}

	@Test
	void linkingToAnUnverifiedAccountVerifiesItAndKillsThePreviousPassword() throws Exception {
		String email = unique() + "@example.com";
		register(email);
		User squatted = this.users.findByEmail(email).orElseThrow();
		assertThat(this.verificationTokens.findByUserIdAndUsedAtIsNull(squatted.getId())).isNotEmpty();
		AccountCode pendingCode = this.accountCodes.save(new AccountCode(squatted, AccountCodePurpose.PASSWORD_CHANGE,
				"a".repeat(64), null, Instant.now().plusSeconds(600)));
		login(email, PASSWORD).andExpect(status().isOk());
		providerReturns(new ProviderIdentity(unique(), "Dona Real", email, true));

		completeLogin("google").andExpect(status().isFound());

		User after = this.users.findByEmail(email).orElseThrow();
		assertThat(after.getId()).isEqualTo(squatted.getId());
		assertThat(after.isEmailVerified()).isTrue();
		assertThat(after.hasPassword()).isFalse();
		assertThat(after.getPasswordHash()).isNotEqualTo(squatted.getPasswordHash());
		login(email, PASSWORD).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
		assertThat(this.verificationTokens.findByUserIdAndUsedAtIsNull(squatted.getId())).isEmpty();
		assertThat(this.accountCodes.findById(pendingCode.getId()).orElseThrow().getUsedAt()).isNotNull();
	}

	@Test
	void anUnverifiedProviderEmailIsRefusedAndNothingIsCreatedOrIssued() throws Exception {
		String email = unique() + "@example.com";
		providerReturns(new ProviderIdentity(unique(), "Ana", email, false));

		MvcResult result = completeLogin("google").andExpect(status().isFound()).andReturn();

		assertThat(result.getResponse().getRedirectedUrl()).isEqualTo(BASE + "/login?oauth_error=OAUTH_EMAIL_UNVERIFIED");
		assertThat(result.getResponse().getCookie(SessionCookie.NAME)).isNull();
		assertThat(this.users.findByEmail(email)).isEmpty();
	}

	@Test
	void anUnverifiedProviderEmailNeverTouchesAnExistingAccount() throws Exception {
		String email = unique() + "@example.com";
		register(email);
		User before = this.users.findByEmail(email).orElseThrow();
		providerReturns(new ProviderIdentity(unique(), "Invasor", email, false));

		MvcResult result = completeLogin("github").andExpect(status().isFound()).andReturn();

		assertThat(result.getResponse().getRedirectedUrl()).endsWith("oauth_error=OAUTH_EMAIL_UNVERIFIED");
		User after = this.users.findByEmail(email).orElseThrow();
		assertThat(after.isEmailVerified()).isFalse();
		assertThat(after.hasPassword()).isTrue();
		assertThat(after.getPasswordHash()).isEqualTo(before.getPasswordHash());
		login(email, PASSWORD).andExpect(status().isOk());
	}

	@Test
	void aProviderEmailMissingEntirelyIsRefused() throws Exception {
		providerReturns(new ProviderIdentity(unique(), "Sem Email", null, false));

		MvcResult result = completeLogin("github").andExpect(status().isFound()).andReturn();

		assertThat(result.getResponse().getRedirectedUrl()).endsWith("oauth_error=OAUTH_EMAIL_UNVERIFIED");
	}

	@Test
	void aKnownIdentityLogsIntoItsOwnerEvenIfTheProviderEmailChanged() throws Exception {
		String originalEmail = unique() + "@example.com";
		String providerUserId = unique();
		providerReturns(new ProviderIdentity(providerUserId, "Caio", originalEmail, true));
		completeLogin("google").andExpect(status().isFound());
		User owner = this.users.findByEmail(originalEmail).orElseThrow();
		providerReturns(new ProviderIdentity(providerUserId, "Caio", unique() + "@example.com", false));

		MvcResult result = completeLogin("google").andExpect(status().isFound()).andReturn();

		assertThat(result.getResponse().getRedirectedUrl()).isEqualTo(BASE + "/dashboard");
		Cookie session = result.getResponse().getCookie(SessionCookie.NAME);
		this.mvc.perform(get("/api/me").cookie(session))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(owner.getId().toString()));
		assertThat(this.identities.findByProviderAndProviderUserId(OAuthProvider.GOOGLE, providerUserId))
				.isPresent();
	}

	@Test
	void theSameProviderUserIdOnAnotherProviderIsAnotherIdentity() throws Exception {
		String sharedId = unique();
		String googleEmail = unique() + "@example.com";
		String githubEmail = unique() + "@example.com";
		providerReturns(new ProviderIdentity(sharedId, "Dora", googleEmail, true));
		completeLogin("google").andExpect(status().isFound());
		providerReturns(new ProviderIdentity(sharedId, "Dora", githubEmail, true));

		completeLogin("github").andExpect(status().isFound());

		assertThat(this.users.findByEmail(googleEmail)).isPresent();
		assertThat(this.users.findByEmail(githubEmail)).isPresent();
	}

	@Test
	void callbackWithoutTheStateCookieIsRefused() throws Exception {
		Started started = start("google");

		MvcResult result = this.mvc.perform(get("/api/auth/oauth/callback/google")
				.param("code", "the-code")
				.param("state", started.state()))
				.andExpect(status().isFound())
				.andReturn();

		assertThat(result.getResponse().getRedirectedUrl()).isEqualTo(BASE + "/login?oauth_error=OAUTH_STATE_INVALID");
		assertThat(result.getResponse().getCookie(SessionCookie.NAME)).isNull();
		verify(this.providers, never()).fetchIdentity(any());
	}

	@Test
	void callbackWithoutTheStateParameterIsRefused() throws Exception {
		Started started = start("google");

		MvcResult result = this.mvc.perform(get("/api/auth/oauth/callback/google")
				.param("code", "the-code")
				.cookie(started.cookie()))
				.andExpect(status().isFound())
				.andReturn();

		assertThat(result.getResponse().getRedirectedUrl()).isEqualTo(BASE + "/login?oauth_error=OAUTH_STATE_INVALID");
		verify(this.providers, never()).fetchIdentity(any());
	}

	@Test
	void callbackWithADifferentStateIsRefused() throws Exception {
		Started started = start("google");
		Started other = start("google");

		MvcResult result = this.mvc.perform(get("/api/auth/oauth/callback/google")
				.param("code", "the-code")
				.param("state", other.state())
				.cookie(started.cookie()))
				.andExpect(status().isFound())
				.andReturn();

		assertThat(result.getResponse().getRedirectedUrl()).isEqualTo(BASE + "/login?oauth_error=OAUTH_STATE_INVALID");
		assertThat(result.getResponse().getCookie(SessionCookie.NAME)).isNull();
		verify(this.providers, never()).fetchIdentity(any());
	}

	@Test
	void callbackWithATamperedStateCookieIsRefused() throws Exception {
		Started started = start("google");
		Cookie forged = new Cookie(started.cookie().getName(), started.cookie().getValue() + "x");

		MvcResult result = this.mvc.perform(get("/api/auth/oauth/callback/google")
				.param("code", "the-code")
				.param("state", started.state())
				.cookie(forged))
				.andExpect(status().isFound())
				.andReturn();

		assertThat(result.getResponse().getRedirectedUrl()).isEqualTo(BASE + "/login?oauth_error=OAUTH_STATE_INVALID");
		verify(this.providers, never()).fetchIdentity(any());
	}

	@Test
	void aStateStartedForOneProviderDoesNotWorkOnAnother() throws Exception {
		Started started = start("google");

		MvcResult result = this.mvc.perform(get("/api/auth/oauth/callback/github")
				.param("code", "the-code")
				.param("state", started.state())
				.cookie(started.cookie()))
				.andExpect(status().isFound())
				.andReturn();

		assertThat(result.getResponse().getRedirectedUrl()).isEqualTo(BASE + "/login?oauth_error=OAUTH_STATE_INVALID");
		verify(this.providers, never()).fetchIdentity(any());
	}

	@Test
	void theCodeVerifierSentToTheProviderMatchesTheChallengeOfTheAuthorizationUrl() throws Exception {
		providerReturns(new ProviderIdentity(unique(), "Eva", unique() + "@example.com", true));
		Started started = start("google");

		this.mvc.perform(get("/api/auth/oauth/callback/google")
				.param("code", "the-code")
				.param("state", started.state())
				.cookie(started.cookie()))
				.andExpect(status().isFound());

		ArgumentCaptor<Exchange> exchange = ArgumentCaptor.forClass(Exchange.class);
		verify(this.providers).fetchIdentity(exchange.capture());
		assertThat(exchange.getValue().code()).isEqualTo("the-code");
		assertThat(exchange.getValue().provider()).isEqualTo(OAuthProvider.GOOGLE);
		assertThat(exchange.getValue().redirectUri()).isEqualTo(BASE + "/api/auth/oauth/callback/google");
		assertThat(exchange.getValue().clientId()).isEqualTo("google-client-id-for-tests");
		assertThat(challengeOf(exchange.getValue().codeVerifier())).isEqualTo(started.codeChallenge());
	}

	@Test
	void theProviderDenyingAccessRedirectsToLoginWithoutSession() throws Exception {
		Started started = start("github");

		MvcResult result = this.mvc.perform(get("/api/auth/oauth/callback/github")
				.param("error", "access_denied")
				.param("state", started.state())
				.cookie(started.cookie()))
				.andExpect(status().isFound())
				.andReturn();

		assertThat(result.getResponse().getRedirectedUrl()).isEqualTo(BASE + "/login?oauth_error=OAUTH_DENIED");
		assertThat(result.getResponse().getCookie(SessionCookie.NAME)).isNull();
		verify(this.providers, never()).fetchIdentity(any());
	}

	@Test
	void aMissingCodeIsAProviderError() throws Exception {
		Started started = start("github");

		MvcResult result = this.mvc.perform(get("/api/auth/oauth/callback/github")
				.param("state", started.state())
				.cookie(started.cookie()))
				.andReturn();

		assertThat(result.getResponse().getRedirectedUrl()).isEqualTo(BASE + "/login?oauth_error=OAUTH_PROVIDER_ERROR");
	}

	@Test
	void aFailureTalkingToTheProviderRedirectsToLoginWithoutSession() throws Exception {
		when(this.providers.fetchIdentity(any())).thenThrow(new OAuthProviderException());

		MvcResult result = completeLogin("google").andExpect(status().isFound()).andReturn();

		assertThat(result.getResponse().getRedirectedUrl()).isEqualTo(BASE + "/login?oauth_error=OAUTH_PROVIDER_ERROR");
		assertThat(result.getResponse().getCookie(SessionCookie.NAME)).isNull();
	}

	@Test
	void callbackNeverRedirectsToAnAddressTakenFromTheRequest() throws Exception {
		providerReturns(new ProviderIdentity(unique(), "Fio", unique() + "@example.com", true));
		Started started = start("google");

		MvcResult result = this.mvc.perform(get("/api/auth/oauth/callback/google")
				.param("code", "the-code")
				.param("state", started.state())
				.param("redirect_uri", "https://evil.example/steal")
				.param("next", "https://evil.example/steal")
				.param("returnTo", "https://evil.example/steal")
				.header("Host", "evil.example")
				.header("Referer", "https://evil.example/")
				.cookie(started.cookie()))
				.andReturn();

		assertThat(result.getResponse().getRedirectedUrl()).isEqualTo(BASE + "/dashboard");
	}

	@Test
	void unknownProviderIsNotFound() throws Exception {
		this.mvc.perform(get("/api/auth/oauth/facebook")).andExpect(status().isNotFound());
		this.mvc.perform(get("/api/auth/oauth/callback/facebook")).andExpect(status().isNotFound());
		this.mvc.perform(get("/api/auth/oauth/callback")).andExpect(status().isNotFound());
	}

	@Test
	void anAccountThatSignsInOnlyByProviderCannotChangeThePassword() throws Exception {
		providerReturns(new ProviderIdentity(unique(), "Gil", unique() + "@example.com", true));
		Cookie session = completeLogin("google").andReturn().getResponse().getCookie(SessionCookie.NAME);

		this.mvc.perform(post("/api/account/password")
				.cookie(session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"code":"123456","currentPassword":"qualquer-coisa","newPassword":"nova-senha-grande"}"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("PASSWORD_NOT_SET"));
		this.mvc.perform(post("/api/account/codes")
				.cookie(session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"purpose\":\"PASSWORD_CHANGE\"}"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("PASSWORD_NOT_SET"));
	}

	@Test
	void anAccountCreatedByProviderCannotLogInWithAPassword() throws Exception {
		String email = unique() + "@example.com";
		providerReturns(new ProviderIdentity(unique(), "Helo", email, true));
		completeLogin("google").andExpect(status().isFound());

		login(email, PASSWORD).andExpect(status().isUnauthorized());
	}

	private Started start(String slug) throws Exception {
		MvcResult result = this.mvc.perform(get("/api/auth/oauth/" + slug)).andExpect(status().isFound()).andReturn();
		URI location = URI.create(result.getResponse().getRedirectedUrl());
		MultiValueMap<String, String> query = UriComponentsBuilder.fromUri(location).build().getQueryParams();
		Cookie cookie = result.getResponse().getCookie("lumi_oauth_state");
		return new Started(decoded(query, "state"), decoded(query, "code_challenge"), cookie);
	}

	private ResultActions completeLogin(String slug) throws Exception {
		Started started = start(slug);
		return this.mvc.perform(get("/api/auth/oauth/callback/" + slug)
				.param("code", "the-code")
				.param("state", started.state())
				.cookie(started.cookie()));
	}

	private void providerReturns(ProviderIdentity identity) {
		when(this.providers.fetchIdentity(any())).thenReturn(identity);
	}

	private void register(String email) throws Exception {
		this.mvc.perform(post("/api/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"name":"Pre Registro","email":"%s","password":"%s"}""".formatted(email, PASSWORD)))
				.andExpect(status().isCreated());
	}

	private ResultActions login(String email, String password) throws Exception {
		return this.mvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"email":"%s","password":"%s"}""".formatted(email, password)));
	}

	private static String decoded(MultiValueMap<String, String> query, String name) {
		return URLDecoder.decode(query.getFirst(name), StandardCharsets.UTF_8);
	}

	private static String challengeOf(String verifier) throws Exception {
		byte[] digest = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII));
		return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
	}

	private static String unique() {
		return UUID.randomUUID().toString().replace("-", "").substring(0, 14);
	}

	private record Started(String state, String codeChallenge, Cookie cookie) {

	}

}
