package dev.l2.api.link;

import dev.l2.api.link.LinkDtos.LinkResponse;
import dev.l2.api.user.User;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

class LinkResponseTests {

	private final Instant now = Instant.parse("2026-10-15T12:00:00Z");

	private Link link() {
		return new Link(new User("ana@example.com", "$2a$10$x", "Ana"), "aB3x9Q", "https://example.com/campanha",
				"Campanha Nebulosa");
	}

	@Test
	void buildsTheShortUrlFromThePublicBase() {
		LinkResponse response = LinkResponse.of(link(), "https://l2.to", this.now);

		assertThat(response.shortUrl()).isEqualTo("https://l2.to/aB3x9Q");
		assertThat(response.code()).isEqualTo("aB3x9Q");
	}

	@Test
	void doesNotDoubleTheSlashWhenTheBaseEndsWithOne() {
		assertThat(LinkResponse.of(link(), "https://l2.to/", this.now).shortUrl())
				.isEqualTo("https://l2.to/aB3x9Q");
	}

	@Test
	void reportsTheDerivedState() {
		Link paused = link();
		paused.setPaused(true);

		assertThat(LinkResponse.of(link(), "https://l2.to", this.now).state()).isEqualTo(LinkState.ACTIVE);
		assertThat(LinkResponse.of(paused, "https://l2.to", this.now).state()).isEqualTo(LinkState.PAUSED);
	}

	@Test
	void reportsClosedWhenTheDeadlinePassed() {
		Link expired = link();
		expired.setExpiresAt(this.now.minus(1, ChronoUnit.SECONDS));

		assertThat(LinkResponse.of(expired, "https://l2.to", this.now).state()).isEqualTo(LinkState.CLOSED);
	}

	@Test
	void neverExposesTheOwner() {
		assertThat(LinkResponse.class.getRecordComponents())
				.extracting(java.lang.reflect.RecordComponent::getName)
				.containsExactly("code", "shortUrl", "targetUrl", "title", "state", "travelCount", "expiresAt",
						"maxTravels", "createdAt");
	}

}
