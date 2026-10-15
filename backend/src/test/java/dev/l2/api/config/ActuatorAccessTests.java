package dev.l2.api.config;

import dev.l2.api.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalManagementPort;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = { "management.server.port=0", "management.defaults.metrics.export.enabled=true", "management.prometheus.metrics.export.enabled=true" })
class ActuatorAccessTests {

	@LocalServerPort
	private int apiPort;

	@LocalManagementPort
	private int managementPort;

	private final HttpClient client = HttpClient.newHttpClient();

	private HttpResponse<String> get(int port, String path) throws Exception {
		HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build();
		return this.client.send(request, HttpResponse.BodyHandlers.ofString());
	}

	@Test
	void probesReachHealthOnTheManagementPortWithoutSession() throws Exception {
		HttpResponse<String> response = get(this.managementPort, "/actuator/health");

		assertThat(response.statusCode()).isEqualTo(200);
		assertThat(response.body()).contains("\"status\":\"UP\"");
	}

	@Test
	void prometheusIsReachableOnTheManagementPort() throws Exception {
		assertThat(get(this.managementPort, "/actuator/prometheus").statusCode()).isEqualTo(200);
	}

	@Test
	void actuatorIsNotExposedOnTheApiPort() throws Exception {
		assertThat(get(this.apiPort, "/actuator/health").statusCode()).isNotEqualTo(200);
		assertThat(get(this.apiPort, "/actuator/prometheus").statusCode()).isNotEqualTo(200);
	}

	@Test
	void apiStillRequiresSessionOnItsOwnPort() throws Exception {
		assertThat(get(this.apiPort, "/api/me").statusCode()).isEqualTo(401);
	}

}
