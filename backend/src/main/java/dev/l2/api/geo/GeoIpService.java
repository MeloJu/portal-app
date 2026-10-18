package dev.l2.api.geo;

import java.util.Optional;

/**
 * Descobre o pais de quem fez a Viagem. O IP entra so para a consulta: nem quem
 * chama nem esta
 * implementacao guardam, registram em log ou colocam em cache. O unico dado que
 * sobrevive e o
 * codigo do pais, que vai para {@code travels.country} (docs/SECURITY.md, secao
 * 11).
 */
@FunctionalInterface
public interface GeoIpService {

    /**
     * @param ip endereco do cliente em texto (IPv4 ou IPv6); nome de host nunca e
     *           resolvido
     * @return codigo ISO 3166-1 alfa-2 em maiusculas (ex.: "BR"); vazio se o IP for
     *         nulo, invalido,
     *         privado ou desconhecido da base, ou se o GeoIP estiver desligado
     */
    Optional<String> countryOf(String ip);

    /**
     * GeoIP desligado ({@code GEOIP_DB_PATH} vazio): nenhuma Viagem recebe pais.
     */
    static GeoIpService disabled() {
        return ip -> Optional.empty();
    }

}
