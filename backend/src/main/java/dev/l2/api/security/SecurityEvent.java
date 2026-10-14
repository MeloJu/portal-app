package dev.l2.api.security;

import dev.l2.api.link.Link;
import dev.l2.api.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "security_events")
public class SecurityEvent {

	@Id
	@UuidGenerator(style = UuidGenerator.Style.TIME)
	@Column(nullable = false, updatable = false)
	private UUID id;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32, updatable = false)
	private SecurityEventKind kind;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id", updatable = false)
	private User user;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "link_id", updatable = false)
	private Link link;

	@Column(length = 255, updatable = false)
	private String detail;

	@CreationTimestamp
	@Column(name = "occurred_at", nullable = false, updatable = false)
	private Instant occurredAt;

	protected SecurityEvent() {
		// exigido pelo JPA
	}

	private SecurityEvent(SecurityEventKind kind, User user, Link link, String detail) {
		this.kind = kind;
		this.user = user;
		this.link = link;
		this.detail = detail;
	}

	public static SecurityEvent of(SecurityEventKind kind, User user, Link link, String detail) {
		return new SecurityEvent(kind, user, link, detail);
	}

	public UUID getId() {
		return this.id;
	}

	public SecurityEventKind getKind() {
		return this.kind;
	}

	public User getUser() {
		return this.user;
	}

	public Link getLink() {
		return this.link;
	}

	public String getDetail() {
		return this.detail;
	}

	public Instant getOccurredAt() {
		return this.occurredAt;
	}

	@Override
	public boolean equals(Object other) {
		if (this == other) {
			return true;
		}
		if (!(other instanceof SecurityEvent event)) {
			return false;
		}
		return this.id != null && this.id.equals(event.id);
	}

	@Override
	public int hashCode() {
		return Objects.hashCode(this.id);
	}

}
