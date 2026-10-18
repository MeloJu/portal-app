package dev.l2.api.ratelimit;

import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.auth.SessionCookie;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@AutoConfigureMockMvc
@SpringBootTest(properties = {
		"app.rate-limit.enabled=true",
		"app.rate-limit.login.capacity=2",
		"app.rate-limit.login.window=1m",
		"app.rate-limit.register.capacity=2",
		"app.rate-limit.register.window=1m",
		"app.rate-limit.travel.capacity=2",
		"app.rate-limit.travel.window=1m" })
class RateLimitApiTests {

	private static final String PASSWORD = "senha-bem-grande";

	@Autowired
	private MockMvc mvc;

	@Test
	void blocksTheThirdLoginFromTheSameAddress() throws Exception {
		String address = "10.1.0.1";
		String email = register(address).email();

		login(address, email).andExpect(status().isOk());
		login(address, email).andExpect(status().isOk());
		login(address, email)
				.andExpect(status().isTooManyRequests())
				.andExpect(header().exists(HttpHeaders.RETRY_AFTER))
				.andExpect(jsonPath("$.code").value("RATE_LIMIT"))
				.andExpect(jsonPath("$.message").isNotEmpty());
	}

	@Test
	void keepsTheBudgetPerAddress() throws Exception {
		String email = register("10.1.0.2").email();

		login("10.1.0.2", email).andExpect(status().isOk());
		login("10.1.0.2", email).andExpect(status().isOk());
		login("10.1.0.2", email).andExpect(status().isTooManyRequests());

		login("10.1.0.3", email).andExpect(status().isOk());
	}

	@Test
	void blocksTheThirdRegisterFromTheSameAddress() throws Exception {
		String address = "10.1.0.4";

		register(address);
		register(address);

		this.mvc.perform(post("/api/auth/register")
				.with(from(address))
				.contentType(MediaType.APPLICATION_JSON)
				.content(body(unique() + "@example.com")))
				.andExpect(status().isTooManyRequests())
				.andExpect(jsonPath("$.code").value("RATE_LIMIT"));
	}

	@Test
	void blocksTheThirdTravelAndCountsTheThreatForTheOwner() throws Exception {
		String address = "10.1.0.5";
		Session owner = register(address);
		String code = createLink(owner);

		travel(address, code).andExpect(status().isOk());
		travel(address, code).andExpect(status().isOk());
		travel(address, code).andExpect(status().isTooManyRequests());

		this.mvc.perform(get("/api/protection/events").cookie(owner.cookie()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[?(@.reason == 'RATE_LIMIT')]", hasSize(1)))
				.andExpect(jsonPath("$[?(@.reason == 'RATE_LIMIT')].code").value(code));
	}

	@Test
	void countsTheThreatOnlyOncePerWindow() throws Exception {
		String address = "10.1.0.6";
		Session owner = register(address);
		String code = createLink(owner);

		travel(address, code).andExpect(status().isOk());
		travel(address, code).andExpect(status().isOk());
		travel(address, code).andExpect(status().isTooManyRequests());
		travel(address, code).andExpect(status().isTooManyRequests());
		travel(address, code).andExpect(status().isTooManyRequests());

		this.mvc.perform(get("/api/protection/events").cookie(owner.cookie()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[?(@.reason == 'RATE_LIMIT')]", hasSize(1)));
	}

	@Test
	void sharesTheTravelBudgetWithTheDirectRedirect() throws Exception {
		String address = "10.1.0.7";
		String code = createLink(register(address));

		this.mvc.perform(get("/r/{code}", code).with(from(address))).andExpect(status().isFound());
		this.mvc.perform(get("/r/{code}", code).with(from(address))).andExpect(status().isFound());

		travel(address, code).andExpect(status().isTooManyRequests());
	}

	@Test
	void leavesTheAuthenticatedApiAlone() throws Exception {
		Session owner = register("10.1.0.8");

		for (int attempt = 0; attempt < 5; attempt++) {
			this.mvc.perform(get("/api/links").cookie(owner.cookie()).with(from("10.1.0.8")))
					.andExpect(status().isOk());
		}
	}

	private Session register(String address) throws Exception {
		String email = unique() + "@example.com";
		Cookie cookie = this.mvc.perform(post("/api/auth/register")
				.with(from(address))
				.contentType(MediaType.APPLICATION_JSON)
				.content(body(email)))
				.andExpect(status().isCreated())
				.andReturn()
				.getResponse()
				.getCookie(SessionCookie.NAME);
		return new Session(email, cookie);
	}

	private org.springframework.test.web.servlet.ResultActions login(String address, String email) throws Exception {
		return this.mvc.perform(post("/api/auth/login")
				.with(from(address))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"email":"%s","password":"%s"}""".formatted(email, PASSWORD)));
	}

	private org.springframework.test.web.servlet.ResultActions travel(String address, String code) throws Exception {
		return this.mvc.perform(get("/api/travel/{code}", code).with(from(address)));
	}

	private String createLink(Session owner) throws Exception {
		String code = "c" + unique().substring(0, 10);
		this.mvc.perform(post("/api/links")
				.cookie(owner.cookie())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"targetUrl":"example.com/campanha","alias":"%s"}""".formatted(code)))
				.andExpect(status().isCreated());
		return code;
	}

	private static String body(String email) {
		return """
				{"name":"Ana","email":"%s","password":"%s"}""".formatted(email, PASSWORD);
	}

	private static String unique() {
		return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
	}

	private static RequestPostProcessor from(String address) {
		return request -> {
			request.setRemoteAddr(address);
			return request;
		};
	}

	private record Session(String email, Cookie cookie) {

	}

}
