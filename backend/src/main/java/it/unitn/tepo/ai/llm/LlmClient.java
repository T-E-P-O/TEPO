package it.unitn.tepo.ai.llm;

// Client LLM minimale: prompt di sistema e utente, restituisce il testo o LlmClientException.
public interface LlmClient {

    // Invia il prompt e restituisce il testo generato.
    String complete(String systemPrompt, String userPrompt);
}