package dev.l2.api.auth.oauth;

import dev.l2.api.account.AccountCodePurpose;
import dev.l2.api.account.AccountCodeRepository;
import dev.l2.api.auth.oauth.OAuthProviderClient.ProviderIdentity;
import dev.l2.api.auth.verification.EmailVerificationTokenRepository;
import dev.l2.api.user.User;
import dev.l2.api.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;

@Service
public class OAuthLoginService {

	static final int MAX_NAME_LENGTH = 120;

	static final int MAX_EMAIL_LENGTH = 254;

	private static final int UNUSABLE_SECRET_BYTES = 32;

	private final UserRepository users;

	private final UserIdentityRepository identities;

	private final EmailVerificationTokenRepository verificationTokens;

	private final AccountCodeRepository accountCodes;

	private final PasswordEncoder passwordEncoder;

	private final Clock clock;

	private final SecureRandom random = new SecureRandom();

	public OAuthLoginService(UserRepository users, UserIdentityRepository identities,
			EmailVerificationTokenRepository verificationTokens, AccountCodeRepository accountCodes,
			PasswordEncoder passwordEncoder, Clock clock) {
		this.users = users;
		this.identities = identities;
		this.verificationTokens = verificationTokens;
		this.accountCodes = accountCodes;
		this.passwordEncoder = passwordEncoder;
		this.clock = clock;
	}

	@Transactional
	public User signIn(OAuthProvider provider, ProviderIdentity identity) {
		User owner = this.identities.findByProviderAndProviderUserId(provider, identity.providerUserId())
				.map(UserIdentity::getUser)
				.orElse(null);
		if (owner != null) {
			return owner;
		}
		String email = verifiedEmailOf(identity);
		User account = this.users.findByEmail(email)
				.map(existing -> takeOver(existing))
				.orElseGet(() -> createFrom(identity, email));
		this.identities.save(new UserIdentity(account, provider, identity.providerUserId()));
		return account;
	}

	private User takeOver(User existing) {
		if (existing.isEmailVerified()) {
			return existing;
		}
		Instant now = this.clock.instant();
		this.accountCodes.invalidateActive(existing.getId(), AccountCodePurpose.EMAIL_CHANGE, now);
		this.accountCodes.invalidateActive(existing.getId(), AccountCodePurpose.PASSWORD_CHANGE, now);
		this.verificationTokens.findByUserIdAndUsedAtIsNull(existing.getId())
				.forEach(pending -> pending.markUsed(now));
		existing.markEmailVerified(now);
		existing.disablePassword(unusablePasswordHash());
		return this.users.save(existing);
	}

	private User createFrom(ProviderIdentity identity, String email) {
		String hash = unusablePasswordHash();
		User created = new User(email, hash, displayName(identity, email));
		created.markEmailVerified(this.clock.instant());
		created.disablePassword(hash);
		return this.users.save(created);
	}

	private String unusablePasswordHash() {
		byte[] secret = new byte[UNUSABLE_SECRET_BYTES];
		this.random.nextBytes(secret);
		return this.passwordEncoder.encode(Base64.getEncoder().encodeToString(secret));
	}

	private static String verifiedEmailOf(ProviderIdentity identity) {
		if (!identity.emailVerified() || !StringUtils.hasText(identity.email())) {
			throw new OAuthEmailUnverifiedException();
		}
		String email = identity.email().trim().toLowerCase(Locale.ROOT);
		if (email.length() > MAX_EMAIL_LENGTH) {
			throw new OAuthProviderException();
		}
		return email;
	}

	private static String displayName(ProviderIdentity identity, String email) {
		String name = StringUtils.hasText(identity.name()) ? identity.name().trim() : localPartOf(email);
		return name.length() > MAX_NAME_LENGTH ? name.substring(0, MAX_NAME_LENGTH) : name;
	}

	private static String localPartOf(String email) {
		int at = email.indexOf('@');
		return at > 0 ? email.substring(0, at) : email;
	}

}
