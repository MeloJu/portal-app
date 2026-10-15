package dev.l2.api.web;

import dev.l2.api.auth.EmailAlreadyUsedException;
import dev.l2.api.auth.InvalidCredentialsException;
import dev.l2.api.link.AliasAlreadyUsedException;
import dev.l2.api.link.InvalidLinkException;
import dev.l2.api.link.LinkNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ErrorResponse> onValidation(MethodArgumentNotValidException exception) {
		String message = exception.getBindingResult().getFieldErrors().stream()
				.findFirst()
				.map(ApiExceptionHandler::describe)
				.orElse("Dados inválidos");
		return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message);
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<ErrorResponse> onUnreadableBody(HttpMessageNotReadableException exception) {
		return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Corpo da requisição inválido");
	}

	@ExceptionHandler(EmailAlreadyUsedException.class)
	public ResponseEntity<ErrorResponse> onEmailTaken(EmailAlreadyUsedException exception) {
		return body(HttpStatus.CONFLICT, "EMAIL_TAKEN", exception.getMessage());
	}

	@ExceptionHandler(InvalidCredentialsException.class)
	public ResponseEntity<ErrorResponse> onInvalidCredentials(InvalidCredentialsException exception) {
		return body(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", exception.getMessage());
	}

	@ExceptionHandler(InvalidLinkException.class)
	public ResponseEntity<ErrorResponse> onInvalidLink(InvalidLinkException exception) {
		return body(HttpStatus.BAD_REQUEST, exception.getReason().name(), exception.getMessage());
	}

	@ExceptionHandler(LinkNotFoundException.class)
	public ResponseEntity<ErrorResponse> onLinkNotFound(LinkNotFoundException exception) {
		return body(HttpStatus.NOT_FOUND, "LINK_NOT_FOUND", exception.getMessage());
	}

	@ExceptionHandler(AliasAlreadyUsedException.class)
	public ResponseEntity<ErrorResponse> onAliasTaken(AliasAlreadyUsedException exception) {
		return body(HttpStatus.CONFLICT, "ALIAS_TAKEN", exception.getMessage());
	}

	private static String describe(FieldError error) {
		return error.getField() + ": " + error.getDefaultMessage();
	}

	private static ResponseEntity<ErrorResponse> body(HttpStatus status, String code, String message) {
		return ResponseEntity.status(status).body(new ErrorResponse(code, message));
	}

}
