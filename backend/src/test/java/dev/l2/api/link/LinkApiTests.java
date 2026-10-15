package dev.l2.api.link;

import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.auth.SessionCookie;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@AutoConfigureMockMvc
@SpringBootTest
class LinkApiTests {

	@Autowired
	private MockMvc mvc;

	private Cookie session() throws Exception {
		String email = "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 12) + "@example.com";
		return this.mvc.perform(post("/api/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"name":"Ana","email":"%s","password":"senha-bem-grande"}""".formatted(email)))
				.andExpect(status().isCreated())
				.andReturn()
				.getResponse()
				.getCookie(SessionCookie.NAME);
	}

	private static String code() {
		return "c" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
	}

	private ResultActions create(Cookie session, String body) throws Exception {
		return this.mvc.perform(post("/api/links")
				.cookie(session)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body));
	}

	private String createLink(Cookie session, String alias) throws Exception {
		create(session, """
				{"targetUrl":"example.com/campanha","alias":"%s"}""".formatted(alias))
				.andExpect(status().isCreated());
		return alias;
	}

	@Test
	void createsAndAnswersTheShortUrl() throws Exception {
		String alias = code();

		create(session(), """
				{"targetUrl":"facebook.com","alias":"%s","title":"Campanha Nebulosa","maxTravels":10}"""
				.formatted(alias))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.code").value(alias))
				.andExpect(jsonPath("$.shortUrl").value("http://localhost:8080/" + alias))
				.andExpect(jsonPath("$.targetUrl").value("https://facebook.com"))
				.andExpect(jsonPath("$.title").value("Campanha Nebulosa"))
				.andExpect(jsonPath("$.state").value("ACTIVE"))
				.andExpect(jsonPath("$.travelCount").value(0))
				.andExpect(jsonPath("$.maxTravels").value(10))
				.andExpect(jsonPath("$.createdAt").isNotEmpty());
	}

	@Test
	void generatesACodeWhenNoAliasIsGiven() throws Exception {
		create(session(), """
				{"targetUrl":"example.com"}""")
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.code").isNotEmpty());
	}

	@Test
	void refusesToCreateWithoutSession() throws Exception {
		this.mvc.perform(post("/api/links")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"targetUrl":"example.com"}"""))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void refusesATargetOutsideHttp() throws Exception {
		create(session(), """
				{"targetUrl":"javascript:alert(document.cookie)"}""")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_URL"));
	}

	@Test
	void refusesALinkToOurselves() throws Exception {
		create(session(), """
				{"targetUrl":"http://localhost:8080/outro"}""")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("SELF_LOOP"));
	}

	@Test
	void refusesAReservedAlias() throws Exception {
		create(session(), """
				{"targetUrl":"example.com","alias":"api"}""")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("RESERVED_ALIAS"));
	}

	@Test
	void refusesAnAliasAlreadyTaken() throws Exception {
		String alias = createLink(session(), code());

		create(session(), """
				{"targetUrl":"example.com","alias":"%s"}""".formatted(alias))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("ALIAS_TAKEN"));
	}

	@Test
	void refusesABodyWithoutTarget() throws Exception {
		create(session(), "{}")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void refusesAnAliasOutsideTheContractPattern() throws Exception {
		create(session(), """
				{"targetUrl":"example.com","alias":"nao_vale"}""")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void listsOnlyTheLinksOfTheLoggedUser() throws Exception {
		Cookie ana = session();
		String fromAna = createLink(ana, code());
		String fromBruno = createLink(session(), code());

		this.mvc.perform(get("/api/links").cookie(ana))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalItems").value(1))
				.andExpect(jsonPath("$.page").value(0))
				.andExpect(jsonPath("$.items[0].code").value(fromAna))
				.andExpect(jsonPath("$.items[?(@.code == '" + fromBruno + "')]").isEmpty());
	}

	@Test
	void listsFilteringByState() throws Exception {
		Cookie session = session();
		String active = createLink(session, code());
		String paused = createLink(session, code());
		String closed = createLink(session, code());
		this.mvc.perform(patch("/api/links/" + paused)
				.cookie(session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"paused":true}"""))
				.andExpect(status().isOk());
		this.mvc.perform(delete("/api/links/" + closed).cookie(session)).andExpect(status().isNoContent());

		this.mvc.perform(get("/api/links").param("state", "ACTIVE").cookie(session))
				.andExpect(jsonPath("$.totalItems").value(1))
				.andExpect(jsonPath("$.items[0].code").value(active));
		this.mvc.perform(get("/api/links").param("state", "PAUSED").cookie(session))
				.andExpect(jsonPath("$.totalItems").value(1))
				.andExpect(jsonPath("$.items[0].code").value(paused));
		this.mvc.perform(get("/api/links").param("state", "CLOSED").cookie(session))
				.andExpect(jsonPath("$.totalItems").value(1))
				.andExpect(jsonPath("$.items[0].code").value(closed));
		this.mvc.perform(get("/api/links").cookie(session))
				.andExpect(jsonPath("$.totalItems").value(3));
	}

	@Test
	void refusesAnUnknownState() throws Exception {
		this.mvc.perform(get("/api/links").param("state", "SUMIDO").cookie(session()))
				.andExpect(status().isBadRequest());
	}

	@Test
	void paginatesKeepingTheTotal() throws Exception {
		Cookie session = session();
		createLink(session, code());
		createLink(session, code());
		createLink(session, code());

		this.mvc.perform(get("/api/links").param("size", "2").cookie(session))
				.andExpect(jsonPath("$.items.length()").value(2))
				.andExpect(jsonPath("$.totalItems").value(3))
				.andExpect(jsonPath("$.page").value(0));
		this.mvc.perform(get("/api/links").param("size", "2").param("page", "1").cookie(session))
				.andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.page").value(1));
	}

	@Test
	void answersTheDetailOfOwnLink() throws Exception {
		Cookie session = session();
		String alias = createLink(session, code());

		this.mvc.perform(get("/api/links/" + alias).cookie(session))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.code").value(alias))
				.andExpect(jsonPath("$.targetUrl").value("https://example.com/campanha"));
	}

	@Test
	void answers404ForACodeThatDoesNotExist() throws Exception {
		this.mvc.perform(get("/api/links/" + code()).cookie(session()))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("LINK_NOT_FOUND"));
	}

	@Test
	void pausesAndResumes() throws Exception {
		Cookie session = session();
		String alias = createLink(session, code());

		this.mvc.perform(patch("/api/links/" + alias)
				.cookie(session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"paused":true}"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.state").value("PAUSED"));

		this.mvc.perform(patch("/api/links/" + alias)
				.cookie(session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"paused":false}"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.state").value("ACTIVE"));
	}

	@Test
	void changesOnlyWhatWasSentAndClearsOnExplicitNull() throws Exception {
		Cookie session = session();
		String alias = code();
		create(session, """
				{"targetUrl":"example.com/antes","alias":"%s","title":"Antes",
				"expiresAt":"2026-12-31T23:59:00Z","maxTravels":7}""".formatted(alias))
				.andExpect(status().isCreated());

		this.mvc.perform(patch("/api/links/" + alias)
				.cookie(session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"targetUrl":"example.com/depois"}"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.targetUrl").value("https://example.com/depois"))
				.andExpect(jsonPath("$.title").value("Antes"))
				.andExpect(jsonPath("$.expiresAt").isNotEmpty())
				.andExpect(jsonPath("$.maxTravels").value(7));

		this.mvc.perform(patch("/api/links/" + alias)
				.cookie(session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"expiresAt":null,"maxTravels":null}"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.expiresAt").doesNotExist())
				.andExpect(jsonPath("$.maxTravels").doesNotExist())
				.andExpect(jsonPath("$.title").value("Antes"));
	}

	@Test
	void refusesAnInvalidTargetOnPatchKeepingTheOldOne() throws Exception {
		Cookie session = session();
		String alias = createLink(session, code());

		this.mvc.perform(patch("/api/links/" + alias)
				.cookie(session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"targetUrl":"javascript:alert(1)"}"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_URL"));

		this.mvc.perform(get("/api/links/" + alias).cookie(session))
				.andExpect(jsonPath("$.targetUrl").value("https://example.com/campanha"));
	}

	@Test
	void closesWithSoftDeleteAndIsIdempotent() throws Exception {
		Cookie session = session();
		String alias = createLink(session, code());

		this.mvc.perform(delete("/api/links/" + alias).cookie(session)).andExpect(status().isNoContent());
		this.mvc.perform(delete("/api/links/" + alias).cookie(session)).andExpect(status().isNoContent());

		this.mvc.perform(get("/api/links/" + alias).cookie(session))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.state").value("CLOSED"));
	}

	@Test
	void answers404AndNotForbiddenOnAnotherOwnersLink() throws Exception {
		String fromAna = createLink(session(), code());
		Cookie bruno = session();

		this.mvc.perform(get("/api/links/" + fromAna).cookie(bruno))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("LINK_NOT_FOUND"));
		this.mvc.perform(patch("/api/links/" + fromAna)
				.cookie(bruno)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"paused":true}"""))
				.andExpect(status().isNotFound());
		this.mvc.perform(delete("/api/links/" + fromAna).cookie(bruno))
				.andExpect(status().isNotFound());
	}

	@Test
	void anotherOwnerCannotChangeTheLinkEvenTryingEveryVerb() throws Exception {
		Cookie ana = session();
		String fromAna = createLink(ana, code());

		this.mvc.perform(patch("/api/links/" + fromAna)
				.cookie(session())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"targetUrl":"evil.com","paused":true}"""))
				.andExpect(status().isNotFound());

		this.mvc.perform(get("/api/links/" + fromAna).cookie(ana))
				.andExpect(jsonPath("$.targetUrl").value("https://example.com/campanha"))
				.andExpect(jsonPath("$.state").value("ACTIVE"));
	}

}
