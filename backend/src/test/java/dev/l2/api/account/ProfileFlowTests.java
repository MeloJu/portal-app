package dev.l2.api.account;

import dev.l2.api.EmailVerification;
import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.auth.JwtService;
import dev.l2.api.auth.SessionCookie;
import dev.l2.api.user.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@AutoConfigureMockMvc
@SpringBootTest(properties = "app.rate-limit.enabled=false")
class ProfileFlowTests {

	private static final String PASSWORD = "senha-bem-grande";

	@Autowired
	private MockMvc mvc;

	@Autowired
	private UserRepository users;

	@Autowired
	private JwtService jwt;

	@Test
	void renamingUpdatesTheMeEndpointAndReissuesTheSessionWithTheNewName() throws Exception {
		Account account = account("Ana", true);

		ResultActions renamed = rename(account.cookie(), "Ana Maria");

		renamed.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Ana Maria"))
				.andExpect(jsonPath("$.email").value(account.email()))
				.andExpect(header().string(HttpHeaders.SET_COOKIE, startsWith(SessionCookie.NAME + "=")));
		Cookie fresh = renamed.andReturn().getResponse().getCookie(SessionCookie.NAME);
		assertThat(this.jwt.verify(fresh.getValue()).getClaimAsString("name")).isEqualTo("Ana Maria");
		this.mvc.perform(get("/api/me").cookie(fresh))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Ana Maria"));
		this.mvc.perform(get("/api/me").cookie(account.cookie()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Ana Maria"));
	}

	@Test
	void trimsTheNameBeforeSavingIt() throws Exception {
		Account account = account("Ana", true);

		renameRaw(account.cookie(), "{\"name\":\"   Bia Souza \\u00a0\\u2003 \"}")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Bia Souza"));
		assertThat(this.users.findByEmail(account.email()).orElseThrow().getName()).isEqualTo("Bia Souza");
	}

	@Test
	void rejectsBlankAndMissingNames() throws Exception {
		Cookie cookie = account("Ana", true).cookie();

		for (String name : new String[] { "", "   ", "\\t\\n" }) {
			renameRaw(cookie, "{\"name\":\"" + name + "\"}")
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		}
		renameRaw(cookie, "{}").andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		renameRaw(cookie, "{\"name\":null}").andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		this.mvc.perform(get("/api/me").cookie(cookie)).andExpect(jsonPath("$.name").value("Ana"));
	}

	@Test
	void limitsTheNameTo120CharactersAfterTrimming() throws Exception {
		Cookie cookie = account("Ana", true).cookie();
		String exact = "a".repeat(120);

		rename(cookie, "  " + exact + "  ").andExpect(status().isOk()).andExpect(jsonPath("$.name").value(exact));
		rename(cookie, "a".repeat(121))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		rename(cookie, "  " + "a".repeat(121) + "  ").andExpect(status().isBadRequest());
	}

	@Test
	void countsCharactersAndNotBytes() throws Exception {
		Cookie cookie = account("Ana", true).cookie();

		rename(cookie, "é".repeat(120)).andExpect(status().isOk());
		rename(cookie, "é".repeat(121)).andExpect(status().isBadRequest());
	}

	@Test
	void keepsAccentsAndApostrophesAsTyped() throws Exception {
		Cookie cookie = account("Ana", true).cookie();

		rename(cookie, "Joana D'Ávila <Ñandú> & Filhos")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Joana D'Ávila <Ñandú> & Filhos"));
	}

	@Test
	void rejectsControlCharacters() throws Exception {
		Cookie cookie = account("Ana", true).cookie();

		for (String name : new String[] { "Ana\\u0007", "An\\ta", "An\\na", "A\\u0000na" }) {
			renameRaw(cookie, "{\"name\":\"" + name + "\"}")
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		}
	}

	@Test
	void requiresASession() throws Exception {
		this.mvc.perform(patch("/api/account/profile")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Ana\"}"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void unverifiedAccountCanRename() throws Exception {
		Account account = account("Ana", false);

		rename(account.cookie(), "Ana Nova")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Ana Nova"))
				.andExpect(jsonPath("$.emailVerified").value(false));
	}

	@Test
	void renamingOneUserNeverTouchesAnother() throws Exception {
		Account first = account("Primeira", true);
		Account second = account("Segunda", true);

		rename(first.cookie(), "Primeira Renomeada").andExpect(status().isOk());

		this.mvc.perform(get("/api/me").cookie(second.cookie()))
				.andExpect(jsonPath("$.name").value("Segunda"));
		assertThat(this.users.findByEmail(second.email()).orElseThrow().getName()).isEqualTo("Segunda");
	}

	@Test
	void ignoresAnIdentityAndAnEmailSentInTheBody() throws Exception {
		Account first = account("Primeira", true);
		Account second = account("Segunda", true);
		UUID secondId = this.users.findByEmail(second.email()).orElseThrow().getId();

		renameRaw(first.cookie(), "{\"name\":\"Nova\",\"id\":\"%s\",\"userId\":\"%s\",\"email\":\"%s\"}"
				.formatted(secondId, secondId, second.email()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value(first.email()));

		assertThat(this.users.findById(secondId).orElseThrow().getName()).isEqualTo("Segunda");
		assertThat(this.users.findByEmail(first.email()).orElseThrow().getName()).isEqualTo("Nova");
	}

	private ResultActions rename(Cookie cookie, String name) throws Exception {
		return renameRaw(cookie, "{\"name\":\"" + name + "\"}");
	}

	private ResultActions renameRaw(Cookie cookie, String json) throws Exception {
		return this.mvc.perform(patch("/api/account/profile")
				.cookie(cookie)
				.contentType(MediaType.APPLICATION_JSON)
				.content(json));
	}

	private Account account(String name, boolean verified) throws Exception {
		String email = UUID.randomUUID().toString().replace("-", "").substring(0, 12) + "@example.com";
		Cookie cookie = this.mvc.perform(post("/api/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"name":"%s","email":"%s","password":"%s"}""".formatted(name, email, PASSWORD)))
				.andExpect(status().isCreated())
				.andReturn()
				.getResponse()
				.getCookie(SessionCookie.NAME);
		if (verified) {
			EmailVerification.verify(this.users, email);
		}
		return new Account(email, cookie);
	}

	private record Account(String email, Cookie cookie) {

	}

}
