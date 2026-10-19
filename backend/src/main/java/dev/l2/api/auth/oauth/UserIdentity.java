package dev.l2.api.auth.oauth;

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
@Table(name = "user_identities")
public class UserIdentity {

	@Id
	@UuidGenerator(style = UuidGenerator.Style.TIME)
	@Column(nullable = false, updatable = false)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false, updatable = false)
	private User user;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, updatable = false, length = 20)
	private OAuthProvider provider;

	@Column(name = "provider_user_id", nullable = false, updatable = false, length = 255)
	private String providerUserId;

	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected UserIdentity() {
	}

	public UserIdentity(User user, OAuthProvider provider, String providerUserId) {
		this.user = user;
		this.provider = provider;
		this.providerUserId = providerUserId;
	}

	public UUID getId() {
		return this.id;
	}

	public User getUser() {
		return this.user;
	}

	public OAuthProvider getProvider() {
		return this.provider;
	}

	public String getProviderUserId() {
		return this.providerUserId;
	}

	public Instant getCreatedAt() {
		return this.createdAt;
	}

	@Override
	public boolean equals(Object other) {
		if (this == other) {
			return true;
		}
		if (!(other instanceof UserIdentity identity)) {
			return false;
		}
		return this.id != null && this.id.equals(identity.id);
	}

	@Override
	public int hashCode() {
		return Objects.hashCode(this.id);
	}

}
