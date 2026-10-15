FROM maven:3.10.0-eclipse-temurin-21-noble AS build

WORKDIR /build

COPY pom.xml ./
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q -DskipTests package

ARG OTEL_AGENT_VERSION=2.32.0
ARG OTEL_AGENT_SHA256=f787eb6c7f3d18e69a431e108a15278d25ee37f83d68b678f621e063f3988f82
RUN curl -fsSL -o /otel-agent.jar \
      "https://repo1.maven.org/maven2/io/opentelemetry/javaagent/opentelemetry-javaagent/${OTEL_AGENT_VERSION}/opentelemetry-javaagent-${OTEL_AGENT_VERSION}.jar" \
 && echo "${OTEL_AGENT_SHA256}  /otel-agent.jar" | sha256sum -c -

FROM eclipse-temurin:21-jre-noble

WORKDIR /app
COPY --from=build /otel-agent.jar /opt/otel/opentelemetry-javaagent.jar
COPY --from=build /build/target/*.jar /app/app.jar

ENV OTEL_SERVICE_NAME=l2-api \
    OTEL_SDK_DISABLED=true \
    OTEL_METRICS_EXPORTER=none \
    OTEL_LOGS_EXPORTER=none

USER 1001:1001

EXPOSE 8080 8081

ENTRYPOINT ["java", "-javaagent:/opt/otel/opentelemetry-javaagent.jar", "-jar", "/app/app.jar"]
