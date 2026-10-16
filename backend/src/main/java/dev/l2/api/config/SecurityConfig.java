package dev.l2.api.config;

import dev.l2.api.auth.CookieTokenResolver;
import dev.l2.api.auth.JwtService;
import dev.l2.api.ratelimit.RateLimitFilter;
import dev.l2.api.ratelimit.RateLimiter;
import dev.l2.api.security.ProtectionService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import tools.jackson.databind.ObjectMapper;

@Configuration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class SecurityConfig {

	@Bean
	SecurityFilterChain filterChain(HttpSecurity http, CookieTokenResolver tokenResolver, JwtService jwt,
			RateLimiter limiter, ProtectionService protection, AppProperties properties, ObjectMapper json)
			throws Exception {
		return http
				.authorizeHttpRequests(requests -> requests
						.requestMatchers("/api/auth/register", "/api/auth/login", "/api/auth/logout").permitAll()
						.requestMatchers("/api/travel/**", "/r/**").permitAll()
						.requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
						.anyRequest().authenticated())
				// SameSite=Strict e mesma origem resolvem CSRF (docs/SECURITY.md, secao 4).
				.csrf(csrf -> csrf.disable())
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.oauth2ResourceServer(resource -> resource
						.bearerTokenResolver(tokenResolver)
						.jwt(token -> token.decoder(jwt::verify))
						.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
				.addFilterBefore(new RateLimitFilter(limiter, protection, properties.rateLimit(), json),
						BearerTokenAuthenticationFilter.class)
				.build();
	}

}
