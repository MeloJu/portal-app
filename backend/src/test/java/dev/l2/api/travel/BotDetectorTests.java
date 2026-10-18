package dev.l2.api.travel;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class BotDetectorTests {

	private final BotDetector detector = new BotDetector();

	@ParameterizedTest
	@ValueSource(strings = {
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
			"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
			"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36" })
	void treatsRealBrowsersAsPeople(String userAgent) {
		assertThat(this.detector.isBot(userAgent)).isFalse();
	}

	@ParameterizedTest
	@ValueSource(strings = {
			"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
			"Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
			"Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
			"Twitterbot/1.0",
			"facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
			"WhatsApp/2.23.20.0",
			"curl/8.5.0",
			"Wget/1.21.4",
			"python-requests/2.31.0",
			"Apache-HttpClient/5.3 (Java/21.0.1)",
			"okhttp/4.12.0",
			"Go-http-client/1.1",
			"Java/21.0.1",
			"axios/1.7.2",
			"PostmanRuntime/7.37.0",
			"Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/129.0.0.0 Safari/537.36",
			"Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
			"Pingdom.com_bot_version_1.4",
			"Chrome-Lighthouse" })
	void recognizesRobotsAndToolsByTheUserAgent(String userAgent) {
		assertThat(this.detector.isBot(userAgent)).isTrue();
	}

	@ParameterizedTest
	@NullAndEmptySource
	@ValueSource(strings = { "   ", "\t" })
	void treatsAMissingUserAgentAsARobot(String userAgent) {
		assertThat(this.detector.isBot(userAgent)).isTrue();
	}

	@Test
	void ignoresTheCaseOfTheSignature() {
		assertThat(this.detector.isBot("CURL/8.5.0")).isTrue();
		assertThat(this.detector.isBot("GoogleBot")).isTrue();
	}

}
