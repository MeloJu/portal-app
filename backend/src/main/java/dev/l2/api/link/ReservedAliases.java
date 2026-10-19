package dev.l2.api.link;

import dev.l2.api.security.BlockedEventReason;

import java.util.Locale;
import java.util.Set;

/**
 * Aliases que colidiriam com rotas da propria plataforma. A comparacao ignora
 * caixa:
 * "API" e "Login" tambem ficam de fora.
 */
public final class ReservedAliases {

    private static final Set<String> RESERVED = Set.of(
            "api", "r", "assets", "otlp", "health", "login", "register", "index.html",
            "dashboard", "tools", "healthz", "verificar-email");

    private ReservedAliases() {
    }

    public static boolean isReserved(String alias) {
        return alias != null && RESERVED.contains(alias.toLowerCase(Locale.ROOT));
    }

    public static void requireAllowed(String alias) {
        if (isReserved(alias)) {
            throw new InvalidLinkException(BlockedEventReason.RESERVED_ALIAS, "Esse nome de portal é reservado");
        }
    }

}
