package it.unitn.tepo.configuration;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Automatically parses cloud database URLs (such as Neon, Render, Heroku) into standard
 * Spring Boot DataSource properties.
 *
 * Handles URLs like:
 *   postgresql://user:password@host:port/database?sslmode=require
 *   postgres://user:password@host/database
 *   jdbc:postgresql://user:password@host/database
 *
 * Converts them to:
 *   spring.datasource.url = jdbc:postgresql://host:port/database?sslmode=require
 *   spring.datasource.username = user
 *   spring.datasource.password = password
 */
public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    public static final String SPRING_DATASOURCE_URL = "spring.datasource.url";
    public static final String SPRING_DATASOURCE_USERNAME = "spring.datasource.username";
    public static final String SPRING_DATASOURCE_PASSWORD = "spring.datasource.password";

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String rawUrl = environment.getProperty("DATABASE_URL");
        if (rawUrl == null || rawUrl.isBlank()) {
            rawUrl = environment.getProperty("DB_URL");
        }
        if (rawUrl == null || rawUrl.isBlank()) {
            rawUrl = environment.getProperty(SPRING_DATASOURCE_URL);
        }

        if (rawUrl == null || rawUrl.isBlank()) {
            return;
        }

        rawUrl = rawUrl.trim();

        if (rawUrl.startsWith("postgres://") || rawUrl.startsWith("postgresql://") || rawUrl.startsWith("jdbc:postgres")) {
            Map<String, Object> props = parseDatabaseUrl(rawUrl, environment);
            if (!props.isEmpty()) {
                environment.getPropertySources().addFirst(new MapPropertySource("cloudDatabaseUrlProperties", props));
            }
        }
    }

    public Map<String, Object> parseDatabaseUrl(String rawUrl, ConfigurableEnvironment environment) {
        Map<String, Object> result = new HashMap<>();

        try {
            String cleanUrl = rawUrl;
            if (cleanUrl.startsWith("jdbc:")) {
                cleanUrl = cleanUrl.substring(5);
            }
            if (cleanUrl.startsWith("postgres://")) {
                cleanUrl = "postgresql://" + cleanUrl.substring("postgres://".length());
            }

            URI uri = new URI(cleanUrl);
            String userInfo = uri.getUserInfo();
            String host = uri.getHost();
            int port = uri.getPort() > 0 ? uri.getPort() : 5432;
            String path = uri.getPath();
            String query = uri.getQuery();

            if (userInfo != null && !userInfo.isBlank()) {
                String[] parts = userInfo.split(":", 2);
                String user = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
                String pass = parts.length > 1 ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : "";

                String existingUser = environment != null ? environment.getProperty("DB_USERNAME") : null;
                if (existingUser == null || existingUser.isBlank() || "tepo".equals(existingUser)) {
                    result.put(SPRING_DATASOURCE_USERNAME, user);
                }

                String existingPass = environment != null ? environment.getProperty("DB_PASSWORD") : null;
                if (existingPass == null || existingPass.isBlank() || "tepo".equals(existingPass)) {
                    result.put(SPRING_DATASOURCE_PASSWORD, pass);
                }
            }

            if (host != null) {
                StringBuilder jdbcUrl = new StringBuilder("jdbc:postgresql://")
                        .append(host)
                        .append(":")
                        .append(port)
                        .append(path != null ? path : "");

                if (query != null && !query.isBlank()) {
                    jdbcUrl.append("?").append(query);
                }

                result.put(SPRING_DATASOURCE_URL, jdbcUrl.toString());
            }
        } catch (Exception e) {
            System.err.println("[DatabaseUrlEnvironmentPostProcessor] Warning: Could not parse database URL: " + e.getMessage());
        }

        return result;
    }
}
