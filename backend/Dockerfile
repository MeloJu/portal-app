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
USER 1001

EXPOSE 8080 8081
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
