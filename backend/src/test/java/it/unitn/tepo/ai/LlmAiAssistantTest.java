package it.unitn.tepo.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import it.unitn.tepo.ai.llm.AiProviderProperties;
import it.unitn.tepo.ai.llm.LlmClient;
import it.unitn.tepo.ai.llm.LlmClientException;
import it.unitn.tepo.ai.llm.LlmResponseParser;
import it.unitn.tepo.application.InterventionOptionRepository;
import it.unitn.tepo.domain.InterventionOption;
import it.unitn.tepo.domain.Objective;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

// Test dell'assistente LLM con client finto e repository simulato, senza rete né Spring.
class LlmAiAssistantTest {

    private InterventionOptionRepository repo;
    private LlmResponseParser parser;

    @BeforeEach
    void setup() {
        repo = Mockito.mock(InterventionOptionRepository.class);
        when(repo.findAll()).thenReturn(List.of(
                option("OPT-001"),
                option("OPT-002"),
                option("OPT-003")
        ));
        parser = new LlmResponseParser(new ObjectMapper());
    }

    private static InterventionOption option(String id) {
        InterventionOption o = new InterventionOption();
        o.setId(id);
        o.setBuildingId("B1");
        o.setInterventionTypeId("T1");
        o.setInvestmentCostCents(100_000);
        o.setAnnualEnergySavingScaled(1_000);
        o.setAnnualEconomicSavingCents(2_000);
        o.setAnnualCo2ReductionScaled(100);
        return o;
    }

    private LlmAiAssistant build(String response, AiProviderProperties props) {
        LlmClient fake = (sys, usr) -> response;
        return new LlmAiAssistant(props, fake, parser, new RuleBasedAiAssistant(repo), repo);
    }

    private LlmAiAssistant buildWithClient(LlmClient client, AiProviderProperties props) {
        return new LlmAiAssistant(props, client, parser, new RuleBasedAiAssistant(repo), repo);
    }

    private AiProviderProperties configured() {
        AiProviderProperties p = new AiProviderProperties();
        p.setEnabled(true);
        p.setApiKey("test-key");
        p.setEndpoint("http://localhost/never");
        p.setTimeoutSeconds(1);
        return p;
    }

    @Test
    void validLlmResponseIsMappedAndMarkedAsLlm() {
        String json = """
                {"budgetCents":12345678,"objective":"CO2_REDUCTION",
                 "maxNumber":null,"excludedOptionIds":["OPT-002"],
                 "missingInformation":[],"warnings":[],"reasoning":"ok"}
                """;
        ScenarioProposal p = build(json, configured()).propose("riduci co2");
        assertEquals(ScenarioProposal.ProposalSource.LLM, p.source());
        assertEquals(12345678L, p.budgetCents());
        assertEquals(Objective.CO2_REDUCTION, p.objective());
        assertTrue(p.candidateOptionIds().contains("OPT-001"));
        assertFalse(p.candidateOptionIds().contains("OPT-002"));
        assertTrue(p.requiresHumanReview());
    }

    @Test
    void malformedJsonFallsBackToRuleBased() {
        ScenarioProposal p = build("not json at all", configured()).propose("budget 100000");
        assertEquals(ScenarioProposal.ProposalSource.LLM_FALLBACK_RULE_BASED, p.source());
        assertFalse(p.warnings().isEmpty());
    }

    @Test
    void timeoutFallsBackWithWarning() {
        LlmClient timeoutClient = (sys, usr) -> {
            throw new LlmClientException(LlmClientException.Kind.TIMEOUT, "timeout di test");
        };
        ScenarioProposal p = buildWithClient(timeoutClient, configured()).propose("co2");
        assertEquals(ScenarioProposal.ProposalSource.LLM_FALLBACK_RULE_BASED, p.source());
        assertTrue(p.warnings().stream().anyMatch(w -> w.contains("TIMEOUT")));
    }

    @Test
    void httpErrorFallsBackWithWarning() {
        LlmClient errClient = (sys, usr) -> {
            throw new LlmClientException(LlmClientException.Kind.HTTP_ERROR, "500");
        };
        ScenarioProposal p = buildWithClient(errClient, configured()).propose("co2");
        assertEquals(ScenarioProposal.ProposalSource.LLM_FALLBACK_RULE_BASED, p.source());
    }

    @Test
    void notConfiguredProviderFallsBack() {
        AiProviderProperties unconfigured = new AiProviderProperties();
        ScenarioProposal p = build("{}", unconfigured).propose("qualsiasi");
        assertEquals(ScenarioProposal.ProposalSource.LLM_FALLBACK_RULE_BASED, p.source());
    }

    @Test
    void unknownExcludedIdsAreDroppedWithWarning() {
        String json = """
                {"budgetCents":1000000,"objective":"ENERGY_SAVING",
                 "excludedOptionIds":["OPT-001","GHOST"],
                 "missingInformation":[],"warnings":[],"reasoning":"x"}
                """;
        ScenarioProposal p = build(json, configured()).propose("efficienta");
        assertEquals(ScenarioProposal.ProposalSource.LLM, p.source());
        assertFalse(p.candidateOptionIds().contains("OPT-001"));
        assertTrue(p.candidateOptionIds().contains("OPT-002"));
        assertTrue(p.warnings().stream().anyMatch(w ->
                w.contains("GHOST") || w.contains("ignorati") || w.contains("non presenti")));
    }

    @Test
    void negativeBudgetMakesProposalInvalidAndFallsBack() {
        String json = """
                {"budgetCents":-5,"objective":"ENERGY_SAVING","excludedOptionIds":[]}
                """;
        ScenarioProposal p = build(json, configured()).propose("x");
        assertEquals(ScenarioProposal.ProposalSource.LLM_FALLBACK_RULE_BASED, p.source());
    }

    @Test
    void missingBudgetIsFilledWithWarning() {
        String json = """
                {"budgetCents":null,"objective":"ECONOMIC_SAVING","excludedOptionIds":[]}
                """;
        ScenarioProposal p = build(json, configured()).propose("risparmia");
        assertEquals(ScenarioProposal.ProposalSource.LLM, p.source());
        assertEquals(Objective.ECONOMIC_SAVING, p.objective());
        assertTrue(p.missingInformation().contains("budgetCents"));
        assertTrue(p.warnings().stream().anyMatch(w -> w.contains("default")));
    }

    @Test
    void emptyInputShortCircuitsToRuleBased() {
        ScenarioProposal p = build("{}", configured()).propose("");
        assertEquals(ScenarioProposal.ProposalSource.RULE_BASED, p.source());
    }

    @Test
    void unknownObjectiveFallsBackToEnergySaving() {
        String json = """
                {"budgetCents":1000000,"objective":"MADE_UP","excludedOptionIds":[]}
                """;
        ScenarioProposal p = build(json, configured()).propose("x");
        assertEquals(ScenarioProposal.ProposalSource.LLM, p.source());
        assertEquals(Objective.ENERGY_SAVING, p.objective());
        assertTrue(p.warnings().stream().anyMatch(w -> w.toLowerCase().contains("obiettivo")));
    }
}