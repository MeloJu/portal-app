package dev.l2.api.auth;

import dev.l2.api.config.AppProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class SessionCookie {

	public static final String NAME = "lumi_session";

	private final Duration ttl;

	private final boolean secure;

	@Autowired
	public SessionCookie(AppProperties properties) {
		this(properties.jwt().ttl(), properties.session().secureCookie());
	}

	SessionCookie(Duration ttl, boolean secure) {
		this.ttl = ttl;
		this.secure = secure;
	}

	public ResponseCookie issue(String token) {
		return base(token).maxAge(this.ttl).build();
	}

	public ResponseCookie expired() {
		return base("").maxAge(Duration.ZERO).build();
	}

	private ResponseCookie.ResponseCookieBuilder base(String value) {
		return ResponseCookie.from(NAME, value).path("/").httpOnly(true).secure(this.secure).sameSite("Strict");
	}

}
