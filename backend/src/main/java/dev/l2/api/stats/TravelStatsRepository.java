package dev.l2.api.stats;

import dev.l2.api.travel.Travel;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Agregacoes de Viagens. Dias sao agrupados em UTC com
 * {@code date_trunc('day', occurred_at at time zone 'UTC')}, e o resultado sai
 * como texto
 * (YYYY-MM-DD) para nao depender de conversao de tipo de data entre JDBC e JPA.
 * Viagem sem pais (GeoIP ainda nao preenche) fica fora das listas de paises.
 */
public interface TravelStatsRepository extends Repository<Travel, UUID> {

    interface Totals {

        long getTotal();

        long getBots();

    }

    interface Window {

        long getRecent();

        long getEarlier();

    }

    interface DayCount {

        String getDay();

        long getTravels();

    }

    interface CountryRow {

        String getCountry();

        long getTravels();

    }

    @Query(nativeQuery = true, value = """
            select count(*) as total,
                   count(*) filter (where t.bot) as bots
              from travels t
             where t.link_id = :linkId
            """)
    Totals totalsByLink(@Param("linkId") UUID linkId);

    @Query(nativeQuery = true, value = """
            select to_char(date_trunc('day', t.occurred_at at time zone 'UTC'), 'YYYY-MM-DD') as day,
                   count(*) as travels
              from travels t
             where t.link_id = :linkId
               and t.occurred_at >= cast(:since as timestamptz)
             group by 1
             order by 1
            """)
    List<DayCount> dailyByLink(@Param("linkId") UUID linkId, @Param("since") Instant since);

    @Query(nativeQuery = true, value = """
            select t.country as country,
                   count(*) as travels
              from travels t
             where t.link_id = :linkId
               and t.country is not null
             group by t.country
             order by count(*) desc, t.country
             limit 50
            """)
    List<CountryRow> countriesByLink(@Param("linkId") UUID linkId);

    @Query(nativeQuery = true, value = """
            select to_char(date_trunc('day', t.occurred_at at time zone 'UTC'), 'YYYY-MM-DD') as day,
                   count(*) as travels
              from travels t
              join links l on l.id = t.link_id
             where l.owner_id = :ownerId
               and t.occurred_at >= cast(:since as timestamptz)
             group by 1
             order by 1
            """)
    List<DayCount> dailyByOwner(@Param("ownerId") UUID ownerId, @Param("since") Instant since);

    @Query(nativeQuery = true, value = """
            select t.country as country,
                   count(*) as travels
              from travels t
              join links l on l.id = t.link_id
             where l.owner_id = :ownerId
               and t.country is not null
             group by t.country
             order by count(*) desc, t.country
             limit 50
            """)
    List<CountryRow> countriesByOwner(@Param("ownerId") UUID ownerId);

    /**
     * Viagens a partir de {@code from} (janela atual) contra as de [previousFrom,
     * from) (janela anterior).
     */
    @Query(nativeQuery = true, value = """
            select count(*) filter (where t.occurred_at >= cast(:from as timestamptz)) as recent,
                   count(*) filter (where t.occurred_at <  cast(:from as timestamptz)) as earlier
              from travels t
              join links l on l.id = t.link_id
             where l.owner_id = :ownerId
               and t.occurred_at >= cast(:previousFrom as timestamptz)
            """)
    Window windowByOwner(@Param("ownerId") UUID ownerId, @Param("from") Instant from,
            @Param("previousFrom") Instant previousFrom);

}
