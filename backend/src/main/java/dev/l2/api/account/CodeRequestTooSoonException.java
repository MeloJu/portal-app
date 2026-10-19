package dev.l2.api.account;

import java.time.Duration;

public class CodeRequestTooSoonException extends RuntimeException {

	private final Duration retryAfter;

	public CodeRequestTooSoonException(Duration retryAfter) {
		super("Aguarde antes de solicitar um novo código.");
		this.retryAfter = retryAfter;
	}

	public Duration retryAfter() {
		return this.retryAfter;
	}

	public long retryAfterSeconds() {
		long seconds = this.retryAfter.toSeconds();
		return this.retryAfter.getNano() > 0 ? seconds + 1 : Math.max(seconds, 1);
	}

}
