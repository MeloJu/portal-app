package dev.l2.api.travel;

import dev.l2.api.link.LinkState;

public class LinkNotTravelableException extends RuntimeException {

	private final LinkState state;

	public LinkNotTravelableException(LinkState state) {
		super(state == LinkState.PAUSED ? "Esse portal está pausado" : "Esse portal foi fechado");
		this.state = state;
	}

	public LinkState getState() {
		return this.state;
	}

}
