package dev.l2.api.ratelimit;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import dev.l2.api.config.AppProperties;
import dev.l2.api.config.AppProperties.RateLimit.Rule;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

@Component
public class RateLimiter {

	static final int MAX_CLIENTS = 100_000;

	private final Cache<String, Bucket> buckets;

	private final Cache<String, Instant> reported;

	private final Clock clock;

	@Autowired
	public RateLimiter(AppProperties properties) {
		this(properties, Clock.systemUTC());
	}

	RateLimiter(AppProperties properties, Clock clock) {
		Duration retention = properties.rateLimit().longestWindow().multipliedBy(2);
		this.buckets = cache(retention);
		this.reported = cache(retention);
		this.clock = clock;
	}

	public Decision check(String scope, String client, Rule rule) {
		String key = scope + "|" + client;
		Bucket bucket = this.buckets.get(key, any -> bucket(rule));
		ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
		if (probe.isConsumed()) {
			return Decision.pass();
		}
		return new Decision(false, Duration.ofNanos(probe.getNanosToWaitForRefill()), firstOfWindow(key, rule));
	}

	private boolean firstOfWindow(String key, Rule rule) {
		Instant now = this.clock.instant();
		Instant silentUntil = this.reported.getIfPresent(key);
		if (silentUntil != null && silentUntil.isAfter(now)) {
			return false;
		}
		this.reported.put(key, now.plus(rule.window()));
		return true;
	}

	private static Bucket bucket(Rule rule) {
		return Bucket.builder()
				.addLimit(Bandwidth.builder()
						.capacity(rule.capacity())
						.refillGreedy(rule.capacity(), rule.window())
						.build())
				.build();
	}

	private static <V> Cache<String, V> cache(Duration retention) {
		return Caffeine.newBuilder()
				.maximumSize(MAX_CLIENTS)
				.expireAfterAccess(retention)
				.build();
	}

	public record Decision(boolean allowed, Duration retryAfter, boolean worthReporting) {

		static Decision pass() {
			return new Decision(true, Duration.ZERO, false);
		}

	}

}
