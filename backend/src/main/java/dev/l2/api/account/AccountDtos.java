package dev.l2.api.account;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class AccountDtos {

	private AccountDtos() {
	}

	public record RequestCodeRequest(

			@NotNull AccountCodePurpose purpose,

			@Email @Size(max = 254) String newEmail) {

	}

	public record ChangeEmailRequest(

			@NotBlank @Email @Size(max = 254) String newEmail,

			@NotBlank @Size(max = 20) String code,

			@NotBlank @Size(max = 72) String currentPassword) {

	}

	public record ChangePasswordRequest(

			@NotBlank @Size(max = 20) String code,

			@NotBlank @Size(max = 72) String currentPassword,

			@NotBlank @Size(min = 8, max = 72) String newPassword) {

	}

}
