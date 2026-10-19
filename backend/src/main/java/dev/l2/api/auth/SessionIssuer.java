package dev.l2.api.auth;

import dev.l2.api.user.User;
import org.springframework.stereotype.Component;

@Component
public class SessionIssuer {

	private final JwtService jwt;

	private final SessionCookie cookie;

	public SessionIssuer(JwtService jwt, SessionCookie cookie) {
		this.jwt = jwt;
		this.cookie = cookie;
	}

	public String setCookieHeader(User user) {
		String token = this.jwt.issue(user.getId(), user.getEmail(), user.getName());
		return this.cookie.issue(token).toString();
	}

	public long expiresInSeconds() {
		return this.jwt.expiresInSeconds();
	}

}
