package dev.l2.api.travel;

import dev.l2.api.link.Link;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "travels")
public class Travel {

	@Id
	@UuidGenerator(style = UuidGenerator.Style.TIME)
	@Column(nullable = false, updatable = false)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "link_id", nullable = false, updatable = false)
	private Link link;

	@CreationTimestamp
	@Column(name = "occurred_at", nullable = false, updatable = false)
	private Instant occurredAt;

	@Column(length = 2048)
	private String referrer;

	@Column(name = "user_agent", length = 512)
	private String userAgent;

	@Column(length = 2)
	private String country;

	/** BotDetector no User-Agent: LinkStats separa humanos de robos. */
	@Column(nullable = false)
	private boolean bot;

	protected Travel() {
		// exigido pelo JPA
	}

	public Travel(Link link, String referrer, String userAgent, String country, boolean bot) {
		this.link = link;
		this.referrer = referrer;
		this.userAgent = userAgent;
		this.country = country;
		this.bot = bot;
	}

	public UUID getId() {
		return this.id;
	}

	public Link getLink() {
		return this.link;
	}

	public Instant getOccurredAt() {
		return this.occurredAt;
	}

	public String getReferrer() {
		return this.referrer;
	}

	public String getUserAgent() {
		return this.userAgent;
	}

	public String getCountry() {
		return this.country;
	}

	public boolean isBot() {
		return this.bot;
	}

	@Override
	public boolean equals(Object other) {
		if (this == other) {
			return true;
		}
		if (!(other instanceof Travel travel)) {
			return false;
		}
		return this.id != null && this.id.equals(travel.id);
	}

	@Override
	public int hashCode() {
		return Objects.hashCode(this.id);
	}

}
