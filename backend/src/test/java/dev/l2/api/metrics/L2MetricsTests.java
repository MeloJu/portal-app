package dev.l2.api.metrics;

import dev.l2.api.security.BlockedEventReason;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class L2MetricsTests {

	private final SimpleMeterRegistry registry = new SimpleMeterRegistry();

	private final L2Metrics metrics = new L2Metrics(this.registry);

	private double value(String name, String tag, String tagValue) {
		Counter counter = this.registry.find(name).tag(tag, tagValue).counter();
		assertThat(counter).as("contador %s{%s=%s}", name, tag, tagValue).isNotNull();
		return counter.count();
	}

	@Test
	void registersEverySeriesAtZeroOnStartup() {
		assertThat(this.registry.find(L2Metrics.LINKS_CREATED).counter()).isNotNull();
		assertThat(this.registry.find(L2Metrics.TRAVELS).counters()).hasSize(2);
		assertThat(this.registry.find(L2Metrics.THREATS_BLOCKED).counters())
				.hasSize(BlockedEventReason.values().length);
		assertThat(this.registry.find(L2Metrics.TRAVELS).counters())
				.allSatisfy(counter -> assertThat(counter.count()).isZero());
	}

	@Test
	void countsLinksCreated() {
		this.metrics.linkCreated();
		this.metrics.linkCreated();

		assertThat(this.registry.find(L2Metrics.LINKS_CREATED).counter().count()).isEqualTo(2);
	}

	@Test
	void countsTravelsSeparatingBotFromHuman() {
		this.metrics.travel(false);
		this.metrics.travel(true);
		this.metrics.travel(true);

		assertThat(value(L2Metrics.TRAVELS, "bot", "false")).isEqualTo(1);
		assertThat(value(L2Metrics.TRAVELS, "bot", "true")).isEqualTo(2);
	}

	@Test
	void countsThreatsByReason() {
		this.metrics.threatBlocked(BlockedEventReason.PAUSED);
		this.metrics.threatBlocked(BlockedEventReason.SELF_LOOP);
		this.metrics.threatBlocked(BlockedEventReason.PAUSED);

		assertThat(value(L2Metrics.THREATS_BLOCKED, "reason", "PAUSED")).isEqualTo(2);
		assertThat(value(L2Metrics.THREATS_BLOCKED, "reason", "SELF_LOOP")).isEqualTo(1);
		assertThat(value(L2Metrics.THREATS_BLOCKED, "reason", "RATE_LIMIT")).isZero();
	}

}
