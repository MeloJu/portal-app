package dev.l2.api.ratelimit;

import dev.l2.api.config.AppProperties;
import dev.l2.api.config.AppProperties.RateLimit;
import dev.l2.api.config.AppProperties.RateLimit.Rule;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimiterTests {

	private static final Rule TWO_PER_MINUTE = new Rule(2, Duration.ofMinutes(1));

	private final MutableClock clock = new MutableClock(Instant.parse("2026-10-16T12:00:00Z"));

	private final RateLimiter limiter = new RateLimiter(properties(), this.clock);

	@Test
	void letsTheConfiguredCapacityThrough() {
		assertThat(this.limiter.check("TRAVEL", "10.0.0.1", TWO_PER_MINUTE).allowed()).isTrue();
		assertThat(this.limiter.check("TRAVEL", "10.0.0.1", TWO_PER_MINUTE).allowed()).isTrue();
		assertThat(this.limiter.check("TRAVEL", "10.0.0.1", TWO_PER_MINUTE).allowed()).isFalse();
	}

	@Test
	void keepsOneBucketPerClient() {
		this.limiter.check("TRAVEL", "10.0.0.1", TWO_PER_MINUTE);
		this.limiter.check("TRAVEL", "10.0.0.1", TWO_PER_MINUTE);

		assertThat(this.limiter.check("TRAVEL", "10.0.0.2", TWO_PER_MINUTE).allowed()).isTrue();
	}

	@Test
	void keepsOneBucketPerScope() {
		this.limiter.check("LOGIN", "10.0.0.1", TWO_PER_MINUTE);
		this.limiter.check("LOGIN", "10.0.0.1", TWO_PER_MINUTE);

		assertThat(this.limiter.check("TRAVEL", "10.0.0.1", TWO_PER_MINUTE).allowed()).isTrue();
	}

	@Test
	void answersHowLongUntilTheNextToken() {
		this.limiter.check("TRAVEL", "10.0.0.1", TWO_PER_MINUTE);
		this.limiter.check("TRAVEL", "10.0.0.1", TWO_PER_MINUTE);

		Duration retryAfter = this.limiter.check("TRAVEL", "10.0.0.1", TWO_PER_MINUTE).retryAfter();

		assertThat(retryAfter).isPositive().isLessThanOrEqualTo(Duration.ofMinutes(1));
	}

	@Test
	void reportsTheThreatOncePerWindow() {
		this.limiter.check("TRAVEL", "10.0.0.1", TWO_PER_MINUTE);
		this.limiter.check("TRAVEL", "10.0.0.1", TWO_PER_MINUTE);

		assertThat(this.limiter.check("TRAVEL", "10.0.0.1", TWO_PER_MINUTE).worthReporting()).isTrue();
		assertThat(this.limiter.check("TRAVEL", "10.0.0.1", TWO_PER_MINUTE).worthReporting()).isFalse();

		this.clock.advance(Duration.ofMinutes(1).plusSeconds(1));

		assertThat(this.limiter.check("TRAVEL", "10.0.0.1", TWO_PER_MINUTE).worthReporting()).isTrue();
	}

	@Test
	void neverReportsWhatItLetThrough() {
		assertThat(this.limiter.check("TRAVEL", "10.0.0.1", TWO_PER_MINUTE).worthReporting()).isFalse();
	}

	private static AppProperties properties() {
		RateLimit limits = new RateLimit(true, TWO_PER_MINUTE, TWO_PER_MINUTE, TWO_PER_MINUTE, TWO_PER_MINUTE);
		return new AppProperties("https://l2.to", null, null, null, limits, null);
	}

	private static final class MutableClock extends Clock {

		private Instant instant;

		private MutableClock(Instant instant) {
			this.instant = instant;
		}

		private void advance(Duration amount) {
			this.instant = this.instant.plus(amount);
		}

		@Override
		public Instant instant() {
			return this.instant;
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return this;
		}

	}

}
