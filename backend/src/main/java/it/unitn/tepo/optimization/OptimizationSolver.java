package it.unitn.tepo.optimization;

public interface OptimizationSolver {
    OptimizationResult solve(OptimizationProblem problem, SolverConfiguration configuration);
}