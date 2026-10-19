package dev.l2.api.account;

import dev.l2.api.config.AppProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;

@Component
public class CodeHasher {

	private static final String ALGORITHM = "HmacSHA256";

	private final SecretKeySpec key;

	@Autowired
	public CodeHasher(AppProperties properties) {
		this(properties.codes().pepperBytes());
	}

	CodeHasher(byte[] pepper) {
		this.key = new SecretKeySpec(pepper, ALGORITHM);
	}

	public String hash(UUID userId, AccountCodePurpose purpose, String code) {
		try {
			Mac mac = Mac.getInstance(ALGORITHM);
			mac.init(this.key);
			byte[] digest = mac.doFinal((userId + ":" + purpose + ":" + code).getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest);
		}
		catch (GeneralSecurityException unavailable) {
			throw new IllegalStateException("HmacSHA256 indisponível", unavailable);
		}
	}

	public boolean matches(String expectedHash, String actualHash) {
		return MessageDigest.isEqual(expectedHash.getBytes(StandardCharsets.UTF_8),
				actualHash.getBytes(StandardCharsets.UTF_8));
	}

}
