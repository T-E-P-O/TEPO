package it.unitn.tepo.optimization;

import it.unitn.tepo.domain.Objective;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

// Confronto con un'euristica greedy onesta (passata singola): dimostra il valore dell'ottimo.
class GreedyBaselineComparisonTest {

    private static final long SEED_START = 1L;
    private static final int SEED_COUNT = 50;
    private static final int N = 8;

    private final OrToolsSolver solver = new OrToolsSolver();

    // Coefficiente obiettivo

    private static long objectiveCoefficient(Objective obj, CandidateOption c) {
        return switch (obj) {
            case ENERGY_SAVING -> c.annualEnergySavingScaled();
            case ECONOMIC_SAVING -> c.annualEconomicSavingCents();
            case CO2_REDUCTION -> c.annualCo2ReductionScaled();
        };
    }

    // Euristica greedy

    private static Optional<List<String>> greedy(OptimizationProblem p) {
        Map<String, CandidateOption> byId = new HashMap<>();
        for (CandidateOption c : p.candidateOptions()) byId.put(c.id(), c);

        Set<String> selected = new LinkedHashSet<>();

        // 1. Include forzate
        for (ScenarioConstraint c : p.constraints()) {
            if (c instanceof ScenarioConstraint.IncludeConstraint inc) {
                if (!byId.containsKey(inc.optionId())) {
                    return Optional.empty(); // non ammissibile per il greedy
                }
                selected.add(inc.optionId());
            }
        }

        // 2. Ordina per rapporto beneficio/costo decrescente
        List<CandidateOption> sorted = new ArrayList<>(p.candidateOptions());
        sorted.sort(Comparator.comparingDouble((CandidateOption c) -> {
            long benefit = objectiveCoefficient(p.objective(), c);
            long cost = Math.max(1, c.investmentCostCents());
            return -(double) benefit / cost;
        }));

        // 3. Aggiungi uno per uno, se ammissibile
        long cost = 0;
        for (String id : selected) cost += byId.get(id).investmentCostCents();
        if (cost > p.budgetCents()) return Optional.of(new ArrayList<>(selected));

        for (CandidateOption candidate : sorted) {
            if (selected.contains(candidate.id())) continue;
            long newCost = cost + candidate.investmentCostCents();
            if (newCost > p.budgetCents()) continue;

            boolean conflicts = false;
            for (ScenarioConstraint sc : p.constraints()) {
                if (sc instanceof ScenarioConstraint.IncompatibilityConstraint inc) {
                    if (inc.optionA().equals(candidate.id()) && selected.contains(inc.optionB())) { conflicts = true; break; }
                    if (inc.optionB().equals(candidate.id()) && selected.contains(inc.optionA())) { conflicts = true; break; }
                }
            }
            if (conflicts) continue;

            boolean prereqMissing = false;
            for (ScenarioConstraint sc : p.constraints()) {
                if (sc instanceof ScenarioConstraint.PrerequisiteConstraint pre) {
                    if (pre.option().equals(candidate.id()) && !selected.contains(pre.requiredOption())) {
                        prereqMissing = true; break;
                    }
                }
            }
            if (prereqMissing) continue;

            boolean excluded = false;
            for (ScenarioConstraint sc : p.constraints()) {
                if (sc instanceof ScenarioConstraint.ExcludeConstraint exc) {
                    if (exc.optionId().equals(candidate.id())) { excluded = true; break; }
                }
            }
            if (excluded) continue;

            boolean maxExceeded = false;
            for (ScenarioConstraint sc : p.constraints()) {
                if (sc instanceof ScenarioConstraint.MaxNumberConstraint max) {
                    if (max.optionIds().contains(candidate.id())) {
                        long cnt = max.optionIds().stream().filter(selected::contains).count();
                        if (cnt >= max.maxNumber()) { maxExceeded = true; break; }
                    }
                }
            }
            if (maxExceeded) continue;

            selected.add(candidate.id());
            cost = newCost;
        }

        return Optional.of(new ArrayList<>(selected));
    }

    private static long objectiveValueOf(OptimizationProblem p, Collection<String> selectedIds) {
        Set<String> sel = new HashSet<>(selectedIds);
        long v = 0;
        for (CandidateOption c : p.candidateOptions()) {
            if (sel.contains(c.id())) v += objectiveCoefficient(p.objective(), c);
        }
        return v;
    }

    // Test 1: il solver non è mai peggiore del greedy

    @Test
    void solverIsNeverWorseThanGreedyOnRandomInstances() {
        for (long seed = SEED_START; seed < SEED_START + SEED_COUNT; seed++) {
            RandomProblemGenerator gen = RandomProblemGenerator.of(seed, N);
            for (Objective obj : Objective.values()) {
                OptimizationProblem p = gen.generate(obj);
                OptimizationResult r = solver.solve(p, SolverConfiguration.defaultConfig());
                if (r.solverStatus() == SolverStatus.INFEASIBLE
                        || r.solverStatus() == SolverStatus.UNKNOWN) continue;

                Optional<List<String>> greedySel = greedy(p);
                if (greedySel.isEmpty()) continue;

                long greedyObj = objectiveValueOf(p, greedySel.get());
                assertTrue(r.objectiveValue() >= greedyObj,
                        "Solver peggiore del greedy: seed=" + seed + " obj=" + obj
                                + " solver=" + r.objectiveValue() + " greedy=" + greedyObj);
            }
        }
    }

    // Test 2: il solver batte il greedy su almeno un'istanza

    @Test
    void solverStrictlyBeatsGreedyOnAtLeastOneRandomInstance() {
        int strictlyBetter = 0;
        int total = 0;

        for (long seed = SEED_START; seed < SEED_START + SEED_COUNT; seed++) {
            RandomProblemGenerator gen = RandomProblemGenerator.of(seed, N);
            for (Objective obj : Objective.values()) {
                OptimizationProblem p = gen.generate(obj);
                OptimizationResult r = solver.solve(p, SolverConfiguration.defaultConfig());
                if (r.solverStatus() != SolverStatus.OPTIMAL) continue;

                Optional<List<String>> greedySel = greedy(p);
                if (greedySel.isEmpty()) continue;

                long greedyObj = objectiveValueOf(p, greedySel.get());
                total++;
                if (r.objectiveValue() > greedyObj) strictlyBetter++;
            }
        }

        assertTrue(total > 0, "Nessuna istanza confrontabile");
        assertTrue(strictlyBetter > 0,
                "Il solver non batte mai il greedy: vantaggio non dimostrabile. "
                        + "Confrontabili: " + total + ", strettamente migliori: " + strictlyBetter);
    }

    // Test 3: controesempio classico dello zaino

    @Test
    void classicKnapsackCounterexampleWhereGreedyFails() {
        // Zaino classico: il greedy per rapporto si ferma a 10, l'ottimo arriva a 16 (gap 60%).
        List<CandidateOption> opts = List.of(
                new CandidateOption("A", "B1", "T1", 6, 10, 0, 0),
                new CandidateOption("B", "B1", "T1", 5, 8, 0, 0),
                new CandidateOption("C", "B1", "T1", 5, 8, 0, 0)
        );
        OptimizationProblem p = new OptimizationProblem(
                "1.0", "test", 10, Objective.ENERGY_SAVING, 1, opts, List.of());

        OptimizationResult r = solver.solve(p, SolverConfiguration.defaultConfig());
        Optional<List<String>> g = greedy(p);
        assertTrue(g.isPresent());

        long greedyObj = objectiveValueOf(p, g.get());
        assertEquals(16, r.objectiveValue(), "Il solver deve trovare l'ottimo classico");
        assertEquals(10, greedyObj, "Il greedy deve fallire nel controesempio classico");
        assertTrue(r.objectiveValue() > greedyObj);
    }
}