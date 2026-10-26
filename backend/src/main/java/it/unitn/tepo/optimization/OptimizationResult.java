package it.unitn.tepo.optimization;

import java.util.List;

public record OptimizationResult(
        String runId,
        String problemHash,
        List<String> selectedOptionsId,
        List<String> excludedOptionsId,
        long totalInvestmentCents,
        long remainingBudgetCents,
        long objectiveValue,
        long totalEnergySavingScaled,
        long totalEconomicSavingCents,
        long totalCo2ReductionScaled,
        SolverStatus solverStatus,
        boolean optimalityProven,
        boolean canonicalTieBreakCompleted,
        List<Explanation> explanations
) {}