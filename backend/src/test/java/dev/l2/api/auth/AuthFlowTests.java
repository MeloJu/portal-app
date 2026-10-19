package dev.l2.api.auth;

import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.user.User;
import dev.l2.api.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import jakarta.servlet.http.Cookie;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@AutoConfigureMockMvc
@SpringBootTest(properties = "app.rate-limit.enabled=false")
class AuthFlowTests {

	@Autowired
	private MockMvc mvc;

	@Autowired
	private UserRepository users;

	private MvcResult register(String name, String email, String password) throws Exception {
		return this.mvc.perform(post("/api/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"name":"%s","email":"%s","password":"%s"}""".formatted(name, email, password)))
				.andReturn();
	}

	private Cookie session(MvcResult result) {
		return result.getResponse().getCookie(SessionCookie.NAME);
	}

	@Test
	void registerOpensTheSessionInACookieAndNeverInTheBody() throws Exception {
		MvcResult result = register("Ana", "ana@example.com", "senha-bem-grande");

		assertThat(result.getResponse().getStatus()).isEqualTo(201);
		assertThat(result.getResponse().getContentAsString()).doesNotContain("accessToken");
		assertThat(result.getResponse().getContentAsString()).contains("\"expiresIn\":28800");

		Cookie cookie = session(result);
		assertThat(cookie).isNotNull();
		assertThat(cookie.isHttpOnly()).isTrue();
		assertThat(cookie.getSecure()).isTrue();
		assertThat(cookie.getMaxAge()).isEqualTo(28800);
		assertThat(result.getResponse().getHeader("Set-Cookie")).contains("SameSite=Strict");
	}

	@Test
	void normalizesEmailToLowercaseAndLetsTheUserLogInWithAnyCase() throws Exception {
		register("Bruno", "Bruno@Example.com", "senha-bem-grande");

		assertThat(this.users.findByEmail("bruno@example.com")).isPresent();

		this.mvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"email":"BRUNO@example.com","password":"senha-bem-grande"}"""))
				.andExpect(status().isOk())
				.andExpect(cookie().exists(SessionCookie.NAME));
	}

	@Test
	void rejectsDuplicatedEmailWithConflict() throws Exception {
		register("Carla", "carla@example.com", "senha-bem-grande");

		this.mvc.perform(post("/api/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"name":"Carla 2","email":"carla@example.com","password":"outra-senha-ok"}"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
	}

	@Test
	void rejectsPasswordShorterThanEightCharacters() throws Exception {
		this.mvc.perform(post("/api/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"name":"Dora","email":"dora@example.com","password":"curta"}"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void loginAnswersTheSameThingForWrongPasswordAndUnknownEmail() throws Exception {
		register("Elisa", "elisa@example.com", "senha-bem-grande");

		String wrongPassword = this.mvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"email":"elisa@example.com","password":"senha-errada"}"""))
				.andExpect(status().isUnauthorized())
				.andReturn().getResponse().getContentAsString();

		String unknownEmail = this.mvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"email":"ninguem@example.com","password":"senha-bem-grande"}"""))
				.andExpect(status().isUnauthorized())
				.andReturn().getResponse().getContentAsString();

		assertThat(wrongPassword).isEqualTo(unknownEmail);
		assertThat(wrongPassword).doesNotContain("cadastrad");
	}

	@Test
	void meAnswersTheLoggedUserWhenTheCookieTravels() throws Exception {
		MvcResult registered = register("Fabio", "fabio@example.com", "senha-bem-grande");

		this.mvc.perform(get("/api/me").cookie(session(registered)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value("fabio@example.com"))
				.andExpect(jsonPath("$.name").value("Fabio"))
				.andExpect(jsonPath("$.id").isNotEmpty());
	}

	@Test
	void newAccountIsUnverifiedInRegisterLoginAndMe() throws Exception {
		MvcResult registered = register("Hugo", "hugo@example.com", "senha-bem-grande");

		assertThat(registered.getResponse().getContentAsString()).contains("\"emailVerified\":false");

		this.mvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"email":"hugo@example.com","password":"senha-bem-grande"}"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.user.emailVerified").value(false));

		this.mvc.perform(get("/api/me").cookie(session(registered)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.emailVerified").value(false));
	}

	@Test
	void meReportsVerifiedAfterTheEmailIsMarkedVerified() throws Exception {
		MvcResult registered = register("Iris", "iris@example.com", "senha-bem-grande");
		User iris = this.users.findByEmail("iris@example.com").orElseThrow();
		iris.markEmailVerified(Instant.parse("2026-10-15T12:00:00Z"));
		this.users.save(iris);

		this.mvc.perform(get("/api/me").cookie(session(registered)))
				.andExpect(jsonPath("$.emailVerified").value(true));
	}

	@Test
	void meRefusesWithoutSession() throws Exception {
		this.mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
	}

	@Test
	void meIgnoresTheAuthorizationHeader() throws Exception {
		MvcResult registered = register("Gabi", "gabi@example.com", "senha-bem-grande");
		String token = session(registered).getValue();

		this.mvc.perform(get("/api/me").header("Authorization", "Bearer " + token))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void logoutExpiresTheCookieAndWorksWithoutSession() throws Exception {
		this.mvc.perform(post("/api/auth/logout"))
				.andExpect(status().isNoContent())
				.andExpect(cookie().maxAge(SessionCookie.NAME, 0))
				.andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("HttpOnly")));
	}

	@Test
	void travelRouteIsPublicEvenWithoutSession() throws Exception {
		this.mvc.perform(get("/api/travel/qualquer")).andExpect(status().isNotFound());
	}

}
