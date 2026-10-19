package dev.l2.api.web;

import dev.l2.api.account.CodeAttemptsExceededException;
import dev.l2.api.account.CodeExpiredException;
import dev.l2.api.account.CodeInvalidException;
import dev.l2.api.account.CodeRequestTooSoonException;
import dev.l2.api.account.InvalidAccountChangeException;
import dev.l2.api.account.PasswordNotSetException;
import dev.l2.api.account.WrongPasswordException;
import dev.l2.api.auth.EmailAlreadyUsedException;
import dev.l2.api.auth.EmailNotVerifiedException;
import dev.l2.api.auth.InvalidCredentialsException;
import dev.l2.api.auth.oauth.OAuthEmailUnverifiedException;
import dev.l2.api.auth.verification.AlreadyVerifiedException;
import dev.l2.api.auth.verification.ResendTooSoonException;
import dev.l2.api.auth.verification.VerificationTokenExpiredException;
import dev.l2.api.auth.verification.VerificationTokenInvalidException;
import dev.l2.api.link.AliasAlreadyUsedException;
import dev.l2.api.link.InvalidLinkException;
import dev.l2.api.link.LinkNotFoundException;
import java.time.Duration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

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

	@ExceptionHandler(EmailNotVerifiedException.class)
	public ResponseEntity<ErrorResponse> onEmailNotVerified(EmailNotVerifiedException exception) {
		return body(HttpStatus.FORBIDDEN, "EMAIL_NOT_VERIFIED", exception.getMessage());
	}

	@ExceptionHandler(InvalidLinkException.class)
	public ResponseEntity<ErrorResponse> onInvalidLink(InvalidLinkException exception) {
		return body(HttpStatus.BAD_REQUEST, exception.getReason().name(), exception.getMessage());
	}

	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	public ResponseEntity<ErrorResponse> onUnknownParameterValue(MethodArgumentTypeMismatchException exception) {
		return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", exception.getName() + ": valor não reconhecido");
	}

	@ExceptionHandler(LinkNotFoundException.class)
	public ResponseEntity<ErrorResponse> onLinkNotFound(LinkNotFoundException exception) {
		return body(HttpStatus.NOT_FOUND, "LINK_NOT_FOUND", exception.getMessage());
	}

	@ExceptionHandler(AliasAlreadyUsedException.class)
	public ResponseEntity<ErrorResponse> onAliasTaken(AliasAlreadyUsedException exception) {
		return body(HttpStatus.CONFLICT, "ALIAS_TAKEN", exception.getMessage());
	}

	@ExceptionHandler(VerificationTokenInvalidException.class)
	public ResponseEntity<ErrorResponse> onTokenInvalid(VerificationTokenInvalidException exception) {
		return body(HttpStatus.BAD_REQUEST, "TOKEN_INVALID", exception.getMessage());
	}

	@ExceptionHandler(VerificationTokenExpiredException.class)
	public ResponseEntity<ErrorResponse> onTokenExpired(VerificationTokenExpiredException exception) {
		return body(HttpStatus.BAD_REQUEST, "TOKEN_EXPIRED", exception.getMessage());
	}

	@ExceptionHandler(AlreadyVerifiedException.class)
	public ResponseEntity<ErrorResponse> onAlreadyVerified(AlreadyVerifiedException exception) {
		return body(HttpStatus.CONFLICT, "ALREADY_VERIFIED", exception.getMessage());
	}

	@ExceptionHandler(ResendTooSoonException.class)
	public ResponseEntity<ErrorResponse> onResendTooSoon(ResendTooSoonException exception) {
		return rateLimited(exception.getRetryAfter(), exception.getMessage());
	}

	@ExceptionHandler(CodeInvalidException.class)
	public ResponseEntity<ErrorResponse> onCodeInvalid(CodeInvalidException exception) {
		return body(HttpStatus.BAD_REQUEST, "CODE_INVALID", exception.getMessage());
	}

	@ExceptionHandler(CodeExpiredException.class)
	public ResponseEntity<ErrorResponse> onCodeExpired(CodeExpiredException exception) {
		return body(HttpStatus.BAD_REQUEST, "CODE_EXPIRED", exception.getMessage());
	}

	@ExceptionHandler(CodeAttemptsExceededException.class)
	public ResponseEntity<ErrorResponse> onCodeAttemptsExceeded(CodeAttemptsExceededException exception) {
		return body(HttpStatus.TOO_MANY_REQUESTS, "CODE_ATTEMPTS_EXCEEDED", exception.getMessage());
	}

	@ExceptionHandler(CodeRequestTooSoonException.class)
	public ResponseEntity<ErrorResponse> onCodeRequestTooSoon(CodeRequestTooSoonException exception) {
		return rateLimited(exception.retryAfter(), exception.getMessage());
	}

	@ExceptionHandler(WrongPasswordException.class)
	public ResponseEntity<ErrorResponse> onWrongPassword(WrongPasswordException exception) {
		return body(HttpStatus.FORBIDDEN, "WRONG_PASSWORD", exception.getMessage());
	}

	@ExceptionHandler(PasswordNotSetException.class)
	public ResponseEntity<ErrorResponse> onPasswordNotSet(PasswordNotSetException exception) {
		return body(HttpStatus.CONFLICT, "PASSWORD_NOT_SET", exception.getMessage());
	}

	@ExceptionHandler(OAuthEmailUnverifiedException.class)
	public ResponseEntity<ErrorResponse> onOAuthEmailUnverified(OAuthEmailUnverifiedException exception) {
		return body(HttpStatus.BAD_REQUEST, "OAUTH_EMAIL_UNVERIFIED", exception.getMessage());
	}

	@ExceptionHandler(InvalidAccountChangeException.class)
	public ResponseEntity<ErrorResponse> onInvalidAccountChange(InvalidAccountChangeException exception) {
		return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", exception.getMessage());
	}

	private static ResponseEntity<ErrorResponse> rateLimited(Duration retryAfter, String message) {
		long seconds = Math.max(retryAfter.plusMillis(999).toSeconds(), 1);
		return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
				.header(HttpHeaders.RETRY_AFTER, Long.toString(seconds))
				.body(new ErrorResponse("RATE_LIMIT", message));
	}

	private static String describe(FieldError error) {
		return error.getField() + ": " + error.getDefaultMessage();
	}

	private static ResponseEntity<ErrorResponse> body(HttpStatus status, String code, String message) {
		return ResponseEntity.status(status).body(new ErrorResponse(code, message));
	}

}
