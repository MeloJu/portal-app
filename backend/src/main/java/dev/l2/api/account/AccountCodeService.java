package dev.l2.api.account;

import dev.l2.api.config.AppProperties;
import dev.l2.api.user.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.random.RandomGenerator;
import java.util.regex.Pattern;

@Service
public class AccountCodeService {

	private static final Pattern SIX_DIGITS = Pattern.compile("^[0-9]{6}$");

	private static final Duration HOUR = Duration.ofHours(1);

	private final AccountCodeRepository codes;

	private final CodeHasher hasher;

	private final AccountCodeAttempts attempts;

	private final AppProperties.Codes settings;

	private final Clock clock;

	private final RandomGenerator random;

	@Autowired
	public AccountCodeService(AccountCodeRepository codes, CodeHasher hasher, AccountCodeAttempts attempts,
			AppProperties properties) {
		this(codes, hasher, attempts, properties, Clock.systemUTC(), new SecureRandom());
	}

	AccountCodeService(AccountCodeRepository codes, CodeHasher hasher, AccountCodeAttempts attempts,
			AppProperties properties, Clock clock, RandomGenerator random) {
		this.codes = codes;
		this.hasher = hasher;
		this.attempts = attempts;
		this.settings = properties.codes();
		this.clock = clock;
		this.random = random;
	}

	@Transactional
	public String issue(User user, AccountCodePurpose purpose, String newEmailOrNull) {
		this.codes.lockIssuance(user.getId() + ":" + purpose);
		Instant now = this.clock.instant();
		requireNotTooSoon(user, purpose, now);
		this.codes.invalidateActive(user.getId(), purpose, now);
		String code = String.format("%06d", this.random.nextInt(1_000_000));
		String hash = this.hasher.hash(user.getId(), purpose, code);
		this.codes.save(new AccountCode(user, purpose, hash, normalize(newEmailOrNull),
				now.plus(this.settings.ttl()), now));
		return code;
	}

	@Transactional
	public AccountCode consume(User user, AccountCodePurpose purpose, String submittedCode,
			String expectedNewEmailOrNull) {
		if (submittedCode == null || !SIX_DIGITS.matcher(submittedCode).matches()) {
			throw new CodeInvalidException();
		}
		Instant now = this.clock.instant();
		AccountCode code = this.codes.findFirstByUserIdAndPurposeOrderByCreatedAtDesc(user.getId(), purpose)
				.orElseThrow(CodeInvalidException::new);
		if (code.getAttempts() >= this.settings.maxAttempts()) {
			throw new CodeAttemptsExceededException();
		}
		if (code.getUsedAt() != null) {
			throw new CodeInvalidException();
		}
		if (!now.isBefore(code.getExpiresAt())) {
			throw new CodeExpiredException();
		}
		if (!matches(user, purpose, submittedCode, expectedNewEmailOrNull, code)) {
			if (!this.attempts.registerFailure(code.getId())) {
				throw new CodeAttemptsExceededException();
			}
			throw new CodeInvalidException();
		}
		if (this.codes.markUsedIfUnused(code.getId(), now, this.settings.maxAttempts()) == 0) {
			if (this.codes.attemptsOf(code.getId()) >= this.settings.maxAttempts()) {
				throw new CodeAttemptsExceededException();
			}
			throw new CodeInvalidException();
		}
		code.markUsed(now);
		return code;
	}

	private boolean matches(User user, AccountCodePurpose purpose, String submittedCode, String expectedNewEmail,
			AccountCode code) {
		String submittedHash = this.hasher.hash(user.getId(), purpose, submittedCode);
		boolean codeMatches = this.hasher.matches(code.getCodeHash(), submittedHash);
		boolean emailMatches = purpose != AccountCodePurpose.EMAIL_CHANGE
				|| (code.getNewEmail() != null && code.getNewEmail().equals(normalize(expectedNewEmail)));
		return codeMatches && emailMatches;
	}

	private void requireNotTooSoon(User user, AccountCodePurpose purpose, Instant now) {
		Duration wait = Duration.ZERO;
		List<AccountCode> lastHour = this.codes.findByUserIdAndPurposeAndCreatedAtAfterOrderByCreatedAtAsc(
				user.getId(), purpose, now.minus(HOUR));
		if (!lastHour.isEmpty()) {
			Instant last = lastHour.get(lastHour.size() - 1).getCreatedAt();
			wait = longer(wait, Duration.between(now, last.plus(this.settings.resendCooldown())));
		}
		int excess = lastHour.size() - this.settings.maxPerHour();
		if (excess >= 0) {
			Instant releasing = lastHour.get(excess).getCreatedAt();
			wait = longer(wait, Duration.between(now, releasing.plus(HOUR)));
		}
		if (wait.isPositive()) {
			throw new CodeRequestTooSoonException(wait);
		}
	}

	private static Duration longer(Duration first, Duration second) {
		return first.compareTo(second) >= 0 ? first : second;
	}

	private static String normalize(String email) {
		return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
	}

}
