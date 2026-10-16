package dev.l2.api.security;

import dev.l2.api.link.Link;
import dev.l2.api.link.LinkRepository;
import dev.l2.api.metrics.L2Metrics;
import dev.l2.api.user.User;
import dev.l2.api.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class ProtectionService {

	private final BlockedEventRepository events;

	private final LinkRepository links;

	private final UserRepository users;

	private final L2Metrics metrics;

	public ProtectionService(BlockedEventRepository events, LinkRepository links, UserRepository users,
			L2Metrics metrics) {
		this.events = events;
		this.links = links;
		this.users = users;
		this.metrics = metrics;
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public BlockedEvent block(BlockedEventReason reason, String code, UUID ownerId) {
		Link link = (code == null) ? null : this.links.findByCode(code).orElse(null);
		User owner = (ownerId != null) ? this.users.findById(ownerId).orElse(null) : ownerOf(link);

		BlockedEvent event = this.events.save(BlockedEvent.of(reason, owner, link, code));
		this.metrics.threatBlocked(reason);
		return event;
	}

	private static User ownerOf(Link link) {
		return (link != null) ? link.getOwner() : null;
	}

}
