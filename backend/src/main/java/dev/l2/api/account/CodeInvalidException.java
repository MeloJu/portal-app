package dev.l2.api.account;

public class CodeInvalidException extends RuntimeException {

	public CodeInvalidException() {
		super("Código inválido. Confira os 6 dígitos e tente novamente.");
	}

}
