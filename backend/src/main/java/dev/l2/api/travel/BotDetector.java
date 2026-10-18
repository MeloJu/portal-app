package dev.l2.api.travel;

import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

@Component
public class BotDetector {

	private static final Pattern SIGNATURES = Pattern.compile(
			"bot|crawl|spider|slurp|archiver"
					+ "|curl|wget|python-requests|httpclient|http-client|okhttp|java/|go-http-client|libwww|axios"
					+ "|postman|insomnia"
					+ "|headless|phantomjs|puppeteer|playwright|lighthouse|pagespeed"
					+ "|monitor|uptime|pingdom|scanner|validator"
					+ "|facebookexternalhit|whatsapp|embedly|preview|snippet"
					+ "|feedfetcher",
			Pattern.CASE_INSENSITIVE);

	public boolean isBot(String userAgent) {
		if (userAgent == null || userAgent.isBlank()) {
			return true;
		}
		return SIGNATURES.matcher(userAgent).find();
	}

}
