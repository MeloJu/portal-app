package dev.l2.api.travel;

import dev.l2.api.link.Link;
import dev.l2.api.link.LinkNotFoundException;
import dev.l2.api.link.LinkRepository;
import dev.l2.api.link.LinkState;
import dev.l2.api.metrics.L2Metrics;
import dev.l2.api.security.BlockedEventReason;
import dev.l2.api.security.ProtectionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;

@Service
public class TravelService {

	private static final int MAX_REFERRER = 2048;

	private static final int MAX_USER_AGENT = 512;

	private final LinkRepository links;

	private final TravelRepository travels;

	private final BotDetector bots;

	private final ProtectionService protection;

	private final L2Metrics metrics;

	private final Clock clock;

	@Autowired
	public TravelService(LinkRepository links, TravelRepository travels, BotDetector bots,
			ProtectionService protection, L2Metrics metrics) {
		this(links, travels, bots, protection, metrics, Clock.systemUTC());
	}

	TravelService(LinkRepository links, TravelRepository travels, BotDetector bots, ProtectionService protection,
			L2Metrics metrics, Clock clock) {
		this.links = links;
		this.travels = travels;
		this.bots = bots;
		this.protection = protection;
		this.metrics = metrics;
		this.clock = clock;
	}

	@Transactional
	public TravelResponse travel(String code, String userAgent, String referrer) {
		Instant now = this.clock.instant();
		if (this.links.registerTravel(code, now) == 0) {
			throw refuse(code, now);
		}

		Link link = this.links.findByCode(code).orElseThrow(LinkNotFoundException::new);
		boolean bot = this.bots.isBot(userAgent);
		this.travels.save(new Travel(link, truncate(referrer, MAX_REFERRER), truncate(userAgent, MAX_USER_AGENT),
				null, bot));
		this.metrics.travel(bot);

		return new TravelResponse(link.getTargetUrl(), link.getTitle(), link.getTravelCount());
	}

	private RuntimeException refuse(String code, Instant now) {
		Link link = this.links.findByCode(code).orElse(null);
		if (link == null) {
			return new LinkNotFoundException();
		}
		LinkState state = link.state(now);
		BlockedEventReason reason = (state == LinkState.PAUSED)
				? BlockedEventReason.PAUSED
				: BlockedEventReason.CLOSED;
		this.protection.block(reason, code, link.getOwner().getId());
		return new LinkNotTravelableException(state);
	}

	private static String truncate(String value, int max) {
		if (value == null) {
			return null;
		}
		String stripped = value.strip();
		if (stripped.isEmpty()) {
			return null;
		}
		return (stripped.length() <= max) ? stripped : stripped.substring(0, max);
	}

}
