package dev.l2.api.metrics;

import dev.l2.api.security.BlockedEventReason;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.Map;

@Component
public class L2Metrics {

	public static final String LINKS_CREATED = "l2.links.created";

	public static final String TRAVELS = "l2.travels";

	public static final String THREATS_BLOCKED = "l2.threats.blocked";

	private final Counter linksCreated;

	private final Map<Boolean, Counter> travels;

	private final Map<BlockedEventReason, Counter> threatsBlocked;

	public L2Metrics(MeterRegistry registry) {
		this.linksCreated = Counter.builder(LINKS_CREATED)
				.description("Links criados")
				.register(registry);
		this.travels = Map.of(
				Boolean.FALSE, travelCounter(registry, false),
				Boolean.TRUE, travelCounter(registry, true));
		this.threatsBlocked = new EnumMap<>(BlockedEventReason.class);
		for (BlockedEventReason reason : BlockedEventReason.values()) {
			this.threatsBlocked.put(reason, Counter.builder(THREATS_BLOCKED)
					.description("Ameacas bloqueadas pela Lumi")
					.tag("reason", reason.name())
					.register(registry));
		}
	}

	public void linkCreated() {
		this.linksCreated.increment();
	}

	public void travel(boolean bot) {
		this.travels.get(bot).increment();
	}

	public void threatBlocked(BlockedEventReason reason) {
		this.threatsBlocked.get(reason).increment();
	}

	private static Counter travelCounter(MeterRegistry registry, boolean bot) {
		return Counter.builder(TRAVELS)
				.description("Viagens registradas")
				.tag("bot", Boolean.toString(bot))
				.register(registry);
	}

}
