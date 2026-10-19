package dev.l2.api.account;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CodeHasherTests {

	private static final byte[] PEPPER = "pepper-de-teste-com-32-bytes-ok!".getBytes(StandardCharsets.UTF_8);

	private final CodeHasher hasher = new CodeHasher(PEPPER);

	private final UUID user = UUID.fromString("00000000-0000-0000-0000-000000000001");

	@Test
	void hashIsSixtyFourLowercaseHexCharacters() {
		assertThat(this.hasher.hash(this.user, AccountCodePurpose.EMAIL_CHANGE, "123456")).matches("^[0-9a-f]{64}$");
	}

	@Test
	void sameInputsProduceSameHash() {
		assertThat(this.hasher.hash(this.user, AccountCodePurpose.EMAIL_CHANGE, "123456"))
				.isEqualTo(this.hasher.hash(this.user, AccountCodePurpose.EMAIL_CHANGE, "123456"));
	}

	@Test
	void hashDependsOnUserPurposeCodeAndPepper() {
		String base = this.hasher.hash(this.user, AccountCodePurpose.EMAIL_CHANGE, "123456");

		assertThat(this.hasher.hash(UUID.randomUUID(), AccountCodePurpose.EMAIL_CHANGE, "123456")).isNotEqualTo(base);
		assertThat(this.hasher.hash(this.user, AccountCodePurpose.PASSWORD_CHANGE, "123456")).isNotEqualTo(base);
		assertThat(this.hasher.hash(this.user, AccountCodePurpose.EMAIL_CHANGE, "123457")).isNotEqualTo(base);
		assertThat(new CodeHasher("outro-pepper-com-32-bytes-ok!!!".getBytes(StandardCharsets.UTF_8))
				.hash(this.user, AccountCodePurpose.EMAIL_CHANGE, "123456")).isNotEqualTo(base);
	}

	@Test
	void matchesEqualHashes() {
		assertThat(this.hasher.matches("abc123", "abc123")).isTrue();
	}

	@Test
	void doesNotMatchDifferentHashes() {
		assertThat(this.hasher.matches("abc123", "abc124")).isFalse();
	}

	@Test
	void doesNotMatchHashesOfDifferentLength() {
		assertThat(this.hasher.matches("abc123", "abc1234")).isFalse();
		assertThat(this.hasher.matches("", "a")).isFalse();
	}

}
