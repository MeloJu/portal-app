package dev.l2.api.auth;

import dev.l2.api.user.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public final class AuthDtos {

	private AuthDtos() {
	}

	public record RegisterRequest(

			@NotBlank @Size(max = 120) String name,

			@NotBlank @Email @Size(max = 254) String email,

			@NotBlank @Size(min = 8, max = 72) String password) {

	}

	public record LoginRequest(@NotBlank String email, @NotBlank String password) {

	}

	public record UserResponse(UUID id, String name, String email) {

		public static UserResponse of(User user) {
			return new UserResponse(user.getId(), user.getName(), user.getEmail());
		}

	}

	public record AuthResponse(long expiresIn, UserResponse user) {

	}

}
