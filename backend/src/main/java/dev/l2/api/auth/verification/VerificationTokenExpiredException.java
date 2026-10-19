package dev.l2.api.auth.verification;

public class VerificationTokenExpiredException extends RuntimeException {

	public VerificationTokenExpiredException() {
		super("Link de confirmação expirado. Peça um novo link");
	}

}
