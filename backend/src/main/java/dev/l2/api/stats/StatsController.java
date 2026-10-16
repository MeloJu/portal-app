package dev.l2.api.stats;

import dev.l2.api.stats.StatsDtos.LinkStats;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class StatsController {

    private final StatsService stats;

    public StatsController(StatsService stats) {
        this.stats = stats;
    }

    @GetMapping("/api/links/{code}/stats")
    public LinkStats stats(@AuthenticationPrincipal Jwt principal, @PathVariable String code,
            @RequestParam(defaultValue = "" + StatsMath.DEFAULT_DAYS) int days) {
        return this.stats.linkStats(UUID.fromString(principal.getSubject()), code, days);
    }

}
