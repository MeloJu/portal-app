# GeoIP: país da Viagem

A API descobre o **país** de quem abriu um link e grava só isso em `travels.country`
(duas letras, ex.: `BR`). O IP é lido em memória para a consulta e descartado: não vai para o
banco, para log nem para cache (`docs/SECURITY.md`, seção 11). Os endpoints de país
(`/api/dashboard/countries` e `countries` em `/api/links/{code}/stats`) passam a ter dados.

Sem a base, **nada quebra**: `GEOIP_DB_PATH` vazio desliga o GeoIP e as Viagens ficam sem país.

## Como funciona

| Situação | O que acontece |
|---|---|
| `GEOIP_DB_PATH` vazio | GeoIP desligado; a API sobe normalmente |
| Caminho configurado e arquivo ausente, ilegível ou que não é a base **Country** | a API **não sobe**, com a mensagem do problema (melhor que gravar tudo sem país sem ninguém perceber) |
| IP privado, inválido ou fora da base | Viagem gravada sem país |
| Erro ao consultar | Viagem gravada sem país; o log traz só o tipo do erro, nunca o IP |

O IP vem de `request.getRemoteAddr()`. Atrás do Traefik isso só é o IP do visitante porque o
`application.yml` tem `server.forward-headers-strategy: native` (ele lê `X-Forwarded-For` apenas
de proxies da rede interna). Nomes como `localhost` nunca são resolvidos: só IP literal é aceito.

## 1. Conseguir a base (conta grátis)

1. Crie uma conta em <https://www.maxmind.com/en/geolite2/signup>.
2. Em *Manage License Keys* gere uma chave e anote o **Account ID**.
3. Baixe **GeoLite2 Country** (`GeoLite2-Country.mmdb`) em *Download Files*, ou use o
   `geoipupdate` (abaixo), que baixa e mantém atualizado.

**A base nunca entra no Git.** A licença da MaxMind proíbe redistribuir, e o `.gitignore` já
ignora `*.mmdb`. A chave de licença também é segredo: não vai em `.env` versionado, no código
nem em camada de imagem.

## 2. Rodar local

```powershell
$env:GEOIP_DB_PATH = "E:\geoip\GeoLite2-Country.mmdb"
cd backend
.\mvnw spring-boot:run
```

Para ver funcionando sem sair de casa, simule um visitante pelo `X-Forwarded-For` (em
`localhost` o Tomcat aceita esse cabeçalho porque o cliente é da rede interna):

```powershell
curl.exe -H "X-Forwarded-For: 8.8.8.8" -A "Mozilla/5.0 Chrome/129" http://localhost:8080/api/travel/SEU-CODIGO
```

Depois, logado, `GET /api/dashboard/countries` deve listar `US`. O teste que consulta a base de
verdade só roda quando a variável existe:

```powershell
$env:GEOIP_DB_PATH = "E:\geoip\GeoLite2-Country.mmdb"
.\mvnw test -Dtest=MaxMindGeoIpServiceTests
```

## 3. Produção: volume, não imagem

Use um **volume** montado só para leitura:

```
-v lumi-geoip:/data/geoip:ro  -e GEOIP_DB_PATH=/data/geoip/GeoLite2-Country.mmdb
```

Por que não pôr na imagem: a licença do GeoLite2 exige usar versões recentes da base (hoje, em
até 30 dias de cada atualização; confira o EULA), e uma imagem velha fica desatualizada; além
disso, a chave de licença precisaria estar no build.

Quem mantém o volume atualizado é o `geoipupdate` oficial, rodando ao lado da API (exemplo para o
compose; confira os nomes das variáveis na documentação da MaxMind):

```yaml
  geoipupdate:
    image: ghcr.io/maxmind/geoipupdate
    environment:
      GEOIPUPDATE_ACCOUNT_ID: ${MAXMIND_ACCOUNT_ID}
      GEOIPUPDATE_LICENSE_KEY: ${MAXMIND_LICENSE_KEY}
      GEOIPUPDATE_EDITION_IDS: GeoLite2-Country
      GEOIPUPDATE_FREQUENCY: 72
    volumes:
      - lumi-geoip:/usr/share/GeoIP
```

No Kubernetes o equivalente é um CronJob (ou initContainer) que escreve num PVC, montado
somente leitura na API. `MAXMIND_ACCOUNT_ID` e `MAXMIND_LICENSE_KEY` ficam em Secret.

A API lê a base **uma vez, ao subir**. Depois de uma atualização, faça um restart (rolling) dos
pods para ela usar o arquivo novo.

## 4. Atribuição e privacidade

- A licença pede, em algum lugar visível do produto ou da documentação, o texto:
  *This product includes GeoLite2 Data created by MaxMind, available from
  <https://www.maxmind.com>.*
- Se ligar o agente OpenTelemetry (`OTEL_SDK_DISABLED=false`), confira os atributos dos spans
  HTTP: o agente costuma incluir o endereço do cliente (`client.address`). Remova no
  collector para manter a promessa de não guardar IP.
