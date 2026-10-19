package dev.l2.api.link;

import dev.l2.api.link.LinkDtos.CreateLinkRequest;
import dev.l2.api.metrics.L2Metrics;
import dev.l2.api.security.ProtectionService;
import dev.l2.api.user.User;
import dev.l2.api.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

@Service
public class LinkService {

	private final LinkRepository links;

	private final UserRepository users;

	private final UrlValidator urls;

	private final CodeGenerator codes;

	private final ProtectionService protection;

	private final L2Metrics metrics;

	private final Clock clock;

	@Autowired
	public LinkService(LinkRepository links, UserRepository users, UrlValidator urls, CodeGenerator codes,
			ProtectionService protection, L2Metrics metrics) {
		this(links, users, urls, codes, protection, metrics, Clock.systemUTC());
	}

	LinkService(LinkRepository links, UserRepository users, UrlValidator urls, CodeGenerator codes,
			ProtectionService protection, L2Metrics metrics, Clock clock) {
		this.links = links;
		this.users = users;
		this.urls = urls;
		this.codes = codes;
		this.protection = protection;
		this.metrics = metrics;
		this.clock = clock;
	}

	@Transactional
	public Link create(UUID ownerId, CreateLinkRequest request) {
		User owner = this.users.requireVerified(ownerId);
		String code = resolveCode(ownerId, request.alias());
		String targetUrl = normalize(ownerId, request.alias(), request.targetUrl());

		Link link = new Link(owner, code, targetUrl, blankToNull(request.title()));
		link.setExpiresAt(request.expiresAt());
		link.setMaxTravels(request.maxTravels());

		Link saved = this.links.save(link);
		this.metrics.linkCreated();
		return saved;
	}

	@Transactional(readOnly = true)
	public Link require(UUID ownerId, String code) {
		return this.links.findByCodeAndOwnerId(code, ownerId).orElseThrow(LinkNotFoundException::new);
	}

	@Transactional(readOnly = true)
	public Page<Link> list(UUID ownerId, LinkState state, Pageable pageable) {
		if (state == null) {
			return this.links.findByOwnerId(ownerId, pageable);
		}
		Instant now = this.clock.instant();
		return switch (state) {
			case ACTIVE -> this.links.findActiveByOwnerId(ownerId, now, pageable);
			case PAUSED -> this.links.findPausedByOwnerId(ownerId, now, pageable);
			case CLOSED -> this.links.findClosedByOwnerId(ownerId, now, pageable);
		};
	}

	@Transactional
	public Link update(UUID ownerId, String code, UpdateLinkRequest request) {
		Link link = this.links.findByCodeAndOwnerId(code, ownerId).orElseThrow(LinkNotFoundException::new);

		if (request.hasTargetUrl()) {
			link.setTargetUrl(normalize(ownerId, code, request.getTargetUrl()));
		}
		if (request.hasTitle()) {
			link.setTitle(blankToNull(request.getTitle()));
		}
		if (request.hasPaused()) {
			link.setPaused(request.getPaused());
		}
		if (request.hasExpiresAt()) {
			link.setExpiresAt(request.getExpiresAt());
		}
		if (request.hasMaxTravels()) {
			link.setMaxTravels(request.getMaxTravels());
		}
		return link;
	}

	@Transactional
	public void close(UUID ownerId, String code) {
		Link link = this.links.findByCodeAndOwnerId(code, ownerId).orElseThrow(LinkNotFoundException::new);
		if (link.getClosedAt() == null) {
			link.close(this.clock.instant());
		}
	}

	public Instant now() {
		return this.clock.instant();
	}

	private String resolveCode(UUID ownerId, String alias) {
		if (alias == null || alias.isBlank()) {
			return this.codes.generate(this.links::existsByCode);
		}
		String candidate = alias.strip();
		try {
			ReservedAliases.requireAllowed(candidate);
		}
		catch (InvalidLinkException refused) {
			this.protection.block(refused.getReason(), candidate, ownerId);
			throw refused;
		}
		if (this.links.existsByCode(candidate)) {
			throw new AliasAlreadyUsedException();
		}
		return candidate;
	}

	private String normalize(UUID ownerId, String code, String rawTargetUrl) {
		try {
			return this.urls.normalize(rawTargetUrl);
		}
		catch (InvalidLinkException refused) {
			this.protection.block(refused.getReason(), code, ownerId);
			throw refused;
		}
	}

	private static String blankToNull(String value) {
		if (value == null) {
			return null;
		}
		String stripped = value.strip();
		return stripped.isEmpty() ? null : stripped;
	}

}
