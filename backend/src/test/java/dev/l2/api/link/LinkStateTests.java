package dev.l2.api.link;

import dev.l2.api.user.User;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class LinkStateTests {

	private static final Instant NOW = Instant.parse("2026-10-14T12:00:00Z");

	private Link link() {
		User owner = new User("ana@example.com", "hash", "Ana");
		return new Link(owner, "nebulosa", "https://example.com", null);
	}

	@Test
	void isActiveByDefault() {
		assertThat(link().state(NOW)).isEqualTo(LinkState.ACTIVE);
	}

	@Test
	void isPausedWhenPaused() {
		Link link = link();
		link.setPaused(true);

		assertThat(link.state(NOW)).isEqualTo(LinkState.PAUSED);
	}

	@Test
	void isClosedWhenExpired() {
		Link link = link();
		link.setExpiresAt(NOW.minus(Duration.ofSeconds(1)));

		assertThat(link.state(NOW)).isEqualTo(LinkState.CLOSED);
	}

	@Test
	void isActiveWhenExpiryIsStillAhead() {
		Link link = link();
		link.setExpiresAt(NOW.plus(Duration.ofHours(1)));

		assertThat(link.state(NOW)).isEqualTo(LinkState.ACTIVE);
	}

	@Test
	void isClosedWhenExpiryIsExactlyNow() {
		Link link = link();
		link.setExpiresAt(NOW);

		assertThat(link.state(NOW)).isEqualTo(LinkState.CLOSED);
	}

	@Test
	void isClosedAfterBeingClosed() {
		Link link = link();
		link.close(NOW);

		assertThat(link.state(NOW)).isEqualTo(LinkState.CLOSED);
	}

	@Test
	void closedWinsOverPaused() {
		Link link = link();
		link.setPaused(true);
		link.close(NOW);

		assertThat(link.state(NOW)).isEqualTo(LinkState.CLOSED);
	}

}
