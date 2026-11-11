package it.unitn.tepo.optimization;

import com.google.ortools.Loader;
import com.google.ortools.sat.*;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class OrToolsSolver implements OptimizationSolver {

    private static boolean loaded = false;

    private static synchronized void ensureLoaded() {
        if (!loaded) {
            Loader.loadNativeLibraries();
            loaded = true;
        }
    }

    @Override
    public OptimizationResult solve(OptimizationProblem problem, SolverConfiguration configuration) {
        ensureLoaded();

        // Pre-validazione: IncludeConstraint su opzione non candidata porta a INFEASIBLE.
        for (ScenarioConstraint c : problem.constraints()) {
            if (c instanceof ScenarioConstraint.IncludeConstraint inc) {
                boolean present = problem.candidateOptions().stream()
                        .anyMatch(o -> o.id().equals(inc.optionId()));
                if (!present) {
                    return emptyResult(problem, SolverStatus.INFEASIBLE, false, false);
                }
            }
        }

        int n = problem.candidateOptions().size();
        if (n == 0) {
            return emptyResult(problem, SolverStatus.OPTIMAL, true, true);
        }

        // Passo 1: massimizza obiettivo primario
        StepResult primary = solvePrimary(problem, configuration);
        if (primary.status == StepStatus.INFEASIBLE) {
            return emptyResult(problem, SolverStatus.INFEASIBLE, false, false);
        }
        if (primary.status == StepStatus.UNKNOWN) {
            return emptyResult(problem, SolverStatus.UNKNOWN, false, false);
        }
        long bestObj = primary.value;

        // Passo 2: minimizza costo con obiettivo fissato
        StepResult minCost = solveMinCost(problem, configuration, bestObj);
        if (minCost.status != StepStatus.OPTIMAL && minCost.status != StepStatus.FEASIBLE) {
            return buildResultFromIds(problem, primary.selected,
                    primary.status == StepStatus.OPTIMAL, false);
        }
        long bestCost = minCost.value;

        // Passo 3: minimizza numero di interventi
        StepResult minCount = solveMinCount(problem, configuration, bestObj, bestCost);
        if (minCount.status != StepStatus.OPTIMAL && minCount.status != StepStatus.FEASIBLE) {
            return buildResultFromIds(problem, minCost.selected,
                    primary.status == StepStatus.OPTIMAL, false);
        }
        int bestCount = (int) minCount.value;

        // Passo 4: ID in ordine lessicografico, ricostruendo il modello ogni volta
        List<String> selected = solveLexicographic(problem, configuration, bestObj, bestCost, bestCount);
        if (selected == null) {
            List<String> fallback = minCount.selected;
            return buildResultFromIds(problem, fallback,
                    primary.status == StepStatus.OPTIMAL, false);
        }

        return buildResultFromIds(problem, selected,
                primary.status == StepStatus.OPTIMAL, true);
    }

    // Passi

    private StepResult solvePrimary(OptimizationProblem problem, SolverConfiguration cfg) {
        BoolVar[] x = new BoolVar[problem.candidateOptions().size()];
        CpModel model = buildBaseModel(problem, x);
        model.maximize(objectiveExpr(problem, x));

        CpSolver solver = newSolver(cfg.primaryTimeoutSeconds());
        CpSolverStatus status = solver.solve(model);
        return interpretStatus(problem, x, solver, status);
    }

    private StepResult solveMinCost(OptimizationProblem problem, SolverConfiguration cfg, long fixedObj) {
        BoolVar[] x = new BoolVar[problem.candidateOptions().size()];
        CpModel model = buildBaseModel(problem, x);
        model.addEquality(objectiveExpr(problem, x), fixedObj);
        model.minimize(costExpr(problem, x));

        CpSolver solver = newSolver(cfg.secondaryTimeoutSeconds());
        CpSolverStatus status = solver.solve(model);

        if (status == CpSolverStatus.OPTIMAL || status == CpSolverStatus.FEASIBLE) {
            long cost = extractCost(problem, x, solver);
            StepStatus st = (status == CpSolverStatus.OPTIMAL) ? StepStatus.OPTIMAL : StepStatus.FEASIBLE;
            return new StepResult(st, cost, extractSelected(problem, x, solver));
        }
        if (status == CpSolverStatus.INFEASIBLE) {
            return new StepResult(StepStatus.INFEASIBLE, 0, List.of());
        }
        return new StepResult(StepStatus.UNKNOWN, 0, List.of());
    }

    private StepResult solveMinCount(OptimizationProblem problem, SolverConfiguration cfg,
                                     long fixedObj, long fixedCost) {
        BoolVar[] x = new BoolVar[problem.candidateOptions().size()];
        CpModel model = buildBaseModel(problem, x);
        model.addEquality(objectiveExpr(problem, x), fixedObj);
        model.addEquality(costExpr(problem, x), fixedCost);
        model.minimize(countExpr(x));

        CpSolver solver = newSolver(cfg.secondaryTimeoutSeconds());
        CpSolverStatus status = solver.solve(model);

        if (status == CpSolverStatus.OPTIMAL || status == CpSolverStatus.FEASIBLE) {
            int cnt = extractCount(x, solver);
            StepStatus st = (status == CpSolverStatus.OPTIMAL) ? StepStatus.OPTIMAL : StepStatus.FEASIBLE;
            return new StepResult(st, cnt, extractSelected(problem, x, solver));
        }
        if (status == CpSolverStatus.INFEASIBLE) {
            return new StepResult(StepStatus.INFEASIBLE, 0, List.of());
        }
        return new StepResult(StepStatus.UNKNOWN, 0, List.of());
    }

    // ID in ordine lessicografico: ricostruisce il CpModel a ogni iterazione; null se non conclude.
    private List<String> solveLexicographic(OptimizationProblem problem, SolverConfiguration cfg,
                                            long fixedObj, long fixedCost, int fixedCount) {
        List<CandidateOption> sorted = new ArrayList<>(problem.candidateOptions());
        sorted.sort(Comparator.comparing(CandidateOption::id));

        Map<String, Integer> idToIndex = new HashMap<>();
        for (int i = 0; i < problem.candidateOptions().size(); i++) {
            idToIndex.put(problem.candidateOptions().get(i).id(), i);
        }

        Set<String> forcedInclude = new HashSet<>();
        Set<String> forcedExclude = new HashSet<>();

        for (CandidateOption c : sorted) {
            Integer idx = idToIndex.get(c.id());
            if (idx == null) continue;

            BoolVar[] x = new BoolVar[problem.candidateOptions().size()];
            CpModel model = buildBaseModel(problem, x);
            model.addEquality(objectiveExpr(problem, x), fixedObj);
            model.addEquality(costExpr(problem, x), fixedCost);
            model.addEquality(countExpr(x), fixedCount);

            for (String id : forcedInclude) {
                Integer i2 = idToIndex.get(id);
                if (i2 != null) model.addEquality(x[i2], 1);
            }
            for (String id : forcedExclude) {
                Integer i2 = idToIndex.get(id);
                if (i2 != null) model.addEquality(x[i2], 0);
            }
            model.addEquality(x[idx], 1);

            CpSolver solver = newSolver(cfg.lexicographicTimeoutSeconds());
            CpSolverStatus s = solver.solve(model);

            if (s == CpSolverStatus.OPTIMAL || s == CpSolverStatus.FEASIBLE) {
                forcedInclude.add(c.id());
            } else if (s == CpSolverStatus.INFEASIBLE) {
                forcedExclude.add(c.id());
            } else {
                return null;
            }
        }

        BoolVar[] x = new BoolVar[problem.candidateOptions().size()];
        CpModel model = buildBaseModel(problem, x);
        model.addEquality(objectiveExpr(problem, x), fixedObj);
        model.addEquality(costExpr(problem, x), fixedCost);
        model.addEquality(countExpr(x), fixedCount);
        for (String id : forcedInclude) {
            Integer i2 = idToIndex.get(id);
            if (i2 != null) model.addEquality(x[i2], 1);
        }
        for (String id : forcedExclude) {
            Integer i2 = idToIndex.get(id);
            if (i2 != null) model.addEquality(x[i2], 0);
        }

        CpSolver solver = newSolver(cfg.lexicographicTimeoutSeconds());
        CpSolverStatus s = solver.solve(model);
        if (s != CpSolverStatus.OPTIMAL && s != CpSolverStatus.FEASIBLE) {
            return null;
        }
        List<String> selected = new ArrayList<>();
        for (int i = 0; i < x.length; i++) {
            if (solver.value(x[i]) == 1) selected.add(problem.candidateOptions().get(i).id());
        }
        return selected;
    }

    // Interpretazione dello stato

    private enum StepStatus { OPTIMAL, FEASIBLE, INFEASIBLE, UNKNOWN }

    private static final class StepResult {
        final StepStatus status;
        final long value;
        final List<String> selected;
        StepResult(StepStatus s, long v, List<String> sel) {
            this.status = s; this.value = v; this.selected = sel;
        }
    }

    private StepResult interpretStatus(OptimizationProblem problem, BoolVar[] x,
                                       CpSolver solver, CpSolverStatus status) {
        if (status == CpSolverStatus.OPTIMAL || status == CpSolverStatus.FEASIBLE) {
            long obj = computeObjectiveFromSolution(problem, x, solver);
            List<String> selected = extractSelected(problem, x, solver);
            long value = switch (problem.objective()) {
                case ENERGY_SAVING, ECONOMIC_SAVING, CO2_REDUCTION -> obj;
            };
            StepStatus st = (status == CpSolverStatus.OPTIMAL) ? StepStatus.OPTIMAL : StepStatus.FEASIBLE;
            return new StepResult(st, value, selected);
        }
        if (status == CpSolverStatus.INFEASIBLE) {
            return new StepResult(StepStatus.INFEASIBLE, 0, List.of());
        }
        return new StepResult(StepStatus.UNKNOWN, 0, List.of());
    }

    private long extractCost(OptimizationProblem problem, BoolVar[] x, CpSolver solver) {
        long c = 0;
        for (int i = 0; i < x.length; i++) {
            if (solver.value(x[i]) == 1) c += problem.candidateOptions().get(i).investmentCostCents();
        }
        return c;
    }

    private int extractCount(BoolVar[] x, CpSolver solver) {
        int c = 0;
        for (BoolVar v : x) if (solver.value(v) == 1) c++;
        return c;
    }

    // Costruzione del modello

    private CpModel buildBaseModel(OptimizationProblem problem, BoolVar[] x) {
        CpModel model = new CpModel();
        int n = problem.candidateOptions().size();
        for (int i = 0; i < n; i++) {
            x[i] = model.newBoolVar("x_" + problem.candidateOptions().get(i).id());
        }

        LinearExprBuilder cost = LinearExpr.newBuilder();
        for (int i = 0; i < n; i++) {
            cost.addTerm(x[i], problem.candidateOptions().get(i).investmentCostCents());
        }
        model.addLessOrEqual(cost.build(), problem.budgetCents());

        Map<String, Integer> index = new HashMap<>();
        for (int i = 0; i < n; i++) {
            index.put(problem.candidateOptions().get(i).id(), i);
        }

        for (ScenarioConstraint constraint : problem.constraints()) {
            if (constraint instanceof ScenarioConstraint.BudgetConstraint budget) {
                // Il budget arriva da problem.budgetCents(); la coerenza è verificata in OptimizationService.
            } else if (constraint instanceof ScenarioConstraint.IncompatibilityConstraint inc) {
                Integer a = index.get(inc.optionA());
                Integer b = index.get(inc.optionB());
                if (a != null && b != null) {
                    LinearExprBuilder sum = LinearExpr.newBuilder();
                    sum.add(x[a]);
                    sum.add(x[b]);
                    model.addLessOrEqual(sum.build(), 1);
                }
            } else if (constraint instanceof ScenarioConstraint.PrerequisiteConstraint pre) {
                Integer opt = index.get(pre.option());
                Integer req = index.get(pre.requiredOption());
                if (opt != null) {
                    if (req != null) {
                        model.addImplication(x[opt], x[req]);
                    } else {
                        // Prerequisito non candidato: l'opzione dipendente non può essere selezionata.
                        model.addEquality(x[opt], 0);
                    }
                }
                // opt == null: opzione dipendente non candidata, nulla da applicare.
            } else if (constraint instanceof ScenarioConstraint.MaxNumberConstraint max) {
                LinearExprBuilder sum = LinearExpr.newBuilder();
                for (String id : max.optionIds()) {
                    Integer idx = index.get(id);
                    if (idx != null) sum.add(x[idx]);
                }
                model.addLessOrEqual(sum.build(), max.maxNumber());
            } else if (constraint instanceof ScenarioConstraint.IncludeConstraint inc) {
                Integer idx = index.get(inc.optionId());
                if (idx != null) {
                    model.addEquality(x[idx], 1);
                }
                // idx == null: gestito dalla pre-validazione in solve() => INFEASIBLE.
            } else if (constraint instanceof ScenarioConstraint.ExcludeConstraint exc) {
                Integer idx = index.get(exc.optionId());
                if (idx != null) model.addEquality(x[idx], 0);
            }
        }
        return model;
    }

    private LinearExpr objectiveExpr(OptimizationProblem problem, BoolVar[] x) {
        LinearExprBuilder b = LinearExpr.newBuilder();
        for (int i = 0; i < x.length; i++) {
            CandidateOption c = problem.candidateOptions().get(i);
            long coeff = switch (problem.objective()) {
                case ENERGY_SAVING -> c.annualEnergySavingScaled();
                case ECONOMIC_SAVING -> c.annualEconomicSavingCents();
                case CO2_REDUCTION -> c.annualCo2ReductionScaled();
            };
            b.addTerm(x[i], coeff);
        }
        return b.build();
    }

    private LinearExpr costExpr(OptimizationProblem problem, BoolVar[] x) {
        LinearExprBuilder b = LinearExpr.newBuilder();
        for (int i = 0; i < x.length; i++) {
            b.addTerm(x[i], problem.candidateOptions().get(i).investmentCostCents());
        }
        return b.build();
    }

    private LinearExpr countExpr(BoolVar[] x) {
        LinearExprBuilder b = LinearExpr.newBuilder();
        for (BoolVar v : x) b.add(v);
        return b.build();
    }

    private long computeObjectiveFromSolution(OptimizationProblem problem, BoolVar[] x, CpSolver solver) {
        long v = 0;
        for (int i = 0; i < x.length; i++) {
            if (solver.value(x[i]) == 1) {
                v += switch (problem.objective()) {
                    case ENERGY_SAVING -> problem.candidateOptions().get(i).annualEnergySavingScaled();
                    case ECONOMIC_SAVING -> problem.candidateOptions().get(i).annualEconomicSavingCents();
                    case CO2_REDUCTION -> problem.candidateOptions().get(i).annualCo2ReductionScaled();
                };
            }
        }
        return v;
    }

    private List<String> extractSelected(OptimizationProblem problem, BoolVar[] x, CpSolver solver) {
        List<String> selected = new ArrayList<>();
        for (int i = 0; i < x.length; i++) {
            if (solver.value(x[i]) == 1) selected.add(problem.candidateOptions().get(i).id());
        }
        return selected;
    }

    // Risultato

    private OptimizationResult buildResultFromIds(OptimizationProblem problem, List<String> selectedIds,
                                                  boolean optimal, boolean canonical) {
        Set<String> sel = new HashSet<>(selectedIds);
        long totalCost = 0, totalEnergy = 0, totalEconomic = 0, totalCo2 = 0;
        List<String> excluded = new ArrayList<>();
        for (CandidateOption c : problem.candidateOptions()) {
            if (sel.contains(c.id())) {
                totalCost += c.investmentCostCents();
                totalEnergy += c.annualEnergySavingScaled();
                totalEconomic += c.annualEconomicSavingCents();
                totalCo2 += c.annualCo2ReductionScaled();
            } else {
                excluded.add(c.id());
            }
        }
        List<String> sortedSel = new ArrayList<>(selectedIds);
        sortedSel.sort(String::compareTo);
        excluded.sort(String::compareTo);

        long objValue = switch (problem.objective()) {
            case ENERGY_SAVING -> totalEnergy;
            case ECONOMIC_SAVING -> totalEconomic;
            case CO2_REDUCTION -> totalCo2;
        };

        SolverStatus status = optimal ? SolverStatus.OPTIMAL : SolverStatus.FEASIBLE;

        return new OptimizationResult(
                UUID.randomUUID().toString(),
                ProblemHasher.hash(problem),
                sortedSel,
                excluded,
                totalCost,
                problem.budgetCents() - totalCost,
                objValue,
                totalEnergy,
                totalEconomic,
                totalCo2,
                status,
                optimal,
                canonical,
                List.of()
        );
    }

    private OptimizationResult emptyResult(OptimizationProblem problem, SolverStatus status,
                                           boolean optimal, boolean canonical) {
        List<String> allIds = problem.candidateOptions().stream().map(CandidateOption::id).toList();
        return new OptimizationResult(
                UUID.randomUUID().toString(),
                ProblemHasher.hash(problem),
                List.of(),
                allIds,
                0, problem.budgetCents(),
                0, 0, 0, 0,
                status, optimal, canonical, List.of()
        );
    }

    private CpSolver newSolver(int timeoutSeconds) {
        CpSolver solver = new CpSolver();
        solver.getParameters().setNumSearchWorkers(1);
        solver.getParameters().setRandomSeed(0);
        solver.getParameters().setMaxTimeInSeconds(timeoutSeconds);
        return solver;
    }
}