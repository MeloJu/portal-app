package dev.l2.api.auth.verification;

public class AlreadyVerifiedException extends RuntimeException {

	public AlreadyVerifiedException() {
		super("E-mail já confirmado");
	}

}
