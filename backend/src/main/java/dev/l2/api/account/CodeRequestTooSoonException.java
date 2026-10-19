package dev.l2.api.account;

import java.time.Duration;

public class CodeRequestTooSoonException extends AccountCodeException {

	private final Duration retryAfter;

	public CodeRequestTooSoonException(Duration retryAfter) {
		super("Aguarde antes de solicitar um novo código.");
		this.retryAfter = retryAfter;
	}

	public Duration retryAfter() {
		return this.retryAfter;
	}

}
