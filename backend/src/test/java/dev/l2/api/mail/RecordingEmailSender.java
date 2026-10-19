package dev.l2.api.mail;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public class RecordingEmailSender implements EmailSender {

	private final List<OutgoingEmail> sent = new CopyOnWriteArrayList<>();

	@Override
	public void send(OutgoingEmail message) {
		sent.add(message);
	}

	public OutgoingEmail last() {
		return sent.isEmpty() ? null : sent.get(sent.size() - 1);
	}

	public List<OutgoingEmail> all() {
		return List.copyOf(sent);
	}

	public void clear() {
		sent.clear();
	}

}
