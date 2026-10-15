# syntax=docker/dockerfile:1
# Contexto de build: backend/

FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /src

# Camada de dependencias separada do codigo: so refaz quando o pom muda.
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q dependency:go-offline

COPY src src
# Os testes rodam no CI (precisam do Docker para o Testcontainers), nao na imagem.
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q -DskipTests package \
 && cp target/l2-api-*.jar /app.jar

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Nao-root (SECURITY.md secao 10). O Deployment monta um emptyDir em /tmp.
RUN addgroup -g 1001 app && adduser -u 1001 -G app -S -H app
COPY --from=build --chown=1001:1001 /app.jar /app/app.jar

# Agente OpenTelemetry (traces). So e carregado quando o Deployment poe
# -javaagent:/app/opentelemetry-javaagent.jar em JAVA_TOOL_OPTIONS; sem isso a imagem roda igual.
# O checksum garante que o jar baixado e exatamente o auditado. ADD de URL cria o arquivo
# com modo 600, por isso o --chmod (a app roda como 1001).
ARG OTEL_AGENT_VERSION=2.31.1
ARG OTEL_AGENT_SHA256=bbf83c151b6400709e2f225bdd07a04f839d9d13b8b93464241333fd25d3e3ba
ADD --chmod=0644 --checksum=sha256:${OTEL_AGENT_SHA256} \
    https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${OTEL_AGENT_VERSION}/opentelemetry-javaagent.jar \
    /app/opentelemetry-javaagent.jar

USER 1001

EXPOSE 8080 8081
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
