package it.unitn.tepo.optimization;

import it.unitn.tepo.domain.Objective;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class BruteForceSolverTest {

    private final BruteForceSolver solver = new BruteForceSolver();

    private CandidateOption opt(String id, long cost, long energy) {
        return new CandidateOption(id, "B", "T", cost, energy, energy, energy);
    }

    @Test
    void matchesPitchExampleBudget10k() {
        CandidateOption a = opt("A", 600000, 1200);
        CandidateOption b = opt("B", 500000, 950);
        CandidateOption c = opt("C", 500000, 950);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 1000000, Objective.ENERGY_SAVING, 1,
                List.of(a, b, c), List.of()
        );

        OptimizationResult r = solver.solve(problem, new SolverConfiguration(5));
        assertEquals(List.of("B", "C"), r.selectedOptionsId());
        assertEquals(1900, r.objectiveValue());
        assertEquals(0, r.remainingBudgetCents());
        assertEquals(SolverStatus.OPTIMAL, r.solverStatus());
        assertTrue(r.optimalityProven());
        assertTrue(r.canonicalTieBreakCompleted());
    }

    @Test
    void matchesPitchExampleBudget11k() {
        CandidateOption a = opt("A", 600000, 1200);
        CandidateOption b = opt("B", 500000, 950);
        CandidateOption c = opt("C", 500000, 950);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 1100000, Objective.ENERGY_SAVING, 1,
                List.of(a, b, c), List.of()
        );

        OptimizationResult r = solver.solve(problem, new SolverConfiguration(5));
        assertEquals(List.of("A", "B"), r.selectedOptionsId());
        assertEquals(2150, r.objectiveValue());
        assertEquals(0, r.remainingBudgetCents());
    }

    @Test
    void withMaxNumber2Budget10kPrefersBC() {
        CandidateOption a = opt("A", 600000, 1200);
        CandidateOption b = opt("B", 500000, 950);
        CandidateOption c = opt("C", 500000, 950);
        CandidateOption d = opt("D", 1200000, 200);
        CandidateOption e = opt("E", 1300000, 900);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 1000000, Objective.ENERGY_SAVING, 1,
                List.of(a, b, c, d, e),
                List.of(new ScenarioConstraint.MaxNumberConstraint(2, List.of("A", "B", "C", "D", "E")))
        );

        OptimizationResult r = solver.solve(problem, new SolverConfiguration(5));
        assertEquals(2, r.selectedOptionsId().size());
        assertEquals(1900, r.objectiveValue());
    }

    @Test
    void zeroBudgetSelectsFreeOptions() {
        CandidateOption free = opt("FREE", 0, 500);
        CandidateOption paid = opt("PAID", 100, 1000);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 0, Objective.ENERGY_SAVING, 1,
                List.of(free, paid), List.of()
        );

        OptimizationResult r = solver.solve(problem, new SolverConfiguration(5));
        assertEquals(List.of("FREE"), r.selectedOptionsId());
        assertEquals(500, r.objectiveValue());
    }

    @Test
    void zeroBudgetNoFreeOptionsGivesEmptyPlan() {
        CandidateOption paid = opt("PAID", 100, 1000);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 0, Objective.ENERGY_SAVING, 1,
                List.of(paid), List.of()
        );

        OptimizationResult r = solver.solve(problem, new SolverConfiguration(5));
        assertTrue(r.selectedOptionsId().isEmpty());
        assertEquals(0, r.objectiveValue());
    }

    @Test
    void incompatibilityRespected() {
        CandidateOption a = opt("A", 100, 1000);
        CandidateOption b = opt("B", 100, 900);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 1000, Objective.ENERGY_SAVING, 1,
                List.of(a, b),
                List.of(new ScenarioConstraint.IncompatibilityConstraint("A", "B"))
        );

        OptimizationResult r = solver.solve(problem, new SolverConfiguration(5));
        assertEquals(List.of("A"), r.selectedOptionsId());
    }

    @Test
    void prerequisiteRespected() {
        CandidateOption a = opt("A", 100, 0);
        CandidateOption b = opt("B", 100, 1000);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 1000, Objective.ENERGY_SAVING, 1,
                List.of(a, b),
                List.of(new ScenarioConstraint.PrerequisiteConstraint("B", "A"))
        );

        OptimizationResult r = solver.solve(problem, new SolverConfiguration(5));
        assertTrue(r.selectedOptionsId().contains("A"));
        assertTrue(r.selectedOptionsId().contains("B"));
        assertEquals(1000, r.objectiveValue());
    }

    @Test
    void prerequisiteWithoutEnoughBudgetInfeasible() {
        CandidateOption a = opt("A", 600, 0);
        CandidateOption b = opt("B", 600, 1000);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 700, Objective.ENERGY_SAVING, 1,
                List.of(a, b),
                List.of(new ScenarioConstraint.PrerequisiteConstraint("B", "A"))
        );

        // A da solo costa 600; B richiede A: nessuna combinazione permette entrambi.
        OptimizationResult r = solver.solve(problem, new SolverConfiguration(5));
        // A può essere selezionato, ma beneficio = 0
        assertEquals(0, r.objectiveValue());
    }

    @Test
    void deterministicAcrossRuns() {
        CandidateOption a = opt("A", 600000, 1200);
        CandidateOption b = opt("B", 500000, 950);
        CandidateOption c = opt("C", 500000, 950);
        CandidateOption d = opt("D", 300000, 500);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 1000000, Objective.ENERGY_SAVING, 1,
                List.of(a, b, c, d), List.of()
        );

        OptimizationResult r1 = solver.solve(problem, new SolverConfiguration(5));
        OptimizationResult r2 = solver.solve(problem, new SolverConfiguration(5));
        OptimizationResult r3 = solver.solve(problem, new SolverConfiguration(5));

        assertEquals(r1.selectedOptionsId(), r2.selectedOptionsId());
        assertEquals(r1.selectedOptionsId(), r3.selectedOptionsId());
        assertEquals(r1.totalInvestmentCents(), r2.totalInvestmentCents());
        assertEquals(r1.objectiveValue(), r2.objectiveValue());
    }

    @Test
    void infeasibleDueToIncludeExclude() {
        CandidateOption a = opt("A", 100, 1000);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 1000, Objective.ENERGY_SAVING, 1,
                List.of(a),
                List.of(
                        new ScenarioConstraint.IncludeConstraint("A"),
                        new ScenarioConstraint.ExcludeConstraint("A")
                )
        );

        OptimizationResult r = solver.solve(problem, new SolverConfiguration(5));
        assertEquals(SolverStatus.INFEASIBLE, r.solverStatus());
        assertTrue(r.selectedOptionsId().isEmpty());
    }

    @Test
    void costEffectiveOptionBeatsCheaperOnes() {
        CandidateOption cheap1 = opt("C1", 100, 100);
        CandidateOption cheap2 = opt("C2", 100, 100);
        CandidateOption good = opt("GOOD", 200, 500);

        OptimizationProblem problem = new OptimizationProblem(
                "1.0", "snap", 200, Objective.ENERGY_SAVING, 1,
                List.of(cheap1, cheap2, good), List.of()
        );

        OptimizationResult r = solver.solve(problem, new SolverConfiguration(5));
        assertEquals(List.of("GOOD"), r.selectedOptionsId());
        assertEquals(500, r.objectiveValue());
    }

    @Test
    void objectiveChangeChangesResult() {
        CandidateOption a = new CandidateOption("A", "B", "T", 500000, 1000, 200000, 100);
        CandidateOption b = new CandidateOption("B", "B", "T", 500000, 500, 400000, 200);

        OptimizationProblem pEnergy = new OptimizationProblem(
                "1.0", "s", 500000, Objective.ENERGY_SAVING, 1, List.of(a, b), List.of());
        OptimizationProblem pEcon = new OptimizationProblem(
                "1.0", "s", 500000, Objective.ECONOMIC_SAVING, 1, List.of(a, b), List.of());

        assertEquals("A", solver.solve(pEnergy, new SolverConfiguration(5)).selectedOptionsId().get(0));
        assertEquals("B", solver.solve(pEcon, new SolverConfiguration(5)).selectedOptionsId().get(0));
    }
}