package dev.l2.api.link;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CodeGeneratorTests {

    private final CodeGenerator generator = new CodeGenerator();

    @Test
    void generatesSevenBase62Characters() {
        for (int i = 0; i < 500; i++) {
            assertThat(this.generator.generate(code -> false)).matches("[0-9A-Za-z]{7}");
        }
    }

    @Test
    void generatedCodesFitTheDatabaseConstraint() {
        // links_code_format (V2): ^[A-Za-z0-9-]{3,32}$
        assertThat(this.generator.generate(code -> false)).matches("^[A-Za-z0-9-]{3,32}$");
    }

    @Test
    void doesNotRepeatInPractice() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 2000; i++) {
            seen.add(this.generator.generate(code -> false));
        }
        assertThat(seen).hasSize(2000);
    }

    @Test
    void retriesWhenTheCodeIsAlreadyTaken() {
        AtomicInteger calls = new AtomicInteger();

        String code = this.generator.generate(candidate -> calls.incrementAndGet() <= 3);

        assertThat(calls.get()).isEqualTo(4);
        assertThat(code).hasSize(CodeGenerator.LENGTH);
    }

    @Test
    void givesUpAfterMaxAttempts() {
        AtomicInteger calls = new AtomicInteger();

        assertThatThrownBy(() -> this.generator.generate(candidate -> {
            calls.incrementAndGet();
            return true;
        })).isInstanceOf(IllegalStateException.class);

        assertThat(calls.get()).isEqualTo(CodeGenerator.MAX_ATTEMPTS);
    }

}
