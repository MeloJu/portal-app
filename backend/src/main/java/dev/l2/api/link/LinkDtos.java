package dev.l2.api.link;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Page;

import java.time.Instant;
import java.util.List;

public final class LinkDtos {

	private LinkDtos() {
	}

	public record CreateLinkRequest(

			@NotBlank @Size(max = Link.MAX_TARGET_URL_LENGTH) String targetUrl,

			@Pattern(regexp = "^[a-zA-Z0-9-]{3,32}$",
					message = "deve ter de 3 a 32 letras, numeros ou hifens") String alias,

			@Size(max = Link.MAX_TITLE_LENGTH) String title,

			Instant expiresAt,

			@Min(1) Integer maxTravels) {

	}

	public record LinkResponse(

			String code,

			String shortUrl,

			String targetUrl,

			String title,

			LinkState state,

			int travelCount,

			Instant expiresAt,

			Integer maxTravels,

			Instant createdAt) {

		public static LinkResponse of(Link link, String publicBaseUrl, Instant now) {
			return new LinkResponse(link.getCode(), shortUrl(publicBaseUrl, link.getCode()), link.getTargetUrl(),
					link.getTitle(), link.state(now), link.getTravelCount(), link.getExpiresAt(),
					link.getMaxTravels(), link.getCreatedAt());
		}

		private static String shortUrl(String publicBaseUrl, String code) {
			String base = publicBaseUrl.endsWith("/")
					? publicBaseUrl.substring(0, publicBaseUrl.length() - 1)
					: publicBaseUrl;
			return base + "/" + code;
		}

	}

	public record LinkPage(List<LinkResponse> items, int page, long totalItems) {

		public static LinkPage of(Page<Link> page, String publicBaseUrl, Instant now) {
			List<LinkResponse> items = page.getContent().stream()
					.map(link -> LinkResponse.of(link, publicBaseUrl, now))
					.toList();
			return new LinkPage(items, page.getNumber(), page.getTotalElements());
		}

	}

}
