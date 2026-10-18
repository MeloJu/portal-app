package dev.l2.api.geo;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param databasePath caminho do GeoLite2-Country.mmdb (variavel
 *                     {@code GEOIP_DB_PATH}). Vazio
 *                     desliga o GeoIP: a API sobe normalmente e as Viagens
 *                     ficam sem pais.
 */
@ConfigurationProperties("app.geoip")
public record GeoIpProperties(String databasePath) {

    public boolean enabled() {
        return this.databasePath != null && !this.databasePath.isBlank();
    }

}
