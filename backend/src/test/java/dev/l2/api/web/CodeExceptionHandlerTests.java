package dev.l2.api.web;

import dev.l2.api.account.CodeAttemptsExceededException;
import dev.l2.api.account.CodeExpiredException;
import dev.l2.api.account.CodeInvalidException;
import dev.l2.api.account.CodeRequestTooSoonException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class CodeExceptionHandlerTests {

	private final ApiExceptionHandler handler = new ApiExceptionHandler();

	@Test
	void invalidCodeIsBadRequest() {
		ResponseEntity<ErrorResponse> response = this.handler.onCodeInvalid(new CodeInvalidException());

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
		assertThat(response.getBody().code()).isEqualTo("CODE_INVALID");
	}

	@Test
	void expiredCodeIsBadRequest() {
		ResponseEntity<ErrorResponse> response = this.handler.onCodeExpired(new CodeExpiredException());

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
		assertThat(response.getBody().code()).isEqualTo("CODE_EXPIRED");
	}

	@Test
	void exhaustedAttemptsAreTooManyRequests() {
		ResponseEntity<ErrorResponse> response = this.handler
				.onCodeAttemptsExceeded(new CodeAttemptsExceededException());

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
		assertThat(response.getBody().code()).isEqualTo("CODE_ATTEMPTS_EXCEEDED");
	}

	@Test
	void requestTooSoonCarriesRetryAfterHeaderRoundedUp() {
		ResponseEntity<ErrorResponse> response = this.handler
				.onCodeRequestTooSoon(new CodeRequestTooSoonException(Duration.ofMillis(34_200)));

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
		assertThat(response.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("35");
		assertThat(response.getBody().code()).isEqualTo("RATE_LIMIT");
	}

}
