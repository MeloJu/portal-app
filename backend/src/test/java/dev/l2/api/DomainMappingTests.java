package dev.l2.api;

import dev.l2.api.link.Link;
import dev.l2.api.link.LinkState;
import dev.l2.api.security.BlockedEvent;
import dev.l2.api.security.BlockedEventReason;
import dev.l2.api.travel.Travel;
import dev.l2.api.user.User;
import jakarta.persistence.EntityManager;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Transactional
class DomainMappingTests {

	@Autowired
	private EntityManager entityManager;

	private User persistedUser(String email) {
		User user = new User(email, "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN", "Ana");
		this.entityManager.persist(user);
		return user;
	}

	@Test
	void persistsTheWholeGraph() {
		User owner = persistedUser("ana@example.com");
		Link link = new Link(owner, "nebulosa", "https://example.com/campanha", "Campanha Nebulosa");
		this.entityManager.persist(link);
		Travel travel = new Travel(link, "https://x.com/post", "Mozilla/5.0", "BR", false);
		this.entityManager.persist(travel);
		BlockedEvent event = BlockedEvent.of(BlockedEventReason.RATE_LIMIT, owner, link, "6 req/s");
		this.entityManager.persist(event);
		this.entityManager.flush();

		assertThat(owner.getId()).isNotNull();
		assertThat(link.getId()).isNotNull();
		assertThat(link.getCreatedAt()).isNotNull();
		assertThat(link.isPaused()).isFalse();
		assertThat(link.getTravelCount()).isZero();
		assertThat(travel.isBot()).isFalse();
		assertThat(event.getReason()).isEqualTo(BlockedEventReason.RATE_LIMIT);
	}

	@Test
	void rejectsTargetUrlOutsideHttpAndHttps() {
		User owner = persistedUser("bruno@example.com");
		this.entityManager.persist(new Link(owner, "xss-try", "javascript:alert(document.cookie)", null));

		assertThatThrownBy(this.entityManager::flush)
				.isInstanceOf(ConstraintViolationException.class)
				.extracting(violation -> ((ConstraintViolationException) violation).getConstraintName())
				.isEqualTo("links_target_url_scheme");
	}

	@Test
	void rejectsDuplicatedCode() {
		User owner = persistedUser("carla@example.com");
		this.entityManager.persist(new Link(owner, "orbit-live", "https://example.com/a", null));
		this.entityManager.persist(new Link(owner, "orbit-live", "https://example.com/b", null));

		assertThatThrownBy(this.entityManager::flush)
				.isInstanceOf(ConstraintViolationException.class)
				.extracting(violation -> ((ConstraintViolationException) violation).getConstraintName())
				.isEqualTo("links_code_unique");
	}

	@Test
	void rejectsUppercaseEmail() {
		persistedUser("Dora@Example.com");

		assertThatThrownBy(this.entityManager::flush)
				.isInstanceOf(ConstraintViolationException.class)
				.extracting(violation -> ((ConstraintViolationException) violation).getConstraintName())
				.isEqualTo("users_email_lowercase");
	}

	@Test
	void rejectsAliasWithUnderscore() {
		User owner = persistedUser("elisa@example.com");
		this.entityManager.persist(new Link(owner, "nao_permitido", "https://example.com/a", null));

		assertThatThrownBy(this.entityManager::flush)
				.isInstanceOf(ConstraintViolationException.class)
				.extracting(violation -> ((ConstraintViolationException) violation).getConstraintName())
				.isEqualTo("links_code_format");
	}

	@Test
	void isClosedWhenMaxTravelsIsReached() {
		User owner = persistedUser("gabi@example.com");
		Link link = new Link(owner, "limite-um", "https://example.com/a", null);
		link.setMaxTravels(1);
		this.entityManager.persist(link);
		this.entityManager.flush();

		this.entityManager.createNativeQuery("update links set travel_count = 1 where id = :id")
				.setParameter("id", link.getId())
				.executeUpdate();
		this.entityManager.refresh(link);

		assertThat(link.getTravelCount()).isEqualTo(1);
		assertThat(link.isExhausted()).isTrue();
		assertThat(link.state(Instant.now())).isEqualTo(LinkState.CLOSED);
	}

	@Test
	void rejectsMaxTravelsBelowOne() {
		User owner = persistedUser("fabio@example.com");
		Link link = new Link(owner, "limite-zero", "https://example.com/a", null);
		link.setMaxTravels(0);
		this.entityManager.persist(link);

		assertThatThrownBy(this.entityManager::flush)
				.isInstanceOf(ConstraintViolationException.class)
				.extracting(violation -> ((ConstraintViolationException) violation).getConstraintName())
				.isEqualTo("links_max_travels_positive");
	}

}
