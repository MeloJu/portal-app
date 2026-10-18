package dev.l2.api.security;

import dev.l2.api.security.ProtectionDtos.BlockedEventResponse;
import dev.l2.api.security.ProtectionDtos.ProtectionSummary;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/protection")
public class ProtectionController {

    private final ProtectionReportService report;

    public ProtectionController(ProtectionReportService report) {
        this.report = report;
    }

    @GetMapping("/summary")
    public ProtectionSummary summary(@AuthenticationPrincipal Jwt principal) {
        return this.report.summary(ownerId(principal));
    }

    @GetMapping("/events")
    public List<BlockedEventResponse> events(@AuthenticationPrincipal Jwt principal,
            @RequestParam(defaultValue = "" + ProtectionReportService.DEFAULT_EVENTS) int limit) {
        return this.report.recentEvents(ownerId(principal), limit);
    }

    private static UUID ownerId(Jwt principal) {
        return UUID.fromString(principal.getSubject());
    }

}
