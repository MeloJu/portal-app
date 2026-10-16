package dev.l2.api.link;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Contagens e ranking dos Links de um Usuario (Visao geral e Protecao). Todo
 * metodo filtra por
 * dono: nenhum numero de um Usuario enxerga Link de outro (docs/SECURITY.md,
 * secao 1).
 * Links fechados continuam contando: fechar e soft delete e nao pode derrubar o
 * historico.
 */
public interface LinkAggregateRepository extends Repository<Link, UUID> {

    interface TopRow {

        String getCode();

        String getTitle();

        long getTravels();

    }

    /** Mesmo criterio do estado ACTIVE de {@link Link#state(Instant)}. */
    @Query("select count(l) from Link l where l.owner.id = :ownerId and " + LinkRepository.OPEN
            + " and l.paused = false")
    long countActive(@Param("ownerId") UUID ownerId, @Param("now") Instant now);

    @Query("select coalesce(sum(l.travelCount), 0L) from Link l where l.owner.id = :ownerId")
    long sumTravels(@Param("ownerId") UUID ownerId);

    /**
     * Todos os Links do Usuario, em qualquer estado: todos passaram pelo
     * UrlValidator ao serem gravados.
     */
    long countByOwnerId(UUID ownerId);

    @Query("""
            select l.code as code, l.title as title, l.travelCount as travels
              from Link l
             where l.owner.id = :ownerId and l.travelCount > 0
             order by l.travelCount desc, l.code asc
            """)
    List<TopRow> findTop(@Param("ownerId") UUID ownerId, Pageable pageable);

}
