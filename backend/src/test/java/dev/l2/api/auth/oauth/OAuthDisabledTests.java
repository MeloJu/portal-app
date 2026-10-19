package dev.l2.api.auth.oauth;

import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.auth.SessionCookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@AutoConfigureMockMvc
@SpringBootTest(properties = {
		"app.rate-limit.enabled=false",
		"app.oauth.google.client-id=google-client-id-for-tests",
		"app.oauth.google.client-secret=",
		"app.oauth.github.client-id=",
		"app.oauth.github.client-secret=" })
class OAuthDisabledTests {

	private static final String DISABLED = "http://localhost:8080/login?oauth_error=OAUTH_DISABLED";

	@Autowired
	private MockMvc mvc;

	@MockitoBean
	private OAuthProviderClient providers;

	@Test
	void aProviderWithoutCredentialsRedirectsToLoginWithADisabledError() throws Exception {
		MvcResult result = this.mvc.perform(get("/api/auth/oauth/github")).andExpect(status().isFound()).andReturn();

		assertThat(result.getResponse().getRedirectedUrl()).isEqualTo(DISABLED);
		assertThat(result.getResponse().getCookie(SessionCookie.NAME)).isNull();
	}

	@Test
	void aClientIdWithoutSecretIsStillDisabled() throws Exception {
		MvcResult result = this.mvc.perform(get("/api/auth/oauth/google")).andExpect(status().isFound()).andReturn();

		assertThat(result.getResponse().getRedirectedUrl()).isEqualTo(DISABLED);
	}

	@Test
	void theCallbackOfADisabledProviderNeverReachesTheProvider() throws Exception {
		MvcResult result = this.mvc.perform(get("/api/auth/oauth/callback/github")
				.param("code", "the-code")
				.param("state", "any-state"))
				.andExpect(status().isFound())
				.andReturn();

		assertThat(result.getResponse().getRedirectedUrl()).isEqualTo(DISABLED);
		assertThat(result.getResponse().getCookie(SessionCookie.NAME)).isNull();
		verifyNoInteractions(this.providers);
	}

	@Test
	void unknownProvidersAreNotFoundEvenWhenEverythingIsDisabled() throws Exception {
		this.mvc.perform(get("/api/auth/oauth/facebook")).andExpect(status().isNotFound());
	}

}
