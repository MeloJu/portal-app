package dev.l2.api;

import org.springframework.boot.SpringApplication;

public class TestL2ApiApplication {

	public static void main(String[] args) {
		SpringApplication.from(L2ApiApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
