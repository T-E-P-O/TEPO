package it.unitn.tepo.configuration;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class DatabaseUrlEnvironmentPostProcessorTest {

    private final DatabaseUrlEnvironmentPostProcessor processor = new DatabaseUrlEnvironmentPostProcessor();

    @Test
    void shouldParseNeonPostgresqlUrlWithCredentialsAndParams() {
        MockEnvironment env = new MockEnvironment();
        String rawUrl = "postgresql://mirco_user:super_secret@ep-cool-fog-12345.eu-central-1.aws.neon.tech/neondb?sslmode=require";

        Map<String, Object> parsed = processor.parseDatabaseUrl(rawUrl, env);

        assertThat(parsed).containsEntry(
                DatabaseUrlEnvironmentPostProcessor.SPRING_DATASOURCE_URL,
                "jdbc:postgresql://ep-cool-fog-12345.eu-central-1.aws.neon.tech:5432/neondb?sslmode=require"
        );
        assertThat(parsed).containsEntry(DatabaseUrlEnvironmentPostProcessor.SPRING_DATASOURCE_USERNAME, "mirco_user");
        assertThat(parsed).containsEntry(DatabaseUrlEnvironmentPostProcessor.SPRING_DATASOURCE_PASSWORD, "super_secret");
    }

    @Test
    void shouldParsePostgresSchemeWithCustomPort() {
        MockEnvironment env = new MockEnvironment();
        String rawUrl = "postgres://usr:pwd@db.render.internal:6543/proddb";

        Map<String, Object> parsed = processor.parseDatabaseUrl(rawUrl, env);

        assertThat(parsed).containsEntry(
                DatabaseUrlEnvironmentPostProcessor.SPRING_DATASOURCE_URL,
                "jdbc:postgresql://db.render.internal:6543/proddb"
        );
        assertThat(parsed).containsEntry(DatabaseUrlEnvironmentPostProcessor.SPRING_DATASOURCE_USERNAME, "usr");
        assertThat(parsed).containsEntry(DatabaseUrlEnvironmentPostProcessor.SPRING_DATASOURCE_PASSWORD, "pwd");
    }

    @Test
    void shouldHandleJdbcPrefixWithCredentials() {
        MockEnvironment env = new MockEnvironment();
        String rawUrl = "jdbc:postgresql://admin:pass123@myhost.com:5432/testdb";

        Map<String, Object> parsed = processor.parseDatabaseUrl(rawUrl, env);

        assertThat(parsed).containsEntry(
                DatabaseUrlEnvironmentPostProcessor.SPRING_DATASOURCE_URL,
                "jdbc:postgresql://myhost.com:5432/testdb"
        );
        assertThat(parsed).containsEntry(DatabaseUrlEnvironmentPostProcessor.SPRING_DATASOURCE_USERNAME, "admin");
        assertThat(parsed).containsEntry(DatabaseUrlEnvironmentPostProcessor.SPRING_DATASOURCE_PASSWORD, "pass123");
    }

    @Test
    void shouldPostProcessEnvironmentUsingDatabaseUrlProperty() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("DATABASE_URL", "postgresql://cloud_user:cloud_pass@ep-host.tech/dbname?sslmode=require");

        processor.postProcessEnvironment(env, null);

        assertThat(env.getProperty(DatabaseUrlEnvironmentPostProcessor.SPRING_DATASOURCE_URL))
                .isEqualTo("jdbc:postgresql://ep-host.tech:5432/dbname?sslmode=require");
        assertThat(env.getProperty(DatabaseUrlEnvironmentPostProcessor.SPRING_DATASOURCE_USERNAME))
                .isEqualTo("cloud_user");
        assertThat(env.getProperty(DatabaseUrlEnvironmentPostProcessor.SPRING_DATASOURCE_PASSWORD))
                .isEqualTo("cloud_pass");
    }

    @Test
    void shouldPostProcessEnvironmentUsingDbUrlProperty() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("DB_URL", "postgresql://cloud_user2:cloud_pass2@ep-host2.tech/dbname2");

        processor.postProcessEnvironment(env, null);

        assertThat(env.getProperty(DatabaseUrlEnvironmentPostProcessor.SPRING_DATASOURCE_URL))
                .isEqualTo("jdbc:postgresql://ep-host2.tech:5432/dbname2");
        assertThat(env.getProperty(DatabaseUrlEnvironmentPostProcessor.SPRING_DATASOURCE_USERNAME))
                .isEqualTo("cloud_user2");
        assertThat(env.getProperty(DatabaseUrlEnvironmentPostProcessor.SPRING_DATASOURCE_PASSWORD))
                .isEqualTo("cloud_pass2");
    }
}
