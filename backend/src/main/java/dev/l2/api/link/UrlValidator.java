package dev.l2.api.link;

import dev.l2.api.config.AppProperties;
import dev.l2.api.security.BlockedEventReason;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Valida e normaliza o destino de um Link (docs/SECURITY.md, secoes 2 e 6).
 *
 * <p>
 * Usar na criacao e no PATCH. A Travessia faz {@code window.location} com este
 * valor, entao
 * so passa http/https: um {@code javascript:} viraria XSS no nosso dominio.
 */
@Component
public class UrlValidator {

    public static final int MAX_LENGTH = Link.MAX_TARGET_URL_LENGTH;

    private static final int MAX_PORT = 65535;

    private static final Pattern SCHEME_WITH_AUTHORITY = Pattern.compile("^[A-Za-z][A-Za-z0-9+.-]*://.*$");

    private static final Pattern ANY_SCHEME = Pattern.compile("^[A-Za-z][A-Za-z0-9+.-]*:(.*)$");

    /**
     * O que vem depois de "host:" quando isso e uma porta, e nao um esquema
     * (localhost:3000/app).
     */
    private static final Pattern PORT_AND_REST = Pattern.compile("^\\d+([/?#].*)?$");

    private final String ownHost;

    @Autowired
    public UrlValidator(AppProperties properties) {
        this(properties.publicBaseUrl());
    }

    UrlValidator(String publicBaseUrl) {
        String host = host(URI.create(publicBaseUrl));
        if (host == null) {
            throw new IllegalStateException("PUBLIC_BASE_URL sem host: " + publicBaseUrl);
        }
        this.ownHost = host;
    }

    /**
     * @return o destino pronto para gravar: sem esquema vira https://, esquema e
     *         host em minusculas
     * @throws InvalidLinkException {@code INVALID_URL} ou {@code SELF_LOOP}
     */
    public String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            throw invalid("Informe o endereço de destino");
        }
        String value = raw.strip();
        if (value.length() > MAX_LENGTH) {
            throw tooLong();
        }
        if (value.chars().anyMatch(c -> Character.isWhitespace(c) || Character.isISOControl(c))) {
            throw invalid("O endereço não pode ter espaços ou caracteres de controle");
        }

        String candidate = withScheme(value);
        if (candidate.length() > MAX_LENGTH) {
            throw tooLong();
        }

        URI uri = parse(candidate);
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) {
            throw invalid("Só aceitamos endereços http ou https");
        }
        String host = host(uri);
        if (host == null) {
            throw invalid("O endereço não tem um domínio válido");
        }
        if (uri.getUserInfo() != null) {
            // https://google.com@evil.com leva a evil.com: e truque classico de phishing
            throw invalid("O endereço não pode ter usuário ou senha");
        }
        if (uri.getPort() == 0 || uri.getPort() > MAX_PORT) {
            throw invalid("A porta do endereço é inválida");
        }
        if (host.equals(this.ownHost)) {
            throw new InvalidLinkException(BlockedEventReason.SELF_LOOP,
                    "Esse endereço aponta para o próprio Lumi Links");
        }

        String normalized = rebuild(scheme, uri);
        if (normalized.length() > MAX_LENGTH) {
            throw tooLong();
        }
        return normalized;
    }

    /**
     * Sem esquema vira https://; esquema que nao seja "host:porta" e recusado cedo
     * (javascript:, data:, mailto:).
     */
    private String withScheme(String value) {
        if (value.startsWith("//")) {
            return "https:" + value;
        }
        if (SCHEME_WITH_AUTHORITY.matcher(value).matches()) {
            return value;
        }
        Matcher scheme = ANY_SCHEME.matcher(value);
        if (scheme.matches() && !PORT_AND_REST.matcher(scheme.group(1)).matches()) {
            throw invalid("Só aceitamos endereços http ou https");
        }
        return "https://" + value;
    }

    private URI parse(String candidate) {
        try {
            return new URI(candidate);
        } catch (URISyntaxException invalidSyntax) {
            throw invalid("Esse endereço não parece válido");
        }
    }

    private String rebuild(String scheme, URI uri) {
        StringBuilder out = new StringBuilder(scheme).append("://")
                .append(uri.getRawAuthority().toLowerCase(Locale.ROOT));
        if (uri.getRawPath() != null) {
            out.append(uri.getRawPath());
        }
        if (uri.getRawQuery() != null) {
            out.append('?').append(uri.getRawQuery());
        }
        if (uri.getRawFragment() != null) {
            out.append('#').append(uri.getRawFragment());
        }
        return out.toString();
    }

    /**
     * Host em minusculas e sem o ponto final ("l2.to." e o mesmo host que "l2.to");
     * null se nao houver.
     */
    private static String host(URI uri) {
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            return null;
        }
        host = host.toLowerCase(Locale.ROOT);
        return host.endsWith(".") ? host.substring(0, host.length() - 1) : host;
    }

    private static InvalidLinkException invalid(String message) {
        return new InvalidLinkException(BlockedEventReason.INVALID_URL, message);
    }

    private static InvalidLinkException tooLong() {
        return invalid("O endereço passa de " + MAX_LENGTH + " caracteres");
    }

}
