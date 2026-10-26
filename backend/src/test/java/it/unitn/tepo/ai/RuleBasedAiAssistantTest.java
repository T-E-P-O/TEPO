package it.unitn.tepo.ai;

import it.unitn.tepo.application.InterventionOptionRepository;
import it.unitn.tepo.domain.InterventionOption;
import it.unitn.tepo.domain.Objective;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

// Test del parser a regole sui casi storici: suffissi k/mln, anni, decimali e default.
class RuleBasedAiAssistantTest {

    private InterventionOptionRepository repo;
    private RuleBasedAiAssistant assistant;

    @BeforeEach
    void setup() {
        repo = Mockito.mock(InterventionOptionRepository.class);
        InterventionOption stub = new InterventionOption();
        stub.setId("OPT-001");
        when(repo.findAll()).thenReturn(List.of(stub));
        assistant = new RuleBasedAiAssistant(repo);
    }

    // extractBudget: casi problematici

    @Test
    void shortNumberWithK() {
        assertEquals(Optional.of(8_000_000L), assistant.extractBudget("budget 80k"));
    }

    @Test
    void yearIsNotTreatedAsBudget() {
        assertEquals(Optional.of(40_000_000L), assistant.extractBudget("nel 2027 ho 400k"));
    }

    @Test
    void yearAfterNumberIsIgnored() {
        assertEquals(Optional.of(40_000_000L), assistant.extractBudget("400k nel 2027"));
    }

    @Test
    void decimalMillion() {
        assertEquals(Optional.of(150_000_000L), assistant.extractBudget("1,5 milioni"));
    }

    @Test
    void thousandsSeparatorWithContext() {
        assertEquals(Optional.of(50_000_000L), assistant.extractBudget("budget di 500.000 euro"));
    }

    @Test
    void shortUnitAlone() {
        assertEquals(Optional.of(50_000_000L), assistant.extractBudget("500k"));
    }

    @Test
    void noNumbersAtAll() {
        assertEquals(Optional.empty(), assistant.extractBudget("voglio ridurre la co2"));
    }

    @Test
    void weakContextWithEuroSymbol() {
        assertEquals(Optional.of(10_000_000L), assistant.extractBudget("spendere 100k€"));
    }

    @Test
    void isolatedNumberWithoutUnitOrContext() {
        // "3 edifici" senza contesto di budget -> nessun budget estraibile
        assertEquals(Optional.empty(), assistant.extractBudget("ho 3 edifici"));
    }

    @Test
    void budgetWithBareNumberAndKeyword() {
        assertEquals(Optional.of(30_000_000L), assistant.extractBudget("budget di 300.000"));
    }

    // propose: comportamento end-to-end

    @Test
    void proposeUsesDefaultWhenNoBudget() {
        ScenarioProposal p = assistant.propose("voglio ridurre la co2");
        assertEquals(RuleBasedAiAssistant.DEFAULT_BUDGET_CENTS, p.budgetCents());
        assertEquals(Objective.CO2_REDUCTION, p.objective());
        assertTrue(p.explanation().contains("default"),
                "La proposta deve spiegare che il budget è un default: " + p.explanation());
    }

    @Test
    void proposeExplainsParsedBudget() {
        ScenarioProposal p = assistant.propose("budget 500k");
        assertEquals(50_000_000L, p.budgetCents());
        assertFalse(p.explanation().contains("default"),
                "Non deve dichiarare default quando il budget è riconosciuto: " + p.explanation());
    }

    @Test
    void proposeDetectsCo2Objective() {
        ScenarioProposal p = assistant.propose("co2 con budget 300k");
        assertEquals(Objective.CO2_REDUCTION, p.objective());
        assertEquals(30_000_000L, p.budgetCents());
    }

    @Test
    void proposeDetectsEconomicObjective() {
        ScenarioProposal p = assistant.propose("risparmio economico con 400k");
        assertEquals(Objective.ECONOMIC_SAVING, p.objective());
        assertEquals(40_000_000L, p.budgetCents());
    }

    @Test
    void proposeDefaultsToEnergyObjective() {
        ScenarioProposal p = assistant.propose("voglio efficientare");
        assertEquals(Objective.ENERGY_SAVING, p.objective());
    }
}