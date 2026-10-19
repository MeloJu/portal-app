package dev.l2.api.account;

public class CodeAttemptsExceededException extends RuntimeException {

	public CodeAttemptsExceededException() {
		super("Muitas tentativas incorretas. Solicite um novo código.");
	}

}
