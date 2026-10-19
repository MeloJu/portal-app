package dev.l2.api.auth.oauth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;

import java.net.http.HttpClient;
import java.time.Duration;

@Component
class HttpOAuthProviderClient implements OAuthProviderClient {

	static final String GOOGLE_USER_INFO = "https://openidconnect.googleapis.com/v1/userinfo";

	static final String GITHUB_USER = "https://api.github.com/user";

	static final String GITHUB_EMAILS = "https://api.github.com/user/emails";

	private static final String GITHUB_MEDIA_TYPE = "application/vnd.github+json";

	private static final String USER_AGENT = "lumi-links";

	private final RestClient http;

	@Autowired
	HttpOAuthProviderClient() {
		this(defaultClient());
	}

	HttpOAuthProviderClient(RestClient http) {
		this.http = http;
	}

	@Override
	public ProviderIdentity fetchIdentity(Exchange exchange) {
		try {
			String accessToken = exchangeCode(exchange);
			return switch (exchange.provider()) {
				case GOOGLE -> googleIdentity(accessToken);
				case GITHUB -> githubIdentity(accessToken);
			};
		}
		catch (RestClientException | IllegalStateException | NullPointerException failure) {
			throw new OAuthProviderException();
		}
	}

	private String exchangeCode(Exchange exchange) {
		MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
		form.add("grant_type", "authorization_code");
		form.add("code", exchange.code());
		form.add("redirect_uri", exchange.redirectUri());
		form.add("client_id", exchange.clientId());
		form.add("client_secret", exchange.clientSecret());
		form.add("code_verifier", exchange.codeVerifier());
		JsonNode token = this.http.post()
				.uri(exchange.provider().tokenUri())
				.contentType(MediaType.APPLICATION_FORM_URLENCODED)
				.accept(MediaType.APPLICATION_JSON)
				.header(HttpHeaders.USER_AGENT, USER_AGENT)
				.body(form)
				.retrieve()
				.body(JsonNode.class);
		String accessToken = text(token, "access_token");
		if (!StringUtils.hasText(accessToken)) {
			throw new OAuthProviderException();
		}
		return accessToken;
	}

	private ProviderIdentity googleIdentity(String accessToken) {
		JsonNode profile = this.http.get()
				.uri(GOOGLE_USER_INFO)
				.accept(MediaType.APPLICATION_JSON)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.retrieve()
				.body(JsonNode.class);
		String subject = text(profile, "sub");
		if (!StringUtils.hasText(subject)) {
			throw new OAuthProviderException();
		}
		return new ProviderIdentity(subject, text(profile, "name"), text(profile, "email"),
				flag(profile, "email_verified"));
	}

	private ProviderIdentity githubIdentity(String accessToken) {
		JsonNode profile = githubGet(GITHUB_USER, accessToken);
		JsonNode emails = githubGet(GITHUB_EMAILS, accessToken);
		String id = text(profile, "id");
		if (!StringUtils.hasText(id)) {
			throw new OAuthProviderException();
		}
		String name = StringUtils.hasText(text(profile, "name")) ? text(profile, "name") : text(profile, "login");
		String email = primaryVerifiedEmail(emails);
		return new ProviderIdentity(id, name, email, email != null);
	}

	private JsonNode githubGet(String uri, String accessToken) {
		return this.http.get()
				.uri(uri)
				.accept(MediaType.parseMediaType(GITHUB_MEDIA_TYPE))
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.header(HttpHeaders.USER_AGENT, USER_AGENT)
				.retrieve()
				.body(JsonNode.class);
	}

	private static String primaryVerifiedEmail(JsonNode emails) {
		if (emails == null || !emails.isArray()) {
			return null;
		}
		for (JsonNode entry : emails) {
			if (flag(entry, "primary") && flag(entry, "verified") && StringUtils.hasText(text(entry, "email"))) {
				return text(entry, "email");
			}
		}
		return null;
	}

	private static String text(JsonNode node, String field) {
		if (node == null) {
			return null;
		}
		JsonNode value = node.get(field);
		return (value == null || value.isNull()) ? null : value.asString();
	}

	private static boolean flag(JsonNode node, String field) {
		if (node == null) {
			return false;
		}
		JsonNode value = node.get(field);
		if (value == null || value.isNull()) {
			return false;
		}
		return value.isBoolean() ? value.booleanValue() : "true".equals(value.asString());
	}

	private static RestClient defaultClient() {
		HttpClient jdk = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
		JdkClientHttpRequestFactory requests = new JdkClientHttpRequestFactory(jdk);
		requests.setReadTimeout(Duration.ofSeconds(10));
		return RestClient.builder().requestFactory(requests).build();
	}

}
