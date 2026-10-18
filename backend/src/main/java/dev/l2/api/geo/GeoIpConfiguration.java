package dev.l2.api.geo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Path;

@Configuration(proxyBeanMethods = false)
class GeoIpConfiguration {

    private static final Logger log = LoggerFactory.getLogger(GeoIpConfiguration.class);

    /**
     * O Spring fecha o servico no desligamento: MaxMindGeoIpService e
     * AutoCloseable.
     */
    @Bean
    GeoIpService geoIpService(GeoIpProperties properties) {
        if (!properties.enabled()) {
            log.info("GeoIP desligado (GEOIP_DB_PATH vazio): as Viagens ficam sem pais");
            return GeoIpService.disabled();
        }
        Path database = Path.of(properties.databasePath().strip());
        MaxMindGeoIpService service = MaxMindGeoIpService.open(database);
        log.info("GeoIP ligado com a base {}", database.getFileName());
        return service;
    }

}
