package dev.l2.api.account;

public class CodeExpiredException extends AccountCodeException {

	public CodeExpiredException() {
		super("Código expirado. Solicite um novo código.");
	}

}
