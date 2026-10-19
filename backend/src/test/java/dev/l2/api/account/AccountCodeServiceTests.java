package dev.l2.api.account;

import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.config.AppProperties;
import dev.l2.api.user.User;
import dev.l2.api.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.Queue;
import java.util.UUID;
import java.util.random.RandomGenerator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Import({ TestcontainersConfiguration.class, AccountCodeServiceTests.Config.class })
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class AccountCodeServiceTests {

	private static final Instant START = Instant.parse("2026-10-19T12:00:00Z");

	@Autowired
	private AccountCodeService service;

	@Autowired
	private AccountCodeRepository codes;

	@Autowired
	private UserRepository users;

	@Autowired
	private CodeHasher hasher;

	@Autowired
	private MutableClock clock;

	@Autowired
	private ScriptedRandom random;

	private User user;

	@BeforeEach
	void setUp() {
		this.clock.set(START);
		this.random.reset();
		this.user = createUser();
	}

	private User createUser() {
		String email = "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 12) + "@example.com";
		return this.users.save(new User(email, "$2a$10$" + "x".repeat(53), "Ana"));
	}

	private AccountCode latest(User owner, AccountCodePurpose purpose) {
		return this.codes.findFirstByUserIdAndPurposeOrderByCreatedAtDesc(owner.getId(), purpose).orElseThrow();
	}

	@Test
	void codeAlwaysHasSixDigitsIncludingLeadingZeros() {
		this.random.script(0, 7, 12345, 999_999);

		assertThat(this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null)).isEqualTo("000000");
		this.clock.advance(Duration.ofMinutes(2));
		assertThat(this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null)).isEqualTo("000007");
		this.clock.advance(Duration.ofMinutes(2));
		assertThat(this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null)).isEqualTo("012345");
		this.clock.advance(Duration.ofMinutes(2));
		assertThat(this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null)).isEqualTo("999999");
	}

	@Test
	void storesOnlyTheHashAndNeverThePlainCode() {
		this.random.script(424_242);

		String code = this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null);

		AccountCode stored = latest(this.user, AccountCodePurpose.PASSWORD_CHANGE);
		assertThat(code).isEqualTo("424242");
		assertThat(stored.getCodeHash()).isNotEqualTo(code).hasSize(64);
		assertThat(stored.getCodeHash())
				.isEqualTo(this.hasher.hash(this.user.getId(), AccountCodePurpose.PASSWORD_CHANGE, code));
		assertThat(stored.getAttempts()).isZero();
		assertThat(stored.getExpiresAt()).isEqualTo(START.plus(Duration.ofMinutes(10)));
	}

	@Test
	void sameCodeHashesDifferentlyPerUserAndPurpose() {
		User other = createUser();
		this.random.script(111_111, 111_111, 111_111);

		this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null);
		this.service.issue(this.user, AccountCodePurpose.EMAIL_CHANGE, "novo@example.com");
		this.service.issue(other, AccountCodePurpose.PASSWORD_CHANGE, null);

		String first = latest(this.user, AccountCodePurpose.PASSWORD_CHANGE).getCodeHash();
		String otherPurpose = latest(this.user, AccountCodePurpose.EMAIL_CHANGE).getCodeHash();
		String otherUser = latest(other, AccountCodePurpose.PASSWORD_CHANGE).getCodeHash();
		assertThat(first).isNotEqualTo(otherPurpose).isNotEqualTo(otherUser);
		assertThat(otherPurpose).isNotEqualTo(otherUser);
	}

	@Test
	void acceptsCodeUpToNineMinutesAndRejectsAfterEleven() {
		this.random.script(100_001, 100_002);
		String early = this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null);
		this.clock.advance(Duration.ofMinutes(9));

		AccountCode consumed = this.service.consume(this.user, AccountCodePurpose.PASSWORD_CHANGE, early, null);
		assertThat(consumed.getUsedAt()).isEqualTo(this.clock.instant());

		this.clock.advance(Duration.ofMinutes(2));
		String late = this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null);
		this.clock.advance(Duration.ofMinutes(11));

		assertThatThrownBy(() -> this.service.consume(this.user, AccountCodePurpose.PASSWORD_CHANGE, late, null))
				.isInstanceOf(CodeExpiredException.class);
	}

	@Test
	void codeCanBeUsedOnlyOnce() {
		this.random.script(222_222);
		String code = this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null);

		this.service.consume(this.user, AccountCodePurpose.PASSWORD_CHANGE, code, null);

		assertThatThrownBy(() -> this.service.consume(this.user, AccountCodePurpose.PASSWORD_CHANGE, code, null))
				.isInstanceOf(CodeInvalidException.class);
	}

	@Test
	void wrongAttemptsArePersistedAndSixthAttemptIsBlockedEvenWithCorrectCode() {
		this.random.script(333_333);
		String code = this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null);

		for (int attempt = 1; attempt <= 5; attempt++) {
			assertThatThrownBy(() -> this.service.consume(this.user, AccountCodePurpose.PASSWORD_CHANGE, "654321", null))
					.isInstanceOf(CodeInvalidException.class);
			assertThat(latest(this.user, AccountCodePurpose.PASSWORD_CHANGE).getAttempts()).isEqualTo(attempt);
		}

		assertThat(latest(this.user, AccountCodePurpose.PASSWORD_CHANGE).getUsedAt()).isNotNull();
		assertThatThrownBy(() -> this.service.consume(this.user, AccountCodePurpose.PASSWORD_CHANGE, code, null))
				.isInstanceOf(CodeAttemptsExceededException.class);
	}

	@Test
	void malformedCodeIsRejectedWithoutConsumingAnAttempt() {
		this.random.script(444_444);
		this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null);

		for (String malformed : new String[] { "12345", "1234567", "12345a", "", " 44444", null }) {
			assertThatThrownBy(() -> this.service.consume(this.user, AccountCodePurpose.PASSWORD_CHANGE, malformed, null))
					.isInstanceOf(CodeInvalidException.class);
		}

		assertThat(latest(this.user, AccountCodePurpose.PASSWORD_CHANGE).getAttempts()).isZero();
	}

	@Test
	void consumeWithoutAnyIssuedCodeIsInvalid() {
		assertThatThrownBy(() -> this.service.consume(this.user, AccountCodePurpose.PASSWORD_CHANGE, "123456", null))
				.isInstanceOf(CodeInvalidException.class);
	}

	@Test
	void newIssueInvalidatesThePreviousCode() {
		this.random.script(555_551, 555_552);
		String first = this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null);
		this.clock.advance(Duration.ofSeconds(61));
		String second = this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null);

		assertThatThrownBy(() -> this.service.consume(this.user, AccountCodePurpose.PASSWORD_CHANGE, first, null))
				.isInstanceOf(CodeInvalidException.class);
		assertThat(this.service.consume(this.user, AccountCodePurpose.PASSWORD_CHANGE, second, null)).isNotNull();
	}

	@Test
	void issueWithinCooldownReportsRemainingSeconds() {
		this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null);
		this.clock.advance(Duration.ofSeconds(25));

		assertThatThrownBy(() -> this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null))
				.isInstanceOfSatisfying(CodeRequestTooSoonException.class, tooSoon -> {
					assertThat(tooSoon.retryAfter()).isEqualTo(Duration.ofSeconds(35));
					assertThat(tooSoon.retryAfterSeconds()).isEqualTo(35);
				});

		this.clock.advance(Duration.ofSeconds(35));
		assertThat(this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null)).hasSize(6);
	}

	@Test
	void cooldownIsPerPurpose() {
		this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null);

		assertThat(this.service.issue(this.user, AccountCodePurpose.EMAIL_CHANGE, "novo@example.com")).hasSize(6);
	}

	@Test
	void sixthIssueWithinAnHourIsBlockedUntilTheOldestLeavesTheWindow() {
		for (int issued = 0; issued < 5; issued++) {
			this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null);
			this.clock.advance(Duration.ofSeconds(61));
		}

		assertThatThrownBy(() -> this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null))
				.isInstanceOfSatisfying(CodeRequestTooSoonException.class,
						tooSoon -> assertThat(tooSoon.retryAfter())
								.isEqualTo(Duration.ofHours(1).minusSeconds(5 * 61)));

		this.clock.set(START.plus(Duration.ofHours(1)).plusSeconds(1));
		assertThat(this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null)).hasSize(6);
	}

	@Test
	void codeOfOneUserDoesNotWorkForAnother() {
		User other = createUser();
		this.random.script(666_666, 666_666);
		String code = this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null);
		this.service.issue(other, AccountCodePurpose.PASSWORD_CHANGE, null);

		assertThat(this.service.consume(other, AccountCodePurpose.PASSWORD_CHANGE, code, null)).isNotNull();

		User stranger = createUser();
		assertThatThrownBy(() -> this.service.consume(stranger, AccountCodePurpose.PASSWORD_CHANGE, code, null))
				.isInstanceOf(CodeInvalidException.class);
	}

	@Test
	void codeOfOnePurposeDoesNotWorkForAnother() {
		this.random.script(777_777, 888_888);
		String passwordCode = this.service.issue(this.user, AccountCodePurpose.PASSWORD_CHANGE, null);
		this.service.issue(this.user, AccountCodePurpose.EMAIL_CHANGE, "novo@example.com");

		assertThatThrownBy(() -> this.service.consume(this.user, AccountCodePurpose.EMAIL_CHANGE, passwordCode,
				"novo@example.com")).isInstanceOf(CodeInvalidException.class);
		assertThat(this.service.consume(this.user, AccountCodePurpose.PASSWORD_CHANGE, passwordCode, null))
				.isNotNull();
	}

	@Test
	void emailChangeReturnsNormalizedNewEmailAndRequiresTheSameOne() {
		this.random.script(121_212);
		String code = this.service.issue(this.user, AccountCodePurpose.EMAIL_CHANGE, "  Novo@Example.com ");

		assertThatThrownBy(() -> this.service.consume(this.user, AccountCodePurpose.EMAIL_CHANGE, code,
				"outro@example.com")).isInstanceOf(CodeInvalidException.class);
		assertThat(latest(this.user, AccountCodePurpose.EMAIL_CHANGE).getAttempts()).isEqualTo(1);

		AccountCode consumed = this.service.consume(this.user, AccountCodePurpose.EMAIL_CHANGE, code,
				"NOVO@example.com");
		assertThat(consumed.getNewEmail()).isEqualTo("novo@example.com");
	}

	static class MutableClock extends Clock {

		private Instant now = START;

		void set(Instant instant) {
			this.now = instant;
		}

		void advance(Duration duration) {
			this.now = this.now.plus(duration);
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return this;
		}

		@Override
		public Instant instant() {
			return this.now;
		}

	}

	static class ScriptedRandom implements RandomGenerator {

		private final Queue<Integer> values = new ArrayDeque<>();

		private final java.security.SecureRandom fallback = new java.security.SecureRandom();

		void script(int... scripted) {
			for (int value : scripted) {
				this.values.add(value);
			}
		}

		void reset() {
			this.values.clear();
		}

		@Override
		public int nextInt(int bound) {
			Integer next = this.values.poll();
			return next != null ? next : this.fallback.nextInt(bound);
		}

		@Override
		public long nextLong() {
			return this.fallback.nextLong();
		}

	}

	@TestConfiguration(proxyBeanMethods = false)
	static class Config {

		@Bean
		MutableClock mutableClock() {
			return new MutableClock();
		}

		@Bean
		ScriptedRandom scriptedRandom() {
			return new ScriptedRandom();
		}

		@Bean
		@Primary
		AccountCodeAttempts controlledAttempts(AccountCodeRepository codes, AppProperties properties,
				MutableClock clock) {
			return new AccountCodeAttempts(codes, properties, clock);
		}

		@Bean
		@Primary
		AccountCodeService controlledService(AccountCodeRepository codes, CodeHasher hasher,
				AccountCodeAttempts controlledAttempts, AppProperties properties, MutableClock clock,
				ScriptedRandom random) {
			return new AccountCodeService(codes, hasher, controlledAttempts, properties, clock, random);
		}

	}

}
