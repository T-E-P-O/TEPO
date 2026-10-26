package it.unitn.tepo.optimization;

import it.unitn.tepo.domain.Objective;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

// Test mirati sui codici di motivazione: diagnosi corrette con vincoli specifici.
class ExplanationReasonCodeTest {

    private final OrToolsSolver solver = new OrToolsSolver();
    private final ExplanationService service = new ExplanationService();

    private static CandidateOption opt(String id, long cost, long energy) {
        return new CandidateOption(id, "B1", "T1", cost, energy, energy * 20, energy / 4);
    }

    private List<Explanation> runAndExplain(OptimizationProblem p) {
        OptimizationResult r = solver.solve(p, SolverConfiguration.defaultConfig());
        return service.explain(p, r);
    }

    private Explanation forOption(List<Explanation> list, String id) {
        return list.stream().filter(e -> e.optionId().equals(id)).findFirst()
                .orElseThrow(() -> new AssertionError("Nessuna spiegazione per " + id));
    }

    // ESCLUSO_ESPLICITO

    @Test
    void explicitExclusionEmitsDedicatedReasonCode() {
        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 1000, Objective.ENERGY_SAVING, 1,
                List.of(opt("A", 100, 500), opt("B", 100, 500)),
                List.of(new ScenarioConstraint.ExcludeConstraint("B"))
        );

        List<Explanation> explanations = runAndExplain(p);

        assertEquals("ESCLUSO_ESPLICITO", forOption(explanations, "B").reasonCode());
        assertEquals("SELEZIONATO", forOption(explanations, "A").reasonCode());
    }

    // ESCLUSO_MAX_NUMBER

    @Test
    void saturatedMaxNumberEmitsDedicatedReasonCode() {
        // Budget per più opzioni, ma MaxNumber K=1 su [A,B,C]: due restano bloccate dal limite.
        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 10_000, Objective.ENERGY_SAVING, 1,
                List.of(opt("A", 100, 500), opt("B", 100, 400), opt("C", 100, 300)),
                List.of(new ScenarioConstraint.MaxNumberConstraint(1, List.of("A", "B", "C")))
        );

        List<Explanation> explanations = runAndExplain(p);

        assertEquals("SELEZIONATO", forOption(explanations, "A").reasonCode());
        assertEquals("ESCLUSO_MAX_NUMBER", forOption(explanations, "B").reasonCode());
        assertEquals("ESCLUSO_MAX_NUMBER", forOption(explanations, "C").reasonCode());
    }

    @Test
    void unsaturatedMaxNumberDoesNotEmitMaxNumberReason() {
        // K=5 è lontano dal saturarsi: le opzioni escluse non devono chiamare in causa maxNumber.
        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 150, Objective.ENERGY_SAVING, 1,
                List.of(opt("A", 100, 500), opt("B", 100, 400)),
                List.of(new ScenarioConstraint.MaxNumberConstraint(5, List.of("A", "B")))
        );

        List<Explanation> explanations = runAndExplain(p);

        assertEquals("SELEZIONATO", forOption(explanations, "A").reasonCode());
        assertNotEquals("ESCLUSO_MAX_NUMBER", forOption(explanations, "B").reasonCode(),
                "Il max number non è saturo: la sua presenza non deve dominare la diagnosi");
    }

    // SELEZIONATO_PREREQUISITO

    @Test
    void selectedPrerequisiteIsFlaggedOnlyWhenDependentIsSelected() {
        // B richiede A ed è conveniente: A viene selezionato, ma ha benefici propri, non è prerequisito.
        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 10_000, Objective.ENERGY_SAVING, 1,
                List.of(opt("A", 100, 500), opt("B", 100, 900)),
                List.of(new ScenarioConstraint.PrerequisiteConstraint("B", "A"))
        );

        List<Explanation> explanations = runAndExplain(p);

        assertEquals("SELEZIONATO", forOption(explanations, "A").reasonCode(),
                "A ha benefici propri: il prerequisito non cambia il reason code");
        assertEquals("SELEZIONATO", forOption(explanations, "B").reasonCode());
    }

    @Test
    void prereqZeroBenefitFlaggedOnlyWhenDependentSelected() {
        // A ha benefici zero e funge da prerequisito per B. Se B è selezionato, A merita SELEZIONATO_PREREQUISITO.
        CandidateOption aZero = new CandidateOption("A", "B1", "T1", 10, 0, 0, 0);
        CandidateOption bHigh = new CandidateOption("B", "B1", "T1", 100, 1000, 20_000, 250);

        OptimizationProblem pWithB = new OptimizationProblem(
                "1.0", "s", 10_000, Objective.ENERGY_SAVING, 1,
                List.of(aZero, bHigh),
                List.of(new ScenarioConstraint.PrerequisiteConstraint("B", "A"))
        );

        List<Explanation> explanations = runAndExplain(pWithB);

        assertEquals("SELEZIONATO_PREREQUISITO", forOption(explanations, "A").reasonCode());
        assertEquals("SELEZIONATO", forOption(explanations, "B").reasonCode());
    }

    // Regressione: codici di motivazione esistenti

    @Test
    void incompatibilityStillEmitsDedicatedReason() {
        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 10_000, Objective.ENERGY_SAVING, 1,
                List.of(opt("A", 100, 500), opt("B", 100, 300)),
                List.of(new ScenarioConstraint.IncompatibilityConstraint("A", "B"))
        );

        List<Explanation> explanations = runAndExplain(p);

        assertEquals("SELEZIONATO", forOption(explanations, "A").reasonCode());
        assertEquals("ESCLUSO_INCOMPATIBILITA", forOption(explanations, "B").reasonCode());
    }

    @Test
    void missingPrerequisiteStillEmitsDedicatedReason() {
        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 10_000, Objective.ENERGY_SAVING, 1,
                List.of(opt("A", 100, 500), opt("B", 100, 300)),
                List.of(new ScenarioConstraint.PrerequisiteConstraint("B", "Z"))
        );

        List<Explanation> explanations = runAndExplain(p);

        assertEquals("SELEZIONATO", forOption(explanations, "A").reasonCode());
        assertEquals("ESCLUSO_PREREQUISITO", forOption(explanations, "B").reasonCode());
    }

    @Test
    void residualBudgetStillEmitsDedicatedReason() {
        // Budget 150: A e B non entrano insieme; l'escluso riceve ESCLUSO_BUDGET_RESIDUO.
        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 150, Objective.ENERGY_SAVING, 1,
                List.of(opt("A", 100, 500), opt("B", 100, 300)),
                List.of()
        );

        List<Explanation> explanations = runAndExplain(p);

        assertEquals("SELEZIONATO", forOption(explanations, "A").reasonCode());
        assertEquals("ESCLUSO_BUDGET_RESIDUO", forOption(explanations, "B").reasonCode());
    }
}