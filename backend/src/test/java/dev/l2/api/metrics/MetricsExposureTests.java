package dev.l2.api.metrics;

import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.security.BlockedEventReason;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalManagementPort;
import org.springframework.context.annotation.Import;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = { "management.server.port=0", "management.defaults.metrics.export.enabled=true",
				"management.prometheus.metrics.export.enabled=true" })
class MetricsExposureTests {

	@LocalManagementPort
	private int managementPort;

	private final HttpClient client = HttpClient.newHttpClient();

	private String scrape;

	@BeforeEach
	void scrapePrometheus() throws Exception {
		HttpRequest request = HttpRequest
				.newBuilder(URI.create("http://localhost:" + this.managementPort + "/actuator/prometheus"))
				.GET()
				.build();
		HttpResponse<String> response = this.client.send(request, HttpResponse.BodyHandlers.ofString());

		assertThat(response.statusCode()).isEqualTo(200);
		this.scrape = response.body();
	}

	@Test
	void exposesLinksCreated() {
		assertThat(this.scrape).contains("l2_links_total");
		assertThat(this.scrape).doesNotContain("l2_links_created_total");
	}

	@Test
	void exposesTravelsSeparatedByBot() {
		assertThat(this.scrape).contains("l2_travels_total{bot=\"false\"}", "l2_travels_total{bot=\"true\"}");
	}

	@Test
	void exposesThreatsBlockedForEveryReason() {
		for (BlockedEventReason reason : BlockedEventReason.values()) {
			assertThat(this.scrape).contains("l2_threats_blocked_total{reason=\"" + reason.name() + "\"}");
		}
	}

}
