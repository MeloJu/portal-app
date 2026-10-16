package dev.l2.api.geo;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class IpAddressesTests {

    @ParameterizedTest
    @ValueSource(strings = { "8.8.8.8", " 8.8.8.8 ", "93.184.216.34", "172.32.0.1", "100.128.0.1", "203.0.113.9",
            "2001:4860:4860::8888", "::ffff:8.8.8.8", "2001:4860:4860::8888%0" })
    void acceptsPublicAddresses(String ip) {
        assertThat(IpAddresses.parsePublic(ip)).isPresent();
    }

    @Test
    void readsAnIpv4MappedIpv6AsIpv4() {
        assertThat(IpAddresses.parsePublic("::ffff:8.8.8.8").orElseThrow().getHostAddress()).isEqualTo("8.8.8.8");
    }

    @ParameterizedTest
    @ValueSource(strings = { "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.1.1",
            "0.0.0.0", "0.1.2.3", "100.64.0.1", "100.127.255.255", "224.0.0.1", "240.0.0.1", "255.255.255.255",
            "::1", "::", "fe80::1", "fe80::1%eth0", "fc00::1", "fd12:3456::1", "ff02::1" })
    void refusesAddressesThatAreNotOnThePublicInternet(String ip) {
        assertThat(IpAddresses.parsePublic(ip)).isEmpty();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = { "   ", "localhost", "example.com", "8.8.8", "8.8.8.8.8", "256.1.1.1", "01.2.3.4",
            "1.2.3.04", "1.2.3.4/24", "1.2.3.4:80", "[::1]", "::g", "1:2", ".:", ":.", "2001:db8::1::2", "1.2.3.-4",
            "0x7f.0.0.1", "8.8.8.8,9.9.9.9", "8.8.8.8 9.9.9.9", "::1::", "1:2:3:4:5:6:7:8:9" })
    void refusesAnythingThatIsNotAnIpLiteral(String text) {
        assertThat(IpAddresses.parse(text)).isEmpty();
    }

    @Test
    void refusesFullWidthDigitsAndOversizedText() {
        assertThat(IpAddresses.parse("８.８.８.８")).isEmpty();
        assertThat(IpAddresses.parse("a".repeat(100))).isEmpty();
    }

    @Test
    void neverResolvesNames() {
        // um nome que passasse por InetAddress.getByName viraria consulta de DNS com
        // dado da rede
        long start = System.nanoTime();
        for (int i = 0; i < 500; i++) {
            assertThat(IpAddresses.parse("nao-e-um-ip-" + i + ".example.invalid")).isEmpty();
            assertThat(IpAddresses.parse(".:" + i)).isEmpty();
        }
        assertThat((System.nanoTime() - start) / 1_000_000).isLessThan(2_000);
    }

}
