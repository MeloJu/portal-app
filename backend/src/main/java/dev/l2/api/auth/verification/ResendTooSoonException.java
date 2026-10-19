package dev.l2.api.auth.verification;

import java.time.Duration;

public class ResendTooSoonException extends RuntimeException {

	private final Duration retryAfter;

	public ResendTooSoonException(Duration retryAfter) {
		super("Aguarde um pouco antes de pedir um novo link de confirmação");
		this.retryAfter = retryAfter;
	}

	public Duration getRetryAfter() {
		return this.retryAfter;
	}

}
