package dev.l2.api.link;

import dev.l2.api.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "links")
public class Link {

	public static final int MAX_TARGET_URL_LENGTH = 2048;

	public static final int MAX_TITLE_LENGTH = 120;

	@Id
	@UuidGenerator(style = UuidGenerator.Style.TIME)
	@Column(nullable = false, updatable = false)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "owner_id", nullable = false, updatable = false)
	private User owner;

	@Column(nullable = false, length = 32, unique = true, updatable = false)
	private String code;

	@Column(name = "target_url", nullable = false, length = MAX_TARGET_URL_LENGTH)
	private String targetUrl;

	@Column(length = MAX_TITLE_LENGTH)
	private String title;

	@Column(nullable = false)
	private boolean active = true;

	@Column(name = "expires_at")
	private Instant expiresAt;

	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected Link() {
		// exigido pelo JPA
	}

	public Link(User owner, String code, String targetUrl, String title) {
		this.owner = owner;
		this.code = code;
		this.targetUrl = targetUrl;
		this.title = title;
	}

	public UUID getId() {
		return this.id;
	}

	public User getOwner() {
		return this.owner;
	}

	public String getCode() {
		return this.code;
	}

	public String getTargetUrl() {
		return this.targetUrl;
	}

	public void setTargetUrl(String targetUrl) {
		this.targetUrl = targetUrl;
	}

	public String getTitle() {
		return this.title;
	}

	public void setTitle(String title) {
		this.title = title;
	}

	public boolean isActive() {
		return this.active;
	}

	public void setActive(boolean active) {
		this.active = active;
	}

	public Instant getExpiresAt() {
		return this.expiresAt;
	}

	public void setExpiresAt(Instant expiresAt) {
		this.expiresAt = expiresAt;
	}

	public Instant getCreatedAt() {
		return this.createdAt;
	}

	public Instant getUpdatedAt() {
		return this.updatedAt;
	}

	@Override
	public boolean equals(Object other) {
		if (this == other) {
			return true;
		}
		if (!(other instanceof Link link)) {
			return false;
		}
		return this.id != null && this.id.equals(link.id);
	}

	@Override
	public int hashCode() {
		return Objects.hashCode(this.id);
	}

}
