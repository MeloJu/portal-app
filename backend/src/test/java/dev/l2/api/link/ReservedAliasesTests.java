package dev.l2.api.link;

import dev.l2.api.security.BlockedEventReason;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

class ReservedAliasesTests {

    @ParameterizedTest
    @ValueSource(strings = { "api", "r", "assets", "otlp", "health", "login", "register", "index.html", "dashboard", "tools", "healthz", "verificar-email" })
    void rejectsEveryReservedAlias(String alias) {
        assertThat(ReservedAliases.isReserved(alias)).isTrue();
        assertThatExceptionOfType(InvalidLinkException.class)
                .isThrownBy(() -> ReservedAliases.requireAllowed(alias))
                .satisfies(exception -> assertThat(exception.getReason()).isEqualTo(BlockedEventReason.RESERVED_ALIAS));
    }

    @ParameterizedTest
    @ValueSource(strings = { "API", "Login", "REGISTER", "Index.HTML", "R", "Dashboard", "Verificar-Email", "VERIFICAR-EMAIL" })
    void ignoresCase(String alias) {
        assertThat(ReservedAliases.isReserved(alias)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = { "nebulosa", "api-v2", "meu-login", "lumi" })
    void allowsOrdinaryAliases(String alias) {
        assertThat(ReservedAliases.isReserved(alias)).isFalse();
        ReservedAliases.requireAllowed(alias);
    }

    @Test
    void nullIsNotReserved() {
        assertThat(ReservedAliases.isReserved(null)).isFalse();
    }

}
