package dev.l2.api.geo;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Consulta de verdade na base GeoLite2-Country. A base nao vai no Git (licenca
 * da MaxMind), entao
 * este teste so roda quando {@code GEOIP_DB_PATH} aponta para ela; sem a
 * variavel ele e ignorado.
 *
 * <p>
 * PowerShell:
 * {@code $env:GEOIP_DB_PATH="E:\geoip\GeoLite2-Country.mmdb"; .\mvnw test
 * -Dtest=MaxMindGeoIpServiceTests}
 */
@EnabledIfEnvironmentVariable(named = "GEOIP_DB_PATH", matches = ".+")
class MaxMindGeoIpServiceTests {

    private static MaxMindGeoIpService service;

    @BeforeAll
    static void open() {
        service = MaxMindGeoIpService.open(Path.of(System.getenv("GEOIP_DB_PATH")));
    }

    @AfterAll
    static void close() {
        if (service != null) {
            service.close();
        }
    }

    @Test
    void findsTheCountryOfAKnownIpv4() {
        assertThat(service.countryOf("8.8.8.8")).contains("US");
    }

    @Test
    void findsTheCountryOfAKnownIpv6() {
        assertThat(service.countryOf("2001:4860:4860::8888")).contains("US");
    }

    @Test
    void answersInUpperCaseWithTwoLetters() {
        assertThat(service.countryOf("8.8.8.8")).hasValueSatisfying(code -> assertThat(code).matches("[A-Z]{2}"));
    }

    @Test
    void doesNotLookUpPrivateOrInvalidAddresses() {
        assertThat(service.countryOf("127.0.0.1")).isEmpty();
        assertThat(service.countryOf("10.0.0.1")).isEmpty();
        assertThat(service.countryOf("192.168.0.10")).isEmpty();
        assertThat(service.countryOf("::1")).isEmpty();
        assertThat(service.countryOf("localhost")).isEmpty();
        assertThat(service.countryOf("nao-e-um-ip")).isEmpty();
        assertThat(service.countryOf("")).isEmpty();
        assertThat(service.countryOf(null)).isEmpty();
    }

    @Test
    void survivesManyConcurrentLookups() {
        long answered = java.util.stream.IntStream.range(0, 2000).parallel()
                .mapToObj(i -> service.countryOf("8.8.8.8"))
                .filter(java.util.Optional::isPresent)
                .count();

        assertThat(answered).isEqualTo(2000);
    }

}