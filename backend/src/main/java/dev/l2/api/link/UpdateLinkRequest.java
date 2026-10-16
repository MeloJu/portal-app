package dev.l2.api.link;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public class UpdateLinkRequest {

	@Size(max = Link.MAX_TARGET_URL_LENGTH)
	private String targetUrl;

	private boolean targetUrlPresent;

	@Size(max = Link.MAX_TITLE_LENGTH)
	private String title;

	private boolean titlePresent;

	private Boolean paused;

	private Instant expiresAt;

	private boolean expiresAtPresent;

	@Min(1)
	private Integer maxTravels;

	private boolean maxTravelsPresent;

	@JsonProperty("targetUrl")
	public void setTargetUrl(String targetUrl) {
		this.targetUrl = targetUrl;
		this.targetUrlPresent = true;
	}

	@JsonProperty("title")
	public void setTitle(String title) {
		this.title = title;
		this.titlePresent = true;
	}

	@JsonProperty("paused")
	public void setPaused(Boolean paused) {
		this.paused = paused;
	}

	@JsonProperty("expiresAt")
	public void setExpiresAt(Instant expiresAt) {
		this.expiresAt = expiresAt;
		this.expiresAtPresent = true;
	}

	@JsonProperty("maxTravels")
	public void setMaxTravels(Integer maxTravels) {
		this.maxTravels = maxTravels;
		this.maxTravelsPresent = true;
	}

	public String getTargetUrl() {
		return this.targetUrl;
	}

	public boolean hasTargetUrl() {
		return this.targetUrlPresent;
	}

	public String getTitle() {
		return this.title;
	}

	public boolean hasTitle() {
		return this.titlePresent;
	}

	public Boolean getPaused() {
		return this.paused;
	}

	public boolean hasPaused() {
		return this.paused != null;
	}

	public Instant getExpiresAt() {
		return this.expiresAt;
	}

	public boolean hasExpiresAt() {
		return this.expiresAtPresent;
	}

	public Integer getMaxTravels() {
		return this.maxTravels;
	}

	public boolean hasMaxTravels() {
		return this.maxTravelsPresent;
	}

}
