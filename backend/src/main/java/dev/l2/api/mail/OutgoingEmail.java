package dev.l2.api.mail;

public record OutgoingEmail(String to, String subject, String textBody) {

}
