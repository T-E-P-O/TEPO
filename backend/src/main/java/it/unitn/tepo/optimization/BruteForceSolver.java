package it.unitn.tepo.optimization;

import it.unitn.tepo.domain.Objective;

import java.util.*;

// Solver a forza bruta (2^n, n <= 20): oracolo nei test e fallback offline.
public class BruteForceSolver implements OptimizationSolver {

    public static final int MAX_N = 20;

    @Override
    public OptimizationResult solve(OptimizationProblem problem, SolverConfiguration configuration) {
        int n = problem.candidateOptions().size();
        if (n > MAX_N) {
            return new OptimizationResult(
                    UUID.randomUUID().toString(),
                    ProblemHasher.hash(problem),
                    List.of(), List.of(), 0, problem.budgetCents(),
                    0, 0, 0, 0,
                    SolverStatus.MODEL_INVALID, false, false,
                    List.of()
            );
        }

        long bestObj = Long.MIN_VALUE;
        long bestCost = Long.MAX_VALUE;
        int bestCount = Integer.MAX_VALUE;
        List<String> bestIds = null;
        long bestEnergy = 0, bestEconomic = 0, bestCo2 = 0;

        int total = 1 << n;
        for (int mask = 0; mask < total; mask++) {
            if (!isFeasible(mask, problem)) continue;

            long obj, cost = 0, energy = 0, economic = 0, co2 = 0;
            int count = 0;
            List<String> ids = new ArrayList<>();

            for (int i = 0; i < n; i++) {
                if ((mask & (1 << i)) == 0) continue;
                CandidateOption c = problem.candidateOptions().get(i);
                cost += c.investmentCostCents();
                energy += c.annualEnergySavingScaled();
                economic += c.annualEconomicSavingCents();
                co2 += c.annualCo2ReductionScaled();
                count++;
                ids.add(c.id());
            }
            obj = switch (problem.objective()) {
                case ENERGY_SAVING -> energy;
                case ECONOMIC_SAVING -> economic;
                case CO2_REDUCTION -> co2;
            };

            ids.sort(String::compareTo);

            int cmp = Long.compare(obj, bestObj);
            if (cmp < 0) continue;
            if (cmp > 0) {
                bestObj = obj; bestCost = cost; bestCount = count;
                bestIds = ids; bestEnergy = energy; bestEconomic = economic; bestCo2 = co2;
                continue;
            }
            // Spareggio: costo minore
            if (cost < bestCost) {
                bestCost = cost; bestCount = count;
                bestIds = ids; bestEnergy = energy; bestEconomic = economic; bestCo2 = co2;
                continue;
            }
            if (cost > bestCost) continue;
            // Spareggio: meno interventi
            if (count < bestCount) {
                bestCount = count;
                bestIds = ids; bestEnergy = energy; bestEconomic = economic; bestCo2 = co2;
                continue;
            }
            if (count > bestCount) continue;
            // Spareggio: ID in ordine lessicografico
            if (bestIds == null || lexLess(ids, bestIds)) {
                bestIds = ids; bestEnergy = energy; bestEconomic = economic; bestCo2 = co2;
            }
        }

        if (bestIds == null) {
            return new OptimizationResult(
                    UUID.randomUUID().toString(),
                    ProblemHasher.hash(problem),
                    List.of(), problem.candidateOptions().stream().map(CandidateOption::id).toList(),
                    0, problem.budgetCents(),
                    0, 0, 0, 0,
                    SolverStatus.INFEASIBLE, false, false,
                    List.of()
            );
        }

        List<String> excluded = new ArrayList<>();
        Set<String> sel = new HashSet<>(bestIds);
        for (CandidateOption c : problem.candidateOptions()) {
            if (!sel.contains(c.id())) excluded.add(c.id());
        }

        return new OptimizationResult(
                UUID.randomUUID().toString(),
                ProblemHasher.hash(problem),
                bestIds, excluded,
                bestCost,
                problem.budgetCents() - bestCost,
                bestObj,
                bestEnergy, bestEconomic, bestCo2,
                SolverStatus.OPTIMAL, true, true,
                List.of()
        );
    }

    private boolean isFeasible(int mask, OptimizationProblem problem) {
        List<CandidateOption> opts = problem.candidateOptions();
        long cost = 0;
        for (int i = 0; i < opts.size(); i++) {
            if ((mask & (1 << i)) != 0) cost += opts.get(i).investmentCostCents();
        }
        if (cost > problem.budgetCents()) return false;

        for (ScenarioConstraint constraint : problem.constraints()) {
            if (constraint instanceof ScenarioConstraint.IncompatibilityConstraint inc) {
                if (has(mask, opts, inc.optionA()) && has(mask, opts, inc.optionB())) return false;
            } else if (constraint instanceof ScenarioConstraint.PrerequisiteConstraint pre) {
                if (has(mask, opts, pre.option()) && !has(mask, opts, pre.requiredOption())) return false;
            } else if (constraint instanceof ScenarioConstraint.MaxNumberConstraint max) {
                int cnt = 0;
                for (String id : max.optionIds()) if (has(mask, opts, id)) cnt++;
                if (cnt > max.maxNumber()) return false;
            } else if (constraint instanceof ScenarioConstraint.IncludeConstraint inc) {
                if (!has(mask, opts, inc.optionId())) return false;
            } else if (constraint instanceof ScenarioConstraint.ExcludeConstraint exc) {
                if (has(mask, opts, exc.optionId())) return false;
            }
        }
        return true;
    }

    private boolean has(int mask, List<CandidateOption> opts, String id) {
        for (int i = 0; i < opts.size(); i++) {
            if (opts.get(i).id().equals(id)) return (mask & (1 << i)) != 0;
        }
        return false;
    }

    private boolean lexLess(List<String> a, List<String> b) {
        int n = Math.min(a.size(), b.size());
        for (int i = 0; i < n; i++) {
            int c = a.get(i).compareTo(b.get(i));
            if (c != 0) return c < 0;
        }
        return a.size() < b.size();
    }
}