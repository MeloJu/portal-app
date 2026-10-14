package dev.l2.api.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Arrays;

@Component
public class CookieTokenResolver implements BearerTokenResolver {

	@Override
	public String resolve(HttpServletRequest request) {
		Cookie[] cookies = request.getCookies();
		if (cookies == null) {
			return null;
		}
		return Arrays.stream(cookies)
				.filter(cookie -> SessionCookie.NAME.equals(cookie.getName()))
				.map(Cookie::getValue)
				.filter(StringUtils::hasText)
				.findFirst()
				.orElse(null);
	}

}
