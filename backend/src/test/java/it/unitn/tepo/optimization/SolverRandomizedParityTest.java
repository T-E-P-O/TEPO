package it.unitn.tepo.optimization;

import it.unitn.tepo.domain.Objective;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

// Parità randomizzata con seed deterministico: campi, auto-consistenza e aritmetica.
class SolverRandomizedParityTest {

    private static final long SEED_START = 1L;
    private static final int  SEED_COUNT = 50;
    private static final int  N          = 8;

    private final OrToolsSolver orTools = new OrToolsSolver();
    private final BruteForceSolver brute = new BruteForceSolver();

    @Test
    void parityAcrossDeterministicSeedsAndObjectives() {
        for (long seed = SEED_START; seed < SEED_START + SEED_COUNT; seed++) {
            RandomProblemGenerator gen = RandomProblemGenerator.of(seed, N);
            for (Objective obj : Objective.values()) {
                OptimizationProblem problem = gen.generate(obj);

                OptimizationResult r1 = orTools.solve(problem, SolverConfiguration.defaultConfig());
                OptimizationResult r2 = brute.solve(problem, SolverConfiguration.defaultConfig());

                String diag = "\n--- seed=" + seed + " objective=" + obj + " ---\n"
                        + gen.describe(problem);

                assertEquals(r2.solverStatus(), r1.solverStatus(), "solverStatus diverge" + diag);
                assertEquals(r2.selectedOptionsId(), r1.selectedOptionsId(), "selected diverge" + diag);
                assertEquals(r2.totalInvestmentCents(), r1.totalInvestmentCents(),
                        "totalInvestmentCents diverge" + diag);
                assertEquals(r2.remainingBudgetCents(), r1.remainingBudgetCents(),
                        "remainingBudgetCents diverge" + diag);
                assertEquals(r2.objectiveValue(), r1.objectiveValue(),
                        "objectiveValue diverge" + diag);
                assertEquals(r2.totalEnergySavingScaled(), r1.totalEnergySavingScaled(),
                        "totalEnergySavingScaled diverge" + diag);
                assertEquals(r2.totalEconomicSavingCents(), r1.totalEconomicSavingCents(),
                        "totalEconomicSavingCents diverge" + diag);
                assertEquals(r2.totalCo2ReductionScaled(), r1.totalCo2ReductionScaled(),
                        "totalCo2ReductionScaled diverge" + diag);
            }
        }
    }

    @Test
    void solutionsSatisfyConstraintsIndependentlyOfSolver() {
        for (long seed = SEED_START; seed < SEED_START + SEED_COUNT; seed++) {
            RandomProblemGenerator gen = RandomProblemGenerator.of(seed, N);
            for (Objective obj : Objective.values()) {
                OptimizationProblem problem = gen.generate(obj);
                OptimizationResult r = orTools.solve(problem, SolverConfiguration.defaultConfig());

                if (r.solverStatus() == SolverStatus.INFEASIBLE) continue;

                assertTrue(r.solverStatus() == SolverStatus.OPTIMAL
                                || r.solverStatus() == SolverStatus.FEASIBLE,
                        "solver in stato inatteso=" + r.solverStatus() + " su seed=" + seed);

                Set<String> sel = new HashSet<>(r.selectedOptionsId());

                long totalCost = 0, totalEnergy = 0, totalEcon = 0, totalCo2 = 0;
                for (CandidateOption c : problem.candidateOptions()) {
                    if (sel.contains(c.id())) {
                        totalCost += c.investmentCostCents();
                        totalEnergy += c.annualEnergySavingScaled();
                        totalEcon += c.annualEconomicSavingCents();
                        totalCo2 += c.annualCo2ReductionScaled();
                    }
                }

                assertTrue(totalCost <= problem.budgetCents(),
                        "budget violato su seed=" + seed + " obj=" + obj);
                assertEquals(totalCost, r.totalInvestmentCents(), "totalInvestmentCents errato");
                assertEquals(totalEnergy, r.totalEnergySavingScaled(), "energy errata");
                assertEquals(totalEcon, r.totalEconomicSavingCents(), "economic errata");
                assertEquals(totalCo2, r.totalCo2ReductionScaled(), "co2 errata");

                for (ScenarioConstraint c : problem.constraints()) {
                    if (c instanceof ScenarioConstraint.IncompatibilityConstraint i) {
                        assertFalse(sel.contains(i.optionA()) && sel.contains(i.optionB()),
                                "incompatibilità violata: " + i.optionA() + " & " + i.optionB());
                    } else if (c instanceof ScenarioConstraint.PrerequisiteConstraint p) {
                        if (sel.contains(p.option())) {
                            assertTrue(sel.contains(p.requiredOption()),
                                    "prerequisito violato: " + p.option() + " richiede " + p.requiredOption());
                        }
                    } else if (c instanceof ScenarioConstraint.MaxNumberConstraint m) {
                        long cnt = m.optionIds().stream().filter(sel::contains).count();
                        assertTrue(cnt <= m.maxNumber(), "maxNumber violato");
                    } else if (c instanceof ScenarioConstraint.ExcludeConstraint e) {
                        assertFalse(sel.contains(e.optionId()), "exclude violato: " + e.optionId());
                    } else if (c instanceof ScenarioConstraint.IncludeConstraint i) {
                        assertTrue(sel.contains(i.optionId()), "include violato: " + i.optionId());
                    }
                }

                long expectedObj = switch (obj) {
                    case ENERGY_SAVING -> totalEnergy;
                    case ECONOMIC_SAVING -> totalEcon;
                    case CO2_REDUCTION -> totalCo2;
                };
                assertEquals(expectedObj, r.objectiveValue(),
                        "objectiveValue errato su seed=" + seed + " obj=" + obj);
            }
        }
    }
}