package dev.l2.api.link;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class UpdateLinkRequestTests {

	private final ObjectMapper json = JsonMapper.builder().addModule(new JavaTimeModule()).build();

	private UpdateLinkRequest read(String body) throws Exception {
		return this.json.readValue(body, UpdateLinkRequest.class);
	}

	@Test
	void treatsAnAbsentFieldAsNothingToChange() throws Exception {
		UpdateLinkRequest request = read("{}");

		assertThat(request.hasTargetUrl()).isFalse();
		assertThat(request.hasTitle()).isFalse();
		assertThat(request.hasPaused()).isFalse();
		assertThat(request.hasExpiresAt()).isFalse();
		assertThat(request.hasMaxTravels()).isFalse();
	}

	@Test
	void treatsAnExplicitNullAsAnOrderToClear() throws Exception {
		UpdateLinkRequest request = read("""
				{"expiresAt":null,"maxTravels":null,"title":null}""");

		assertThat(request.hasExpiresAt()).isTrue();
		assertThat(request.getExpiresAt()).isNull();
		assertThat(request.hasMaxTravels()).isTrue();
		assertThat(request.getMaxTravels()).isNull();
		assertThat(request.hasTitle()).isTrue();
		assertThat(request.getTitle()).isNull();
	}

	@Test
	void readsTheValuesWhenTheyCome() throws Exception {
		UpdateLinkRequest request = read("""
				{"targetUrl":"https://example.com/novo","title":"Campanha","paused":true,
				"expiresAt":"2026-12-31T23:59:00Z","maxTravels":50}""");

		assertThat(request.getTargetUrl()).isEqualTo("https://example.com/novo");
		assertThat(request.getTitle()).isEqualTo("Campanha");
		assertThat(request.getPaused()).isTrue();
		assertThat(request.getExpiresAt()).isEqualTo(Instant.parse("2026-12-31T23:59:00Z"));
		assertThat(request.getMaxTravels()).isEqualTo(50);
	}

	@Test
	void readsPausedFalseAsAnOrderToResume() throws Exception {
		UpdateLinkRequest request = read("""
				{"paused":false}""");

		assertThat(request.hasPaused()).isTrue();
		assertThat(request.getPaused()).isFalse();
	}

	@Test
	void doesNotMistakeOneFieldForAnother() throws Exception {
		UpdateLinkRequest request = read("""
				{"paused":true}""");

		assertThat(request.hasPaused()).isTrue();
		assertThat(request.hasExpiresAt()).isFalse();
		assertThat(request.hasMaxTravels()).isFalse();
		assertThat(request.hasTargetUrl()).isFalse();
	}

}
