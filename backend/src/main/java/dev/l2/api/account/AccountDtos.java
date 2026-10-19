package dev.l2.api.account;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AccountDtos {

	private AccountDtos() {
	}

	public record UpdateProfileRequest(

			@NotBlank @Size(max = 120) @Pattern(regexp = "^\\P{Cc}*$", message = "não pode conter caracteres de controle") String name) {

		public UpdateProfileRequest {
			name = (name == null) ? null : trimmed(name);
		}

		private static String trimmed(String value) {
			int start = 0;
			int end = value.length();
			while (start < end && isBlankEdge(value.charAt(start))) {
				start++;
			}
			while (end > start && isBlankEdge(value.charAt(end - 1))) {
				end--;
			}
			return value.substring(start, end);
		}

		private static boolean isBlankEdge(char character) {
			return Character.isWhitespace(character) || Character.isSpaceChar(character);
		}

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

			@NotBlank @Size(min = 8, max = 72) @MaxUtf8Bytes(72) String newPassword) {

	}

}
