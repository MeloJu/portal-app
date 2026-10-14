package dev.l2.api;

import dev.l2.api.link.Link;
import dev.l2.api.security.SecurityEvent;
import dev.l2.api.security.SecurityEventKind;
import dev.l2.api.travel.Travel;
import dev.l2.api.user.User;
import jakarta.persistence.EntityManager;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * O contexto sobe com ddl-auto=validate, logo este teste falha se a V1__init.sql e as
 * entidades divergirem. Alem disso cobre as constraints que carregam decisao de seguranca.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Transactional
class DomainMappingTests {

	@Autowired
	private EntityManager entityManager;

	private User persistedUser(String email) {
		User user = new User(email, "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN", "Ana");
		entityManager.persist(user);
		return user;
	}

	@Test
	void persistsTheWholeGraph() {
		User owner = persistedUser("ana@example.com");
		Link link = new Link(owner, "nebulosa", "https://example.com/campanha", "Campanha Nebulosa");
		entityManager.persist(link);
		Travel travel = new Travel(link, "https://x.com/post", "Mozilla/5.0", "BR");
		entityManager.persist(travel);
		SecurityEvent event = SecurityEvent.of(SecurityEventKind.RATE_LIMIT, owner, link, "6 req/s");
		entityManager.persist(event);
		entityManager.flush();

		assertThat(owner.getId()).isNotNull();
		assertThat(link.getId()).isNotNull();
		assertThat(link.getCreatedAt()).isNotNull();
		assertThat(link.isActive()).isTrue();
		assertThat(travel.getOccurredAt()).isNotNull();
		assertThat(event.getKind()).isEqualTo(SecurityEventKind.RATE_LIMIT);
	}

	@Test
	void rejectsTargetUrlOutsideHttpAndHttps() {
		User owner = persistedUser("bruno@example.com");
		entityManager.persist(new Link(owner, "xss-try", "javascript:alert(document.cookie)", null));

		assertThatThrownBy(entityManager::flush)
				.isInstanceOf(ConstraintViolationException.class)
				.extracting(violation -> ((ConstraintViolationException) violation).getConstraintName())
				.isEqualTo("links_target_url_scheme");
	}

	@Test
	void rejectsDuplicatedCode() {
		User owner = persistedUser("carla@example.com");
		entityManager.persist(new Link(owner, "orbit-live", "https://example.com/a", null));
		entityManager.persist(new Link(owner, "orbit-live", "https://example.com/b", null));

		assertThatThrownBy(entityManager::flush)
				.isInstanceOf(ConstraintViolationException.class)
				.extracting(violation -> ((ConstraintViolationException) violation).getConstraintName())
				.isEqualTo("links_code_unique");
	}

	@Test
	void rejectsUppercaseEmail() {
		persistedUser("Dora@Example.com");

		assertThatThrownBy(entityManager::flush)
				.isInstanceOf(ConstraintViolationException.class)
				.extracting(violation -> ((ConstraintViolationException) violation).getConstraintName())
				.isEqualTo("users_email_lowercase");
	}

}
