package dev.l2.api.auth;

public class EmailAlreadyUsedException extends RuntimeException {

	public EmailAlreadyUsedException() {
		super("E-mail já cadastrado");
	}

}
