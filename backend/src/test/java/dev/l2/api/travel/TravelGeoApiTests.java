package dev.l2.api.travel;

import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.EmailVerification;
import dev.l2.api.auth.SessionCookie;
import dev.l2.api.user.UserRepository;
import dev.l2.api.geo.GeoIpService;
import jakarta.persistence.EntityManager;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A Viagem grava so o pais do visitante. O GeoIP aqui e um stub (a base real
 * nao vai no Git): o
 * que se testa e o caminho IP do socket -> GeoIpService -> travels.country ->
 * stats.
 */
@Import({ TestcontainersConfiguration.class, TravelGeoApiTests.StubGeoIp.class })
@AutoConfigureMockMvc
@SpringBootTest
class TravelGeoApiTests {

    @Autowired
    private UserRepository users;

    private static final String BRAZILIAN_VISITOR = "203.0.113.9";

    private static final String CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            + "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

    @TestConfiguration(proxyBeanMethods = false)
    static class StubGeoIp {

        @Bean
        @Primary
        GeoIpService stubGeoIp() {
            return ip -> BRAZILIAN_VISITOR.equals(ip) ? Optional.of("BR") : Optional.empty();
        }

    }

    @Autowired
    private MockMvc mvc;

    @Autowired
    private EntityManager entityManager;

    private Cookie session() throws Exception {
        String email = "u" + unique() + "@example.com";
        Cookie cookie = this.mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name":"Ana","email":"%s","password":"senha-bem-grande"}""".formatted(email)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getCookie(SessionCookie.NAME);
        EmailVerification.verify(this.users, email);
        return cookie;
    }

    private static String unique() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private String link(Cookie session) throws Exception {
        String code = "c" + unique();
        this.mvc.perform(post("/api/links")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"targetUrl":"example.com/destino","alias":"%s"}""".formatted(code)))
                .andExpect(status().isCreated());
        return code;
    }

    private void travelFrom(String code, String remoteAddress) throws Exception {
        this.mvc.perform(get("/api/travel/" + code)
                .header(HttpHeaders.USER_AGENT, CHROME)
                .with(request -> {
                    request.setRemoteAddr(remoteAddress);
                    return request;
                }))
                .andExpect(status().isOk());
    }

    private void redirectFrom(String code, String remoteAddress) throws Exception {
        this.mvc.perform(get("/r/" + code)
                .header(HttpHeaders.USER_AGENT, CHROME)
                .with(request -> {
                    request.setRemoteAddr(remoteAddress);
                    return request;
                }))
                .andExpect(status().isFound());
    }

    @Test
    void savesTheCountryOfTheVisitorOnTheTravel() throws Exception {
        Cookie session = session();
        String code = link(session);

        travelFrom(code, BRAZILIAN_VISITOR);

        this.mvc.perform(get("/api/links/" + code + "/stats").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTravels").value(1))
                .andExpect(jsonPath("$.countries", hasSize(1)))
                .andExpect(jsonPath("$.countries[0].country").value("BR"))
                .andExpect(jsonPath("$.countries[0].travels").value(1));
    }

    @Test
    void alsoLooksUpTheCountryOnTheDirectRedirect() throws Exception {
        Cookie session = session();
        String code = link(session);

        redirectFrom(code, BRAZILIAN_VISITOR);

        this.mvc.perform(get("/api/links/" + code + "/stats").cookie(session))
                .andExpect(jsonPath("$.countries[0].country").value("BR"));
    }

    @Test
    void feedsTheDashboardCountries() throws Exception {
        Cookie session = session();
        String first = link(session);
        String second = link(session);

        travelFrom(first, BRAZILIAN_VISITOR);
        travelFrom(second, BRAZILIAN_VISITOR);

        this.mvc.perform(get("/api/dashboard/countries").cookie(session))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].country").value("BR"))
                .andExpect(jsonPath("$[0].travels").value(2));
    }

    @Test
    void keepsTheTravelWithoutCountryWhenTheIpIsNotKnown() throws Exception {
        Cookie session = session();
        String code = link(session);

        travelFrom(code, "198.51.100.7");
        travelFrom(code, "127.0.0.1");

        this.mvc.perform(get("/api/links/" + code + "/stats").cookie(session))
                .andExpect(jsonPath("$.totalTravels").value(2))
                .andExpect(jsonPath("$.countries", hasSize(0)));
    }

    @Test
    void theTravelsTableHasNoColumnThatCouldHoldAnIp() {
        @SuppressWarnings("unchecked")
        List<String> columns = this.entityManager
                .createNativeQuery("select column_name from information_schema.columns where table_name = 'travels'")
                .getResultList();

        assertThat(columns).isNotEmpty().contains("country");
        assertThat(columns).noneMatch(name -> name.matches("(?i).*(^|_)ip($|_).*|.*address.*|.*remote.*|.*client.*"));
    }

}
