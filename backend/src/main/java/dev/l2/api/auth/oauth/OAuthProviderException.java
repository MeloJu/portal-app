package dev.l2.api.auth.oauth;

public class OAuthProviderException extends RuntimeException {

	public OAuthProviderException() {
		super("Falha ao falar com o provedor de login");
	}

}
