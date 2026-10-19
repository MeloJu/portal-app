package dev.l2.api.mail;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

@ExtendWith(OutputCaptureExtension.class)
class MailDispatcherTests {

	private static final OutgoingEmail MESSAGE =
			new OutgoingEmail("ana@example.com", "Código", "codigo-secreto-123456");

	@Test
	void senderFailureDoesNotPropagateNorLeakBody(CapturedOutput output) {
		EmailSender failing = message -> {
			throw new IllegalStateException("smtp fora do ar: codigo-secreto-123456");
		};

		assertThatCode(() -> new MailDispatcher(failing).dispatch(MESSAGE)).doesNotThrowAnyException();
		assertThat(output).contains("Falha ao enviar e-mail").doesNotContain("codigo-secreto-123456");
	}

	@Test
	void deliversMessageToSender() {
		RecordingEmailSender recording = new RecordingEmailSender();

		new MailDispatcher(recording).dispatch(MESSAGE);

		assertThat(recording.all()).containsExactly(MESSAGE);
		assertThat(recording.last()).isEqualTo(MESSAGE);
		recording.clear();
		assertThat(recording.all()).isEmpty();
	}

}
