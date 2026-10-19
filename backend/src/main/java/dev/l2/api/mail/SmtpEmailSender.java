package dev.l2.api.mail;

import dev.l2.api.config.AppProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.mail.enabled", havingValue = "true")
public class SmtpEmailSender implements EmailSender {

	private final JavaMailSender mailSender;

	private final String from;

	public SmtpEmailSender(JavaMailSender mailSender, AppProperties properties) {
		this.mailSender = mailSender;
		this.from = properties.mail().from();
	}

	@Override
	public void send(OutgoingEmail message) {
		SimpleMailMessage mail = new SimpleMailMessage();
		mail.setFrom(from);
		mail.setTo(message.to());
		mail.setSubject(message.subject());
		mail.setText(message.textBody());
		mailSender.send(mail);
	}

}
