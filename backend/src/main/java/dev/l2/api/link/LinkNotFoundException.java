package dev.l2.api.link;

public class LinkNotFoundException extends RuntimeException {

	public LinkNotFoundException() {
		super("Esse portal não existe");
	}

}
