package dev.l2.api.account;

public class PasswordNotSetException extends RuntimeException {

	public PasswordNotSetException() {
		super("Esta conta entra pelo Google ou GitHub e não tem senha para trocar.");
	}

}
