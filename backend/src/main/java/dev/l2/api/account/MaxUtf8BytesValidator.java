package dev.l2.api.account;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.nio.charset.StandardCharsets;

public class MaxUtf8BytesValidator implements ConstraintValidator<MaxUtf8Bytes, CharSequence> {

	private int limit;

	@Override
	public void initialize(MaxUtf8Bytes constraint) {
		this.limit = constraint.value();
	}

	@Override
	public boolean isValid(CharSequence value, ConstraintValidatorContext context) {
		return value == null || value.toString().getBytes(StandardCharsets.UTF_8).length <= this.limit;
	}

}
