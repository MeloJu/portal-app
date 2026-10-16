package dev.l2.api.geo;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Le o IP de um cabecalho ou do socket sem nunca fazer consulta de DNS: so
 * aceita literais IPv4
 * e IPv6. Um nome como "localhost" ou "example.com" vira vazio, em vez de
 * disparar uma resolucao
 * de nome com dado vindo da rede.
 */
final class IpAddresses {

    /**
     * Maior literal possivel: IPv6 com IPv4 embutido ("0000:...:255.255.255.255").
     */
    private static final int MAX_LENGTH = 45;

    private static final Pattern IPV4 = Pattern.compile("^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$");

    /**
     * Comeca com digito hexa ou ':' de proposito: e o que faz o JDK tratar o texto
     * como literal
     * IPv6 (e recusar se for invalido) em vez de cair numa consulta de DNS.
     */
    private static final Pattern IPV6 = Pattern.compile("^[0-9A-Fa-f:][0-9A-Fa-f:.]*$");

    private IpAddresses() {
    }

    /**
     * O endereco, se for um IP literal valido de um cliente na internet publica.
     */
    static Optional<InetAddress> parsePublic(String raw) {
        return parse(raw).filter(IpAddresses::isPublic);
    }

    /** O endereco, se {@code raw} for um IP literal valido (publico ou nao). */
    static Optional<InetAddress> parse(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        String value = withoutZone(raw.strip());
        if (value.isEmpty() || value.length() > MAX_LENGTH) {
            return Optional.empty();
        }
        try {
            Matcher ipv4 = IPV4.matcher(value);
            if (ipv4.matches()) {
                return ipv4(ipv4);
            }
            if (value.indexOf(':') >= 0 && IPV6.matcher(value).matches()) {
                return Optional.of(InetAddress.getByName(value));
            }
        } catch (UnknownHostException invalidLiteral) {
            return Optional.empty();
        }
        return Optional.empty();
    }

    static boolean isPublic(InetAddress address) {
        if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                || address.isSiteLocalAddress() || address.isMulticastAddress()) {
            return false;
        }
        byte[] bytes = address.getAddress();
        if (bytes.length == 16) {
            // fc00::/7 (unique local), que isSiteLocalAddress nao cobre
            return (bytes[0] & 0xFE) != 0xFC;
        }
        int first = bytes[0] & 0xFF;
        // 0.0.0.0/8 ("esta rede"), 240.0.0.0/4 (reservado, inclui o broadcast) e
        // 100.64.0.0/10 (CGNAT: rede privada de operadora e de VPN)
        return first != 0 && first < 240 && !(first == 100 && (bytes[1] & 0xC0) == 64);
    }

    private static Optional<InetAddress> ipv4(Matcher matcher) throws UnknownHostException {
        byte[] bytes = new byte[4];
        for (int i = 0; i < 4; i++) {
            String octet = matcher.group(i + 1);
            // "010" e octal para alguns programas e decimal para outros: ambiguo, recusa
            if (octet.length() > 1 && octet.charAt(0) == '0') {
                return Optional.empty();
            }
            int number = Integer.parseInt(octet);
            if (number > 255) {
                return Optional.empty();
            }
            bytes[i] = (byte) number;
        }
        return Optional.of(InetAddress.getByAddress(bytes));
    }

    /**
     * "fe80::1%eth0" -> "fe80::1": o identificador de interface nao muda o pais.
     */
    private static String withoutZone(String value) {
        int zone = value.indexOf('%');
        return (zone < 0) ? value : value.substring(0, zone);
    }

}
