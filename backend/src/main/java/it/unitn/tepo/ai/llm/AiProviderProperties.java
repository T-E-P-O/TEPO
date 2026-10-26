package it.unitn.tepo.ai.llm;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "tepo.ai")
public class AiProviderProperties {

    // Abilita il provider LLM. Se false, il bean LlmAiAssistant non viene creato.
    private boolean enabled = false;

    // URL completo dell'endpoint compatibile OpenAI (chat/completions).
    private String endpoint = "https://api.openai.com/v1/chat/completions";

    // Nome del modello.
    private String model = "gpt-4o-mini";

    // Chiave API letta dall'ambiente, mai committata.
    private String apiKey = "";

    // Timeout per la richiesta HTTP, in secondi.
    private int timeoutSeconds = 20;

    // Numero massimo di token generati.
    private int maxTokens = 512;

    // Se true, in caso di errore LLM il servizio torna alle regole locali con un avviso.
    private boolean fallbackOnError = true;

    // Lunghezza massima del testo utente accettato.
    private int maxInputLength = 2000;

    // Temperatura bassa per ottenere risposte deterministiche.
    private double temperature = 0.2;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public int getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(int timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }
    public int getMaxTokens() { return maxTokens; }
    public void setMaxTokens(int maxTokens) { this.maxTokens = maxTokens; }
    public boolean isFallbackOnError() { return fallbackOnError; }
    public void setFallbackOnError(boolean fallbackOnError) { this.fallbackOnError = fallbackOnError; }
    public int getMaxInputLength() { return maxInputLength; }
    public void setMaxInputLength(int maxInputLength) { this.maxInputLength = maxInputLength; }
    public double getTemperature() { return temperature; }
    public void setTemperature(double temperature) { this.temperature = temperature; }

    public boolean isConfigured() {
        return enabled && apiKey != null && !apiKey.isBlank();
    }
}