package dev.l2.api.ratelimit;

import dev.l2.api.config.AppProperties.RateLimit;
import dev.l2.api.config.AppProperties.RateLimit.Rule;
import jakarta.servlet.http.HttpServletRequest;

import java.util.function.Function;

enum RateLimitedRoute {

	LOGIN(RateLimit::login),

	REGISTER(RateLimit::register),

	TRAVEL(RateLimit::travel),

	VERIFY_EMAIL(RateLimit::verifyEmail);

	private final Function<RateLimit, Rule> rule;

	RateLimitedRoute(Function<RateLimit, Rule> rule) {
		this.rule = rule;
	}

	Rule ruleOf(RateLimit limits) {
		return this.rule.apply(limits);
	}

	static Match match(HttpServletRequest request) {
		String path = request.getRequestURI().substring(request.getContextPath().length());
		if ("POST".equals(request.getMethod())) {
			if ("/api/auth/login".equals(path)) {
				return new Match(LOGIN, null);
			}
			if ("/api/auth/register".equals(path)) {
				return new Match(REGISTER, null);
			}
			if ("/api/auth/verify-email".equals(path)) {
				return new Match(VERIFY_EMAIL, null);
			}
		}
		if ("GET".equals(request.getMethod())) {
			String code = travelCode(path);
			if (code != null) {
				return new Match(TRAVEL, code);
			}
		}
		return null;
	}

	private static String travelCode(String path) {
		String code = suffixOf(path, "/api/travel/");
		return (code != null) ? code : suffixOf(path, "/r/");
	}

	private static String suffixOf(String path, String prefix) {
		if (!path.startsWith(prefix)) {
			return null;
		}
		String suffix = path.substring(prefix.length());
		return (suffix.isEmpty() || suffix.indexOf('/') >= 0) ? null : suffix;
	}

	record Match(RateLimitedRoute route, String code) {

	}

}
