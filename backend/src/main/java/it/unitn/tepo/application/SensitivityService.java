package it.unitn.tepo.application;

import it.unitn.tepo.domain.InterventionOption;
import it.unitn.tepo.domain.Objective;
import it.unitn.tepo.optimization.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

// Scansione deterministica del budget con lo stesso solver; nessuna scrittura e nessun LLM.
@Service
public class SensitivityService {

    private static final Logger log = LoggerFactory.getLogger(SensitivityService.class);

    public static final int POINTS_MIN = 3;
    public static final int POINTS_MAX = 51;

    private final InterventionOptionRepository optionRepository;
    private final OptimizationSolver solver;

    @Value("${tepo.solver.primary-timeout-seconds:10}")
    private int primaryTimeoutSeconds = 10;

    @Value("${tepo.solver.secondary-timeout-seconds:3}")
    private int secondaryTimeoutSeconds = 3;

    @Value("${tepo.solver.lexicographic-timeout-seconds:1}")
    private int lexicographicTimeoutSeconds = 1;

    public SensitivityService(InterventionOptionRepository optionRepository,
                              OptimizationSolver solver) {
        this.optionRepository = optionRepository;
        this.solver = solver;
    }

    public Result analyze(String scenarioId,
                          long baseBudgetCents,
                          Objective objective,
                          Set<String> candidateOptionIds,
                          int points,
                          double minFactor,
                          double maxFactor) {

        // Validazione
        if (scenarioId == null || scenarioId.isBlank()) {
            throw new IllegalArgumentException("scenarioId mancante");
        }
        if (baseBudgetCents < 0) {
            throw new IllegalArgumentException("baseBudgetCents non può essere negativo");
        }
        if (objective == null) {
            throw new IllegalArgumentException("obiettivo mancante");
        }
        if (candidateOptionIds == null || candidateOptionIds.isEmpty()) {
            throw new IllegalArgumentException("nessun intervento candidato");
        }
        if (points < POINTS_MIN || points > POINTS_MAX) {
            throw new IllegalArgumentException(
                    "points deve essere in [" + POINTS_MIN + ", " + POINTS_MAX + "], ricevuto " + points);
        }
        if (!(minFactor > 0) || !(maxFactor > 0)) {
            throw new IllegalArgumentException("minFactor e maxFactor devono essere > 0");
        }
        if (minFactor >= maxFactor) {
            throw new IllegalArgumentException("minFactor deve essere < maxFactor");
        }

        // Caricamento candidati (stessa logica di OptimizationService)
        List<InterventionOption> options = optionRepository.findAllById(candidateOptionIds);
        Set<String> foundIds = options.stream().map(InterventionOption::getId).collect(Collectors.toSet());
        Set<String> missing = new HashSet<>(candidateOptionIds);
        missing.removeAll(foundIds);
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException("Interventi non trovati nel catalogo: " + missing);
        }
        if (options.isEmpty()) {
            throw new IllegalArgumentException("nessun intervento trovato nel catalogo");
        }

        List<CandidateOption> candidates = options.stream()
                .map(o -> new CandidateOption(
                        o.getId(),
                        o.getBuildingId(),
                        o.getInterventionTypeId(),
                        o.getInvestmentCostCents(),
                        o.getAnnualEnergySavingScaled(),
                        o.getAnnualEconomicSavingCents(),
                        o.getAnnualCo2ReductionScaled()))
                .collect(Collectors.toList());

        SolverConfiguration config = new SolverConfiguration(
                primaryTimeoutSeconds, secondaryTimeoutSeconds, lexicographicTimeoutSeconds);

        // Griglia di budget
        long minBudget = Math.round(baseBudgetCents * minFactor);
        long maxBudget = Math.round(baseBudgetCents * maxFactor);

        List<Point> grid = new ArrayList<>(points);
        long started = System.currentTimeMillis();

        for (int i = 0; i < points; i++) {
            long budget = (points == 1)
                    ? minBudget
                    : minBudget + (maxBudget - minBudget) * i / (points - 1);

            OptimizationProblem p = new OptimizationProblem(
                    "1.0",
                    scenarioId + ":sens:" + budget,
                    budget,
                    objective,
                    1,
                    candidates,
                    List.of(new ScenarioConstraint.BudgetConstraint(budget))
            );

            OptimizationResult r;
            try {
                r = solver.solve(p, config);
            } catch (RuntimeException ex) {
                log.warn("Sensitivity solve error scenario={} budget={}: {}",
                        scenarioId, budget, ex.getMessage());
                grid.add(new Point(budget, SolverStatus.UNKNOWN.name(),
                        false, 0, 0, budget, 0, List.of()));
                continue;
            }

            grid.add(new Point(
                    budget,
                    r.solverStatus().name(),
                    r.optimalityProven(),
                    r.objectiveValue(),
                    r.totalInvestmentCents(),
                    r.remainingBudgetCents(),
                    r.selectedOptionsId().size(),
                    r.selectedOptionsId()
            ));
        }

        long elapsedMs = System.currentTimeMillis() - started;
        log.info("Sensitivity analysis: scenario={} points={} budget=[{},{}] elapsedMs={}",
                scenarioId, points, minBudget, maxBudget, elapsedMs);

        // Stabilità
        Set<String> alwaysSelected = new HashSet<>(candidates.stream().map(CandidateOption::id).toList());
        Set<String> neverSelected = new HashSet<>(candidates.stream().map(CandidateOption::id).toList());

        for (Point p : grid) {
            Set<String> sel = new HashSet<>(p.selectedOptionsId());
            alwaysSelected.retainAll(sel);
            neverSelected.removeAll(sel);
        }

        Set<String> swing = new HashSet<>(candidates.stream().map(CandidateOption::id).toList());
        swing.removeAll(alwaysSelected);
        swing.removeAll(neverSelected);

        return new Result(
                objective.name(),
                baseBudgetCents,
                minBudget,
                maxBudget,
                points,
                List.copyOf(grid),
                List.copyOf(new TreeSet<>(alwaysSelected)),
                List.copyOf(new TreeSet<>(neverSelected)),
                List.copyOf(new TreeSet<>(swing))
        );
    }

    // DTO

    public record Point(
            long budgetCents,
            String solverStatus,
            boolean optimalityProven,
            long objectiveValue,
            long totalInvestmentCents,
            long remainingBudgetCents,
            int numSelected,
            List<String> selectedOptionsId
    ) {}

    public record Result(
            String objective,
            long baseBudgetCents,
            long minBudgetCents,
            long maxBudgetCents,
            int points,
            List<Point> grid,
            List<String> alwaysSelected,
            List<String> neverSelected,
            List<String> swing
    ) {}
}