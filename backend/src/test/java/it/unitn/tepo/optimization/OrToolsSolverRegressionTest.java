package it.unitn.tepo.optimization;

import it.unitn.tepo.domain.Objective;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class OrToolsSolverRegressionTest {

    private final OrToolsSolver solver = new OrToolsSolver();
    private final BruteForceSolver brute = new BruteForceSolver();

    private CandidateOption opt(String id, long cost, long energy) {
        return new CandidateOption(id, "B", "T", cost, energy, energy, energy);
    }

    // Spareggio

    @Test
    void tieBreakPrefersLowerIdWhenEqualBenefitAndCost() {
        CandidateOption a = opt("A", 100, 500);
        CandidateOption b = opt("B", 100, 500);
        CandidateOption c = opt("C", 100, 500);
        CandidateOption d = opt("D", 100, 500);

        // Budget per 2 soli: a parità di beneficio vince lo spareggio (costo, conteggio, ID).
        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 250, Objective.ENERGY_SAVING, 1,
                List.of(a, b, c, d), List.of());

        OptimizationResult r = solver.solve(p, new SolverConfiguration(5));
        assertTrue(r.canonicalTieBreakCompleted(), "tie-break deve essere completato");
        assertEquals(List.of("A", "B"), r.selectedOptionsId());
    }

    @Test
    void tieBreakOnMultipleOptimaWithSameCostDifferentCount() {
        // X e Y+Z pari per costo e beneficio: lo spareggio preferisce meno interventi, quindi X.
        CandidateOption x = opt("X", 100, 500);
        CandidateOption y = opt("Y", 50, 250);
        CandidateOption z = opt("Z", 50, 250);

        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 100, Objective.ENERGY_SAVING, 1,
                List.of(x, y, z), List.of());

        OptimizationResult r = solver.solve(p, new SolverConfiguration(5));
        assertTrue(r.canonicalTieBreakCompleted());
        assertEquals(1, r.selectedOptionsId().size());
        assertEquals("X", r.selectedOptionsId().get(0));
    }

    @Test
    void tieBreakDeterministicAcrossRuns() {
        CandidateOption a = opt("A", 100, 500);
        CandidateOption b = opt("B", 100, 500);
        CandidateOption c = opt("C", 100, 500);

        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 200, Objective.ENERGY_SAVING, 1,
                List.of(a, b, c), List.of());

        List<String> first = solver.solve(p, new SolverConfiguration(5)).selectedOptionsId();
        for (int i = 0; i < 5; i++) {
            List<String> next = solver.solve(p, new SolverConfiguration(5)).selectedOptionsId();
            assertEquals(first, next);
        }
    }

    // Stati

    @Test
    void infeasibleDueToContradictoryConstraints() {
        CandidateOption a = opt("A", 100, 1000);

        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 1000, Objective.ENERGY_SAVING, 1,
                List.of(a),
                List.of(
                        new ScenarioConstraint.IncludeConstraint("A"),
                        new ScenarioConstraint.ExcludeConstraint("A")
                ));

        OptimizationResult r = solver.solve(p, new SolverConfiguration(5));
        assertEquals(SolverStatus.INFEASIBLE, r.solverStatus());
        assertFalse(r.optimalityProven());
        assertFalse(r.canonicalTieBreakCompleted());
    }

    @Test
    void infeasibleDueToPrerequisiteCostExceedsBudget() {
        CandidateOption prereq = opt("P", 800, 0);
        CandidateOption target = opt("T", 800, 1000);

        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 1000, Objective.ENERGY_SAVING, 1,
                List.of(prereq, target),
                List.of(new ScenarioConstraint.PrerequisiteConstraint("T", "P")));

        // P+T costa 1600 > 1000: ammissibile solo il vuoto o P da solo (beneficio 0).
        OptimizationResult r = solver.solve(p, new SolverConfiguration(5));
        // Lo stato deve essere OPTIMAL (esiste una soluzione ammissibile: P da solo o vuoto)
        assertEquals(SolverStatus.OPTIMAL, r.solverStatus());
        // Nessun intervento "T" senza "P"
        if (r.selectedOptionsId().contains("T")) {
            assertTrue(r.selectedOptionsId().contains("P"));
        }
    }

    // Casi limite di budget

    @Test
    void exactBudgetMatchesTotalCost() {
        CandidateOption a = opt("A", 500, 1000);
        CandidateOption b = opt("B", 500, 800);

        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 1000, Objective.ENERGY_SAVING, 1,
                List.of(a, b), List.of());

        OptimizationResult r = solver.solve(p, new SolverConfiguration(5));
        assertEquals(0, r.remainingBudgetCents());
        assertEquals(1000, r.totalInvestmentCents());
    }

    @Test
    void zeroBudgetWithFreeOption() {
        CandidateOption free = opt("FREE", 0, 500);

        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 0, Objective.ENERGY_SAVING, 1,
                List.of(free), List.of());

        OptimizationResult r = solver.solve(p, new SolverConfiguration(5));
        assertEquals(List.of("FREE"), r.selectedOptionsId());
    }

    // Parità con la forza bruta

    @Test
    void parityWithBruteForceOnSmallInstance() {
        CandidateOption a = opt("A", 600000, 1200);
        CandidateOption b = opt("B", 500000, 950);
        CandidateOption c = opt("C", 500000, 950);
        CandidateOption d = opt("D", 300000, 500);

        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 1000000, Objective.ENERGY_SAVING, 1,
                List.of(a, b, c, d), List.of());

        OptimizationResult rOr = solver.solve(p, new SolverConfiguration(5));
        OptimizationResult rBf = brute.solve(p, new SolverConfiguration(5));

        assertEquals(rBf.objectiveValue(), rOr.objectiveValue());
        assertEquals(rBf.totalInvestmentCents(), rOr.totalInvestmentCents());
        assertEquals(rBf.selectedOptionsId(), rOr.selectedOptionsId());
        assertTrue(rOr.canonicalTieBreakCompleted());
    }

    @Test
    void parityWithBruteForceOnPrerequisiteChain() {
        CandidateOption a = opt("A", 100, 500);
        CandidateOption b = opt("B", 100, 400);
        CandidateOption c = opt("C", 100, 300);

        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 250, Objective.ENERGY_SAVING, 1,
                List.of(a, b, c),
                List.of(new ScenarioConstraint.PrerequisiteConstraint("B", "A")));

        OptimizationResult rOr = solver.solve(p, new SolverConfiguration(5));
        OptimizationResult rBf = brute.solve(p, new SolverConfiguration(5));

        assertEquals(rBf.objectiveValue(), rOr.objectiveValue());
        assertEquals(rBf.selectedOptionsId(), rOr.selectedOptionsId());
    }

    // Informazioni di stato

    @Test
    void optimalSolutionHasAllFlagsTrue() {
        CandidateOption a = opt("A", 100, 1000);

        OptimizationProblem p = new OptimizationProblem(
                "1.0", "s", 200, Objective.ENERGY_SAVING, 1,
                List.of(a), List.of());

        OptimizationResult r = solver.solve(p, new SolverConfiguration(5));
        assertEquals(SolverStatus.OPTIMAL, r.solverStatus());
        assertTrue(r.optimalityProven());
        assertTrue(r.canonicalTieBreakCompleted());
    }
}