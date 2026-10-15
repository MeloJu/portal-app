package dev.l2.api.link;

import dev.l2.api.config.AppProperties;
import dev.l2.api.link.LinkDtos.CreateLinkRequest;
import dev.l2.api.link.LinkDtos.LinkPage;
import dev.l2.api.link.LinkDtos.LinkResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/links")
public class LinkController {

	static final int DEFAULT_PAGE_SIZE = 20;

	static final int MAX_PAGE_SIZE = 100;

	private final LinkService links;

	private final String publicBaseUrl;

	public LinkController(LinkService links, AppProperties properties) {
		this.links = links;
		this.publicBaseUrl = properties.publicBaseUrl();
	}

	@PostMapping
	public ResponseEntity<LinkResponse> create(@AuthenticationPrincipal Jwt principal,
			@Valid @RequestBody CreateLinkRequest request) {
		Link created = this.links.create(ownerId(principal), request);
		return ResponseEntity.status(HttpStatus.CREATED).body(present(created));
	}

	@GetMapping
	public LinkPage list(@AuthenticationPrincipal Jwt principal,
			@RequestParam(required = false) LinkState state,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size) {
		Pageable pageable = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, MAX_PAGE_SIZE),
				Sort.by(Sort.Direction.DESC, "createdAt"));
		return LinkPage.of(this.links.list(ownerId(principal), state, pageable), this.publicBaseUrl,
				this.links.now());
	}

	@GetMapping("/{code}")
	public LinkResponse detail(@AuthenticationPrincipal Jwt principal, @PathVariable String code) {
		return present(this.links.require(ownerId(principal), code));
	}

	@PatchMapping("/{code}")
	public LinkResponse update(@AuthenticationPrincipal Jwt principal, @PathVariable String code,
			@Valid @RequestBody UpdateLinkRequest request) {
		return present(this.links.update(ownerId(principal), code, request));
	}

	@DeleteMapping("/{code}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void close(@AuthenticationPrincipal Jwt principal, @PathVariable String code) {
		this.links.close(ownerId(principal), code);
	}

	private LinkResponse present(Link link) {
		return LinkResponse.of(link, this.publicBaseUrl, this.links.now());
	}

	private static UUID ownerId(Jwt principal) {
		return UUID.fromString(principal.getSubject());
	}

}
