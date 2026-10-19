package dev.l2.api.account;

import dev.l2.api.auth.EmailAlreadyUsedException;
import dev.l2.api.config.AppProperties;
import dev.l2.api.mail.MailDispatcher;
import dev.l2.api.user.User;
import dev.l2.api.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.invocation.InvocationOnMock;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AccountServiceTests {

	private final UserRepository users = mock(UserRepository.class);

	private final AccountCodeService codes = mock(AccountCodeService.class);

	private final PasswordEncoder encoder = mock(PasswordEncoder.class);

	private final MailDispatcher mail = mock(MailDispatcher.class);

	private final AppProperties properties = mock(AppProperties.class);

	private final UUID id = UUID.randomUUID();

	private User stored;

	private AccountService service;

	@BeforeEach
	void setUp() {
		AppProperties.Codes settings = new AppProperties.Codes("pepper", Duration.ofMinutes(10), 5,
				Duration.ofSeconds(60), 5);
		when(this.properties.codes()).thenReturn(settings);
		this.stored = new User("ana@example.com", "hash-atual", "Ana");
		this.stored.markEmailVerified(java.time.Instant.now());
		when(this.users.requireVerified(this.id)).thenReturn(this.stored);
		when(this.users.findById(this.id)).thenReturn(Optional.of(this.stored));
		when(this.encoder.matches("senha-atual", "hash-atual")).thenReturn(true);
		this.service = new AccountService(this.users, this.codes, this.encoder, this.mail, this.properties);
	}

	@Test
	void lostRaceOnTheUniqueConstraintBecomesEmailTaken() {
		when(this.users.existsByEmail("novo@example.com")).thenReturn(false);
		runConsumerOnConsume();
		when(this.users.saveAndFlush(any(User.class))).thenThrow(new DataIntegrityViolationException("unique"));

		assertThatThrownBy(() -> this.service.changeEmail(this.id, "NOVO@example.com", "123456", "senha-atual"))
				.isInstanceOf(EmailAlreadyUsedException.class);

		verify(this.mail, never()).dispatch(any());
	}

	@Test
	void emailTakenInsideTheTransactionAbortsBeforeSaving() {
		when(this.users.existsByEmail("novo@example.com")).thenReturn(false, true);
		runConsumerOnConsume();

		assertThatThrownBy(() -> this.service.changeEmail(this.id, "novo@example.com", "123456", "senha-atual"))
				.isInstanceOf(EmailAlreadyUsedException.class);

		verify(this.users, never()).saveAndFlush(any(User.class));
		verify(this.mail, never()).dispatch(any());
	}

	@Test
	void effectReloadsTheUserAndNoticeGoesToThePreviousAddressAfterConsume() {
		when(this.users.existsByEmail("novo@example.com")).thenReturn(false);
		runConsumerOnConsume();

		User result = this.service.changeEmail(this.id, "novo@example.com", "123456", "senha-atual");

		assertThat(result.getEmail()).isEqualTo("novo@example.com");
		verify(this.users).saveAndFlush(this.stored);
		verify(this.mail).dispatch(org.mockito.ArgumentMatchers.argThat(
				message -> message != null && message.to().equals("ana@example.com")));
	}

	@Test
	void wrongPasswordNeverReachesTheCodeService() {
		assertThatThrownBy(() -> this.service.changePassword(this.id, "123456", "errada", "nova-senha-1"))
				.isInstanceOf(WrongPasswordException.class);

		verify(this.codes, never()).consume(any(), any(), anyString(), any(), any());
	}

	@SuppressWarnings("unchecked")
	private void runConsumerOnConsume() {
		doAnswer((InvocationOnMock call) -> {
			((Consumer<AccountCode>) call.getArgument(4)).accept(null);
			return null;
		}).when(this.codes).consume(any(User.class), eq(AccountCodePurpose.EMAIL_CHANGE), anyString(), anyString(),
				any());
	}

}
