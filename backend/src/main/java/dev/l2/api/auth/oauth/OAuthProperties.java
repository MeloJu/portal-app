package dev.l2.api.auth.oauth;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.StringUtils;

@ConfigurationProperties("app.oauth")
public record OAuthProperties(

		@DefaultValue Credentials google,

		@DefaultValue Credentials github) {

	public Credentials credentialsOf(OAuthProvider provider) {
		return switch (provider) {
			case GOOGLE -> this.google;
			case GITHUB -> this.github;
		};
	}

	public record Credentials(

			@DefaultValue("") String clientId,

			@DefaultValue("") String clientSecret) {

		public boolean enabled() {
			return StringUtils.hasText(this.clientId) && StringUtils.hasText(this.clientSecret);
		}

		@Override
		public String toString() {
			return "Credentials[enabled=" + enabled() + "]";
		}

	}

}
