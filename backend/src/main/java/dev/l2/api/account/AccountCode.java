package dev.l2.api.account;

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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "account_codes")
public class AccountCode {

	@Id
	@UuidGenerator(style = UuidGenerator.Style.TIME)
	@Column(nullable = false, updatable = false)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false, updatable = false)
	private User user;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, updatable = false, length = 20)
	private AccountCodePurpose purpose;

	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(name = "code_hash", nullable = false, updatable = false, length = 64)
	private String codeHash;

	@Column(name = "new_email", updatable = false, length = 254)
	private String newEmail;

	@Column(nullable = false)
	private int attempts;

	@Column(name = "expires_at", nullable = false, updatable = false)
	private Instant expiresAt;

	@Column(name = "used_at")
	private Instant usedAt;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected AccountCode() {
	}

	public AccountCode(User user, AccountCodePurpose purpose, String codeHash, String newEmail, Instant expiresAt) {
		this(user, purpose, codeHash, newEmail, expiresAt, Instant.now());
	}

	public AccountCode(User user, AccountCodePurpose purpose, String codeHash, String newEmail, Instant expiresAt,
			Instant createdAt) {
		this.createdAt = createdAt;
		this.user = user;
		this.purpose = purpose;
		this.codeHash = codeHash;
		this.newEmail = newEmail;
		this.expiresAt = expiresAt;
	}

	public UUID getId() {
		return this.id;
	}

	public User getUser() {
		return this.user;
	}

	public AccountCodePurpose getPurpose() {
		return this.purpose;
	}

	public String getCodeHash() {
		return this.codeHash;
	}

	public String getNewEmail() {
		return this.newEmail;
	}

	public int getAttempts() {
		return this.attempts;
	}

	public void registerAttempt() {
		this.attempts++;
	}

	public Instant getExpiresAt() {
		return this.expiresAt;
	}

	public Instant getUsedAt() {
		return this.usedAt;
	}

	public void markUsed(Instant now) {
		this.usedAt = now;
	}

	public Instant getCreatedAt() {
		return this.createdAt;
	}

	@Override
	public boolean equals(Object other) {
		if (this == other) {
			return true;
		}
		if (!(other instanceof AccountCode code)) {
			return false;
		}
		return this.id != null && this.id.equals(code.id);
	}

	@Override
	public int hashCode() {
		return Objects.hashCode(this.id);
	}

}
