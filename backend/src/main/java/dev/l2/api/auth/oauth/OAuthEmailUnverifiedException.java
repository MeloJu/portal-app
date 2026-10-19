package dev.l2.api.auth.oauth;

public class OAuthEmailUnverifiedException extends RuntimeException {

	public OAuthEmailUnverifiedException() {
		super("O provedor não confirmou o seu e-mail. Confirme-o lá ou entre com e-mail e senha.");
	}

}
