package dev.l2.api;

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

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * O caminho critico do produto atravessando os quatro modulos numa unica linha
 * do tempo: criar o Link, viajar, pausar, ter a Viagem bloqueada e ver a Ameaca
 * contada. Os testes de cada modulo garantem o status de cada rota isolada;
 * aqui a pergunta e outra -- depois da jornada, Link, Numeros do Link, Visao
 * geral e Protecao contam a mesma historia, e nada disso vaza para outro dono.
 */
@Import(TestcontainersConfiguration.class)
@AutoConfigureMockMvc
@SpringBootTest(properties = "app.rate-limit.enabled=false")
class CriticalFlowTests {

	private static final String CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
			+ "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

	/** Ultimo ponto das series de 12 dias (janela padrao): hoje, em UTC. */
	private static final String TODAY = "$[11]";

	@Autowired
	private MockMvc mvc;

	private final LocalDate today = LocalDate.now(ZoneOffset.UTC);

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

	private String createLink(Cookie session) throws Exception {
		String code = "c" + unique();
		this.mvc.perform(post("/api/links")
				.cookie(session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"targetUrl":"example.com/destino","alias":"%s","title":"Campanha"}""".formatted(code)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.state").value("ACTIVE"))
				.andExpect(jsonPath("$.travelCount").value(0));
		return code;
	}

	private void pause(Cookie session, String code, boolean paused) throws Exception {
		this.mvc.perform(patch("/api/links/" + code)
				.cookie(session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"paused":%s}""".formatted(paused)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.state").value(paused ? "PAUSED" : "ACTIVE"));
	}

	private void travel(String code) throws Exception {
		this.mvc.perform(get("/api/travel/" + code).header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(status().isOk());
	}

	private void blockedTravel(String code) throws Exception {
		this.mvc.perform(get("/api/travel/" + code).header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(status().isLocked())
				.andExpect(jsonPath("$.code").value("PAUSED"));
	}

	@Test
	void theOwnersJourneyAddsUpAcrossEveryModule() throws Exception {
		Cookie ana = session();
		String code = createLink(ana);

		travel(code);
		this.mvc.perform(get("/r/" + code).header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(status().isFound());
		pause(ana, code, true);
		blockedTravel(code);

		this.mvc.perform(get("/api/links/" + code).cookie(ana))
				.andExpect(jsonPath("$.state").value("PAUSED"))
				.andExpect(jsonPath("$.travelCount").value(2));

		this.mvc.perform(get("/api/links/" + code + "/stats").cookie(ana))
				.andExpect(jsonPath("$.totalTravels").value(2))
				.andExpect(jsonPath("$.humanTravels").value(2))
				.andExpect(jsonPath("$.botTravels").value(0))
				.andExpect(jsonPath("$.travelsByDay[11].date").value(this.today.toString()))
				.andExpect(jsonPath("$.travelsByDay[11].travels").value(2));

		this.mvc.perform(get("/api/dashboard/summary").cookie(ana))
				.andExpect(jsonPath("$.activeLinks").value(0))
				.andExpect(jsonPath("$.totalTravels").value(2))
				.andExpect(jsonPath("$.blockedThreats").value(1));
		this.mvc.perform(get("/api/dashboard/travels").cookie(ana))
				.andExpect(jsonPath(TODAY + ".travels").value(2));
		this.mvc.perform(get("/api/dashboard/top-links").cookie(ana))
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].code").value(code))
				.andExpect(jsonPath("$[0].title").value("Campanha"))
				.andExpect(jsonPath("$[0].travels").value(2));

		this.mvc.perform(get("/api/protection/summary").cookie(ana))
				.andExpect(jsonPath("$.blockedThreats").value(1))
				.andExpect(jsonPath("$.byReason.PAUSED").value(1))
				.andExpect(jsonPath("$.verifiedDestinations").value(1));
		this.mvc.perform(get("/api/protection/events").cookie(ana))
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].reason").value("PAUSED"))
				.andExpect(jsonPath("$[0].code").value(code));
	}

	@Test
	void resumingPutsTheLinkBackWithoutErasingTheBlockedThreat() throws Exception {
		Cookie ana = session();
		String code = createLink(ana);
		travel(code);
		pause(ana, code, true);
		blockedTravel(code);

		pause(ana, code, false);
		travel(code);

		this.mvc.perform(get("/api/links/" + code).cookie(ana))
				.andExpect(jsonPath("$.state").value("ACTIVE"))
				.andExpect(jsonPath("$.travelCount").value(2));
		this.mvc.perform(get("/api/dashboard/summary").cookie(ana))
				.andExpect(jsonPath("$.activeLinks").value(1))
				.andExpect(jsonPath("$.totalTravels").value(2))
				.andExpect(jsonPath("$.blockedThreats").value(1));
		this.mvc.perform(get("/api/protection/events").cookie(ana))
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].reason").value("PAUSED"));
	}

	@Test
	void aStrangerNeitherReachesTheLinkNorItsNumbers() throws Exception {
		Cookie ana = session();
		String code = createLink(ana);
		travel(code);
		pause(ana, code, true);
		blockedTravel(code);

		Cookie bruno = session();

		this.mvc.perform(get("/api/links/" + code).cookie(bruno))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("LINK_NOT_FOUND"));
		this.mvc.perform(get("/api/links/" + code + "/stats").cookie(bruno))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("LINK_NOT_FOUND"));
		this.mvc.perform(patch("/api/links/" + code)
				.cookie(bruno)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"targetUrl":"evil.com","paused":false}"""))
				.andExpect(status().isNotFound());
		this.mvc.perform(delete("/api/links/" + code).cookie(bruno))
				.andExpect(status().isNotFound());
		this.mvc.perform(get("/api/links").cookie(bruno))
				.andExpect(jsonPath("$.totalItems").value(0));

		this.mvc.perform(get("/api/dashboard/summary").cookie(bruno))
				.andExpect(jsonPath("$.activeLinks").value(0))
				.andExpect(jsonPath("$.totalTravels").value(0))
				.andExpect(jsonPath("$.blockedThreats").value(0));
		this.mvc.perform(get("/api/dashboard/top-links").cookie(bruno))
				.andExpect(jsonPath("$", hasSize(0)));
		this.mvc.perform(get("/api/protection/summary").cookie(bruno))
				.andExpect(jsonPath("$.blockedThreats").value(0))
				.andExpect(jsonPath("$.verifiedDestinations").value(0));
		this.mvc.perform(get("/api/protection/events").cookie(bruno))
				.andExpect(jsonPath("$", hasSize(0)));

		this.mvc.perform(get("/api/links/" + code).cookie(ana))
				.andExpect(jsonPath("$.state").value("PAUSED"))
				.andExpect(jsonPath("$.targetUrl").value("https://example.com/destino"))
				.andExpect(jsonPath("$.travelCount").value(1));
	}

	/**
	 * A Viagem recusada e uma Ameaca do dono do Link, nao de quem tentou viajar:
	 * o evento entra na Protecao da Ana mesmo quando a tentativa vem do Bruno.
	 */
	@Test
	void theBlockedTravelOfAVisitorCountsForTheOwner() throws Exception {
		Cookie ana = session();
		String code = createLink(ana);
		pause(ana, code, true);
		blockedTravel(code);

		Cookie bruno = session();
		this.mvc.perform(get("/api/travel/" + code)
				.cookie(bruno)
				.header(HttpHeaders.USER_AGENT, CHROME))
				.andExpect(status().isLocked())
				.andExpect(jsonPath("$.code").value("PAUSED"));

		this.mvc.perform(get("/api/protection/summary").cookie(ana))
				.andExpect(jsonPath("$.byReason.PAUSED").value(2))
				.andExpect(jsonPath("$.blockedThreats").value(2));
		this.mvc.perform(get("/api/protection/summary").cookie(bruno))
				.andExpect(jsonPath("$.blockedThreats").value(0));
	}

}
