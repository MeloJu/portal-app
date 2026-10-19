package dev.l2.api.auth.oauth;

public interface OAuthProviderClient {

	ProviderIdentity fetchIdentity(Exchange exchange);

	record Exchange(OAuthProvider provider, String clientId, String clientSecret, String redirectUri, String code,
			String codeVerifier) {

		@Override
		public String toString() {
			return "Exchange[provider=" + this.provider + "]";
		}

	}

	record ProviderIdentity(String providerUserId, String name, String email, boolean emailVerified) {

		@Override
		public String toString() {
			return "ProviderIdentity[providerUserId=" + this.providerUserId + "]";
		}

	}

}
