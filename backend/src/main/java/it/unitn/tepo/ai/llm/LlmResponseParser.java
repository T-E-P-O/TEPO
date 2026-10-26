package it.unitn.tepo.ai.llm;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import it.unitn.tepo.domain.Objective;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

// Converte il JSON dell'LLM in LlmRawProposal, gestendo blocchi markdown e JSON malformato.
@Component
public class LlmResponseParser {

    private final ObjectMapper objectMapper;

    public LlmResponseParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public LlmRawProposal parse(String rawText) {
        if (rawText == null || rawText.isBlank()) {
            throw new LlmClientException(LlmClientException.Kind.MALFORMED_RESPONSE,
                    "Risposta LLM vuota");
        }
        String cleaned = stripCodeFences(rawText.strip());
        try {
            return objectMapper.readValue(cleaned, LlmRawProposal.class);
        } catch (JsonProcessingException ex) {
            throw new LlmClientException(LlmClientException.Kind.MALFORMED_RESPONSE,
                    "Risposta LLM non è JSON valido", ex);
        }
    }

    // Estrae l'enum Objective, restituendo null se assente o non riconosciuto.
    public Objective parseObjective(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return Objective.valueOf(raw.strip().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    // Filtra gli ID escludendo quelli non presenti nell'insieme dei candidati.
    public List<String> filterValidIds(List<String> ids, Set<String> validIds) {
        if (ids == null) return List.of();
        List<String> out = new ArrayList<>();
        for (String id : ids) {
            if (id != null && validIds.contains(id)) out.add(id);
        }
        return out;
    }

    private String stripCodeFences(String s) {
        if (s.startsWith("```")) {
            int firstNl = s.indexOf('\n');
            if (firstNl > 0) s = s.substring(firstNl + 1);
            if (s.endsWith("```")) s = s.substring(0, s.length() - 3);
            return s.strip();
        }
        return s;
    }
}