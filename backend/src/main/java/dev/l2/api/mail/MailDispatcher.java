package dev.l2.api.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
public class MailDispatcher {

	private static final Logger log = LoggerFactory.getLogger(MailDispatcher.class);

	private final EmailSender sender;

	public MailDispatcher(EmailSender sender) {
		this.sender = sender;
	}

	@Async("mailExecutor")
	public void dispatch(OutgoingEmail message) {
		try {
			sender.send(message);
		}
		catch (RuntimeException failure) {
			log.warn("Falha ao enviar e-mail com assunto '{}': {}", message.subject(),
					failure.getClass().getSimpleName());
		}
	}

}
