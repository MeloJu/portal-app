package dev.l2.api.mail;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(OutputCaptureExtension.class)
class LoggingEmailSenderTests {

	@Test
	void writesRecipientSubjectAndBodyToLog(CapturedOutput output) {
		new LoggingEmailSender().send(new OutgoingEmail("ana@example.com", "Assunto de teste", "corpo de teste"));

		assertThat(output).contains("ana@example.com").contains("Assunto de teste").contains("corpo de teste");
	}

}
