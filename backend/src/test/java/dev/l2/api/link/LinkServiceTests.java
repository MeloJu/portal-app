package dev.l2.api.link;

import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.link.LinkDtos.CreateLinkRequest;
import dev.l2.api.metrics.L2Metrics;
import dev.l2.api.security.BlockedEvent;
import dev.l2.api.security.BlockedEventReason;
import dev.l2.api.security.BlockedEventRepository;
import dev.l2.api.user.User;
import dev.l2.api.user.UserRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class LinkServiceTests {

	@Autowired
	private LinkService service;

	@Autowired
	private LinkRepository links;

	@Autowired
	private UserRepository users;

	@Autowired
	private BlockedEventRepository events;

	@Autowired
	private MeterRegistry registry;

	private final Pageable firstPage = PageRequest.of(0, 20);

	private UUID ana;

	private UUID bruno;

	@BeforeEach
	void resetState() {
		this.events.deleteAll();
		this.links.deleteAll();
		this.users.deleteAll();
		this.ana = this.users.save(new User(unique() + "-ana@example.com", hash(), "Ana")).getId();
		this.bruno = this.users.save(new User(unique() + "-bruno@example.com", hash(), "Bruno")).getId();
	}

	private static String hash() {
		return "$2a$10$" + "x".repeat(53);
	}

	private static String unique() {
		return "t" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
	}

	private static CreateLinkRequest request(String targetUrl, String alias) {
		return new CreateLinkRequest(targetUrl, alias, null, null, null);
	}

	private double blockedCount(BlockedEventReason reason) {
		Counter counter = this.registry.find(L2Metrics.THREATS_BLOCKED).tag("reason", reason.name()).counter();
		return (counter == null) ? 0 : counter.count();
	}

	@Test
	void createsWithARandomCodeWhenNoAliasIsGiven() {
		Link link = this.service.create(this.ana, request("example.com/campanha", null));

		assertThat(link.getCode()).hasSize(CodeGenerator.LENGTH);
		assertThat(link.getTravelCount()).isZero();
		assertThat(link.state(Instant.now())).isEqualTo(LinkState.ACTIVE);
	}

	@Test
	void normalizesTheTargetUrlOnCreation() {
		Link link = this.service.create(this.ana, request("facebook.com", null));

		assertThat(link.getTargetUrl()).isEqualTo("https://facebook.com");
	}

	@Test
	void createsWithTheChosenAlias() {
		Link link = this.service.create(this.ana, request("example.com", "campanha-nebulosa"));

		assertThat(link.getCode()).isEqualTo("campanha-nebulosa");
	}

	@Test
	void countsTheCreationInPrometheus() {
		Counter counter = this.registry.find(L2Metrics.LINKS_CREATED).counter();
		double before = (counter == null) ? 0 : counter.count();

		this.service.create(this.ana, request("example.com", null));

		assertThat(this.registry.find(L2Metrics.LINKS_CREATED).counter().count()).isEqualTo(before + 1);
	}

	@Test
	void refusesAReservedAliasAndRecordsTheThreat() {
		double before = blockedCount(BlockedEventReason.RESERVED_ALIAS);

		assertThatThrownBy(() -> this.service.create(this.ana, request("example.com", "api")))
				.isInstanceOf(InvalidLinkException.class)
				.extracting(thrown -> ((InvalidLinkException) thrown).getReason())
				.isEqualTo(BlockedEventReason.RESERVED_ALIAS);

		assertThat(this.events.findAll()).singleElement().satisfies(event -> {
			assertThat(event.getReason()).isEqualTo(BlockedEventReason.RESERVED_ALIAS);
			assertThat(event.getDetail()).isEqualTo("api");
			assertThat(event.getUser().getId()).isEqualTo(this.ana);
		});
		assertThat(blockedCount(BlockedEventReason.RESERVED_ALIAS)).isEqualTo(before + 1);
		assertThat(this.links.findAll()).isEmpty();
	}

	@Test
	void refusesATargetOutsideHttpAndRecordsTheThreat() {
		assertThatThrownBy(() -> this.service.create(this.ana, request("javascript:alert(1)", null)))
				.isInstanceOf(InvalidLinkException.class);

		assertThat(this.events.findAll()).singleElement()
				.satisfies(event -> assertThat(event.getReason()).isEqualTo(BlockedEventReason.INVALID_URL));
		assertThat(this.links.findAll()).isEmpty();
	}

	@Test
	void refusesALinkToOurselvesAndRecordsTheThreat() {
		assertThatThrownBy(() -> this.service.create(this.ana, request("http://localhost:8080/aB3x9Q", null)))
				.isInstanceOf(InvalidLinkException.class);

		assertThat(this.events.findAll()).singleElement()
				.satisfies(event -> assertThat(event.getReason()).isEqualTo(BlockedEventReason.SELF_LOOP));
	}

	@Test
	void refusesAnAliasAlreadyTakenWithoutRecordingAThreat() {
		this.service.create(this.ana, request("example.com", "disputado"));

		assertThatThrownBy(() -> this.service.create(this.bruno, request("example.com", "disputado")))
				.isInstanceOf(AliasAlreadyUsedException.class);

		assertThat(this.events.findAll()).isEmpty();
	}

	@Test
	void updatesOnlyWhatWasSent() {
		Link created = this.service.create(this.ana,
				new CreateLinkRequest("example.com/antes", "edicao", "Titulo", null, 10));

		UpdateLinkRequest request = new UpdateLinkRequest();
		request.setPaused(true);
		this.service.update(this.ana, created.getCode(), request);

		Link updated = this.links.findByCode("edicao").orElseThrow();
		assertThat(updated.isPaused()).isTrue();
		assertThat(updated.getTargetUrl()).isEqualTo("https://example.com/antes");
		assertThat(updated.getTitle()).isEqualTo("Titulo");
		assertThat(updated.getMaxTravels()).isEqualTo(10);
	}

	@Test
	void clearsTheDeadlineOnExplicitNull() {
		this.service.create(this.ana,
				new CreateLinkRequest("example.com", "validade", null, Instant.parse("2026-12-01T00:00:00Z"), 5));

		UpdateLinkRequest request = new UpdateLinkRequest();
		request.setExpiresAt(null);
		request.setMaxTravels(null);
		this.service.update(this.ana, "validade", request);

		Link updated = this.links.findByCode("validade").orElseThrow();
		assertThat(updated.getExpiresAt()).isNull();
		assertThat(updated.getMaxTravels()).isNull();
	}

	@Test
	void keepsTheOldTargetWhenTheNewOneIsRefused() {
		this.service.create(this.ana, request("example.com/bom", "mantem"));

		UpdateLinkRequest request = new UpdateLinkRequest();
		request.setTargetUrl("javascript:alert(1)");
		assertThatThrownBy(() -> this.service.update(this.ana, "mantem", request))
				.isInstanceOf(InvalidLinkException.class);

		assertThat(this.links.findByCode("mantem").orElseThrow().getTargetUrl())
				.isEqualTo("https://example.com/bom");
		assertThat(this.events.findAll()).singleElement()
				.satisfies(event -> assertThat(event.getLink()).isNotNull());
	}

	@Test
	void closesWithoutDeletingAndIsIdempotent() {
		this.service.create(this.ana, request("example.com", "fechar"));

		this.service.close(this.ana, "fechar");
		Instant firstClose = this.links.findByCode("fechar").orElseThrow().getClosedAt();
		this.service.close(this.ana, "fechar");

		Link closed = this.links.findByCode("fechar").orElseThrow();
		assertThat(closed.getClosedAt()).isEqualTo(firstClose);
		assertThat(closed.state(Instant.now())).isEqualTo(LinkState.CLOSED);
	}

	@Test
	void neverTouchesALinkOfAnotherOwner() {
		this.service.create(this.ana, request("example.com", "da-ana"));

		UpdateLinkRequest request = new UpdateLinkRequest();
		request.setPaused(true);

		assertThatThrownBy(() -> this.service.require(this.bruno, "da-ana"))
				.isInstanceOf(LinkNotFoundException.class);
		assertThatThrownBy(() -> this.service.update(this.bruno, "da-ana", request))
				.isInstanceOf(LinkNotFoundException.class);
		assertThatThrownBy(() -> this.service.close(this.bruno, "da-ana"))
				.isInstanceOf(LinkNotFoundException.class);
		assertThat(this.links.findByCode("da-ana").orElseThrow().isPaused()).isFalse();
	}

	@Test
	void listsFilteringByState() {
		this.service.create(this.ana, request("example.com", "ativo-um"));
		this.service.create(this.ana, request("example.com", "pausado-um"));
		UpdateLinkRequest pause = new UpdateLinkRequest();
		pause.setPaused(true);
		this.service.update(this.ana, "pausado-um", pause);
		this.service.create(this.ana, request("example.com", "fechado-um"));
		this.service.close(this.ana, "fechado-um");

		assertThat(codes(LinkState.ACTIVE)).containsExactly("ativo-um");
		assertThat(codes(LinkState.PAUSED)).containsExactly("pausado-um");
		assertThat(codes(LinkState.CLOSED)).containsExactly("fechado-um");
		assertThat(codes(null)).hasSize(3);
	}

	private List<String> codes(LinkState state) {
		return this.service.list(this.ana, state, this.firstPage).getContent().stream().map(Link::getCode).toList();
	}

	@Test
	void doesNotRecordAThreatWhenEverythingIsFine() {
		this.service.create(this.ana, request("example.com", "tudo-certo"));

		assertThat(this.events.findAll()).isEmpty();
	}

	@Test
	void storesTheAttemptedCodeInTheEventWhenTheAliasNeverBecameALink() {
		assertThatThrownBy(() -> this.service.create(this.ana, request("javascript:alert(1)", "nasceu-nao")))
				.isInstanceOf(InvalidLinkException.class);

		BlockedEvent event = this.events.findAll().getFirst();
		assertThat(event.getDetail()).isEqualTo("nasceu-nao");
		assertThat(event.getLink()).isNull();
	}

}
