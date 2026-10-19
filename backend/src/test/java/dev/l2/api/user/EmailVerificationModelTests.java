package dev.l2.api.user;

import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.account.AccountCode;
import dev.l2.api.account.AccountCodePurpose;
import dev.l2.api.account.AccountCodeRepository;
import dev.l2.api.auth.verification.EmailVerificationToken;
import dev.l2.api.auth.verification.EmailVerificationTokenRepository;
import jakarta.persistence.EntityManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class EmailVerificationModelTests {

	private static final String HASH = "a".repeat(64);

	@Autowired
	private UserRepository users;

	@Autowired
	private EmailVerificationTokenRepository tokens;

	@Autowired
	private AccountCodeRepository codes;

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private DataSource dataSource;

	private static String uniqueEmail() {
		return "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 12) + "@example.com";
	}

	@Test
	@Transactional
	void newUserIsUnverifiedUntilMarked() {
		User user = this.users.saveAndFlush(new User(uniqueEmail(), "$2a$10$" + "x".repeat(53), "Ana"));
		this.entityManager.refresh(user);

		assertThat(user.isEmailVerified()).isFalse();

		user.markEmailVerified(Instant.parse("2026-10-15T12:00:00Z"));
		this.users.saveAndFlush(user);
		this.entityManager.clear();

		assertThat(this.users.findById(user.getId()).orElseThrow().isEmailVerified()).isTrue();
	}

	@Test
	@Transactional
	void persistsAndFindsVerificationTokenByHash() {
		User user = this.users.saveAndFlush(new User(uniqueEmail(), "$2a$10$" + "x".repeat(53), "Bia"));
		String hash = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
		this.tokens.saveAndFlush(new EmailVerificationToken(user, hash, Instant.parse("2026-10-16T12:00:00Z")));
		this.entityManager.clear();

		EmailVerificationToken found = this.tokens.findByTokenHash(hash).orElseThrow();

		assertThat(found.getUser().getId()).isEqualTo(user.getId());
		assertThat(found.getUsedAt()).isNull();
	}

	@Test
	@Transactional
	void findsTheLatestAccountCodeForTheUserAndPurpose() {
		User user = this.users.saveAndFlush(new User(uniqueEmail(), "$2a$10$" + "x".repeat(53), "Caio"));
		this.codes.saveAndFlush(new AccountCode(user, AccountCodePurpose.EMAIL_CHANGE, HASH, "novo@example.com",
				Instant.parse("2026-10-16T12:00:00Z")));
		this.entityManager.clear();

		AccountCode found = this.codes
				.findFirstByUserIdAndPurposeOrderByCreatedAtDesc(user.getId(), AccountCodePurpose.EMAIL_CHANGE)
				.orElseThrow();

		assertThat(found.getNewEmail()).isEqualTo("novo@example.com");
		assertThat(found.getAttempts()).isZero();
		assertThat(this.codes.findFirstByUserIdAndPurposeOrderByCreatedAtDesc(user.getId(),
				AccountCodePurpose.PASSWORD_CHANGE)).isEmpty();
	}

	@Test
	void v3MarksExistingUsersAsVerifiedAndLeavesNewOnesUnverified() {
		Flyway flyway = Flyway.configure()
				.dataSource(this.dataSource)
				.schemas("migration_v3_check")
				.cleanDisabled(false)
				.target("2")
				.load();
		try {
			flyway.migrate();
			JdbcTemplate jdbc = new JdbcTemplate(this.dataSource);
			jdbc.update("insert into migration_v3_check.users (email, password_hash, name) values (?, ?, ?)",
					"antigo@example.com", "$2a$10$" + "x".repeat(53), "Antigo");

			Flyway.configure()
					.dataSource(this.dataSource)
					.schemas("migration_v3_check")
					.target("latest")
					.load()
					.migrate();

			Integer verified = jdbc.queryForObject(
					"select count(*) from migration_v3_check.users where email = 'antigo@example.com' "
							+ "and email_verified_at = created_at",
					Integer.class);
			jdbc.update("insert into migration_v3_check.users (email, password_hash, name) values (?, ?, ?)",
					"novo@example.com", "$2a$10$" + "x".repeat(53), "Novo");
			Integer unverified = jdbc.queryForObject(
					"select count(*) from migration_v3_check.users where email = 'novo@example.com' "
							+ "and email_verified_at is null",
					Integer.class);

			assertThat(verified).isEqualTo(1);
			assertThat(unverified).isEqualTo(1);
		}
		finally {
			Flyway.configure().dataSource(this.dataSource).schemas("migration_v3_check").cleanDisabled(false).load()
					.clean();
		}
	}

}
