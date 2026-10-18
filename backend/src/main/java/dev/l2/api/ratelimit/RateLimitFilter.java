package dev.l2.api.ratelimit;

import dev.l2.api.config.AppProperties.RateLimit;
import dev.l2.api.ratelimit.RateLimitedRoute.Match;
import dev.l2.api.security.BlockedEventReason;
import dev.l2.api.security.ProtectionService;
import dev.l2.api.web.ErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Duration;

public class RateLimitFilter extends OncePerRequestFilter {

	static final String CODE = "RATE_LIMIT";

	static final String MESSAGE = "Muitas tentativas em pouco tempo. Tente de novo daqui a pouco.";

	private final RateLimiter limiter;

	private final ProtectionService protection;

	private final RateLimit limits;

	private final ObjectMapper json;

	public RateLimitFilter(RateLimiter limiter, ProtectionService protection, RateLimit limits, ObjectMapper json) {
		this.limiter = limiter;
		this.protection = protection;
		this.limits = limits;
		this.json = json;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return !this.limits.enabled() || RateLimitedRoute.match(request) == null;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		Match match = RateLimitedRoute.match(request);
		RateLimiter.Decision decision = this.limiter.check(match.route().name(), request.getRemoteAddr(),
				match.route().ruleOf(this.limits));
		if (decision.allowed()) {
			chain.doFilter(request, response);
			return;
		}
		if (decision.worthReporting()) {
			report(match);
		}
		reject(response, decision.retryAfter());
	}

	private void report(Match match) {
		try {
			this.protection.block(BlockedEventReason.RATE_LIMIT, match.code(), null);
		}
		catch (RuntimeException failed) {
			this.logger.warn("Ameaca RATE_LIMIT nao registrada: " + failed.getMessage());
		}
	}

	private void reject(HttpServletResponse response, Duration retryAfter) throws IOException {
		response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
		response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(Math.max(retryAfter.toSeconds(), 1)));
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		response.setCharacterEncoding("UTF-8");
		this.json.writeValue(response.getWriter(), new ErrorResponse(CODE, MESSAGE));
	}

}
