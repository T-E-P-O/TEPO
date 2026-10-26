package it.unitn.tepo.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import it.unitn.tepo.domain.*;
import it.unitn.tepo.optimization.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

// Orchestrazione dell'ottimizzazione; i timeout hanno default per i test fuori da Spring.
@Service
public class OptimizationService {

    private static final Logger log = LoggerFactory.getLogger(OptimizationService.class);

    private final BuildingRepository buildingRepository;
    private final InterventionOptionRepository optionRepository;
    private final OptimizationRunRepository runRepository;
    private final OptimizationSolver solver;
    private final ExplanationService explanationService;
    private final ObjectMapper objectMapper;

    @Value("${tepo.solver.primary-timeout-seconds:10}")
    private int primaryTimeoutSeconds = 10;

    @Value("${tepo.solver.secondary-timeout-seconds:3}")
    private int secondaryTimeoutSeconds = 3;

    @Value("${tepo.solver.lexicographic-timeout-seconds:1}")
    private int lexicographicTimeoutSeconds = 1;

    public OptimizationService(BuildingRepository buildingRepository,
                               InterventionOptionRepository optionRepository,
                               OptimizationRunRepository runRepository,
                               OptimizationSolver solver,
                               ExplanationService explanationService,
                               ObjectMapper objectMapper) {
        this.buildingRepository = buildingRepository;
        this.optionRepository = optionRepository;
        this.runRepository = runRepository;
        this.solver = solver;
        this.explanationService = explanationService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public OptimizationResult optimize(String scenarioId,
                                       long budgetCents,
                                       Objective objective,
                                       List<ScenarioConstraint> constraints,
                                       Set<String> candidateOptionIds) {

        if (budgetCents < 0) {
            throw new IllegalArgumentException("Budget non valido: " + budgetCents);
        }
        if (objective == null) {
            throw new IllegalArgumentException("Obiettivo mancante");
        }
        if (candidateOptionIds == null || candidateOptionIds.isEmpty()) {
            throw new IllegalArgumentException("Nessun intervento candidato fornito per lo scenario " + scenarioId);
        }

        List<InterventionOption> options = optionRepository.findAllById(candidateOptionIds);
        if (options.isEmpty()) {
            throw new IllegalArgumentException("Nessun intervento candidato trovato per lo scenario " + scenarioId);
        }

        Set<String> foundIds = options.stream().map(InterventionOption::getId).collect(Collectors.toSet());
        Set<String> missing = new HashSet<>(candidateOptionIds);
        missing.removeAll(foundIds);
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException("Interventi non trovati nel catalogo: " + missing);
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

        List<ScenarioConstraint> allConstraints = new ArrayList<>(constraints == null ? List.of() : constraints);
        boolean hasBudget = false;
        for (ScenarioConstraint c : allConstraints) {
            if (c instanceof ScenarioConstraint.BudgetConstraint b) {
                hasBudget = true;
                if (b.budgetCents() != budgetCents) {
                    throw new IllegalArgumentException(
                            "BudgetConstraint(" + b.budgetCents() + ") non coincide con budgetCents="
                                    + budgetCents + " per lo scenario " + scenarioId);
                }
            }
        }
        if (!hasBudget) {
            allConstraints.add(new ScenarioConstraint.BudgetConstraint(budgetCents));
        }

        OptimizationProblem problem = new OptimizationProblem(
                "1.0",
                scenarioId,
                budgetCents,
                objective,
                1,
                candidates,
                allConstraints
        );

        log.info("Starting optimization: scenario={} budgetCents={} objective={} candidates={} constraints={}",
                scenarioId, budgetCents, objective, candidates.size(), allConstraints.size());

        SolverConfiguration config = new SolverConfiguration(
                primaryTimeoutSeconds, secondaryTimeoutSeconds, lexicographicTimeoutSeconds);

        long started = System.currentTimeMillis();
        OptimizationResult raw;
        try {
            raw = solver.solve(problem, config);
        } catch (RuntimeException ex) {
            log.error("Solver error for scenario {}: {}", scenarioId, ex.getMessage(), ex);
            throw new IllegalStateException("Errore durante l'ottimizzazione: " + ex.getMessage(), ex);
        }
        long elapsedMs = System.currentTimeMillis() - started;

        log.info("Solver finished: scenario={} status={} selected={} elapsedMs={}",
                scenarioId, raw.solverStatus(), raw.selectedOptionsId().size(), elapsedMs);

        List<Explanation> explanations = explanationService.explain(problem, raw);

        OptimizationResult result = new OptimizationResult(
                raw.runId(),
                raw.problemHash(),
                raw.selectedOptionsId(),
                raw.excludedOptionsId(),
                raw.totalInvestmentCents(),
                raw.remainingBudgetCents(),
                raw.objectiveValue(),
                raw.totalEnergySavingScaled(),
                raw.totalEconomicSavingCents(),
                raw.totalCo2ReductionScaled(),
                raw.solverStatus(),
                raw.optimalityProven(),
                raw.canonicalTieBreakCompleted(),
                explanations
        );

        persistRun(scenarioId, objective, budgetCents, result);
        return result;
    }

    private void persistRun(String scenarioId, Objective objective, long budgetCents, OptimizationResult result) {
        try {
            OptimizationRun run = new OptimizationRun();
            run.setRunId(result.runId());
            run.setScenarioId(scenarioId);
            run.setProblemHash(result.problemHash());
            run.setSnapshotId(scenarioId);
            run.setObjective(objective);
            run.setBudgetCents(budgetCents);
            run.setTotalInvestmentCents(result.totalInvestmentCents());
            run.setRemainingBudgetCents(result.remainingBudgetCents());
            run.setObjectiveValue(result.objectiveValue());
            run.setTotalEnergySaving(result.totalEnergySavingScaled());
            run.setTotalEconomicSavingCents(result.totalEconomicSavingCents());
            run.setTotalCo2Reduction(result.totalCo2ReductionScaled());
            run.setSolverStatus(result.solverStatus().name());
            run.setOptimalityProven(result.optimalityProven());
            run.setCanonicalTieBreakCompleted(result.canonicalTieBreakCompleted());
            run.setSelectedOptionsJson(serializeJson(result.selectedOptionsId()));
            run.setExcludedOptionsJson(serializeJson(result.excludedOptionsId()));
            run.setExplanationsJson(serializeJson(result.explanations()));
            runRepository.save(run);
        } catch (RuntimeException ex) {
            log.warn("Impossibile salvare optimization_run per scenario {}: {}", scenarioId, ex.getMessage());
        }
    }

    private String serializeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            log.warn("Impossibile serializzare valore JSON: {}", ex.getMessage());
            return "[]";
        }
    }
}