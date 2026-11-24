package it.unitn.tepo.optimization;

import it.unitn.tepo.domain.Objective;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Generatore deterministico per i test di parità: stesso (seed, n), stessa istanza.
final class RandomProblemGenerator {

    private final long seed;
    private final int n;

    private RandomProblemGenerator(long seed, int n) {
        this.seed = seed;
        this.n = n;
    }

    static RandomProblemGenerator of(long seed, int n) {
        return new RandomProblemGenerator(seed, n);
    }

    OptimizationProblem generate(Objective objective) {
        Random r = new Random(seed);

        List<CandidateOption> options = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            String id = "OPT-" + String.format("%03d", i + 1);
            long cost = 1 + r.nextLong(200);
            long energy = 10 + r.nextLong(500);
            long tariffCents = 10 + r.nextLong(20);   // 10..30 cent/kWh
            long co2X100 = 5 + r.nextLong(20);        // 0.05..0.25 kg/kWh

            long economic = energy * tariffCents;
            long co2 = (energy * co2X100) / 100;

            options.add(new CandidateOption(id, "BLD-1", "TYPE-A",
                    cost, energy, economic, co2));
        }

        List<ScenarioConstraint> constraints = new ArrayList<>();

        int incompat = r.nextInt(3);                  // 0..2
        for (int i = 0; i < incompat; i++) {
            int a = r.nextInt(n);
            int b = r.nextInt(n);
            if (a == b) continue;
            constraints.add(new ScenarioConstraint.IncompatibilityConstraint(
                    options.get(a).id(), options.get(b).id()));
        }

        int prereq = r.nextInt(3);                    // 0..2
        for (int i = 0; i < prereq; i++) {
            int a = r.nextInt(n);
            int b = r.nextInt(n);
            if (a == b) continue;
            constraints.add(new ScenarioConstraint.PrerequisiteConstraint(
                    options.get(b).id(), options.get(a).id()));
        }

        if (r.nextBoolean()) {                        // ~50%: maxNumber
            int k = 1 + r.nextInt(Math.max(1, n / 2));
            List<String> ids = options.stream().map(CandidateOption::id).toList();
            constraints.add(new ScenarioConstraint.MaxNumberConstraint(k, ids));
        }

        if (r.nextInt(4) == 0) {                      // ~25%: include/exclude
            int idx = r.nextInt(n);
            if (r.nextBoolean()) {
                constraints.add(new ScenarioConstraint.IncludeConstraint(options.get(idx).id()));
            } else {
                constraints.add(new ScenarioConstraint.ExcludeConstraint(options.get(idx).id()));
            }
        }

        long totalCost = options.stream()
                .mapToLong(CandidateOption::investmentCostCents).sum();
        int percent = 30 + r.nextInt(91);             // 30..120
        long budget = Math.max(0, totalCost * percent / 100);

        return new OptimizationProblem(
                "1.0", "seed-" + seed, budget, objective, 1, options, constraints);
    }

    long seed() { return seed; }

    String describe(OptimizationProblem p) {
        StringBuilder sb = new StringBuilder();
        sb.append("seed=").append(seed).append(" n=").append(n)
                .append(" budget=").append(p.budgetCents())
                .append(" objective=").append(p.objective()).append('\n');
        for (CandidateOption c : p.candidateOptions()) {
            sb.append("  ").append(c.id())
                    .append(" cost=").append(c.investmentCostCents())
                    .append(" energy=").append(c.annualEnergySavingScaled())
                    .append(" econ=").append(c.annualEconomicSavingCents())
                    .append(" co2=").append(c.annualCo2ReductionScaled())
                    .append('\n');
        }
        for (ScenarioConstraint c : p.constraints()) {
            sb.append("  ").append(c).append('\n');
        }
        return sb.toString();
    }
}