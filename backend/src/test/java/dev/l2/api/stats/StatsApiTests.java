package dev.l2.api.stats;

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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@AutoConfigureMockMvc
@SpringBootTest(properties = "app.rate-limit.enabled=false")
class StatsApiTests {

    private static final String CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            + "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

    private static final String CURL = "curl/8.5.0";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

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

    private String link(Cookie session, String title) throws Exception {
        String code = "c" + unique();
        this.mvc.perform(post("/api/links")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"targetUrl":"example.com/destino","alias":"%s","title":"%s"}""".formatted(code, title)))
                .andExpect(status().isCreated());
        return code;
    }

    private void travel(String code, String userAgent) throws Exception {
        this.mvc.perform(get("/api/travel/" + code).header(HttpHeaders.USER_AGENT, userAgent))
                .andExpect(status().isOk());
    }

    /**
     * Grava uma Viagem com data e pais escolhidos (a rota publica nao deixa) e soma
     * no contador do Link.
     */
    private void seed(String code, int daysAgo, boolean bot, String country) {
        Instant at = this.today.minusDays(daysAgo).atTime(12, 0).toInstant(ZoneOffset.UTC);
        UUID linkId = this.jdbc.queryForObject("select id from links where code = ?", UUID.class, code);
        this.jdbc.update("""
                insert into travels (id, link_id, occurred_at, bot, country)
                values (gen_random_uuid(), ?, ?, ?, ?)
                """, linkId, Timestamp.from(at), bot, country);
        this.jdbc.update("update links set travel_count = travel_count + 1 where id = ?", linkId);
    }

    // ---------- GET /api/links/{code}/stats ----------

    @Test
    void separatesHumansFromRobots() throws Exception {
        Cookie session = session();
        String code = link(session, "Campanha");
        travel(code, CHROME);
        travel(code, CHROME);
        travel(code, CURL);

        this.mvc.perform(get("/api/links/" + code + "/stats").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.totalTravels").value(3))
                .andExpect(jsonPath("$.humanTravels").value(2))
                .andExpect(jsonPath("$.botTravels").value(1));
    }

    @Test
    void aLinkWithoutTravelsHasAFlatSeriesAndNoCountries() throws Exception {
        Cookie session = session();
        String code = link(session, "Vazio");

        this.mvc.perform(get("/api/links/" + code + "/stats").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTravels").value(0))
                .andExpect(jsonPath("$.humanTravels").value(0))
                .andExpect(jsonPath("$.botTravels").value(0))
                .andExpect(jsonPath("$.travelsByDay", hasSize(12)))
                .andExpect(jsonPath("$.travelsByDay[0].travels").value(0))
                .andExpect(jsonPath("$.countries", hasSize(0)));
    }

    @Test
    void groupsTravelsByDayAndByCountry() throws Exception {
        Cookie session = session();
        String code = link(session, "Mapa");
        seed(code, 0, false, "BR");
        seed(code, 0, true, "BR");
        seed(code, 2, false, "US");
        seed(code, 20, false, "BR");

        this.mvc.perform(get("/api/links/" + code + "/stats").param("days", "5").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTravels").value(4))
                .andExpect(jsonPath("$.humanTravels").value(3))
                .andExpect(jsonPath("$.botTravels").value(1))
                .andExpect(jsonPath("$.travelsByDay", hasSize(5)))
                .andExpect(jsonPath("$.travelsByDay[4].date").value(this.today.toString()))
                .andExpect(jsonPath("$.travelsByDay[4].travels").value(2))
                .andExpect(jsonPath("$.travelsByDay[3].travels").value(0))
                .andExpect(jsonPath("$.travelsByDay[2].travels").value(1))
                .andExpect(jsonPath("$.travelsByDay[0].travels").value(0))
                .andExpect(jsonPath("$.countries", hasSize(2)))
                .andExpect(jsonPath("$.countries[0].country").value("BR"))
                .andExpect(jsonPath("$.countries[0].travels").value(3))
                .andExpect(jsonPath("$.countries[1].country").value("US"))
                .andExpect(jsonPath("$.countries[1].travels").value(1));
    }

    @Test
    void limitsTheWindowOfTheSeries() throws Exception {
        Cookie session = session();
        String code = link(session, "Janela");

        this.mvc.perform(get("/api/links/" + code + "/stats").param("days", "1000").cookie(session))
                .andExpect(jsonPath("$.travelsByDay", hasSize(90)));
        this.mvc.perform(get("/api/links/" + code + "/stats").param("days", "0").cookie(session))
                .andExpect(jsonPath("$.travelsByDay", hasSize(1)));
        this.mvc.perform(get("/api/links/" + code + "/stats").param("days", "abc").cookie(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void keepsTheStatsOfAClosedLink() throws Exception {
        Cookie session = session();
        String code = link(session, "Historico");
        travel(code, CHROME);
        this.mvc.perform(delete("/api/links/" + code).cookie(session)).andExpect(status().isNoContent());

        this.mvc.perform(get("/api/links/" + code + "/stats").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTravels").value(1));
    }

    @Test
    void answers404ForALinkOfAnotherUserAndForOneThatDoesNotExist() throws Exception {
        String code = link(session(), "Do outro");
        Cookie stranger = session();

        this.mvc.perform(get("/api/links/" + code + "/stats").cookie(stranger))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("LINK_NOT_FOUND"));
        this.mvc.perform(get("/api/links/c" + unique() + "/stats").cookie(stranger))
                .andExpect(status().isNotFound());
    }

    @Test
    void requiresASession() throws Exception {
        this.mvc.perform(get("/api/links/qualquer/stats")).andExpect(status().isUnauthorized());
        this.mvc.perform(get("/api/dashboard/summary")).andExpect(status().isUnauthorized());
        this.mvc.perform(get("/api/dashboard/travels")).andExpect(status().isUnauthorized());
        this.mvc.perform(get("/api/dashboard/top-links")).andExpect(status().isUnauthorized());
        this.mvc.perform(get("/api/dashboard/countries")).andExpect(status().isUnauthorized());
    }

    // ---------- GET /api/dashboard/** ----------

    @Test
    void summarizesTheOwnersLinks() throws Exception {
        Cookie session = session();
        String active = link(session, "Ativo");
        String paused = link(session, "Pausado");
        String closed = link(session, "Fechado");
        this.mvc.perform(patch("/api/links/" + paused)
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"paused":true}"""))
                .andExpect(status().isOk());
        this.mvc.perform(delete("/api/links/" + closed).cookie(session)).andExpect(status().isNoContent());
        seed(active, 0, false, "BR");
        seed(active, 1, false, "BR");
        seed(closed, 2, false, "US");

        this.mvc.perform(get("/api/dashboard/summary").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeLinks").value(1))
                .andExpect(jsonPath("$.totalTravels").value(3))
                .andExpect(jsonPath("$.blockedThreats").value(0));
    }

    @Test
    void comparesTheWindowWithThePreviousOne() throws Exception {
        Cookie session = session();
        String code = link(session, "Variacao");
        seed(code, 0, false, "BR");
        seed(code, 1, false, "BR");
        seed(code, 2, false, "BR");
        seed(code, 15, false, "BR");
        seed(code, 16, false, "BR");

        // janela atual (12 dias): 3 Viagens; janela anterior (dias 13 a 24): 2 Viagens
        this.mvc.perform(get("/api/dashboard/summary").cookie(session))
                .andExpect(jsonPath("$.totalTravels").value(5))
                .andExpect(jsonPath("$.travelsChangePct").value(50.0));
    }

    @Test
    void hasNoPercentageWhenThereWasNothingBefore() throws Exception {
        Cookie session = session();
        String code = link(session, "Novo");
        seed(code, 0, false, "BR");

        this.mvc.perform(get("/api/dashboard/summary").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.travelsChangePct").value(nullValue()));
    }

    @Test
    void countsTheThreatsBlockedForTheOwner() throws Exception {
        Cookie session = session();
        String code = link(session, "Pausado");
        this.mvc.perform(patch("/api/links/" + code)
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"paused":true}"""))
                .andExpect(status().isOk());
        this.mvc.perform(get("/api/travel/" + code).header(HttpHeaders.USER_AGENT, CHROME))
                .andExpect(status().isLocked());

        this.mvc.perform(get("/api/dashboard/summary").cookie(session))
                .andExpect(jsonPath("$.blockedThreats").value(1));
    }

    @Test
    void returnsOnePointPerDayOfTheTravelFlow() throws Exception {
        Cookie session = session();
        String first = link(session, "Um");
        String second = link(session, "Dois");
        seed(first, 0, false, "BR");
        seed(second, 0, true, "US");
        seed(first, 3, false, "BR");

        this.mvc.perform(get("/api/dashboard/travels").param("days", "5").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(5)))
                .andExpect(jsonPath("$[4].date").value(this.today.toString()))
                .andExpect(jsonPath("$[4].travels").value(2))
                .andExpect(jsonPath("$[1].travels").value(1))
                .andExpect(jsonPath("$[0].travels").value(0));
        this.mvc.perform(get("/api/dashboard/travels").cookie(session))
                .andExpect(jsonPath("$", hasSize(12)));
    }

    @Test
    void ranksTheLinksWithTheMostTravels() throws Exception {
        Cookie session = session();
        String bronze = link(session, "Bronze");
        String gold = link(session, "Ouro");
        String silver = link(session, "Prata");
        link(session, "Sem viagens");
        seed(bronze, 0, false, "BR");
        for (int i = 0; i < 3; i++) {
            seed(gold, i, false, "BR");
        }
        seed(silver, 0, false, "BR");
        seed(silver, 1, false, "BR");

        this.mvc.perform(get("/api/dashboard/top-links").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].code").value(gold))
                .andExpect(jsonPath("$[0].title").value("Ouro"))
                .andExpect(jsonPath("$[0].travels").value(3))
                .andExpect(jsonPath("$[1].code").value(silver))
                .andExpect(jsonPath("$[2].code").value(bronze));
        this.mvc.perform(get("/api/dashboard/top-links").param("limit", "1").cookie(session))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].code").value(gold));
    }

    @Test
    void sumsTheCountriesOfAllTheOwnersLinks() throws Exception {
        Cookie session = session();
        String first = link(session, "Um");
        String second = link(session, "Dois");
        seed(first, 0, false, "BR");
        seed(first, 1, false, "BR");
        seed(second, 0, false, "BR");
        seed(second, 0, false, "US");
        seed(second, 0, false, null);

        this.mvc.perform(get("/api/dashboard/countries").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].country").value("BR"))
                .andExpect(jsonPath("$[0].travels").value(3))
                .andExpect(jsonPath("$[1].country").value("US"))
                .andExpect(jsonPath("$[1].travels").value(1));
    }

    @Test
    void neverMixesTheNumbersOfDifferentUsers() throws Exception {
        Cookie ana = session();
        String code = link(ana, "Da Ana");
        seed(code, 0, false, "BR");
        Cookie bruno = session();

        this.mvc.perform(get("/api/dashboard/summary").cookie(bruno))
                .andExpect(jsonPath("$.activeLinks").value(0))
                .andExpect(jsonPath("$.totalTravels").value(0))
                .andExpect(jsonPath("$.travelsChangePct").value(nullValue()));
        this.mvc.perform(get("/api/dashboard/top-links").cookie(bruno)).andExpect(jsonPath("$", hasSize(0)));
        this.mvc.perform(get("/api/dashboard/countries").cookie(bruno)).andExpect(jsonPath("$", hasSize(0)));
        this.mvc.perform(get("/api/dashboard/travels").cookie(bruno))
                .andExpect(jsonPath("$[11].travels").value(0));
    }

}
