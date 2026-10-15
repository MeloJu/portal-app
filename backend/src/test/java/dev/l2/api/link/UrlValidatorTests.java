package dev.l2.api.link;

import dev.l2.api.security.BlockedEventReason;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

class UrlValidatorTests {

    private final UrlValidator validator = new UrlValidator("https://l2.to");

    private void assertRejected(String raw, BlockedEventReason reason) {
        assertThatExceptionOfType(InvalidLinkException.class)
                .isThrownBy(() -> this.validator.normalize(raw))
                .satisfies(exception -> assertThat(exception.getReason()).isEqualTo(reason));
    }

    @ParameterizedTest
    @CsvSource({
            "facebook.com,                        https://facebook.com",
            "www.example.com/a/b?x=1#topo,        https://www.example.com/a/b?x=1#topo",
            "http://example.com/a?b=1#c,          http://example.com/a?b=1#c",
            "HTTPS://Example.COM/CaminhoMaiusc,   https://example.com/CaminhoMaiusc",
            "//cdn.example.com/x,                 https://cdn.example.com/x",
            "localhost:3000/app,                  https://localhost:3000/app",
            "example.com:8443,                    https://example.com:8443",
            "https://sub.l2.to/x,                 https://sub.l2.to/x",
            "https://l2.to.evil.com,              https://l2.to.evil.com"
    })
    void normalizesValidDestinations(String raw, String expected) {
        assertThat(this.validator.normalize(raw)).isEqualTo(expected);
    }

    @Test
    void trimsSurroundingWhitespace() {
        assertThat(this.validator.normalize("   example.com/x \n")).isEqualTo("https://example.com/x");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "javascript:alert(1)",
            "JavaScript:alert(1)",
            "data:text/html;base64,PHNjcmlwdD4=",
            "vbscript:msgbox(1)",
            "mailto:ana@example.com",
            "ftp://example.com/arquivo",
            "file:///etc/passwd",
            "http:/example.com",
            "http://",
            "https://",
            "https://user:senha@example.com",
            "https://google.com@evil.com",
            "https://example.com:99999",
            "https://example.com:0",
            "exa mple.com",
            "https://example.com/a b"
    })
    void rejectsUnsafeOrMalformedDestinations(String raw) {
        assertRejected(raw, BlockedEventReason.INVALID_URL);
    }

    @Test
    void rejectsControlCharacters() {
        // fora do @ParameterizedTest: um NUL no nome do teste quebraria o XML do
        // relatorio do Surefire
        assertRejected("https://example.com/\u0000", BlockedEventReason.INVALID_URL);
        assertRejected("https://example.com/\tx", BlockedEventReason.INVALID_URL);
    }

    @Test
    void rejectsNullAndBlank() {
        assertRejected(null, BlockedEventReason.INVALID_URL);
        assertRejected("", BlockedEventReason.INVALID_URL);
        assertRejected("   ", BlockedEventReason.INVALID_URL);
    }

    @Test
    void acceptsExactlyTheMaximumLength() {
        String url = "https://example.com/" + "a".repeat(UrlValidator.MAX_LENGTH - "https://example.com/".length());

        assertThat(url).hasSize(2048);
        assertThat(this.validator.normalize(url)).isEqualTo(url);
    }

    @Test
    void rejectsAboveTheMaximumLength() {
        assertRejected("https://example.com/" + "a".repeat(UrlValidator.MAX_LENGTH), BlockedEventReason.INVALID_URL);
    }

    @Test
    void rejectsWhenAddingTheSchemePushesPastTheLimit() {
        String withoutScheme = "example.com/" + "a".repeat(UrlValidator.MAX_LENGTH - "example.com/".length());

        assertThat(withoutScheme).hasSize(2048);
        assertRejected(withoutScheme, BlockedEventReason.INVALID_URL);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "l2.to",
            "https://l2.to/abc123",
            "http://l2.to",
            "HTTPS://L2.TO/x",
            "https://l2.to./x",
            "l2.to:8443/x",
            "//l2.to/x"
    })
    void rejectsTheOwnDomain(String raw) {
        assertRejected(raw, BlockedEventReason.SELF_LOOP);
    }

    @Test
    void ownDomainIsTakenFromPublicBaseUrlIncludingPortAndPath() {
        UrlValidator other = new UrlValidator("https://Portal.Example.com:8443/app");

        assertThatExceptionOfType(InvalidLinkException.class)
                .isThrownBy(() -> other.normalize("portal.example.com/x"))
                .satisfies(exception -> assertThat(exception.getReason()).isEqualTo(BlockedEventReason.SELF_LOOP));
        assertThat(other.normalize("l2.to")).isEqualTo("https://l2.to");
    }

}
