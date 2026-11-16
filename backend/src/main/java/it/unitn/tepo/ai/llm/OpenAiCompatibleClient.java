package it.unitn.tepo.ai.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.SocketTimeoutException;
import java.net.http.HttpClient;
import java.net.http.HttpClient.Redirect;
import java.time.Duration;

// Client per endpoint compatibili OpenAI: non logga mai API key né prompt completi.
public class OpenAiCompatibleClient implements LlmClient {

    private static final Logger log = LoggerFactory.getLogger(OpenAiCompatibleClient.class);

    private final AiProviderProperties props;
    private final RestClient client;
    private final ObjectMapper objectMapper;

    public OpenAiCompatibleClient(AiProviderProperties props, ObjectMapper objectMapper) {
        this.props = props;
        this.objectMapper = objectMapper;

        HttpClient http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(Redirect.NORMAL)
                .build();
        org.springframework.http.client.JdkClientHttpRequestFactory factory =
                new org.springframework.http.client.JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(Duration.ofSeconds(props.getTimeoutSeconds()));

        this.client = RestClient.builder()
                .requestFactory(factory)
                .baseUrl(props.getEndpoint())
                .build();
    }

    @Override
    public String complete(String systemPrompt, String userPrompt) {
        if (!props.isConfigured()) {
            throw new LlmClientException(LlmClientException.Kind.NOT_CONFIGURED,
                    "Provider LLM non configurato (api-key mancante o provider disabilitato).");
        }

        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", props.getModel());
        body.put("temperature", props.getTemperature());
        body.put("max_tokens", props.getMaxTokens());
        ArrayNode messages = body.putArray("messages");
        ObjectNode sys = messages.addObject();
        sys.put("role", "system");
        sys.put("content", systemPrompt);
        ObjectNode usr = messages.addObject();
        usr.put("role", "user");
        usr.put("content", userPrompt);

        try {
            String raw = client.post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + props.getApiKey())
                    .body(body.toString())
                    .retrieve()
                    .body(String.class);

            return extractContent(raw);
        } catch (RestClientResponseException ex) {
            log.warn("LLM HTTP error status={} model={}", ex.getStatusCode().value(), props.getModel());
            throw new LlmClientException(LlmClientException.Kind.HTTP_ERROR,
                    "Errore HTTP dal provider LLM: " + ex.getStatusCode().value(), ex);
        } catch (ResourceAccessException ex) {
            boolean timeout = hasCause(ex, SocketTimeoutException.class);
            log.warn("LLM access error kind={} model={}", timeout ? "timeout" : "network", props.getModel());
            throw new LlmClientException(
                    timeout ? LlmClientException.Kind.TIMEOUT : LlmClientException.Kind.NETWORK,
                    "Provider LLM non raggiungibile: " + ex.getMessage(), ex);
        }
    }

    private String extractContent(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new LlmClientException(LlmClientException.Kind.MALFORMED_RESPONSE,
                    "Risposta LLM vuota");
        }
        try {
            JsonNode root = objectMapper.readTree(raw);
            JsonNode choices = root.path("choices");
            if (!choices.isArray() || choices.isEmpty()) {
                throw new LlmClientException(LlmClientException.Kind.MALFORMED_RESPONSE,
                        "Risposta LLM priva di 'choices'");
            }
            JsonNode content = choices.get(0).path("message").path("content");
            if (!content.isTextual()) {
                throw new LlmClientException(LlmClientException.Kind.MALFORMED_RESPONSE,
                        "Risposta LLM priva di 'message.content' testuale");
            }
            return content.asText();
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new LlmClientException(LlmClientException.Kind.MALFORMED_RESPONSE,
                    "Risposta LLM non è JSON valido", ex);
        }
    }

    private static boolean hasCause(Throwable t, Class<? extends Throwable> type) {
        while (t != null) {
            if (type.isInstance(t)) return true;
            t = t.getCause();
        }
        return false;
    }
}