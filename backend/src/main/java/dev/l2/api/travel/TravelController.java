package dev.l2.api.travel;

import dev.l2.api.link.LinkState;
import dev.l2.api.web.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TravelController {

	private final TravelService travels;

	public TravelController(TravelService travels) {
		this.travels = travels;
	}

	@GetMapping("/api/travel/{code}")
	public TravelResponse travel(@PathVariable String code,
			@RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent,
			@RequestHeader(value = HttpHeaders.REFERER, required = false) String referrer,
			HttpServletRequest request) {
		return this.travels.travel(code, userAgent, referrer, request.getRemoteAddr());
	}

	@GetMapping("/r/{code}")
	public ResponseEntity<Void> redirect(@PathVariable String code,
			@RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent,
			@RequestHeader(value = HttpHeaders.REFERER, required = false) String referrer,
			HttpServletRequest request) {
		TravelResponse travel = this.travels.travel(code, userAgent, referrer, request.getRemoteAddr());
		return ResponseEntity.status(HttpStatus.FOUND)
				.header(HttpHeaders.LOCATION, travel.targetUrl())
				.header("Referrer-Policy", "no-referrer")
				.cacheControl(CacheControl.noStore())
				.build();
	}

	@ExceptionHandler(LinkNotTravelableException.class)
	ResponseEntity<ErrorResponse> onNotTravelable(LinkNotTravelableException exception) {
		HttpStatus status = (exception.getState() == LinkState.PAUSED) ? HttpStatus.LOCKED : HttpStatus.GONE;
		return ResponseEntity.status(status)
				.body(new ErrorResponse(exception.getState().name(), exception.getMessage()));
	}

}
