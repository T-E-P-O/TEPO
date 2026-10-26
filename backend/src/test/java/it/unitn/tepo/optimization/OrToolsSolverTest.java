package it.unitn.tepo.optimization;

import it.unitn.tepo.domain.Objective;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class OrToolsSolverTest {

    private final OrToolsSolver solver = new OrToolsSolver();

    private CandidateOption opt(String id, long cost, long energy) {
        return new CandidateOption(id, "B", "T", cost, energy, energy, energy);
    }

    @Test
    void picksBestCombinationWhenBudgetIsLimited() {
        CandidateOption a = opt("A", 600000, 1200);
        CandidateOption b = opt("B", 500000, 950);
        CandidateOption c = opt("C", 500000, 950);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 1000000, Objective.ENERGY_SAVING, 1,
                List.of(a, b, c), List.of()
        );

        OptimizationResult result = solver.solve(problem, new SolverConfiguration(5));

        assertEquals(List.of("B", "C"), result.selectedOptionsId());
        assertEquals(1900, result.objectiveValue());
        assertEquals(0, result.remainingBudgetCents());
        assertEquals(SolverStatus.OPTIMAL, result.solverStatus());
    }

    @Test
    void zeroBudgetOnlySelectsFreeOptions() {
        CandidateOption free = opt("FREE", 0, 500);
        CandidateOption paid = opt("PAID", 100, 1000);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 0, Objective.ENERGY_SAVING, 1,
                List.of(free, paid), List.of()
        );

        OptimizationResult result = solver.solve(problem, new SolverConfiguration(5));
        assertEquals(List.of("FREE"), result.selectedOptionsId());
    }

    @Test
    void incompatibilityIsRespected() {
        CandidateOption a = opt("A", 100, 1000);
        CandidateOption b = opt("B", 100, 900);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 1000, Objective.ENERGY_SAVING, 1,
                List.of(a, b),
                List.of(new ScenarioConstraint.IncompatibilityConstraint("A", "B"))
        );

        OptimizationResult result = solver.solve(problem, new SolverConfiguration(5));
        assertEquals(1, result.selectedOptionsId().size());
        assertEquals("A", result.selectedOptionsId().get(0));
    }

    @Test
    void prerequisiteIsRespected() {
        CandidateOption a = opt("A", 100, 0);
        CandidateOption b = opt("B", 100, 1000);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 1000, Objective.ENERGY_SAVING, 1,
                List.of(a, b),
                List.of(new ScenarioConstraint.PrerequisiteConstraint("B", "A"))
        );

        OptimizationResult result = solver.solve(problem, new SolverConfiguration(5));
        assertTrue(result.selectedOptionsId().contains("A"));
        assertTrue(result.selectedOptionsId().contains("B"));
    }

    @Test
    void maxNumberIsRespected() {
        CandidateOption a = opt("A", 100, 1000);
        CandidateOption b = opt("B", 100, 900);
        CandidateOption c = opt("C", 100, 800);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 10000, Objective.ENERGY_SAVING, 1,
                List.of(a, b, c),
                List.of(new ScenarioConstraint.MaxNumberConstraint(2, List.of("A", "B", "C")))
        );

        OptimizationResult result = solver.solve(problem, new SolverConfiguration(5));
        assertEquals(2, result.selectedOptionsId().size());
    }

    @Test
    void infeasibleScenarioIsDetected() {
        CandidateOption a = opt("A", 100, 1000);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 1000, Objective.ENERGY_SAVING, 1,
                List.of(a),
                List.of(
                        new ScenarioConstraint.IncludeConstraint("A"),
                        new ScenarioConstraint.ExcludeConstraint("A")
                )
        );

        OptimizationResult result = solver.solve(problem, new SolverConfiguration(5));
        assertEquals(SolverStatus.INFEASIBLE, result.solverStatus());
        assertTrue(result.selectedOptionsId().isEmpty());
    }
}