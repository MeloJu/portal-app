package dev.l2.api.stats;

import java.time.LocalDate;
import java.util.List;

/**
 * Respostas de /api/links/{code}/stats e /api/dashboard/** (docs/openapi.yaml).
 */
public final class StatsDtos {

    private StatsDtos() {
    }

    /** Um ponto de serie por dia (UTC). */
    public record TimePoint(LocalDate date, long travels) {

    }

    public record CountryCount(String country, long travels) {

    }

    public record LinkStats(

            String code,

            long totalTravels,

            long humanTravels,

            long botTravels,

            List<TimePoint> travelsByDay,

            List<CountryCount> countries) {

    }

    /**
     * @param travelsChangePct variacao das Viagens da janela atual contra a janela
     *                         anterior de mesmo
     *                         tamanho; {@code null} quando a janela anterior nao
     *                         teve Viagens (nao existe percentual)
     */
    public record DashboardSummary(

            long activeLinks,

            long totalTravels,

            Double travelsChangePct,

            long blockedThreats) {

    }

    public record TopLink(String code, String title, long travels) {

    }

}
