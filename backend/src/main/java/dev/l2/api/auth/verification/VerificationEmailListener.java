package dev.l2.api.auth.verification;

import dev.l2.api.config.AppProperties;
import dev.l2.api.mail.EmailTemplates;
import dev.l2.api.mail.MailDispatcher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class VerificationEmailListener {

	private final MailDispatcher dispatcher;

	private final String baseUrl;

	public VerificationEmailListener(MailDispatcher dispatcher, AppProperties properties) {
		this.dispatcher = dispatcher;
		this.baseUrl = properties.publicBaseUrl().replaceAll("/+$", "");
	}

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void onVerificationRequested(VerificationEmailRequested event) {
		String link = this.baseUrl + "/verificar-email?token=" + event.token();
		this.dispatcher.dispatch(EmailTemplates.emailVerification(event.email(), link));
	}

}
