package dev.l2.api.stats;

import dev.l2.api.stats.StatsDtos.CountryCount;
import dev.l2.api.stats.StatsDtos.DashboardSummary;
import dev.l2.api.stats.StatsDtos.TimePoint;
import dev.l2.api.stats.StatsDtos.TopLink;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final StatsService stats;

    public DashboardController(StatsService stats) {
        this.stats = stats;
    }

    @GetMapping("/summary")
    public DashboardSummary summary(@AuthenticationPrincipal Jwt principal,
            @RequestParam(defaultValue = "" + StatsMath.DEFAULT_DAYS) int days) {
        return this.stats.summary(ownerId(principal), days);
    }

    @GetMapping("/travels")
    public List<TimePoint> travels(@AuthenticationPrincipal Jwt principal,
            @RequestParam(defaultValue = "" + StatsMath.DEFAULT_DAYS) int days) {
        return this.stats.travelsByDay(ownerId(principal), days);
    }

    @GetMapping("/top-links")
    public List<TopLink> topLinks(@AuthenticationPrincipal Jwt principal,
            @RequestParam(defaultValue = "" + StatsService.DEFAULT_TOP_LINKS) int limit) {
        return this.stats.topLinks(ownerId(principal), limit);
    }

    @GetMapping("/countries")
    public List<CountryCount> countries(@AuthenticationPrincipal Jwt principal) {
        return this.stats.countries(ownerId(principal));
    }

    private static UUID ownerId(Jwt principal) {
        return UUID.fromString(principal.getSubject());
    }

}
