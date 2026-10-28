package it.unitn.tepo.optimization;

public record CandidateOption(
        String id,
        String buildingId,
        String interventionTypeId,
        long investmentCostCents,
        long annualEnergySavingScaled,
        long annualEconomicSavingCents,
        long annualCo2ReductionScaled
) {}