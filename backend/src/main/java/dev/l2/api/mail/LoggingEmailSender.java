package dev.l2.api.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.mail.enabled", havingValue = "false", matchIfMissing = true)
public class LoggingEmailSender implements EmailSender {

	private static final Logger log = LoggerFactory.getLogger(LoggingEmailSender.class);

	@Override
	public void send(OutgoingEmail message) {
		log.info("E-mail simulado (app.mail.enabled=false)\nPara: {}\nAssunto: {}\n\n{}",
				message.to(), message.subject(), message.textBody());
	}

}
