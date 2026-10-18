package dev.l2.api.stats;

import dev.l2.api.stats.StatsDtos.TimePoint;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Contas de janela e serie, sem Spring nem banco. Os dias sao sempre UTC: e o
 * mesmo fuso do
 * {@code date_trunc('day', occurred_at at time zone 'UTC')} das consultas,
 * entao o dia que o SQL
 * agrupa e o dia que esta classe preenche.
 */
final class StatsMath {

    static final int DEFAULT_DAYS = 12;

    static final int MAX_DAYS = 90;

    private StatsMath() {
    }

    /** Janela pedida pelo cliente, limitada a [1, MAX_DAYS]. */
    static int clampDays(int days) {
        return Math.clamp(days, 1, MAX_DAYS);
    }

    /**
     * Primeiro dia de uma janela de {@code days} dias que termina hoje (hoje
     * conta).
     */
    static LocalDate firstDay(LocalDate today, int days) {
        return today.minusDays(days - 1L);
    }

    static LocalDate today(Instant now) {
        return LocalDate.ofInstant(now, ZoneOffset.UTC);
    }

    static Instant startOf(LocalDate day) {
        return day.atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    /**
     * Uma entrada por dia da janela, em ordem; dia sem Viagem vira zero (o grafico
     * nao fica com buracos).
     */
    static List<TimePoint> fillDays(Map<LocalDate, Long> counts, LocalDate first, int days) {
        List<TimePoint> series = new ArrayList<>(days);
        for (int offset = 0; offset < days; offset++) {
            LocalDate day = first.plusDays(offset);
            series.add(new TimePoint(day, counts.getOrDefault(day, 0L)));
        }
        return series;
    }

    /**
     * Variacao percentual com uma casa; {@code null} se antes nao havia nada para
     * comparar.
     */
    static Double changePct(long recent, long earlier) {
        if (earlier <= 0) {
            return null;
        }
        return Math.round((recent - earlier) * 1000.0 / earlier) / 10.0;
    }

}
