package dev.l2.api.security;

import java.time.Instant;
import java.util.Map;

/** Respostas de /api/protection/** (docs/openapi.yaml). */
public final class ProtectionDtos {

    private ProtectionDtos() {
    }

    /**
     * @param byReason uma entrada por motivo, na ordem do enum, inclusive os que
     *                 ainda estao em zero:
     *                 o front nao precisa tratar chave ausente
     */
    public record ProtectionSummary(

            long blockedThreats,

            long verifiedDestinations,

            Map<String, Long> byReason) {

    }

    /**
     * {@code code} e o codigo (ou alias) que motivou o bloqueio; nulo quando nao
     * havia um.
     */
    public record BlockedEventResponse(BlockedEventReason reason, String code, Instant occurredAt) {

        static BlockedEventResponse of(BlockedEvent event) {
            return new BlockedEventResponse(event.getReason(), event.getDetail(), event.getOccurredAt());
        }

    }

}
