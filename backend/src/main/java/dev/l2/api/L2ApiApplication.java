package dev.l2.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class L2ApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(L2ApiApplication.class, args);
	}

}
