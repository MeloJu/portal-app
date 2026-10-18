package dev.l2.api.geo;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GeoIpConfigurationTests {

    private final GeoIpConfiguration configuration = new GeoIpConfiguration();

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = { "   " })
    void staysOffWithoutADatabasePath(String path) {
        GeoIpProperties properties = new GeoIpProperties(path);

        assertThat(properties.enabled()).isFalse();
        assertThat(this.configuration.geoIpService(properties).countryOf("8.8.8.8")).isEmpty();
    }

    @Test
    void theDisabledServiceNeverAnswers() {
        assertThat(GeoIpService.disabled().countryOf("8.8.8.8")).isEmpty();
        assertThat(GeoIpService.disabled().countryOf(null)).isEmpty();
    }

    @Test
    void failsToStartWhenTheConfiguredFileDoesNotExist(@TempDir Path directory) {
        Path missing = directory.resolve("GeoLite2-Country.mmdb");

        assertThatThrownBy(() -> this.configuration.geoIpService(new GeoIpProperties(missing.toString())))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("GeoLite2-Country.mmdb");
    }

    @Test
    void failsToStartWhenTheFileIsNotAMaxMindDatabase(@TempDir Path directory) throws IOException {
        Path notADatabase = Files.writeString(directory.resolve("falsa.mmdb"), "isto nao e uma base MaxMind");

        assertThatThrownBy(() -> this.configuration.geoIpService(new GeoIpProperties(notADatabase.toString())))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("falsa.mmdb");
    }

    @Test
    void failsToStartWhenThePathIsADirectory(@TempDir Path directory) {
        assertThatThrownBy(() -> this.configuration.geoIpService(new GeoIpProperties(directory.toString())))
                .isInstanceOf(IllegalStateException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = { "br", "BR", "Us", "pt" })
    void normalizesTheCountryCodeToUpperCase(String code) {
        assertThat(MaxMindGeoIpService.isoCode(code)).contains(code.toUpperCase());
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = { "B", "BRA", "  " })
    void ignoresACodeThatDoesNotFitTheColumn(String code) {
        assertThat(MaxMindGeoIpService.isoCode(code)).isEmpty();
    }

}
