package it.unitn.tepo.optimization;

import org.springframework.stereotype.Service;

import java.util.*;

// Diagnosi deterministiche: barriere locali dimostrate e causa non determinata.
@Service
public class ExplanationService {

    public List<Explanation> explain(OptimizationProblem problem, OptimizationResult result) {
        List<Explanation> explanations = new ArrayList<>();
        Set<String> selected = new HashSet<>(result.selectedOptionsId());
        Map<String, CandidateOption> byId = new HashMap<>();
        for (CandidateOption c : problem.candidateOptions()) {
            byId.put(c.id(), c);
        }

        // Pre-calcolo dei vincoli per una consultazione rapida
        Map<String, Set<String>> incompatibilities = new HashMap<>();
        Map<String, String> prerequisites = new HashMap<>();
        Set<String> explicitExclusions = new HashSet<>();
        List<ScenarioConstraint.MaxNumberConstraint> maxNumberConstraints = new ArrayList<>();

        for (ScenarioConstraint constraint : problem.constraints()) {
            if (constraint instanceof ScenarioConstraint.IncompatibilityConstraint inc) {
                incompatibilities.computeIfAbsent(inc.optionA(), k -> new HashSet<>()).add(inc.optionB());
                incompatibilities.computeIfAbsent(inc.optionB(), k -> new HashSet<>()).add(inc.optionA());
            } else if (constraint instanceof ScenarioConstraint.PrerequisiteConstraint pre) {
                prerequisites.put(pre.option(), pre.requiredOption());
            } else if (constraint instanceof ScenarioConstraint.ExcludeConstraint exc) {
                explicitExclusions.add(exc.optionId());
            } else if (constraint instanceof ScenarioConstraint.MaxNumberConstraint max) {
                maxNumberConstraints.add(max);
            }
        }

        long budgetResidual = problem.budgetCents() - result.totalInvestmentCents();

        for (String excludedId : result.excludedOptionsId()) {
            CandidateOption c = byId.get(excludedId);
            if (c == null) continue;
            explanations.add(diagnoseLocal(c, selected, incompatibilities, prerequisites,
                    explicitExclusions, maxNumberConstraints,
                    problem.budgetCents(), budgetResidual));
        }

        for (String selectedId : result.selectedOptionsId()) {
            CandidateOption c = byId.get(selectedId);
            if (c == null) continue;
            explanations.add(explainSelected(c, prerequisites, selected));
        }

        return explanations;
    }

    private Explanation diagnoseLocal(CandidateOption c,
                                      Set<String> selected,
                                      Map<String, Set<String>> incompatibilities,
                                      Map<String, String> prerequisites,
                                      Set<String> explicitExclusions,
                                      List<ScenarioConstraint.MaxNumberConstraint> maxNumberConstraints,
                                      long totalBudget,
                                      long budgetResidual) {

        // 1) Esclusione esplicita: il vincolo stesso nomina l'opzione
        if (explicitExclusions.contains(c.id())) {
            return new Explanation(c.id(), "ESCLUSO_ESPLICITO",
                    "L'opzione è esclusa da un vincolo EscludeConstraint esplicito dello scenario.");
        }

        // 2) Incompatibilità con un selezionato
        Set<String> incomp = incompatibilities.getOrDefault(c.id(), Set.of());
        for (String other : incomp) {
            if (selected.contains(other)) {
                return new Explanation(c.id(), "ESCLUSO_INCOMPATIBILITA",
                        "L'aggiunta viola l'incompatibilità con " + other + " già selezionato.");
            }
        }

        // 3) Prerequisito non soddisfatto
        String required = prerequisites.get(c.id());
        if (required != null && !selected.contains(required)) {
            return new Explanation(c.id(), "ESCLUSO_PREREQUISITO",
                    "L'aggiunta richiede anche " + required + "; occorre ricalcolare il portafoglio.");
        }

        // 4) Budget totale insufficiente per l'opzione da sola
        if (c.investmentCostCents() > totalBudget) {
            return new Explanation(c.id(), "ESCLUSO_BUDGET_TOTALE",
                    "Questa opzione da sola supera il budget dello scenario.");
        }

        // 5) Limite massimo raggiunto, solo con MaxNumberConstraint già saturo.
        for (ScenarioConstraint.MaxNumberConstraint max : maxNumberConstraints) {
            if (!max.optionIds().contains(c.id())) continue;
            long selectedInScope = max.optionIds().stream().filter(selected::contains).count();
            if (selectedInScope >= max.maxNumber()) {
                return new Explanation(c.id(), "ESCLUSO_MAX_NUMBER",
                        "Aggiungere questa opzione supererebbe il limite di "
                                + max.maxNumber() + " interventi del vincolo MaxNumber; "
                                + "il limite risulta già raggiunto nel portafoglio corrente.");
            }
        }

        // 6) Budget residuo insufficiente per l'aggiunta singola
        if (c.investmentCostCents() > budgetResidual) {
            return new Explanation(c.id(), "ESCLUSO_BUDGET_RESIDUO",
                    "Non può essere aggiunta a questo piano senza modificare altre selezioni.");
        }

        // 7) Nessuna barriera locale dimostrabile
        return new Explanation(c.id(), "ESCLUSO_NON_OTTIMALE",
                "Non selezionata nella soluzione ottima; causa specifica non determinata dal solo risultato corrente.");
    }

    private Explanation explainSelected(CandidateOption c,
                                        Map<String, String> prerequisites,
                                        Set<String> selected) {
        // Serve almeno un richiedente selezionato: altrimenti c non abilita nulla.
        boolean enablesSelectedOption = prerequisites.entrySet().stream()
                .anyMatch(e -> e.getValue().equals(c.id()) && selected.contains(e.getKey()));

        boolean zeroBenefit = c.annualEnergySavingScaled() == 0
                && c.annualEconomicSavingCents() == 0
                && c.annualCo2ReductionScaled() == 0;

        if (enablesSelectedOption && zeroBenefit) {
            return new Explanation(c.id(), "SELEZIONATO_PREREQUISITO",
                    "Selezionato come prerequisito per un altro intervento selezionato; "
                            + "non contribuisce direttamente all'obiettivo.");
        }
        return new Explanation(c.id(), "SELEZIONATO",
                "Selezionato perché contribuisce all'obiettivo scelto e rispetta budget e vincoli dello scenario.");
    }
}