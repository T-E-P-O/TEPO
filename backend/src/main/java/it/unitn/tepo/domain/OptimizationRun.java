package it.unitn.tepo.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "optimization_runs")
public class OptimizationRun {

    @Id
    @Column(name = "run_id")
    private String runId;

    @Column(name = "scenario_id", nullable = false)
    private String scenarioId;

    @Column(name = "problem_hash")
    private String problemHash;

    @Column(name = "snapshot_id")
    private String snapshotId;

    @Enumerated(EnumType.STRING)
    private Objective objective;

    @Column(name = "budget_cents")
    private long budgetCents;

    @Column(name = "total_investment_cents")
    private long totalInvestmentCents;

    @Column(name = "remaining_budget_cents")
    private long remainingBudgetCents;

    @Column(name = "objective_value")
    private long objectiveValue;

    @Column(name = "total_energy_saving")
    private long totalEnergySaving;

    @Column(name = "total_economic_saving_cents")
    private long totalEconomicSavingCents;

    @Column(name = "total_co2_reduction")
    private long totalCo2Reduction;

    @Column(name = "solver_status")
    private String solverStatus;

    @Column(name = "optimality_proven")
    private boolean optimalityProven;

    @Column(name = "canonical_tie_break_completed")
    private boolean canonicalTieBreakCompleted;

    @Column(name = "selected_options_json", columnDefinition = "TEXT")
    private String selectedOptionsJson;

    @Column(name = "excluded_options_json", columnDefinition = "TEXT")
    private String excludedOptionsJson;

    @Column(name = "explanations_json", columnDefinition = "TEXT")
    private String explanationsJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    // getter e setter
    public String getRunId() { return runId; }
    public void setRunId(String runId) { this.runId = runId; }
    public String getScenarioId() { return scenarioId; }
    public void setScenarioId(String scenarioId) { this.scenarioId = scenarioId; }
    public String getProblemHash() { return problemHash; }
    public void setProblemHash(String problemHash) { this.problemHash = problemHash; }
    public String getSnapshotId() { return snapshotId; }
    public void setSnapshotId(String snapshotId) { this.snapshotId = snapshotId; }
    public Objective getObjective() { return objective; }
    public void setObjective(Objective objective) { this.objective = objective; }
    public long getBudgetCents() { return budgetCents; }
    public void setBudgetCents(long budgetCents) { this.budgetCents = budgetCents; }
    public long getTotalInvestmentCents() { return totalInvestmentCents; }
    public void setTotalInvestmentCents(long totalInvestmentCents) { this.totalInvestmentCents = totalInvestmentCents; }
    public long getRemainingBudgetCents() { return remainingBudgetCents; }
    public void setRemainingBudgetCents(long remainingBudgetCents) { this.remainingBudgetCents = remainingBudgetCents; }
    public long getObjectiveValue() { return objectiveValue; }
    public void setObjectiveValue(long objectiveValue) { this.objectiveValue = objectiveValue; }
    public long getTotalEnergySaving() { return totalEnergySaving; }
    public void setTotalEnergySaving(long totalEnergySaving) { this.totalEnergySaving = totalEnergySaving; }
    public long getTotalEconomicSavingCents() { return totalEconomicSavingCents; }
    public void setTotalEconomicSavingCents(long totalEconomicSavingCents) { this.totalEconomicSavingCents = totalEconomicSavingCents; }
    public long getTotalCo2Reduction() { return totalCo2Reduction; }
    public void setTotalCo2Reduction(long totalCo2Reduction) { this.totalCo2Reduction = totalCo2Reduction; }
    public String getSolverStatus() { return solverStatus; }
    public void setSolverStatus(String solverStatus) { this.solverStatus = solverStatus; }
    public boolean isOptimalityProven() { return optimalityProven; }
    public void setOptimalityProven(boolean optimalityProven) { this.optimalityProven = optimalityProven; }
    public boolean isCanonicalTieBreakCompleted() { return canonicalTieBreakCompleted; }
    public void setCanonicalTieBreakCompleted(boolean v) { this.canonicalTieBreakCompleted = v; }
    public String getSelectedOptionsJson() { return selectedOptionsJson; }
    public void setSelectedOptionsJson(String v) { this.selectedOptionsJson = v; }
    public String getExcludedOptionsJson() { return excludedOptionsJson; }
    public void setExcludedOptionsJson(String v) { this.excludedOptionsJson = v; }
    public String getExplanationsJson() { return explanationsJson; }
    public void setExplanationsJson(String v) { this.explanationsJson = v; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}