package dev.l2.api.auth.verification;

public record VerificationEmailRequested(String email, String token) {

	@Override
	public String toString() {
		return "VerificationEmailRequested[email=" + this.email + "]";
	}

}
