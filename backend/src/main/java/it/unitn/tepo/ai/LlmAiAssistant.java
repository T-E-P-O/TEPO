package it.unitn.tepo.ai;

import it.unitn.tepo.ai.llm.*;
import it.unitn.tepo.application.InterventionOptionRepository;
import it.unitn.tepo.domain.Objective;
import it.unitn.tepo.optimization.CandidateOption;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

// Assistente LLM: in errore torna alle regole locali; propone, non modifica mai i dati.
@Service
@Profile("llm")
@Primary
public class LlmAiAssistant implements AiAssistant {

    private static final Logger log = LoggerFactory.getLogger(LlmAiAssistant.class);

    private final AiProviderProperties props;
    private final LlmClient client;
    private final LlmResponseParser parser;
    private final RuleBasedAiAssistant ruleBased;
    private final InterventionOptionRepository optionRepo;

    public LlmAiAssistant(AiProviderProperties props,
                          LlmClient client,
                          LlmResponseParser parser,
                          RuleBasedAiAssistant ruleBased,
                          InterventionOptionRepository optionRepo) {
        this.props = props;
        this.client = client;
        this.parser = parser;
        this.ruleBased = ruleBased;
        this.optionRepo = optionRepo;
    }

    @Override
    public ScenarioProposal propose(String naturalLanguageRequest) {
        String text = naturalLanguageRequest == null ? "" : naturalLanguageRequest.strip();

        if (text.isEmpty()) {
            return ruleBased.propose(text);
        }
        if (text.length() > props.getMaxInputLength()) {
            text = text.substring(0, props.getMaxInputLength());
            log.info("Richiesta AI troncata a {} caratteri", props.getMaxInputLength());
        }

        if (!props.isConfigured()) {
            return fallback(text, "Provider LLM non configurato: uso assistente locale deterministico.",
                    null);
        }

        List<CandidateOption> candidates = snapshotCandidates();

        String raw;
        try {
            raw = client.complete(
                    LlmPromptTemplates.SYSTEM_PROMPT,
                    LlmPromptTemplates.userPrompt(text, candidates)
            );
        } catch (LlmClientException ex) {
            log.info("LLM call failed: kind={} msg={}", ex.getKind(), ex.getMessage());
            return fallback(text, "Errore dal provider LLM (" + ex.getKind() + "): "
                    + ex.getMessage() + ". Uso assistente locale.", null);
        }

        LlmRawProposal parsed;
        try {
            parsed = parser.parse(raw);
        } catch (LlmClientException ex) {
            log.info("LLM response unparsable: {}", ex.getMessage());
            return fallback(text, "Risposta LLM non interpretabile: " + ex.getMessage()
                    + ". Uso assistente locale.", null);
        }

        try {
            return mergeWithValidation(parsed, candidates, text);
        } catch (IllegalArgumentException ex) {
            log.info("LLM proposal invalid: {}", ex.getMessage());
            return fallback(text, "Proposta LLM non valida: " + ex.getMessage()
                    + ". Uso assistente locale.", null);
        }
    }

    private ScenarioProposal mergeWithValidation(LlmRawProposal parsed,
                                                 List<CandidateOption> candidates,
                                                 String originalText) {
        List<String> warnings = new ArrayList<>(safe(parsed.warnings()));
        List<String> missing = new ArrayList<>(safe(parsed.missingInformation()));

        // 1) Obiettivo: stringa nota o null.
        Objective objective = parser.parseObjective(parsed.objective());
        if (objective == null) {
            warnings.add("Obiettivo non riconosciuto nella risposta LLM: uso il valore di default ENERGY_SAVING.");
            objective = Objective.ENERGY_SAVING;
        }

        // 2) Budget: deve essere > 0 se specificato.
        long budget;
        if (parsed.budgetCents() == null) {
            budget = 500_000_00L;
            missing.add("budgetCents");
            warnings.add("Budget non specificato: uso il default 500000 EUR (50000000 cent).");
        } else if (parsed.budgetCents() <= 0) {
            throw new IllegalArgumentException("budgetCents non positivo: " + parsed.budgetCents());
        } else {
            budget = parsed.budgetCents();
        }

        // 3) maxNumber opzionale e positivo; non è in ScenarioProposal, ma va negli avvisi.
        if (parsed.maxNumber() != null) {
            if (parsed.maxNumber() <= 0) {
                warnings.add("maxNumber non positivo: ignorato.");
            } else {
                warnings.add("maxNumber = " + parsed.maxNumber()
                        + " rilevato ma non ancora applicato automaticamente; verifica manualmente.");
            }
        }

        // 4) excludedOptionIds: filtra solo ID presenti nel catalogo.
        Set<String> validIds = new HashSet<>();
        for (CandidateOption c : candidates) validIds.add(c.id());
        List<String> excluded = parser.filterValidIds(parsed.excludedOptionIds(), validIds);
        int dropped = (parsed.excludedOptionIds() == null ? 0
                : parsed.excludedOptionIds().size()) - excluded.size();
        if (dropped > 0) {
            warnings.add(dropped + " ID di esclusione non presenti nel catalogo sono stati ignorati.");
        }
        if (!excluded.isEmpty()) {
            warnings.add("Esclusioni proposte dall'LLM: " + excluded
                    + ". Verifica prima di applicare.");
        }

        // 5) Lista candidati finale: tutti gli ID del catalogo, meno gli esclusi validi.
        List<String> candidateIds = new ArrayList<>();
        for (CandidateOption c : candidates) {
            if (!excluded.contains(c.id())) candidateIds.add(c.id());
        }

        String explanation = parsed.reasoning() == null || parsed.reasoning().isBlank()
                ? "Proposta generata dal provider LLM."
                : parsed.reasoning().strip();

        return new ScenarioProposal(
                budget,
                objective,
                candidateIds,
                explanation,
                ScenarioProposal.ProposalSource.LLM,
                missing,
                warnings,
                true
        );
    }

    private ScenarioProposal fallback(String text, String reason, Throwable cause) {
        ScenarioProposal base = ruleBased.propose(text);
        List<String> warnings = new ArrayList<>();
        warnings.add(reason);
        return new ScenarioProposal(
                base.budgetCents(),
                base.objective(),
                base.candidateOptionIds(),
                base.explanation(),
                ScenarioProposal.ProposalSource.LLM_FALLBACK_RULE_BASED,
                base.missingInformation(),
                warnings,
                true
        );
    }

    private List<CandidateOption> snapshotCandidates() {
        List<CandidateOption> list = new ArrayList<>();
        optionRepo.findAll().forEach(o -> list.add(new CandidateOption(
                o.getId(),
                o.getBuildingId(),
                o.getInterventionTypeId(),
                o.getInvestmentCostCents(),
                o.getAnnualEnergySavingScaled(),
                o.getAnnualEconomicSavingCents(),
                o.getAnnualCo2ReductionScaled()
        )));
        return list;
    }

    private static <T> List<T> safe(List<T> l) {
        return l == null ? List.of() : l;
    }
}