package dev.l2.api.security;

import dev.l2.api.link.LinkAggregateRepository;
import dev.l2.api.security.BlockedEventStatsRepository.ReasonCount;
import dev.l2.api.security.ProtectionDtos.BlockedEventResponse;
import dev.l2.api.security.ProtectionDtos.ProtectionSummary;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Leitura do painel Protecao. Quem grava os eventos e o
 * {@link ProtectionService}.
 */
@Service
public class ProtectionReportService {

    static final int DEFAULT_EVENTS = 20;

    static final int MAX_EVENTS = 100;

    private final BlockedEventStatsRepository events;

    private final LinkAggregateRepository links;

    public ProtectionReportService(BlockedEventStatsRepository events, LinkAggregateRepository links) {
        this.events = events;
        this.links = links;
    }

    @Transactional(readOnly = true)
    public long blockedThreats(UUID ownerId) {
        return this.events.countByUserId(ownerId);
    }

    @Transactional(readOnly = true)
    public ProtectionSummary summary(UUID ownerId) {
        Map<BlockedEventReason, Long> counted = new EnumMap<>(BlockedEventReason.class);
        for (ReasonCount row : this.events.countByReason(ownerId)) {
            counted.put(row.getReason(), row.getTotal());
        }

        Map<String, Long> byReason = new LinkedHashMap<>();
        long total = 0;
        for (BlockedEventReason reason : BlockedEventReason.values()) {
            long count = counted.getOrDefault(reason, 0L);
            byReason.put(reason.name(), count);
            total += count;
        }
        return new ProtectionSummary(total, this.links.countByOwnerId(ownerId), byReason);
    }

    @Transactional(readOnly = true)
    public List<BlockedEventResponse> recentEvents(UUID ownerId, int limit) {
        int size = Math.clamp(limit, 1, MAX_EVENTS);
        return this.events.findRecent(ownerId, PageRequest.of(0, size)).stream()
                .map(BlockedEventResponse::of)
                .toList();
    }

}
