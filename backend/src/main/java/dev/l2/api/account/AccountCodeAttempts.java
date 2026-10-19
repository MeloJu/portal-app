package dev.l2.api.account;

import dev.l2.api.config.AppProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.UUID;

@Component
public class AccountCodeAttempts {

	private final AccountCodeRepository codes;

	private final int maxAttempts;

	private final Clock clock;

	@Autowired
	public AccountCodeAttempts(AccountCodeRepository codes, AppProperties properties) {
		this(codes, properties, Clock.systemUTC());
	}

	AccountCodeAttempts(AccountCodeRepository codes, AppProperties properties, Clock clock) {
		this.codes = codes;
		this.maxAttempts = properties.codes().maxAttempts();
		this.clock = clock;
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void registerFailure(UUID codeId) {
		this.codes.incrementAttempts(codeId);
		this.codes.invalidateIfExhausted(codeId, this.maxAttempts, this.clock.instant());
	}

}
