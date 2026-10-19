package dev.l2.api.mail;

import dev.l2.api.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;

import java.time.Duration;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

@Import({ TestcontainersConfiguration.class, MailDispatcherAsyncTests.ThreadCapturingConfiguration.class })
@SpringBootTest(properties = "app.rate-limit.enabled=false")
class MailDispatcherAsyncTests {

	static final List<String> SENDER_THREADS = new CopyOnWriteArrayList<>();

	@Autowired
	private MailDispatcher dispatcher;

	@Test
	void dispatchRunsOnMailExecutorThread() {
		dispatcher.dispatch(new OutgoingEmail("ana@example.com", "Assunto", "Corpo"));

		await().atMost(Duration.ofSeconds(5)).until(() -> !SENDER_THREADS.isEmpty());
		assertThat(SENDER_THREADS.get(0)).startsWith("mail-");
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class ThreadCapturingConfiguration {

		@Bean
		@Primary
		EmailSender threadCapturingEmailSender() {
			return message -> SENDER_THREADS.add(Thread.currentThread().getName());
		}

	}

}
