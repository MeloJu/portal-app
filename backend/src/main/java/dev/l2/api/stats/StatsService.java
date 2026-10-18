package dev.l2.api.stats;

import dev.l2.api.link.Link;
import dev.l2.api.link.LinkAggregateRepository;
import dev.l2.api.link.LinkService;
import dev.l2.api.security.ProtectionReportService;
import dev.l2.api.stats.StatsDtos.CountryCount;
import dev.l2.api.stats.StatsDtos.DashboardSummary;
import dev.l2.api.stats.StatsDtos.LinkStats;
import dev.l2.api.stats.StatsDtos.TimePoint;
import dev.l2.api.stats.StatsDtos.TopLink;
import dev.l2.api.stats.TravelStatsRepository.CountryRow;
import dev.l2.api.stats.TravelStatsRepository.DayCount;
import dev.l2.api.stats.TravelStatsRepository.Totals;
import dev.l2.api.stats.TravelStatsRepository.Window;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Numeros de um Link (B2.4) e da Visao geral do Usuario (B2.5). Toda consulta
 * parte do dono:
 * o Link vem de {@link LinkService#require}, que responde 404 para Link de
 * outra pessoa, e as
 * agregacoes da Visao geral filtram por {@code owner_id}.
 */
@Service
public class StatsService {

    static final int DEFAULT_TOP_LINKS = 5;

    static final int MAX_TOP_LINKS = 20;

    private final LinkService links;

    private final TravelStatsRepository travels;

    private final LinkAggregateRepository aggregates;

    private final ProtectionReportService protection;

    private final Clock clock;

    @Autowired
    public StatsService(LinkService links, TravelStatsRepository travels, LinkAggregateRepository aggregates,
            ProtectionReportService protection) {
        this(links, travels, aggregates, protection, Clock.systemUTC());
    }

    StatsService(LinkService links, TravelStatsRepository travels, LinkAggregateRepository aggregates,
            ProtectionReportService protection, Clock clock) {
        this.links = links;
        this.travels = travels;
        this.aggregates = aggregates;
        this.protection = protection;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public LinkStats linkStats(UUID ownerId, String code, int days) {
        Link link = this.links.require(ownerId, code);
        int window = StatsMath.clampDays(days);
        LocalDate first = StatsMath.firstDay(StatsMath.today(this.clock.instant()), window);

        Totals totals = this.travels.totalsByLink(link.getId());
        long total = totals.getTotal();
        long bots = totals.getBots();

        List<TimePoint> byDay = StatsMath.fillDays(
                byDay(this.travels.dailyByLink(link.getId(), StatsMath.startOf(first))), first, window);
        List<CountryCount> countries = countries(this.travels.countriesByLink(link.getId()));

        return new LinkStats(link.getCode(), total, total - bots, bots, byDay, countries);
    }

    @Transactional(readOnly = true)
    public DashboardSummary summary(UUID ownerId, int days) {
        Instant now = this.clock.instant();
        int window = StatsMath.clampDays(days);
        LocalDate first = StatsMath.firstDay(StatsMath.today(now), window);
        Instant from = StatsMath.startOf(first);
        Instant previousFrom = StatsMath.startOf(first.minusDays(window));

        Window travelWindow = this.travels.windowByOwner(ownerId, from, previousFrom);

        return new DashboardSummary(
                this.aggregates.countActive(ownerId, now),
                this.aggregates.sumTravels(ownerId),
                StatsMath.changePct(travelWindow.getRecent(), travelWindow.getEarlier()),
                this.protection.blockedThreats(ownerId));
    }

    @Transactional(readOnly = true)
    public List<TimePoint> travelsByDay(UUID ownerId, int days) {
        int window = StatsMath.clampDays(days);
        LocalDate first = StatsMath.firstDay(StatsMath.today(this.clock.instant()), window);
        return StatsMath.fillDays(byDay(this.travels.dailyByOwner(ownerId, StatsMath.startOf(first))), first, window);
    }

    @Transactional(readOnly = true)
    public List<TopLink> topLinks(UUID ownerId, int limit) {
        int size = Math.clamp(limit, 1, MAX_TOP_LINKS);
        return this.aggregates.findTop(ownerId, PageRequest.of(0, size)).stream()
                .map(row -> new TopLink(row.getCode(), row.getTitle(), row.getTravels()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CountryCount> countries(UUID ownerId) {
        return countries(this.travels.countriesByOwner(ownerId));
    }

    private static Map<LocalDate, Long> byDay(List<DayCount> rows) {
        Map<LocalDate, Long> counts = new HashMap<>();
        for (DayCount row : rows) {
            counts.put(LocalDate.parse(row.getDay()), row.getTravels());
        }
        return counts;
    }

    private static List<CountryCount> countries(List<CountryRow> rows) {
        return rows.stream().map(row -> new CountryCount(row.getCountry(), row.getTravels())).toList();
    }

}
