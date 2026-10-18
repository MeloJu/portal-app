package dev.l2.api;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class L2ApiApplicationTests {

	@Test
	void contextLoads() {
	}

}
