package dev.l2.api.security;

import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.link.Link;
import dev.l2.api.link.LinkRepository;
import dev.l2.api.metrics.L2Metrics;
import dev.l2.api.user.User;
import dev.l2.api.user.UserRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Import({ TestcontainersConfiguration.class, ProtectionServiceTests.FailingCallerConfiguration.class })
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class ProtectionServiceTests {

	@TestConfiguration(proxyBeanMethods = false)
	static class FailingCallerConfiguration {

		@Bean
		FailingCaller failingCaller(ProtectionService protection) {
			return new FailingCaller(protection);
		}

	}

	public static class FailingCaller {

		private final ProtectionService protection;

		FailingCaller(ProtectionService protection) {
			this.protection = protection;
		}

		@Transactional
		public void blockAndThenFail(BlockedEventReason reason, String code, UUID ownerId) {
			this.protection.block(reason, code, ownerId);
			throw new IllegalStateException("destino recusado");
		}

	}

	@Autowired
	private ProtectionService protection;

	@Autowired
	private BlockedEventRepository events;

	@Autowired
	private LinkRepository links;

	@Autowired
	private UserRepository users;

	@Autowired
	private FailingCaller failingCaller;

	@Autowired
	private MeterRegistry registry;

	private User owner;

	@BeforeEach
	void resetState() {
		this.events.deleteAll();
		this.owner = this.users.save(new User(unique() + "@example.com", "$2a$10$" + "x".repeat(53), "Ana"));
	}

	private static String unique() {
		return "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
	}

	private Link persistedLink() {
		return this.links.save(new Link(this.owner, unique(), "https://example.com/campanha", "Campanha"));
	}

	private double blockedCount(BlockedEventReason reason) {
		Counter counter = this.registry.find(L2Metrics.THREATS_BLOCKED).tag("reason", reason.name()).counter();
		return (counter == null) ? 0 : counter.count();
	}

	@Test
	void recordsTheEventWithOwnerAndLink() {
		Link link = persistedLink();

		this.protection.block(BlockedEventReason.PAUSED, link.getCode(), this.owner.getId());

		List<BlockedEvent> all = this.events.findAll();
		assertThat(all).hasSize(1);
		assertThat(all.getFirst().getReason()).isEqualTo(BlockedEventReason.PAUSED);
		assertThat(all.getFirst().getLink().getId()).isEqualTo(link.getId());
		assertThat(all.getFirst().getUser().getId()).isEqualTo(this.owner.getId());
		assertThat(all.getFirst().getDetail()).isEqualTo(link.getCode());
		assertThat(all.getFirst().getOccurredAt()).isNotNull();
	}

	@Test
	void recordsTheEventWithoutLinkWhenTheCodeNeverBecameOne() {
		this.protection.block(BlockedEventReason.RESERVED_ALIAS, "api", this.owner.getId());

		BlockedEvent event = this.events.findAll().getFirst();
		assertThat(event.getLink()).isNull();
		assertThat(event.getUser().getId()).isEqualTo(this.owner.getId());
		assertThat(event.getDetail()).isEqualTo("api");
	}

	@Test
	void acceptsAnEventWithoutCodeAndWithoutOwner() {
		this.protection.block(BlockedEventReason.RATE_LIMIT, null, null);

		BlockedEvent event = this.events.findAll().getFirst();
		assertThat(event.getLink()).isNull();
		assertThat(event.getUser()).isNull();
		assertThat(event.getDetail()).isNull();
	}

	@Test
	void countsTheThreatInPrometheus() {
		double before = blockedCount(BlockedEventReason.SELF_LOOP);

		this.protection.block(BlockedEventReason.SELF_LOOP, "loop-aqui", this.owner.getId());

		assertThat(blockedCount(BlockedEventReason.SELF_LOOP)).isEqualTo(before + 1);
	}

	@Test
	void survivesTheRollbackOfTheCallerThatRefusedTheRequest() {
		assertThatThrownBy(() -> this.failingCaller.blockAndThenFail(BlockedEventReason.INVALID_URL,
				"javascript-nope", this.owner.getId()))
				.isInstanceOf(IllegalStateException.class);

		assertThat(this.events.findAll())
				.singleElement()
				.satisfies(event -> assertThat(event.getReason()).isEqualTo(BlockedEventReason.INVALID_URL));
	}

}
