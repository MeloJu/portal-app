package dev.l2.api.geo;

import com.maxmind.db.Reader.FileMode;
import com.maxmind.geoip2.DatabaseReader;
import com.maxmind.geoip2.exception.AddressNotFoundException;
import com.maxmind.geoip2.exception.GeoIp2Exception;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.InetAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Optional;

/**
 * GeoIpService sobre a base GeoLite2-Country da MaxMind. A base e lida do disco
 * uma vez, na
 * subida, e consultada em memoria; o {@link DatabaseReader} aguenta chamadas
 * concorrentes.
 *
 * <p>
 * O IP nunca vai para log: as excecoes da biblioteca trazem o endereco na
 * mensagem, entao
 * aqui so se registra o tipo delas.
 */
public final class MaxMindGeoIpService implements GeoIpService, AutoCloseable {

    private static final Logger log = LoggerFactory.getLogger(MaxMindGeoIpService.class);

    private final DatabaseReader reader;

    private MaxMindGeoIpService(DatabaseReader reader) {
        this.reader = reader;
    }

    /**
     * @throws IllegalStateException se o arquivo nao existe, nao abre ou nao e uma
     *                               base Country: um
     *                               caminho configurado e errado derruba a subida,
     *                               em vez de gravar todas as Viagens sem
     *                               pais sem ninguem perceber
     */
    public static MaxMindGeoIpService open(Path database) {
        if (!Files.isRegularFile(database) || !Files.isReadable(database)) {
            throw new IllegalStateException("Base GeoIP nao encontrada ou ilegivel: " + database);
        }
        DatabaseReader reader;
        try {
            reader = new DatabaseReader.Builder(database.toFile()).fileMode(FileMode.MEMORY).build();
        } catch (IOException invalid) {
            throw new IllegalStateException("Nao foi possivel abrir a base GeoIP: " + database, invalid);
        }
        String type = reader.getMetadata().getDatabaseType();
        if (type == null || !type.contains("Country")) {
            closeQuietly(reader);
            throw new IllegalStateException(
                    "A base GeoIP deve ser a GeoLite2-Country, mas " + database + " e do tipo " + type);
        }
        return new MaxMindGeoIpService(reader);
    }

    @Override
    public Optional<String> countryOf(String ip) {
        return IpAddresses.parsePublic(ip).flatMap(this::lookup);
    }

    @Override
    public void close() {
        closeQuietly(this.reader);
    }

    private Optional<String> lookup(InetAddress address) {
        try {
            return isoCode(this.reader.country(address).getCountry().getIsoCode());
        } catch (AddressNotFoundException notInTheDatabase) {
            return Optional.empty();
        } catch (IOException | GeoIp2Exception failure) {
            log.warn("Falha ao consultar a base GeoIP ({})", failure.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    /**
     * Codigo de dois caracteres em maiusculas, o formato de travels.country
     * (varchar(2)).
     */
    static Optional<String> isoCode(String code) {
        if (code == null || !code.matches("[A-Za-z]{2}")) {
            return Optional.empty();
        }
        return Optional.of(code.toUpperCase(Locale.ROOT));
    }

    private static void closeQuietly(DatabaseReader reader) {
        try {
            reader.close();
        } catch (IOException ignored) {
            // nada a fazer: o arquivo ja nao esta em uso
        }
    }

}