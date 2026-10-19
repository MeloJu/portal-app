package dev.l2.api.account;

public class CodeExpiredException extends RuntimeException {

	public CodeExpiredException() {
		super("Código expirado. Solicite um novo código.");
	}

}
