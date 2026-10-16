package dev.l2.api.security;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

/**
 * Leitura das Ameacas bloqueadas de um Usuario (painel Protecao). A gravacao
 * continua sendo do
 * {@link ProtectionService}. Evento sem Usuario (user_id nulo, ex.: Link
 * inexistente) nao entra
 * em nenhum painel.
 */
public interface BlockedEventStatsRepository extends Repository<BlockedEvent, UUID> {

    interface ReasonCount {

        BlockedEventReason getReason();

        long getTotal();

    }

    long countByUserId(UUID userId);

    @Query("""
            select e.reason as reason, count(e) as total
              from BlockedEvent e
             where e.user.id = :userId
             group by e.reason
            """)
    List<ReasonCount> countByReason(@Param("userId") UUID userId);

    @Query("""
            select e
              from BlockedEvent e
             where e.user.id = :userId
             order by e.occurredAt desc, e.id desc
            """)
    List<BlockedEvent> findRecent(@Param("userId") UUID userId, Pageable pageable);

}
