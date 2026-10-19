package dev.l2.api.mail;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EmailTemplatesTests {

	@Test
	void verificationHasLinkAndThirtyMinutes() {
		OutgoingEmail email = EmailTemplates.emailVerification("ana@example.com", "https://l2.to/verify?token=abc");

		assertThat(email.to()).isEqualTo("ana@example.com");
		assertThat(email.textBody()).contains("https://l2.to/verify?token=abc").contains("30 minutos");
	}

	@Test
	void emailChangeCodeHasCodeAndMinutes() {
		OutgoingEmail email = EmailTemplates.emailChangeCode("ana@example.com", "123456", 15);

		assertThat(email.textBody()).contains("123456").contains("15 minutos");
	}

	@Test
	void passwordChangeCodeHasCodeAndMinutes() {
		OutgoingEmail email = EmailTemplates.passwordChangeCode("ana@example.com", "654321", 10);

		assertThat(email.textBody()).contains("654321").contains("10 minutos");
	}

	@Test
	void emailChangedMentionsNewAddressAndGoesToOldOne() {
		OutgoingEmail email = EmailTemplates.emailChanged("velho@example.com", "novo@example.com");

		assertThat(email.to()).isEqualTo("velho@example.com");
		assertThat(email.textBody()).contains("novo@example.com");
	}

	@Test
	void bodiesArePlainText() {
		OutgoingEmail email = EmailTemplates.emailVerification("ana@example.com", "https://l2.to/x");

		assertThat(email.textBody()).doesNotContain("<");
	}

}
