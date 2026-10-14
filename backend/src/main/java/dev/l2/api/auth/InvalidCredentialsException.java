package dev.l2.api.auth;

public class InvalidCredentialsException extends RuntimeException {

	public InvalidCredentialsException() {
		super("E-mail ou senha inválidos");
	}

}
