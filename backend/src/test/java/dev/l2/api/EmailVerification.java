package dev.l2.api;

import dev.l2.api.user.User;
import dev.l2.api.user.UserRepository;

import java.time.Instant;

public final class EmailVerification {

	private EmailVerification() {
	}

	public static void verify(UserRepository users, String email) {
		User user = users.findByEmail(email).orElseThrow();
		user.markEmailVerified(Instant.now());
		users.save(user);
	}

}
