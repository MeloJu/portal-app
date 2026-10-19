package dev.l2.api.auth.oauth;

import java.util.Arrays;
import java.util.Optional;

public enum OAuthProvider {

	GOOGLE("google", "openid email profile", "https://accounts.google.com/o/oauth2/v2/auth",
			"https://oauth2.googleapis.com/token"),

	GITHUB("github", "read:user user:email", "https://github.com/login/oauth/authorize",
			"https://github.com/login/oauth/access_token");

	private final String slug;

	private final String scopes;

	private final String authorizationUri;

	private final String tokenUri;

	OAuthProvider(String slug, String scopes, String authorizationUri, String tokenUri) {
		this.slug = slug;
		this.scopes = scopes;
		this.authorizationUri = authorizationUri;
		this.tokenUri = tokenUri;
	}

	public String slug() {
		return this.slug;
	}

	public String scopes() {
		return this.scopes;
	}

	public String authorizationUri() {
		return this.authorizationUri;
	}

	public String tokenUri() {
		return this.tokenUri;
	}

	public static Optional<OAuthProvider> fromSlug(String slug) {
		return Arrays.stream(values()).filter(provider -> provider.slug.equals(slug)).findFirst();
	}

}
