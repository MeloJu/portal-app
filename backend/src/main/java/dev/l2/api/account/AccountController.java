package dev.l2.api.account;

import dev.l2.api.account.AccountDtos.ChangeEmailRequest;
import dev.l2.api.account.AccountDtos.ChangePasswordRequest;
import dev.l2.api.account.AccountDtos.RequestCodeRequest;
import dev.l2.api.account.AccountDtos.UpdateProfileRequest;
import dev.l2.api.auth.AuthDtos.UserResponse;
import dev.l2.api.auth.SessionIssuer;
import dev.l2.api.user.User;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class AccountController {

	private final AccountService account;

	private final SessionIssuer sessions;

	public AccountController(AccountService account, SessionIssuer sessions) {
		this.account = account;
		this.sessions = sessions;
	}

	@PatchMapping("/api/account/profile")
	public ResponseEntity<UserResponse> updateProfile(@AuthenticationPrincipal Jwt principal,
			@Valid @RequestBody UpdateProfileRequest request) {
		return refreshed(this.account.updateName(userId(principal), request.name()));
	}

	@PostMapping("/api/account/codes")
	public ResponseEntity<Void> requestCode(@AuthenticationPrincipal Jwt principal,
			@Valid @RequestBody RequestCodeRequest request) {
		this.account.requestCode(userId(principal), request.purpose(), request.newEmail());
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/api/account/email")
	public ResponseEntity<UserResponse> changeEmail(@AuthenticationPrincipal Jwt principal,
			@Valid @RequestBody ChangeEmailRequest request) {
		User user = this.account.changeEmail(userId(principal), request.newEmail(), request.code(),
				request.currentPassword());
		return refreshed(user);
	}

	@PostMapping("/api/account/password")
	public ResponseEntity<UserResponse> changePassword(@AuthenticationPrincipal Jwt principal,
			@Valid @RequestBody ChangePasswordRequest request) {
		User user = this.account.changePassword(userId(principal), request.code(), request.currentPassword(),
				request.newPassword());
		return refreshed(user);
	}

	private ResponseEntity<UserResponse> refreshed(User user) {
		return ResponseEntity.ok()
				.header(HttpHeaders.SET_COOKIE, this.sessions.setCookieHeader(user))
				.body(UserResponse.of(user));
	}

	private static UUID userId(Jwt principal) {
		return UUID.fromString(principal.getSubject());
	}

}
