package dev.l2.api.account;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AccountCodeRepository extends JpaRepository<AccountCode, UUID> {

	Optional<AccountCode> findFirstByUserIdAndPurposeOrderByCreatedAtDesc(UUID userId, AccountCodePurpose purpose);

}
