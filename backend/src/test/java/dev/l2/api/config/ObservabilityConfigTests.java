package dev.l2.api.config;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;

import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O dashboard do Grafana (portal-gitops) e as probes do Kubernetes dependem destas chaves do
 * application.yml. Mudar uma delas sem querer deixa o painel em branco ou expoe o Actuator,
 * e isso so apareceria no cluster. Nao sobe contexto Spring: le o YAML direto.
 */
class ObservabilityConfigTests {

	private static Properties yaml;

	@BeforeAll
	static void loadYaml() {
		YamlPropertiesFactoryBean factory = new YamlPropertiesFactoryBean();
		factory.setResources(new ClassPathResource("application.yml"));
		yaml = factory.getObject();
	}

	@Test
	void actuatorRunsOnItsOwnPortSoTheIngressNeverRoutesIt() {
		assertThat(yaml.getProperty("management.server.port")).isEqualTo("8081");
	}

	@Test
	void prometheusEndpointIsExposed() {
		assertThat(yaml.getProperty("management.endpoints.web.exposure.include"))
				.contains("prometheus")
				.contains("health");
	}

	@Test
	void doesNotExposeSensitiveActuatorEndpoints() {
		assertThat(yaml.getProperty("management.endpoints.web.exposure.include"))
				.doesNotContain("env", "heapdump", "threaddump", "beans", "*");
	}

	@Test
	void publishesLatencyHistogramBucketsForHttpServerRequests() {
		assertThat(yaml.getProperty("management.metrics.distribution.percentiles-histogram.http.server.requests"))
				.isEqualTo("true");
	}

}
