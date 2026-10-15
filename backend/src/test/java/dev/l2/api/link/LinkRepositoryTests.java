package dev.l2.api.link;

import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.user.User;
import dev.l2.api.user.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Transactional
class LinkRepositoryTests {

	@Autowired
	private LinkRepository links;

	@Autowired
	private UserRepository users;

	@Autowired
	private EntityManager entityManager;

	private final Instant now = Instant.parse("2026-10-15T12:00:00Z");

	private final Pageable firstPage = PageRequest.of(0, 20);

	private String tag;

	private User ana;

	private User bruno;

	@BeforeEach
	void populate() {
		this.tag = "t" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
		this.ana = this.users.save(new User(this.tag + "-ana@example.com", hash(), "Ana"));
		this.bruno = this.users.save(new User(this.tag + "-bruno@example.com", hash(), "Bruno"));

		link(this.ana, code("ativo"));
		Link paused = link(this.ana, code("pausado"));
		paused.setPaused(true);
		link(this.ana, code("fechado")).close(this.now.minus(1, ChronoUnit.HOURS));
		link(this.ana, code("expirado")).setExpiresAt(this.now.minus(1, ChronoUnit.MINUTES));
		exhaust(link(this.ana, code("exaurido")));

		link(this.bruno, code("do-bruno"));
		this.entityManager.flush();
	}

	private String code(String suffix) {
		return this.tag + "-" + suffix;
	}

	private static String hash() {
		return "$2a$10$" + "x".repeat(53);
	}

	private Link link(User owner, String code) {
		return this.links.save(new Link(owner, code, "https://example.com/" + code, null));
	}

	private void exhaust(Link link) {
		link.setMaxTravels(1);
		this.entityManager.flush();
		this.entityManager.createNativeQuery("update links set travel_count = 1 where id = :id")
				.setParameter("id", link.getId())
				.executeUpdate();
		this.entityManager.refresh(link);
	}

	private static List<String> codesOf(Page<Link> page) {
		return page.getContent().stream().map(Link::getCode).toList();
	}

	@Test
	void listsOnlyTheActiveOnes() {
		assertThat(codesOf(this.links.findActiveByOwnerId(this.ana.getId(), this.now, this.firstPage)))
				.containsExactly(code("ativo"));
	}

	@Test
	void listsOnlyThePausedOnes() {
		assertThat(codesOf(this.links.findPausedByOwnerId(this.ana.getId(), this.now, this.firstPage)))
				.containsExactly(code("pausado"));
	}

	@Test
	void treatsClosedExpiredAndExhaustedAsClosed() {
		assertThat(codesOf(this.links.findClosedByOwnerId(this.ana.getId(), this.now, this.firstPage)))
				.containsExactlyInAnyOrder(code("fechado"), code("expirado"), code("exaurido"));
	}

	@Test
	void putsEveryLinkInExactlyOneState() {
		int active = this.links.findActiveByOwnerId(this.ana.getId(), this.now, this.firstPage).getContent().size();
		int paused = this.links.findPausedByOwnerId(this.ana.getId(), this.now, this.firstPage).getContent().size();
		int closed = this.links.findClosedByOwnerId(this.ana.getId(), this.now, this.firstPage).getContent().size();

		assertThat(active + paused + closed)
				.isEqualTo((int) this.links.findByOwnerId(this.ana.getId(), this.firstPage).getTotalElements());
	}

	@Test
	void pausedLinkThatAlsoExpiredCountsAsClosedOnly() {
		Link link = this.links.findByCode(code("pausado")).orElseThrow();
		link.setExpiresAt(this.now.minus(1, ChronoUnit.MINUTES));
		this.entityManager.flush();

		assertThat(codesOf(this.links.findPausedByOwnerId(this.ana.getId(), this.now, this.firstPage))).isEmpty();
		assertThat(codesOf(this.links.findClosedByOwnerId(this.ana.getId(), this.now, this.firstPage)))
				.contains(code("pausado"));
	}

	@Test
	void expiresExactlyAtTheDeadline() {
		Link link = this.links.findByCode(code("ativo")).orElseThrow();
		link.setExpiresAt(this.now);
		this.entityManager.flush();

		assertThat(codesOf(this.links.findActiveByOwnerId(this.ana.getId(), this.now, this.firstPage))).isEmpty();
		assertThat(link.state(this.now)).isEqualTo(LinkState.CLOSED);
	}

	@Test
	void neverCrossesOwners() {
		assertThat(codesOf(this.links.findByOwnerId(this.ana.getId(), this.firstPage)))
				.doesNotContain(code("do-bruno"));
		assertThat(codesOf(this.links.findActiveByOwnerId(this.bruno.getId(), this.now, this.firstPage)))
				.containsExactly(code("do-bruno"));
	}

	@Test
	void findsByCodeOnlyForTheOwner() {
		assertThat(this.links.findByCodeAndOwnerId(code("ativo"), this.ana.getId())).isPresent();
		assertThat(this.links.findByCodeAndOwnerId(code("ativo"), this.bruno.getId())).isEmpty();
	}

	@Test
	void paginatesKeepingTheTotal() {
		Page<Link> page = this.links.findByOwnerId(this.ana.getId(), PageRequest.of(0, 2));

		assertThat(page.getContent()).hasSize(2);
		assertThat(page.getTotalElements()).isEqualTo(5);
	}

}
