package dev.l2.api.mail;

public final class EmailTemplates {

	public static final int VERIFICATION_LINK_VALIDITY_MINUTES = 30;

	private EmailTemplates() {
	}

	public static OutgoingEmail emailVerification(String to, String verificationLink) {
		String body = """
				Olá!

				Confirme o seu e-mail acessando o link abaixo:

				%s

				O link vale por %d minutos. Se você não criou uma conta, ignore esta mensagem.
				""".formatted(verificationLink, VERIFICATION_LINK_VALIDITY_MINUTES);
		return new OutgoingEmail(to, "Confirme o seu e-mail", body);
	}

	public static OutgoingEmail emailChangeCode(String to, String code, int validityMinutes) {
		String body = """
				Olá!

				Use o código abaixo para confirmar a troca do seu e-mail:

				%s

				O código vale por %d minutos. Se você não pediu a troca, ignore esta mensagem.
				""".formatted(code, validityMinutes);
		return new OutgoingEmail(to, "Código para trocar o seu e-mail", body);
	}

	public static OutgoingEmail passwordChangeCode(String to, String code, int validityMinutes) {
		String body = """
				Olá!

				Use o código abaixo para confirmar a troca da sua senha:

				%s

				O código vale por %d minutos. Se você não pediu a troca, altere a sua senha o quanto antes.
				""".formatted(code, validityMinutes);
		return new OutgoingEmail(to, "Código para trocar a sua senha", body);
	}

	public static OutgoingEmail emailChanged(String to, String newEmail) {
		String body = """
				Olá!

				O e-mail da sua conta foi alterado para %s.

				Se não foi você, entre em contato com o suporte imediatamente.
				""".formatted(newEmail);
		return new OutgoingEmail(to, "O e-mail da sua conta foi alterado", body);
	}

}
