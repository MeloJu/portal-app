package dev.l2.api.mail;

import dev.l2.api.config.AppProperties;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SmtpEmailSenderTests {

	@Test
	void buildsMessageWithConfiguredSender() {
		JavaMailSender javaMailSender = mock(JavaMailSender.class);
		AppProperties properties = mock(AppProperties.class);
		when(properties.mail()).thenReturn(new AppProperties.Mail(true, "lumi@example.com"));

		new SmtpEmailSender(javaMailSender, properties)
				.send(new OutgoingEmail("ana@example.com", "Assunto", "Corpo"));

		ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
		verify(javaMailSender).send(captor.capture());
		SimpleMailMessage sent = captor.getValue();
		assertThat(sent.getFrom()).isEqualTo("lumi@example.com");
		assertThat(sent.getTo()).containsExactly("ana@example.com");
		assertThat(sent.getSubject()).isEqualTo("Assunto");
		assertThat(sent.getText()).isEqualTo("Corpo");
	}

}
