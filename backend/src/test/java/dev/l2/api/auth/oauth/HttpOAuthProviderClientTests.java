package dev.l2.api.auth.oauth;

import dev.l2.api.auth.oauth.OAuthProviderClient.Exchange;
import dev.l2.api.auth.oauth.OAuthProviderClient.ProviderIdentity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class HttpOAuthProviderClientTests {

	private static final String REDIRECT = "https://l2.example/api/auth/oauth/callback/";

	private MockRestServiceServer server;

	private HttpOAuthProviderClient client;

	@BeforeEach
	void setUp() {
		RestClient.Builder builder = RestClient.builder();
		this.server = MockRestServiceServer.bindTo(builder).build();
		this.client = new HttpOAuthProviderClient(builder.build());
	}

	@Test
	void googleExchangesTheCodeWithPkceAndReadsTheUserInfo() {
		this.server.expect(requestTo(OAuthProvider.GOOGLE.tokenUri()))
				.andExpect(method(HttpMethod.POST))
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_FORM_URLENCODED))
				.andExpect(content().string(org.hamcrest.Matchers.allOf(
						org.hamcrest.Matchers.containsString("grant_type=authorization_code"),
						org.hamcrest.Matchers.containsString("code=the-code"),
						org.hamcrest.Matchers.containsString("code_verifier=the-verifier"),
						org.hamcrest.Matchers.containsString("client_id=the-client"))))
				.andRespond(withSuccess("{\"access_token\":\"the-access\",\"token_type\":\"Bearer\"}",
						MediaType.APPLICATION_JSON));
		this.server.expect(requestTo(HttpOAuthProviderClient.GOOGLE_USER_INFO))
				.andExpect(header("Authorization", "Bearer the-access"))
				.andRespond(withSuccess(
						"{\"sub\":\"1234\",\"name\":\"Ana Souza\",\"email\":\"ana@example.com\",\"email_verified\":true}",
						MediaType.APPLICATION_JSON));

		ProviderIdentity identity = this.client.fetchIdentity(exchange(OAuthProvider.GOOGLE));

		assertThat(identity.providerUserId()).isEqualTo("1234");
		assertThat(identity.name()).isEqualTo("Ana Souza");
		assertThat(identity.email()).isEqualTo("ana@example.com");
		assertThat(identity.emailVerified()).isTrue();
		this.server.verify();
	}

	@Test
	void googleReportsAnUnverifiedEmailAsUnverified() {
		expectGoogleToken();
		this.server.expect(requestTo(HttpOAuthProviderClient.GOOGLE_USER_INFO))
				.andRespond(withSuccess(
						"{\"sub\":\"1\",\"email\":\"ana@example.com\",\"email_verified\":false}",
						MediaType.APPLICATION_JSON));

		assertThat(this.client.fetchIdentity(exchange(OAuthProvider.GOOGLE)).emailVerified()).isFalse();
	}

	@Test
	void googleTreatsAMissingVerifiedFlagAsUnverified() {
		expectGoogleToken();
		this.server.expect(requestTo(HttpOAuthProviderClient.GOOGLE_USER_INFO))
				.andRespond(withSuccess("{\"sub\":\"1\",\"email\":\"ana@example.com\"}", MediaType.APPLICATION_JSON));

		assertThat(this.client.fetchIdentity(exchange(OAuthProvider.GOOGLE)).emailVerified()).isFalse();
	}

	@Test
	void githubUsesOnlyTheEmailThatIsPrimaryAndVerified() {
		expectGithubToken();
		expectGithubUser("{\"id\":99,\"login\":\"ana-dev\",\"name\":\"Ana Souza\"}");
		this.server.expect(requestTo(HttpOAuthProviderClient.GITHUB_EMAILS))
				.andExpect(header("Authorization", "Bearer the-access"))
				.andRespond(withSuccess("""
						[
						  {"email":"secundario@example.com","primary":false,"verified":true},
						  {"email":"nao-confirmado@example.com","primary":true,"verified":false},
						  {"email":"ana@example.com","primary":true,"verified":true}
						]""", MediaType.APPLICATION_JSON));

		ProviderIdentity identity = this.client.fetchIdentity(exchange(OAuthProvider.GITHUB));

		assertThat(identity.providerUserId()).isEqualTo("99");
		assertThat(identity.name()).isEqualTo("Ana Souza");
		assertThat(identity.email()).isEqualTo("ana@example.com");
		assertThat(identity.emailVerified()).isTrue();
	}

	@Test
	void githubWithoutAPrimaryVerifiedEmailYieldsNoEmail() {
		expectGithubToken();
		expectGithubUser("{\"id\":99,\"login\":\"ana-dev\",\"name\":null}");
		this.server.expect(requestTo(HttpOAuthProviderClient.GITHUB_EMAILS))
				.andRespond(withSuccess("""
						[
						  {"email":"secundario@example.com","primary":false,"verified":true},
						  {"email":"nao-confirmado@example.com","primary":true,"verified":false}
						]""", MediaType.APPLICATION_JSON));

		ProviderIdentity identity = this.client.fetchIdentity(exchange(OAuthProvider.GITHUB));

		assertThat(identity.email()).isNull();
		assertThat(identity.emailVerified()).isFalse();
		assertThat(identity.name()).isEqualTo("ana-dev");
	}

	@Test
	void githubSendsTheUserAgentItRequires() {
		expectGithubToken();
		this.server.expect(requestTo(HttpOAuthProviderClient.GITHUB_USER))
				.andExpect(header("User-Agent", "lumi-links"))
				.andRespond(withSuccess("{\"id\":1,\"login\":\"ana\"}", MediaType.APPLICATION_JSON));
		this.server.expect(requestTo(HttpOAuthProviderClient.GITHUB_EMAILS))
				.andExpect(header("User-Agent", "lumi-links"))
				.andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

		this.client.fetchIdentity(exchange(OAuthProvider.GITHUB));

		this.server.verify();
	}

	@Test
	void aTokenResponseWithoutAccessTokenIsAProviderFailure() {
		this.server.expect(requestTo(OAuthProvider.GITHUB.tokenUri()))
				.andRespond(withSuccess("{\"error\":\"bad_verification_code\"}", MediaType.APPLICATION_JSON));

		assertThatThrownBy(() -> this.client.fetchIdentity(exchange(OAuthProvider.GITHUB)))
				.isInstanceOf(OAuthProviderException.class)
				.hasMessageNotContaining("bad_verification_code");
	}

	@Test
	void aProviderServerErrorIsAProviderFailureWithoutLeakingTheBody() {
		this.server.expect(requestTo(OAuthProvider.GOOGLE.tokenUri()))
				.andRespond(withServerError().body("corpo-sensivel-do-provedor").contentType(MediaType.TEXT_PLAIN));

		assertThatThrownBy(() -> this.client.fetchIdentity(exchange(OAuthProvider.GOOGLE)))
				.isInstanceOf(OAuthProviderException.class)
				.hasNoCause()
				.hasMessageNotContaining("corpo-sensivel-do-provedor");
	}

	@Test
	void exchangeAndIdentityStringsNeverCarrySecretsOrPersonalData() {
		Exchange exchange = exchange(OAuthProvider.GOOGLE);
		ProviderIdentity identity = new ProviderIdentity("1", "Ana", "ana@example.com", true);

		assertThat(exchange.toString()).doesNotContain("the-client-secret", "the-code", "the-verifier");
		assertThat(identity.toString()).doesNotContain("ana@example.com", "Ana");
	}

	private void expectGoogleToken() {
		this.server.expect(requestTo(OAuthProvider.GOOGLE.tokenUri()))
				.andRespond(withSuccess("{\"access_token\":\"the-access\"}", MediaType.APPLICATION_JSON));
	}

	private void expectGithubToken() {
		this.server.expect(requestTo(OAuthProvider.GITHUB.tokenUri()))
				.andExpect(header("Accept", "application/json"))
				.andRespond(withSuccess("{\"access_token\":\"the-access\",\"token_type\":\"bearer\"}",
						MediaType.APPLICATION_JSON));
	}

	private void expectGithubUser(String body) {
		this.server.expect(requestTo(HttpOAuthProviderClient.GITHUB_USER))
				.andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
	}

	private static Exchange exchange(OAuthProvider provider) {
		return new Exchange(provider, "the-client", "the-client-secret", REDIRECT + provider.slug(), "the-code",
				"the-verifier");
	}

}
