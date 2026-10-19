package dev.l2.api.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

	@Id
	@UuidGenerator(style = UuidGenerator.Style.TIME)
	@Column(nullable = false, updatable = false)
	private UUID id;

	@Column(nullable = false, length = 254, unique = true)
	private String email;
    
	@Column(name = "password_hash", nullable = false, length = 72)
	private String passwordHash;

	@Column(nullable = false, length = 120)
	private String name;

	@Column(name = "has_password", nullable = false)
	private boolean hasPassword = true;

	@Column(name = "email_verified_at")
	private Instant emailVerifiedAt;

	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected User() {
		// exigido pelo JPA
	}

	public User(String email, String passwordHash, String name) {
		this.email = email;
		this.passwordHash = passwordHash;
		this.name = name;
	}

	public UUID getId() {
		return this.id;
	}

	public String getEmail() {
		return this.email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public boolean isEmailVerified() {
		return this.emailVerifiedAt != null;
	}

	public void markEmailVerified(Instant now) {
		this.emailVerifiedAt = now;
	}

	public String getPasswordHash() {
		return this.passwordHash;
	}

	public void setPasswordHash(String passwordHash) {
		this.passwordHash = passwordHash;
	}

	public boolean hasPassword() {
		return this.hasPassword;
	}

	public void disablePassword(String unusablePasswordHash) {
		this.passwordHash = unusablePasswordHash;
		this.hasPassword = false;
	}

	public String getName() {
		return this.name;
	}

	public void setName(String name) {
		this.name = name;
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
		if (!(other instanceof User user)) {
			return false;
		}
		return this.id != null && this.id.equals(user.id);
	}

	@Override
	public int hashCode() {
		return Objects.hashCode(this.id);
	}

}
