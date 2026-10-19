package dev.l2.api.auth;

public class EmailNotVerifiedException extends RuntimeException {

	public EmailNotVerifiedException() {
		super("Confirme seu e-mail para criar portais.");
	}

}
