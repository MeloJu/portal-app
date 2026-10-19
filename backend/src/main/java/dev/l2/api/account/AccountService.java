package dev.l2.api.account;

import dev.l2.api.auth.EmailAlreadyUsedException;
import dev.l2.api.auth.InvalidCredentialsException;
import dev.l2.api.config.AppProperties;
import dev.l2.api.mail.EmailTemplates;
import dev.l2.api.mail.MailDispatcher;
import dev.l2.api.user.User;
import dev.l2.api.user.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.UUID;

@Service
public class AccountService {

	private final UserRepository users;

	private final AccountCodeService codes;

	private final PasswordEncoder passwordEncoder;

	private final MailDispatcher mail;

	private final int codeValidityMinutes;

	public AccountService(UserRepository users, AccountCodeService codes, PasswordEncoder passwordEncoder,
			MailDispatcher mail, AppProperties properties) {
		this.users = users;
		this.codes = codes;
		this.passwordEncoder = passwordEncoder;
		this.mail = mail;
		this.codeValidityMinutes = (int) properties.codes().ttl().toMinutes();
	}

	public void requestCode(UUID userId, AccountCodePurpose purpose, String newEmail) {
		User user = this.users.requireVerified(userId);
		if (purpose == AccountCodePurpose.EMAIL_CHANGE) {
			String target = requireAvailableEmail(user, newEmail);
			String code = this.codes.issue(user, purpose, target);
			this.mail.dispatch(EmailTemplates.emailChangeCode(target, code, this.codeValidityMinutes));
			return;
		}
		requirePasswordSet(user);
		String code = this.codes.issue(user, purpose, null);
		this.mail.dispatch(EmailTemplates.passwordChangeCode(user.getEmail(), code, this.codeValidityMinutes));
	}

	public User changeEmail(UUID userId, String newEmail, String code, String currentPassword) {
		User user = this.users.requireVerified(userId);
		requireCurrentPassword(user, currentPassword);
		String target = requireAvailableEmail(user, newEmail);
		String previousEmail = user.getEmail();
		try {
			this.codes.consume(user, AccountCodePurpose.EMAIL_CHANGE, code, target,
					accepted -> replaceEmail(userId, target));
		}
		catch (DataIntegrityViolationException raced) {
			throw new EmailAlreadyUsedException();
		}
		this.mail.dispatch(EmailTemplates.emailChanged(previousEmail, target));
		return this.users.findById(userId).orElseThrow(InvalidCredentialsException::new);
	}

	public User changePassword(UUID userId, String code, String currentPassword, String newPassword) {
		User user = this.users.requireVerified(userId);
		requirePasswordSet(user);
		requireCurrentPassword(user, currentPassword);
		if (this.passwordEncoder.matches(newPassword, user.getPasswordHash())) {
			throw new InvalidAccountChangeException("A nova senha deve ser diferente da atual");
		}
		String newHash = this.passwordEncoder.encode(newPassword);
		this.codes.consume(user, AccountCodePurpose.PASSWORD_CHANGE, code, null,
				accepted -> replacePasswordHash(userId, newHash));
		return this.users.findById(userId).orElseThrow(InvalidCredentialsException::new);
	}

	private void replaceEmail(UUID userId, String target) {
		User fresh = this.users.findById(userId).orElseThrow(InvalidCredentialsException::new);
		if (this.users.existsByEmail(target)) {
			throw new EmailAlreadyUsedException();
		}
		fresh.setEmail(target);
		this.users.saveAndFlush(fresh);
	}

	private void replacePasswordHash(UUID userId, String newHash) {
		User fresh = this.users.findById(userId).orElseThrow(InvalidCredentialsException::new);
		fresh.setPasswordHash(newHash);
		this.users.saveAndFlush(fresh);
	}

	private static void requirePasswordSet(User user) {
		if (!user.hasPassword()) {
			throw new PasswordNotSetException();
		}
	}

	private void requireCurrentPassword(User user, String currentPassword) {
		if (!this.passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
			throw new WrongPasswordException();
		}
	}

	private String requireAvailableEmail(User user, String newEmail) {
		String target = normalize(newEmail);
		if (target == null || target.isEmpty()) {
			throw new InvalidAccountChangeException("newEmail: informe o novo e-mail");
		}
		if (target.equals(user.getEmail())) {
			throw new InvalidAccountChangeException("O novo e-mail deve ser diferente do atual");
		}
		if (this.users.existsByEmail(target)) {
			throw new EmailAlreadyUsedException();
		}
		return target;
	}

	private static String normalize(String email) {
		return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
	}

}
