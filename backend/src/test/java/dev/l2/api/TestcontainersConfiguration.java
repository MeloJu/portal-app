package dev.l2.api;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

	@Bean
	@ServiceConnection
	public PostgreSQLContainer postgresContainer() {
		return new PostgreSQLContainer(DockerImageName.parse("postgres:18-alpine"));
	}

	@Bean
	DynamicPropertyRegistrar environmentVariables(PostgreSQLContainer container) {
		return registry -> {
			registry.add("DB_URL", container::getJdbcUrl);
			registry.add("DB_USER", container::getUsername);
			registry.add("DB_PASSWORD", container::getPassword);
			registry.add("PUBLIC_BASE_URL", () -> "http://localhost:8080");
			registry.add("JWT_SECRET", () -> Base64.getEncoder()
					.encodeToString("chave-de-teste-com-32-bytes-ok!!".getBytes(StandardCharsets.UTF_8)));
			registry.add("APP_CODE_PEPPER", () -> Base64.getEncoder()
					.encodeToString("pepper-de-teste-com-32-bytes-ok!".getBytes(StandardCharsets.UTF_8)));
		};
	}

}
