package dev.l2.api.mail;

public interface EmailSender {

	void send(OutgoingEmail message);

}
