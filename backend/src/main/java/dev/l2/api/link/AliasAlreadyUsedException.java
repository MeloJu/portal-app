package dev.l2.api.link;

public class AliasAlreadyUsedException extends RuntimeException {

	public AliasAlreadyUsedException() {
		super("Esse nome de portal já foi pego");
	}

}
