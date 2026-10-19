package dev.l2.api.account;

public abstract class AccountCodeException extends RuntimeException {

	protected AccountCodeException(String message) {
		super(message);
	}

}
