package dev.l2.api.auth.verification;

public class VerificationTokenInvalidException extends RuntimeException {

	public VerificationTokenInvalidException() {
		super("Link de confirmação inválido ou já utilizado");
	}

}
