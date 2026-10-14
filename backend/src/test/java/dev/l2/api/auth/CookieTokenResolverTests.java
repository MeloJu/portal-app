package dev.l2.api.auth;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class CookieTokenResolverTests {

	private final CookieTokenResolver resolver = new CookieTokenResolver();

	@Test
	void readsTheTokenFromTheSessionCookie() {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setCookies(new Cookie(SessionCookie.NAME, "um.jwt.qualquer"));

		assertThat(this.resolver.resolve(request)).isEqualTo("um.jwt.qualquer");
	}

	@Test
	void resolvesNothingWithoutTheCookie() {
		assertThat(this.resolver.resolve(new MockHttpServletRequest())).isNull();
	}

	@Test
	void ignoresOtherCookies() {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setCookies(new Cookie("outro", "valor"));

		assertThat(this.resolver.resolve(request)).isNull();
	}

	@Test
	void ignoresTheAuthorizationHeader() {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.addHeader("Authorization", "Bearer um.jwt.pelo.header");

		assertThat(this.resolver.resolve(request)).isNull();
	}

	@Test
	void treatsEmptyCookieAsAbsent() {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setCookies(new Cookie(SessionCookie.NAME, ""));

		assertThat(this.resolver.resolve(request)).isNull();
	}

}
