package it.unitn.tepo.optimization;

import it.unitn.tepo.domain.Objective;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

// OrToolsSolver e BruteForceSolver devono dare lo stesso ottimo sui piccoli problemi.
class SolverParityTest {

    private final OrToolsSolver orTools = new OrToolsSolver();
    private final BruteForceSolver brute = new BruteForceSolver();

    private CandidateOption opt(String id, long cost, long energy) {
        return new CandidateOption(id, "B", "T", cost, energy, energy, energy);
    }

    @Test
    void parityOnSimpleKnapsack() {
        CandidateOption a = opt("A", 600000, 1200);
        CandidateOption b = opt("B", 500000, 950);
        CandidateOption c = opt("C", 500000, 950);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 1000000, Objective.ENERGY_SAVING, 1,
                List.of(a, b, c), List.of()
        );

        OptimizationResult rOr = orTools.solve(problem, new SolverConfiguration(10));
        OptimizationResult rBf = brute.solve(problem, new SolverConfiguration(10));

        assertEquals(rBf.objectiveValue(), rOr.objectiveValue());
        assertEquals(rBf.totalInvestmentCents(), rOr.totalInvestmentCents());
    }

    @Test
    void parityWithIncompatibility() {
        CandidateOption a = opt("A", 100, 1000);
        CandidateOption b = opt("B", 100, 900);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 1000, Objective.ENERGY_SAVING, 1,
                List.of(a, b),
                List.of(new ScenarioConstraint.IncompatibilityConstraint("A", "B"))
        );

        OptimizationResult rOr = orTools.solve(problem, new SolverConfiguration(10));
        OptimizationResult rBf = brute.solve(problem, new SolverConfiguration(10));

        assertEquals(rBf.objectiveValue(), rOr.objectiveValue());
        assertEquals(List.of("A"), rOr.selectedOptionsId());
    }

    @Test
    void parityWithPrerequisite() {
        CandidateOption a = opt("A", 100, 0);
        CandidateOption b = opt("B", 100, 1000);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 1000, Objective.ENERGY_SAVING, 1,
                List.of(a, b),
                List.of(new ScenarioConstraint.PrerequisiteConstraint("B", "A"))
        );

        OptimizationResult rOr = orTools.solve(problem, new SolverConfiguration(10));
        OptimizationResult rBf = brute.solve(problem, new SolverConfiguration(10));

        assertEquals(rBf.objectiveValue(), rOr.objectiveValue());
        assertEquals(rBf.totalInvestmentCents(), rOr.totalInvestmentCents());
    }

    @Test
    void bothReturnInfeasibleWhenIncludeExcludeConflict() {
        CandidateOption a = opt("A", 100, 1000);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 1000, Objective.ENERGY_SAVING, 1,
                List.of(a),
                List.of(
                        new ScenarioConstraint.IncludeConstraint("A"),
                        new ScenarioConstraint.ExcludeConstraint("A")
                )
        );

        OptimizationResult rOr = orTools.solve(problem, new SolverConfiguration(10));
        OptimizationResult rBf = brute.solve(problem, new SolverConfiguration(10));

        assertEquals(SolverStatus.INFEASIBLE, rOr.solverStatus());
        assertEquals(SolverStatus.INFEASIBLE, rBf.solverStatus());
    }
}