package it.unitn.tepo.ai;

import it.unitn.tepo.domain.Objective;

import java.util.List;

// Proposta di scenario da revisionare: non è un comando e non viene applicata da sola.
public record ScenarioProposal(
        long budgetCents,
        Objective objective,
        List<String> candidateOptionIds,
        String explanation,
        ProposalSource source,
        List<String> missingInformation,
        List<String> warnings,
        boolean requiresHumanReview
) {

    public enum ProposalSource {
        RULE_BASED,
        LLM,
        LLM_FALLBACK_RULE_BASED
    }

    // Costruttore retro-compatibile: proposta basata su regole, senza avvisi.
    public ScenarioProposal(long budgetCents, Objective objective,
                            List<String> candidateOptionIds, String explanation) {
        this(budgetCents, objective, candidateOptionIds, explanation,
                ProposalSource.RULE_BASED, List.of(), List.of(), true);
    }
}