package dev.l2.api.travel;

import dev.l2.api.TestcontainersConfiguration;
import dev.l2.api.link.Link;
import dev.l2.api.link.LinkNotFoundException;
import dev.l2.api.link.LinkRepository;
import dev.l2.api.link.LinkState;
import dev.l2.api.metrics.L2Metrics;
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

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE,
		properties = "spring.datasource.hikari.maximum-pool-size=24")
class TravelServiceTests {

	private static final String CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
			+ "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

	@Autowired
	private TravelService service;

	@Autowired
	private LinkRepository links;

	@Autowired
	private TravelRepository travels;

	@Autowired
	private UserRepository users;

	@Autowired
	private BlockedEventRepository events;

	@Autowired
	private MeterRegistry registry;

	private User owner;

	@BeforeEach
	void resetState() {
		this.events.deleteAll();
		this.travels.deleteAll();
		this.links.deleteAll();
		this.users.deleteAll();
		String email = "t" + UUID.randomUUID().toString().replace("-", "").substring(0, 10) + "@example.com";
		this.owner = this.users.save(new User(email, "$2a$10$" + "x".repeat(53), "Ana"));
	}

	private Link link(String code) {
		return this.links.save(new Link(this.owner, code, "https://example.com/destino", "Campanha"));
	}

	private double travelCount(boolean bot) {
		Counter counter = this.registry.find(L2Metrics.TRAVELS).tag("bot", Boolean.toString(bot)).counter();
		return (counter == null) ? 0 : counter.count();
	}

	@Test
	void registersTheTravelAndAnswersTheDestination() {
		link("viagem-um");

		TravelResponse response = this.service.travel("viagem-um", CHROME, "https://x.com/post");

		assertThat(response.targetUrl()).isEqualTo("https://example.com/destino");
		assertThat(response.title()).isEqualTo("Campanha");
		assertThat(response.travelCount()).isEqualTo(1);
	}

	@Test
	void countsTheTravelOnTheLinkAndKeepsTheHistory() {
		Link link = link("historico");

		this.service.travel("historico", CHROME, null);
		this.service.travel("historico", CHROME, null);

		assertThat(this.links.findByCode("historico").orElseThrow().getTravelCount()).isEqualTo(2);
		assertThat(this.travels.countByLinkId(link.getId())).isEqualTo(2);
	}

	@Test
	void marksTheTravelAsBotFromTheUserAgent() {
		Link link = link("robo");

		this.service.travel("robo", "curl/8.5.0", null);
		this.service.travel("robo", CHROME, null);

		assertThat(this.travels.countByLinkIdAndBot(link.getId(), true)).isEqualTo(1);
		assertThat(this.travels.countByLinkIdAndBot(link.getId(), false)).isEqualTo(1);
	}

	@Test
	void countsTravelsInPrometheusSeparatingBotFromHuman() {
		link("metrica");
		double humansBefore = travelCount(false);
		double botsBefore = travelCount(true);

		this.service.travel("metrica", CHROME, null);
		this.service.travel("metrica", "Googlebot/2.1", null);

		assertThat(travelCount(false)).isEqualTo(humansBefore + 1);
		assertThat(travelCount(true)).isEqualTo(botsBefore + 1);
	}

	@Test
	void savesTheUserAgentAndTheReferrer() {
		link("guarda");

		this.service.travel("guarda", CHROME, "https://x.com/post");

		Travel travel = this.travels.findAll().getFirst();
		assertThat(travel.getUserAgent()).isEqualTo(CHROME);
		assertThat(travel.getReferrer()).isEqualTo("https://x.com/post");
		assertThat(travel.getCountry()).isNull();
	}

	@Test
	void cutsAUserAgentLongerThanTheColumn() {
		link("comprido");

		this.service.travel("comprido", "a".repeat(900), "b".repeat(3000));

		Travel travel = this.travels.findAll().getFirst();
		assertThat(travel.getUserAgent()).hasSize(512);
		assertThat(travel.getReferrer()).hasSize(2048);
	}

	@Test
	void refusesAnUnknownCode() {
		assertThatThrownBy(() -> this.service.travel("nao-existe", CHROME, null))
				.isInstanceOf(LinkNotFoundException.class);

		assertThat(this.events.findAll()).isEmpty();
	}

	@Test
	void refusesAPausedLinkAndRecordsTheThreat() {
		Link link = link("pausado");
		link.setPaused(true);
		this.links.save(link);

		assertThatThrownBy(() -> this.service.travel("pausado", CHROME, null))
				.isInstanceOf(LinkNotTravelableException.class)
				.extracting(thrown -> ((LinkNotTravelableException) thrown).getState())
				.isEqualTo(LinkState.PAUSED);

		assertThat(this.events.findAll()).singleElement().satisfies(event -> {
			assertThat(event.getReason()).isEqualTo(BlockedEventReason.PAUSED);
			assertThat(event.getUser().getId()).isEqualTo(this.owner.getId());
			assertThat(event.getLink()).isNotNull();
		});
		assertThat(this.links.findByCode("pausado").orElseThrow().getTravelCount()).isZero();
		assertThat(this.travels.count()).isZero();
	}

	@Test
	void refusesAClosedLinkAndRecordsTheThreat() {
		Link link = link("fechado");
		link.close(Instant.now());
		this.links.save(link);

		assertThatThrownBy(() -> this.service.travel("fechado", CHROME, null))
				.isInstanceOf(LinkNotTravelableException.class)
				.extracting(thrown -> ((LinkNotTravelableException) thrown).getState())
				.isEqualTo(LinkState.CLOSED);

		assertThat(this.events.findAll()).singleElement()
				.satisfies(event -> assertThat(event.getReason()).isEqualTo(BlockedEventReason.CLOSED));
	}

	@Test
	void refusesAnExpiredLinkAsClosed() {
		Link link = link("vencido");
		link.setExpiresAt(Instant.now().minus(1, ChronoUnit.MINUTES));
		this.links.save(link);

		assertThatThrownBy(() -> this.service.travel("vencido", CHROME, null))
				.isInstanceOf(LinkNotTravelableException.class)
				.extracting(thrown -> ((LinkNotTravelableException) thrown).getState())
				.isEqualTo(LinkState.CLOSED);
	}

	@Test
	void refusesTheTravelThatWouldPassMaxTravels() {
		Link link = link("limite-um");
		link.setMaxTravels(1);
		this.links.save(link);

		assertThat(this.service.travel("limite-um", CHROME, null).travelCount()).isEqualTo(1);

		assertThatThrownBy(() -> this.service.travel("limite-um", CHROME, null))
				.isInstanceOf(LinkNotTravelableException.class);
		assertThat(this.links.findByCode("limite-um").orElseThrow().getTravelCount()).isEqualTo(1);
	}

	@Test
	void countsBotTravelsTowardMaxTravelsToo() {
		Link link = link("limite-robo");
		link.setMaxTravels(1);
		this.links.save(link);

		this.service.travel("limite-robo", "curl/8.5.0", null);

		assertThatThrownBy(() -> this.service.travel("limite-robo", CHROME, null))
				.isInstanceOf(LinkNotTravelableException.class);
	}

	@Test
	void neverGoesOverMaxTravelsWhenEverybodyArrivesAtOnce() throws Exception {
		Link link = link("corrida");
		link.setMaxTravels(5);
		this.links.save(link);

		int attempts = 20;
		ExecutorService pool = Executors.newFixedThreadPool(10);
		CountDownLatch start = new CountDownLatch(1);
		List<Future<Boolean>> results = new ArrayList<>();
		for (int attempt = 0; attempt < attempts; attempt++) {
			results.add(pool.submit(() -> {
				start.await();
				try {
					this.service.travel("corrida", CHROME, null);
					return true;
				}
				catch (LinkNotTravelableException refused) {
					return false;
				}
			}));
		}
		start.countDown();

		long traveled = 0;
		for (Future<Boolean> result : results) {
			if (result.get()) {
				traveled++;
			}
		}
		pool.shutdown();

		assertThat(traveled).isEqualTo(5);
		assertThat(this.links.findByCode("corrida").orElseThrow().getTravelCount()).isEqualTo(5);
		assertThat(this.travels.countByLinkId(link.getId())).isEqualTo(5);
	}

	@Test
	void doesNotLoseTravelsWhenEverybodyArrivesAtOnceWithoutALimit() throws Exception {
		Link link = link("sem-limite");
		int attempts = 20;
		ExecutorService pool = Executors.newFixedThreadPool(10);
		CountDownLatch start = new CountDownLatch(1);
		List<Future<?>> results = new ArrayList<>();
		for (int attempt = 0; attempt < attempts; attempt++) {
			results.add(pool.submit(() -> {
				start.await();
				return this.service.travel("sem-limite", CHROME, null);
			}));
		}
		start.countDown();
		for (Future<?> result : results) {
			result.get();
		}
		pool.shutdown();

		assertThat(this.links.findByCode("sem-limite").orElseThrow().getTravelCount()).isEqualTo(attempts);
		assertThat(this.travels.countByLinkId(link.getId())).isEqualTo(attempts);
	}

	@Test
	void alwaysAnswersACountThatAlreadyIncludesTheTravelItself() throws Exception {
		link("posicoes");
		int attempts = 12;
		ExecutorService pool = Executors.newFixedThreadPool(6);
		CountDownLatch start = new CountDownLatch(1);
		List<Future<Integer>> results = new ArrayList<>();
		for (int attempt = 0; attempt < attempts; attempt++) {
			results.add(pool.submit(() -> {
				start.await();
				return this.service.travel("posicoes", CHROME, null).travelCount();
			}));
		}
		start.countDown();

		List<Integer> positions = new ArrayList<>();
		for (Future<Integer> result : results) {
			positions.add(result.get());
		}
		pool.shutdown();

		assertThat(positions).hasSize(attempts).allSatisfy(position -> assertThat(position).isBetween(1, attempts));
		assertThat(positions.stream().mapToInt(Integer::intValue).max().orElseThrow()).isEqualTo(attempts);
	}

}
