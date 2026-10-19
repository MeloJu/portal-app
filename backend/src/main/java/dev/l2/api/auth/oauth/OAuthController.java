package dev.l2.api.auth.oauth;

import dev.l2.api.auth.SessionIssuer;
import dev.l2.api.auth.oauth.OAuthProperties.Credentials;
import dev.l2.api.auth.oauth.OAuthProviderClient.Exchange;
import dev.l2.api.auth.oauth.OAuthProviderClient.ProviderIdentity;
import dev.l2.api.auth.oauth.OAuthStateCookie.Started;
import dev.l2.api.config.AppProperties;
import dev.l2.api.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Map;
import java.util.Optional;

@RestController
public class OAuthController {

	private static final Logger LOG = LoggerFactory.getLogger(OAuthController.class);

	private static final String AUTHORIZATION_PATH = "/api/auth/oauth/";

	private static final String CALLBACK_PATH = "/api/auth/oauth/callback/";

	private final OAuthProperties oauth;

	private final OAuthStateCookie stateCookie;

	private final OAuthProviderClient providers;

	private final OAuthLoginService login;

	private final SessionIssuer sessions;

	private final String publicBaseUrl;

	public OAuthController(OAuthProperties oauth, OAuthStateCookie stateCookie, OAuthProviderClient providers,
			OAuthLoginService login, SessionIssuer sessions, AppProperties properties) {
		this.oauth = oauth;
		this.stateCookie = stateCookie;
		this.providers = providers;
		this.login = login;
		this.sessions = sessions;
		this.publicBaseUrl = properties.publicBaseUrl().replaceAll("/+$", "");
	}

	@GetMapping(AUTHORIZATION_PATH + "{provider}")
	public ResponseEntity<Void> authorize(@PathVariable String provider) {
		Optional<OAuthProvider> known = OAuthProvider.fromSlug(provider);
		if (known.isEmpty()) {
			return ResponseEntity.notFound().build();
		}
		OAuthProvider target = known.get();
		Credentials credentials = this.oauth.credentialsOf(target);
		if (!credentials.enabled()) {
			return failure(OAuthError.OAUTH_DISABLED);
		}
		Started started = this.stateCookie.start(target);
		URI authorization = UriComponentsBuilder.fromUriString(target.authorizationUri())
				.queryParam("response_type", "code")
				.queryParam("client_id", "{clientId}")
				.queryParam("redirect_uri", "{redirectUri}")
				.queryParam("scope", "{scope}")
				.queryParam("state", "{state}")
				.queryParam("code_challenge", "{challenge}")
				.queryParam("code_challenge_method", "S256")
				.encode()
				.buildAndExpand(Map.of(
						"clientId", credentials.clientId(),
						"redirectUri", redirectUri(target),
						"scope", target.scopes(),
						"state", started.state(),
						"challenge", started.codeChallenge()))
				.toUri();
		return ResponseEntity.status(HttpStatus.FOUND)
				.location(authorization)
				.header(HttpHeaders.SET_COOKIE, started.cookie().toString())
				.cacheControl(CacheControl.noStore())
				.build();
	}

	@GetMapping(CALLBACK_PATH + "{provider}")
	public ResponseEntity<Void> callback(@PathVariable String provider,
			@RequestParam(required = false) String code,
			@RequestParam(required = false) String state,
			@RequestParam(required = false) String error,
			@CookieValue(name = OAuthStateCookie.NAME, required = false) String pendingState) {
		Optional<OAuthProvider> known = OAuthProvider.fromSlug(provider);
		if (known.isEmpty()) {
			return ResponseEntity.notFound().build();
		}
		OAuthProvider target = known.get();
		Credentials credentials = this.oauth.credentialsOf(target);
		if (!credentials.enabled()) {
			return failure(OAuthError.OAUTH_DISABLED);
		}
		Optional<String> codeVerifier = this.stateCookie.verifiedCodeVerifier(target, pendingState, state);
		if (codeVerifier.isEmpty()) {
			return failure(OAuthError.OAUTH_STATE_INVALID);
		}
		if (error != null) {
			return failure(OAuthError.OAUTH_DENIED);
		}
		if (code == null || code.isBlank()) {
			return failure(OAuthError.OAUTH_PROVIDER_ERROR);
		}
		try {
			ProviderIdentity identity = this.providers.fetchIdentity(new Exchange(target, credentials.clientId(),
					credentials.clientSecret(), redirectUri(target), code, codeVerifier.get()));
			User user = this.login.signIn(target, identity);
			return success(user);
		}
		catch (OAuthEmailUnverifiedException unverified) {
			return failure(OAuthError.OAUTH_EMAIL_UNVERIFIED);
		}
		catch (RuntimeException failed) {
			LOG.warn("Login OAuth ({}) falhou: {}", target.slug(), failed.getClass().getSimpleName());
			return failure(OAuthError.OAUTH_PROVIDER_ERROR);
		}
	}

	private ResponseEntity<Void> success(User user) {
		return ResponseEntity.status(HttpStatus.FOUND)
				.location(URI.create(this.publicBaseUrl + "/dashboard"))
				.header(HttpHeaders.SET_COOKIE, this.sessions.setCookieHeader(user))
				.header(HttpHeaders.SET_COOKIE, this.stateCookie.expired().toString())
				.cacheControl(CacheControl.noStore())
				.build();
	}

	private ResponseEntity<Void> failure(OAuthError error) {
		URI login = UriComponentsBuilder.fromUriString(this.publicBaseUrl + "/login")
				.queryParam("oauth_error", error.name())
				.build()
				.toUri();
		return ResponseEntity.status(HttpStatus.FOUND)
				.location(login)
				.header(HttpHeaders.SET_COOKIE, this.stateCookie.expired().toString())
				.cacheControl(CacheControl.noStore())
				.build();
	}

	private String redirectUri(OAuthProvider provider) {
		return this.publicBaseUrl + CALLBACK_PATH + provider.slug();
	}

}
