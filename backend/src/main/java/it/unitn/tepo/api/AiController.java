package it.unitn.tepo.api;

import it.unitn.tepo.ai.AiAssistant;
import it.unitn.tepo.ai.ScenarioProposal;
import it.unitn.tepo.ai.llm.AiProviderProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiAssistant assistant;
    private final AiProviderProperties providerProperties;

    public AiController(AiAssistant assistant,
                        ObjectProvider<AiProviderProperties> providerProperties) {
        this.assistant = assistant;
        this.providerProperties = providerProperties.getIfAvailable();
    }

    // Traduce testo libero in una proposta di scenario; l'applicazione resta in mano all'operatore.
    @PostMapping("/propose")
    public ScenarioProposal propose(@Valid @RequestBody AiProposalRequest request) {
        return assistant.propose(request.text());
    }

    // Stato dell'integrazione AI: LLM configurato oppure solo regole locali.
    @GetMapping("/status")
    public AiStatusResponse status() {
        boolean llmConfigured = providerProperties != null && providerProperties.isConfigured();
        String provider = llmConfigured ? "llm" : "rule-based";
        List<String> notes;
        if (llmConfigured) {
            notes = List.of(
                    "Provider LLM attivo. Endpoint: " + providerProperties.getEndpoint(),
                    "Modello: " + providerProperties.getModel(),
                    "Le proposte LLM richiedono sempre approvazione umana.",
                    "Fallback al rule-based in caso di errore."
            );
        } else {
            notes = List.of(
                    "Provider LLM non configurato: l'assistente usa un motore deterministico locale.",
                    "Le risposte sono generate da regole, non da un modello linguistico.",
                    "Per attivare l'LLM: profilo Spring 'llm' + variabile LLM_API_KEY."
            );
        }
        return new AiStatusResponse(llmConfigured, provider, notes);
    }

    public record AiProposalRequest(
            @NotBlank(message = "Il testo della richiesta non può essere vuoto")
            @Size(max = 2000, message = "Il testo non può superare 2000 caratteri")
            String text
    ) {}

    public record AiStatusResponse(
            boolean llmConfigured,
            String activeProvider,
            List<String> notes
    ) {}
}