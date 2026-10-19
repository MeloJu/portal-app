package dev.l2.api.auth;

import dev.l2.api.auth.AuthDtos.AuthResponse;
import dev.l2.api.auth.AuthDtos.LoginRequest;
import dev.l2.api.auth.AuthDtos.RegisterRequest;
import dev.l2.api.auth.AuthDtos.UserResponse;
import dev.l2.api.auth.AuthDtos.VerifyEmailRequest;
import dev.l2.api.auth.verification.VerificationTokenService;
import dev.l2.api.user.User;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class AuthController {

	private final AuthService auth;

	private final SessionIssuer sessions;

	private final SessionCookie cookie;

	private final VerificationTokenService verification;

	public AuthController(AuthService auth, SessionIssuer sessions, SessionCookie cookie,
			VerificationTokenService verification) {
		this.auth = auth;
		this.sessions = sessions;
		this.cookie = cookie;
		this.verification = verification;
	}

	@PostMapping("/api/auth/register")
	public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
		User user = this.auth.register(request.name(), request.email(), request.password());
		return session(user, HttpStatus.CREATED);
	}

	@PostMapping("/api/auth/login")
	public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
		User user = this.auth.login(request.email(), request.password());
		return session(user, HttpStatus.OK);
	}

	@PostMapping("/api/auth/logout")
	public ResponseEntity<Void> logout() {
		return ResponseEntity.noContent()
				.header(HttpHeaders.SET_COOKIE, this.cookie.expired().toString())
				.build();
	}

	@PostMapping("/api/auth/verify-email")
	public ResponseEntity<Void> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
		this.verification.verify(request.token());
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/api/auth/resend-verification")
	public ResponseEntity<Void> resendVerification(@AuthenticationPrincipal Jwt principal) {
		this.verification.resend(UUID.fromString(principal.getSubject()));
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/api/me")
	public UserResponse me(@AuthenticationPrincipal Jwt principal) {
		return UserResponse.of(this.auth.require(UUID.fromString(principal.getSubject())));
	}

	private ResponseEntity<AuthResponse> session(User user, HttpStatus status) {
		return ResponseEntity.status(status)
				.header(HttpHeaders.SET_COOKIE, this.sessions.setCookieHeader(user))
				.body(new AuthResponse(this.sessions.expiresInSeconds(), UserResponse.of(user)));
	}

}
