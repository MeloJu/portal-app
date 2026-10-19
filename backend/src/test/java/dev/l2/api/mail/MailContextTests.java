package dev.l2.api.mail;

import dev.l2.api.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = { "app.mail.enabled=false", "app.rate-limit.enabled=false" })
class MailContextTests {

	@Autowired
	private ApplicationContext context;

	@Test
	void startsWithLoggingSenderAndNoSmtpHost() {
		assertThat(context.getBean(EmailSender.class)).isInstanceOf(LoggingEmailSender.class);
		assertThat(context.getBeansOfType(SmtpEmailSender.class)).isEmpty();
		assertThat(context.getBean(MailDispatcher.class)).isNotNull();
	}

}
