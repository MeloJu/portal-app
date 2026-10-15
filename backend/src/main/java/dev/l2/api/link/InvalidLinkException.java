package dev.l2.api.link;

import dev.l2.api.security.BlockedEventReason;

/**
 * Destino ou alias recusado na criacao/edicao de um Link. Carrega o motivo para
 * o controller
 * registrar a Ameaca bloqueada (ProtectionService.block) e para o handler
 * responder 400 com
 * {@code code} igual ao nome do motivo.
 */
public class InvalidLinkException extends RuntimeException {

    private final BlockedEventReason reason;

    public InvalidLinkException(BlockedEventReason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public BlockedEventReason getReason() {
        return this.reason;
    }

}
