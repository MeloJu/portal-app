package dev.l2.api.account;

public class WrongPasswordException extends RuntimeException {

	public WrongPasswordException() {
		super("Senha atual incorreta");
	}

}
