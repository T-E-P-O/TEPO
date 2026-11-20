package it.unitn.tepo.optimization;

import it.unitn.tepo.domain.Objective;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

// Regressione Fase C — P1: prerequisiti non candidati, hash canonico e parità solver.
class SolverEdgeCaseTest {

    private final OrToolsSolver orTools = new OrToolsSolver();
    private final BruteForceSolver bruteForce = new BruteForceSolver();

    private static CandidateOption opt(String id, long cost, long energy) {
        return new CandidateOption(id, "B1", "T1", cost, energy, energy * 2, energy / 10);
    }

    @Test
    void prerequisiteToNonCandidateForcesDependentOff() {
        List<CandidateOption> options = List.of(
                opt("A", 100, 500),
                opt("C", 100, 300)
        );
        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "s", 1000, Objective.ENERGY_SAVING, 1,
                options,
                List.of(new ScenarioConstraint.PrerequisiteConstraint("A", "B"))
        );

        OptimizationResult r1 = orTools.solve(problem, SolverConfiguration.defaultConfig());
        OptimizationResult r2 = bruteForce.solve(problem, SolverConfiguration.defaultConfig());

        assertFalse(r1.selectedOptionsId().contains("A"),
                "A non deve essere selezionata se il prerequisito B è assente dai candidati");
        assertFalse(r2.selectedOptionsId().contains("A"));
        assertEquals(r2.selectedOptionsId(), r1.selectedOptionsId());
        assertEquals(r2.objectiveValue(), r1.objectiveValue());
        assertEquals(SolverStatus.OPTIMAL, r1.solverStatus());
    }

    @Test
    void prerequisiteToNonCandidateDoesNotForceInfeasibilityOfWholeScenario() {
        List<CandidateOption> options = List.of(
                opt("A", 10, 9000),
                opt("C", 100, 500)
        );
        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "s", 1000, Objective.ENERGY_SAVING, 1,
                options,
                List.of(new ScenarioConstraint.PrerequisiteConstraint("A", "B"))
        );

        OptimizationResult r = orTools.solve(problem, SolverConfiguration.defaultConfig());
        assertEquals(SolverStatus.OPTIMAL, r.solverStatus());
        assertEquals(List.of("C"), r.selectedOptionsId());
    }

    @Test
    void includeNonCandidateIsInfeasible() {
        List<CandidateOption> options = List.of(opt("A", 100, 500));
        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "s", 1000, Objective.ENERGY_SAVING, 1,
                options,
                List.of(new ScenarioConstraint.IncludeConstraint("Z"))
        );
        OptimizationResult r1 = orTools.solve(problem, SolverConfiguration.defaultConfig());
        OptimizationResult r2 = bruteForce.solve(problem, SolverConfiguration.defaultConfig());
        assertEquals(SolverStatus.INFEASIBLE, r1.solverStatus());
        assertEquals(SolverStatus.INFEASIBLE, r2.solverStatus());
    }

    @Test
    void problemHashStableUnderOptionReordering() {
        List<CandidateOption> a = new ArrayList<>(List.of(opt("A", 100, 500), opt("B", 200, 300)));
        List<CandidateOption> b = new ArrayList<>(List.of(opt("B", 200, 300), opt("A", 100, 500)));
        OptimizationProblem p1 = new OptimizationProblem("1.0", "s", 1000, Objective.ENERGY_SAVING, 1, a, List.of());
        OptimizationProblem p2 = new OptimizationProblem("1.0", "s", 1000, Objective.ENERGY_SAVING, 1, b, List.of());
        assertEquals(ProblemHasher.hash(p1), ProblemHasher.hash(p2));
    }

    @Test
    void problemHashStableUnderConstraintReordering() {
        List<CandidateOption> opts = List.of(opt("A", 100, 500), opt("B", 200, 300));
        ScenarioConstraint c1 = new ScenarioConstraint.IncompatibilityConstraint("A", "B");
        ScenarioConstraint c2 = new ScenarioConstraint.ExcludeConstraint("C");
        OptimizationProblem p1 = new OptimizationProblem("1.0", "s", 1000, Objective.ENERGY_SAVING, 1, opts, List.of(c1, c2));
        OptimizationProblem p2 = new OptimizationProblem("1.0", "s", 1000, Objective.ENERGY_SAVING, 1, opts, List.of(c2, c1));
        assertEquals(ProblemHasher.hash(p1), ProblemHasher.hash(p2));
    }

    @Test
    void problemHashIncompatibilityIsOrderInsensitive() {
        List<CandidateOption> opts = List.of(opt("A", 100, 500), opt("B", 200, 300));
        OptimizationProblem p1 = new OptimizationProblem("1.0", "s", 1000, Objective.ENERGY_SAVING, 1, opts,
                List.of(new ScenarioConstraint.IncompatibilityConstraint("A", "B")));
        OptimizationProblem p2 = new OptimizationProblem("1.0", "s", 1000, Objective.ENERGY_SAVING, 1, opts,
                List.of(new ScenarioConstraint.IncompatibilityConstraint("B", "A")));
        assertEquals(ProblemHasher.hash(p1), ProblemHasher.hash(p2));
    }

    @Test
    void problemHashDiffersForDifferentBudgets() {
        List<CandidateOption> opts = List.of(opt("A", 100, 500));
        OptimizationProblem p1 = new OptimizationProblem("1.0", "s", 1000, Objective.ENERGY_SAVING, 1, opts, List.of());
        OptimizationProblem p2 = new OptimizationProblem("1.0", "s", 5000, Objective.ENERGY_SAVING, 1, opts, List.of());
        assertNotEquals(ProblemHasher.hash(p1), ProblemHasher.hash(p2));
    }

    @Test
    void bothSolversProduceSameHashForSameProblem() {
        List<CandidateOption> opts = List.of(opt("A", 100, 500), opt("B", 200, 300));
        OptimizationProblem problem = new OptimizationProblem("1.0", "s", 1000, Objective.ENERGY_SAVING, 1, opts,
                List.of(new ScenarioConstraint.IncompatibilityConstraint("A", "B")));
        OptimizationResult r1 = orTools.solve(problem, SolverConfiguration.defaultConfig());
        OptimizationResult r2 = bruteForce.solve(problem, SolverConfiguration.defaultConfig());
        assertEquals(r1.problemHash(), r2.problemHash());
    }
}