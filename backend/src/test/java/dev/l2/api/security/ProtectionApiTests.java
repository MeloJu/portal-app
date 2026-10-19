package dev.l2.api.security;

import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.EmailVerification;
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

import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@AutoConfigureMockMvc
@SpringBootTest(properties = "app.rate-limit.enabled=false")
class ProtectionApiTests {

    @Autowired
    private UserRepository users;

    private static final String CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            + "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

    @Autowired
    private MockMvc mvc;

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

    private void createRefused(Cookie session, String targetUrl, String alias, String reason) throws Exception {
        this.mvc.perform(post("/api/links")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"targetUrl":"%s","alias":"%s"}""".formatted(targetUrl, alias)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(reason));
    }

    private String createLink(Cookie session) throws Exception {
        String code = "c" + unique();
        this.mvc.perform(post("/api/links")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"targetUrl":"example.com/destino","alias":"%s"}""".formatted(code)))
                .andExpect(status().isCreated());
        return code;
    }

    /**
     * Gera um evento de cada motivo que a API consegue provocar sozinha; devolve
     * [codigo pausado, codigo fechado].
     */
    private String[] provokeFiveBlocks(Cookie session, String invalidAlias, String loopAlias) throws Exception {
        createRefused(session, "example.com", "api", "RESERVED_ALIAS");
        createRefused(session, "javascript:alert(1)", invalidAlias, "INVALID_URL");
        createRefused(session, "localhost:8080/x", loopAlias, "SELF_LOOP");

        String paused = createLink(session);
        this.mvc.perform(patch("/api/links/" + paused)
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"paused":true}"""))
                .andExpect(status().isOk());
        this.mvc.perform(get("/api/travel/" + paused).header(HttpHeaders.USER_AGENT, CHROME))
                .andExpect(status().isLocked());

        String closed = createLink(session);
        this.mvc.perform(delete("/api/links/" + closed).cookie(session)).andExpect(status().isNoContent());
        this.mvc.perform(get("/api/travel/" + closed).header(HttpHeaders.USER_AGENT, CHROME))
                .andExpect(status().isGone());
        return new String[] { paused, closed };
    }

    @Test
    void summarizesTheBlockedThreatsByReason() throws Exception {
        Cookie session = session();
        provokeFiveBlocks(session, "x" + unique(), "y" + unique());

        this.mvc.perform(get("/api/protection/summary").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blockedThreats").value(5))
                .andExpect(jsonPath("$.byReason.RESERVED_ALIAS").value(1))
                .andExpect(jsonPath("$.byReason.INVALID_URL").value(1))
                .andExpect(jsonPath("$.byReason.SELF_LOOP").value(1))
                .andExpect(jsonPath("$.byReason.PAUSED").value(1))
                .andExpect(jsonPath("$.byReason.CLOSED").value(1))
                .andExpect(jsonPath("$.byReason.RATE_LIMIT").value(0));
    }

    @Test
    void countsEveryLinkOfTheOwnerAsAVerifiedDestination() throws Exception {
        Cookie session = session();
        provokeFiveBlocks(session, "x" + unique(), "y" + unique());

        // os 3 pedidos recusados nao criaram Link; os 2 aceitos (um depois pausado,
        // outro fechado) contam
        this.mvc.perform(get("/api/protection/summary").cookie(session))
                .andExpect(jsonPath("$.verifiedDestinations").value(2));
    }

    @Test
    void listsTheMostRecentEventsFirst() throws Exception {
        Cookie session = session();
        String invalidAlias = "x" + unique();
        String loopAlias = "y" + unique();
        String[] codes = provokeFiveBlocks(session, invalidAlias, loopAlias);

        this.mvc.perform(get("/api/protection/events").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(5)))
                .andExpect(jsonPath("$[0].reason").value("CLOSED"))
                .andExpect(jsonPath("$[0].code").value(codes[1]))
                .andExpect(jsonPath("$[0].occurredAt").isNotEmpty())
                .andExpect(jsonPath("$[1].reason").value("PAUSED"))
                .andExpect(jsonPath("$[1].code").value(codes[0]))
                .andExpect(jsonPath("$[2].reason").value("SELF_LOOP"))
                .andExpect(jsonPath("$[2].code").value(loopAlias))
                .andExpect(jsonPath("$[3].reason").value("INVALID_URL"))
                .andExpect(jsonPath("$[3].code").value(invalidAlias))
                .andExpect(jsonPath("$[4].reason").value("RESERVED_ALIAS"))
                .andExpect(jsonPath("$[4].code").value("api"));
    }

    @Test
    void limitsTheNumberOfEvents() throws Exception {
        Cookie session = session();
        provokeFiveBlocks(session, "x" + unique(), "y" + unique());

        this.mvc.perform(get("/api/protection/events").param("limit", "2").cookie(session))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].reason").value("CLOSED"));
        this.mvc.perform(get("/api/protection/events").param("limit", "0").cookie(session))
                .andExpect(jsonPath("$", hasSize(1)));
        this.mvc.perform(get("/api/protection/events").param("limit", "abc").cookie(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void aUserWithoutBlocksSeesZerosAndNoEvents() throws Exception {
        Cookie session = session();

        this.mvc.perform(get("/api/protection/summary").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blockedThreats").value(0))
                .andExpect(jsonPath("$.verifiedDestinations").value(0))
                .andExpect(jsonPath("$.byReason.INVALID_URL").value(0))
                .andExpect(jsonPath("$.byReason.CLOSED").value(0));
        this.mvc.perform(get("/api/protection/events").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void neverShowsTheEventsOfAnotherUser() throws Exception {
        provokeFiveBlocks(session(), "x" + unique(), "y" + unique());
        Cookie stranger = session();

        this.mvc.perform(get("/api/protection/summary").cookie(stranger))
                .andExpect(jsonPath("$.blockedThreats").value(0))
                .andExpect(jsonPath("$.verifiedDestinations").value(0));
        this.mvc.perform(get("/api/protection/events").cookie(stranger))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void requiresASession() throws Exception {
        this.mvc.perform(get("/api/protection/summary")).andExpect(status().isUnauthorized());
        this.mvc.perform(get("/api/protection/events")).andExpect(status().isUnauthorized());
    }

}
