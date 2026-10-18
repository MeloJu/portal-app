package dev.l2.api.security;

public enum BlockedEventReason {

	INVALID_URL,

	SELF_LOOP,

	RESERVED_ALIAS,

	PAUSED,

	CLOSED,

	RATE_LIMIT

}
