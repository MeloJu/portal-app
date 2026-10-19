package dev.l2.api.auth.verification;

import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.mail.EmailSender;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import({ TestcontainersConfiguration.class, VerificationEmailFailureTests.FailingSenderConfiguration.class })
@AutoConfigureMockMvc
@SpringBootTest(properties = "app.rate-limit.enabled=false")
class VerificationEmailFailureTests {

	static final AtomicInteger ATTEMPTS = new AtomicInteger();

	@Autowired
	private MockMvc mvc;

	@Test
	void registerSucceedsEvenWhenTheEmailCannotBeSent() throws Exception {
		String email = UUID.randomUUID().toString().replace("-", "").substring(0, 12) + "@example.com";

		this.mvc.perform(post("/api/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"name":"Ana","email":"%s","password":"senha-bem-grande"}""".formatted(email)))
				.andExpect(status().isCreated());

		await().atMost(Duration.ofSeconds(5)).until(() -> ATTEMPTS.get() > 0);
		assertThat(ATTEMPTS.get()).isEqualTo(1);
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class FailingSenderConfiguration {

		@Bean
		@Primary
		EmailSender failingEmailSender() {
			return message -> {
				ATTEMPTS.incrementAndGet();
				throw new IllegalStateException("smtp fora do ar");
			};
		}

	}

}
