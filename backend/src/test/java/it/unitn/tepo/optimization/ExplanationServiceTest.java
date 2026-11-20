package it.unitn.tepo.optimization;

import it.unitn.tepo.domain.Objective;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

class ExplanationServiceTest {

    private final BruteForceSolver solver = new BruteForceSolver();
    private final ExplanationService svc = new ExplanationService();

    private CandidateOption opt(String id, long cost, long energy) {
        return new CandidateOption(id, "B", "T", cost, energy, energy, energy);
    }

    @Test
    void selectedOptionGetsSelectedReason() {
        CandidateOption a = opt("A", 100, 1000);
        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 1000, Objective.ENERGY_SAVING, 1, List.of(a), List.of());
        OptimizationResult r = solver.solve(p, new SolverConfiguration(5));
        List<Explanation> ex = svc.explain(p, r);
        Map<String, Explanation> byId = ex.stream().collect(Collectors.toMap(Explanation::optionId, e -> e));
        assertEquals("SELEZIONATO", byId.get("A").reasonCode());
    }

    @Test
    void excludedForBudgetResidual() {
        CandidateOption a = opt("A", 500, 1000);
        CandidateOption b = opt("B", 600, 500);
        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 1000, Objective.ENERGY_SAVING, 1, List.of(a, b), List.of());
        OptimizationResult r = solver.solve(p, new SolverConfiguration(5));
        // A selezionato (1000), B escluso (residuo 500 < 600)
        List<Explanation> ex = svc.explain(p, r);
        Explanation forB = ex.stream().filter(e -> e.optionId().equals("B")).findFirst().orElseThrow();
        assertTrue(forB.reasonCode().startsWith("ESCLUSO_"));
    }

    @Test
    void excludedForIncompatibility() {
        CandidateOption a = opt("A", 500, 1000);
        CandidateOption b = opt("B", 500, 900);
        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 1000, Objective.ENERGY_SAVING, 1,
                List.of(a, b),
                List.of(new ScenarioConstraint.IncompatibilityConstraint("A", "B")));
        OptimizationResult r = solver.solve(p, new SolverConfiguration(5));
        List<Explanation> ex = svc.explain(p, r);
        Explanation forB = ex.stream().filter(e -> e.optionId().equals("B")).findFirst().orElseThrow();
        // B escluso perché incompatibile con A già selezionato
        assertEquals("ESCLUSO_INCOMPATIBILITA", forB.reasonCode());
    }

    @Test
    void explanationForEveryOptionPresent() {
        CandidateOption a = opt("A", 100, 500);
        CandidateOption b = opt("B", 100, 400);
        CandidateOption c = opt("C", 100, 300);
        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 200, Objective.ENERGY_SAVING, 1,
                List.of(a, b, c), List.of());
        OptimizationResult r = solver.solve(p, new SolverConfiguration(5));
        List<Explanation> ex = svc.explain(p, r);
        assertEquals(3, ex.size());
    }
}