package dev.l2.api.travel;

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

import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@AutoConfigureMockMvc
@SpringBootTest(properties = "app.rate-limit.enabled=false")
class TravelApiTests {

	private static final String CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
			+ "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

	@Autowired
	private MockMvc mvc;

	private Cookie session() throws Exception {
		String email = "u" + unique() + "@example.com";
		return this.mvc.perform(post("/api/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"name":"Ana","email":"%s","password":"senha-bem-grande"}""".formatted(email)))
				.andExpect(status().isCreated())
				.andReturn()
				.getResponse()
				.getCookie(SessionCookie.NAME);
	}

	private static String unique() {
		return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
	}

	private String link(Cookie session, String extraFields) throws Exception {
		String code = "c" + unique();
		this.mvc.perform(post("/api/links")
				.cookie(session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"targetUrl":"example.com/destino","alias":"%s","title":"Campanha"%s}"""
						.formatted(code, extraFields)))
				.andExpect(status().isCreated());
		return code;
	}

	@Test
	void travelsWithoutSessionAndAnswersTheDestination() throws Exception {
		String code = link(session(), "");

		this.mvc.perform(get("/api/travel/" + code).header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.targetUrl").value("https://example.com/destino"))
				.andExpect(jsonPath("$.title").value("Campanha"))
				.andExpect(jsonPath("$.travelCount").value(1));
	}

	@Test
	void countsEachTravel() throws Exception {
		String code = link(session(), "");

		this.mvc.perform(get("/api/travel/" + code).header(HttpHeaders.USER_AGENT, CHROME));
		this.mvc.perform(get("/api/travel/" + code).header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(jsonPath("$.travelCount").value(2));
	}

	@Test
	void showsTheTravelCountInTheOwnersLink() throws Exception {
		Cookie session = session();
		String code = link(session, "");

		this.mvc.perform(get("/api/travel/" + code).header(HttpHeaders.USER_AGENT, CHROME));

		this.mvc.perform(get("/api/links/" + code).cookie(session))
				.andExpect(jsonPath("$.travelCount").value(1));
	}

	@Test
	void redirectsWithoutLettingAnyoneCacheIt() throws Exception {
		String code = link(session(), "");

		this.mvc.perform(get("/r/" + code).header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(status().isFound())
				.andExpect(header().string(HttpHeaders.LOCATION, "https://example.com/destino"))
				.andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")));
	}

	@Test
	void doesNotLeakTheShortCodeToTheDestination() throws Exception {
		String code = link(session(), "");

		this.mvc.perform(get("/r/" + code).header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(status().isFound())
				.andExpect(header().string("Referrer-Policy", "no-referrer"));
	}

	@Test
	void countsTheTravelOnTheDirectRedirectToo() throws Exception {
		Cookie session = session();
		String code = link(session, "");

		this.mvc.perform(get("/r/" + code).header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(status().isFound());

		this.mvc.perform(get("/api/links/" + code).cookie(session))
				.andExpect(jsonPath("$.travelCount").value(1));
	}

	@Test
	void travelsEvenWithoutAUserAgent() throws Exception {
		String code = link(session(), "");

		this.mvc.perform(get("/api/travel/" + code))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.travelCount").value(1));
	}

	@Test
	void answers404ForACodeThatDoesNotExist() throws Exception {
		this.mvc.perform(get("/api/travel/c" + unique()))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("LINK_NOT_FOUND"));
		this.mvc.perform(get("/r/c" + unique()))
				.andExpect(status().isNotFound());
	}

	@Test
	void answers423ForAPausedLink() throws Exception {
		Cookie session = session();
		String code = link(session, "");
		this.mvc.perform(patch("/api/links/" + code)
				.cookie(session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"paused":true}"""))
				.andExpect(status().isOk());

		this.mvc.perform(get("/api/travel/" + code).header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(status().isLocked())
				.andExpect(jsonPath("$.code").value("PAUSED"));
		this.mvc.perform(get("/r/" + code).header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(status().isLocked());
	}

	@Test
	void answers410ForAClosedLink() throws Exception {
		Cookie session = session();
		String code = link(session, "");
		this.mvc.perform(delete("/api/links/" + code).cookie(session)).andExpect(status().isNoContent());

		this.mvc.perform(get("/api/travel/" + code).header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(status().isGone())
				.andExpect(jsonPath("$.code").value("CLOSED"));
		this.mvc.perform(get("/r/" + code).header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(status().isGone());
	}

	@Test
	void answers410WhenTheLinkRanOutOfTravels() throws Exception {
		String code = link(session(), ",\"maxTravels\":1");

		this.mvc.perform(get("/api/travel/" + code).header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(status().isOk());

		this.mvc.perform(get("/api/travel/" + code).header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(status().isGone())
				.andExpect(jsonPath("$.code").value("CLOSED"));
	}

	@Test
	void doesNotCountTheRefusedTravel() throws Exception {
		Cookie session = session();
		String code = link(session, "");
		this.mvc.perform(patch("/api/links/" + code)
				.cookie(session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"paused":true}"""))
				.andExpect(status().isOk());

		this.mvc.perform(get("/api/travel/" + code).header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(status().isLocked());

		this.mvc.perform(get("/api/links/" + code).cookie(session))
				.andExpect(jsonPath("$.travelCount").value(0));
	}

	@Test
	void travelsAgainAfterTheOwnerResumesTheLink() throws Exception {
		Cookie session = session();
		String code = link(session, "");
		this.mvc.perform(patch("/api/links/" + code)
				.cookie(session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"paused":true}"""));
		this.mvc.perform(get("/api/travel/" + code)).andExpect(status().isLocked());

		this.mvc.perform(patch("/api/links/" + code)
				.cookie(session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"paused":false}"""));

		this.mvc.perform(get("/api/travel/" + code).header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.travelCount").value(1));
	}

	@Test
	void neverExposesTheOwnerOnThePublicRoute() throws Exception {
		String code = link(session(), "");

		this.mvc.perform(get("/api/travel/" + code).header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(jsonPath("$.owner").doesNotExist())
				.andExpect(jsonPath("$.ownerId").doesNotExist())
				.andExpect(jsonPath("$.code").doesNotExist());
	}

}
