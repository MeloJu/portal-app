package dev.l2.api.link;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.function.Predicate;
import java.util.random.RandomGenerator;

/**
 * Gera o codigo curto do Link: 7 caracteres base62 de um SecureRandom (62^7 ~
 * 3,5 trilhoes,
 * imprevisivel, entao nao da para enumerar links alheios). O gerador nao
 * conhece o banco:
 * quem chama diz o que ja esta em uso, e a colisao e resolvida com nova
 * tentativa.
 *
 * <p>
 * Alias escolhido pelo usuario nao passa por aqui: valide com
 * {@link ReservedAliases#requireAllowed(String)}.
 */
@Component
public class CodeGenerator {

    public static final int LENGTH = 7;

    static final int MAX_ATTEMPTS = 10;

    private static final char[] ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
            .toCharArray();

    private final RandomGenerator random;

    @Autowired
    public CodeGenerator() {
        this(new SecureRandom());
    }

    CodeGenerator(RandomGenerator random) {
        this.random = random;
    }

    /**
     * @param taken diz se o codigo ja existe (ex.: {@code links::existsByCode})
     * @throws IllegalStateException se {@value #MAX_ATTEMPTS} codigos seguidos
     *                               colidirem
     */
    public String generate(Predicate<String> taken) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            String candidate = randomCode();
            if (!ReservedAliases.isReserved(candidate) && !taken.test(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException(
                "Nao foi possivel gerar um codigo livre em " + MAX_ATTEMPTS + " tentativas");
    }

    private String randomCode() {
        char[] code = new char[LENGTH];
        for (int i = 0; i < LENGTH; i++) {
            code[i] = ALPHABET[this.random.nextInt(ALPHABET.length)];
        }
        return new String(code);
    }

}
