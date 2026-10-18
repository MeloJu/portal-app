package dev.l2.api.stats;

import dev.l2.api.stats.StatsDtos.TimePoint;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class StatsMathTests {

    private final LocalDate today = LocalDate.of(2026, 10, 15);

    @ParameterizedTest
    @CsvSource({ "-5, 1", "0, 1", "1, 1", "12, 12", "90, 90", "91, 90", "1000, 90", "2147483647, 90" })
    void limitsTheWindow(int asked, int expected) {
        assertThat(StatsMath.clampDays(asked)).isEqualTo(expected);
    }

    @Test
    void aOneDayWindowIsJustToday() {
        assertThat(StatsMath.firstDay(this.today, 1)).isEqualTo(this.today);
    }

    @Test
    void theWindowEndsTodayAndCountsIt() {
        assertThat(StatsMath.firstDay(this.today, 5)).isEqualTo(LocalDate.of(2026, 10, 11));
    }

    @Test
    void splitsTheDayAtMidnightUtc() {
        assertThat(StatsMath.today(Instant.parse("2026-10-15T00:00:00Z"))).isEqualTo(this.today);
        assertThat(StatsMath.today(Instant.parse("2026-10-14T23:59:59Z"))).isEqualTo(LocalDate.of(2026, 10, 14));
        assertThat(StatsMath.startOf(this.today)).isEqualTo(Instant.parse("2026-10-15T00:00:00Z"));
    }

    @Test
    void fillsDaysWithoutTravelsWithZero() {
        Map<LocalDate, Long> counts = new HashMap<>();
        counts.put(LocalDate.of(2026, 10, 13), 1L);
        counts.put(LocalDate.of(2026, 10, 15), 2L);
        counts.put(LocalDate.of(2026, 9, 1), 99L);

        List<TimePoint> series = StatsMath.fillDays(counts, LocalDate.of(2026, 10, 11), 5);

        assertThat(series).containsExactly(
                new TimePoint(LocalDate.of(2026, 10, 11), 0),
                new TimePoint(LocalDate.of(2026, 10, 12), 0),
                new TimePoint(LocalDate.of(2026, 10, 13), 1),
                new TimePoint(LocalDate.of(2026, 10, 14), 0),
                new TimePoint(LocalDate.of(2026, 10, 15), 2));
    }

    @Test
    void anEmptySeriesStillHasOnePointPerDay() {
        assertThat(StatsMath.fillDays(Map.of(), this.today, 12)).hasSize(12)
                .allSatisfy(point -> assertThat(point.travels()).isZero());
    }

    @ParameterizedTest
    @CsvSource({ "9, 1, 800.0", "10, 8, 25.0", "8, 10, -20.0", "1, 3, -66.7", "4, 4, 0.0", "0, 5, -100.0" })
    void comparesTheWindowWithThePreviousOne(long recent, long earlier, double expected) {
        assertThat(StatsMath.changePct(recent, earlier)).isEqualTo(expected);
    }

    @Test
    void hasNoPercentageWhenThePreviousWindowWasEmpty() {
        assertThat(StatsMath.changePct(5, 0)).isNull();
        assertThat(StatsMath.changePct(0, 0)).isNull();
    }

}
