CREATE TABLE optimization_runs (
    run_id VARCHAR(64) PRIMARY KEY,
    scenario_id VARCHAR(64) NOT NULL,
    problem_hash VARCHAR(64),
    snapshot_id VARCHAR(64),
    objective VARCHAR(32),
    budget_cents BIGINT NOT NULL,
    total_investment_cents BIGINT NOT NULL,
    remaining_budget_cents BIGINT NOT NULL,
    objective_value BIGINT NOT NULL,
    total_energy_saving BIGINT NOT NULL,
    total_economic_saving_cents BIGINT NOT NULL,
    total_co2_reduction BIGINT NOT NULL,
    solver_status VARCHAR(32),
    optimality_proven BOOLEAN NOT NULL DEFAULT FALSE,
    canonical_tie_break_completed BOOLEAN NOT NULL DEFAULT FALSE,
    selected_options_json TEXT,
    excluded_options_json TEXT,
    explanations_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_runs_scenario ON optimization_runs(scenario_id);
CREATE INDEX idx_runs_created ON optimization_runs(created_at DESC);