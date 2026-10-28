package it.unitn.tepo.optimization;

import it.unitn.tepo.domain.Objective;
import java.util.List;

public record OptimizationProblem(
        String schemaVersion,
        String snapshotId,
        long budgetCents,
        Objective objective,
        int coefficientScale,
        List<CandidateOption> candidateOptions,
        List<ScenarioConstraint> constraints
) {}