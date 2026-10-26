package it.unitn.tepo.optimization;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

// Hash canonico del problema: indipendente da ordine di opzioni e vincoli.
public final class ProblemHasher {

    private ProblemHasher() {}

    public static String hash(OptimizationProblem problem) {
        StringBuilder sb = new StringBuilder(1024);
        sb.append("v=").append(problem.schemaVersion()).append('\n');
        sb.append("obj=").append(problem.objective()).append('\n');
        sb.append("budget=").append(problem.budgetCents()).append('\n');
        sb.append("scale=").append(problem.coefficientScale()).append('\n');

        sb.append("--options--\n");
        problem.candidateOptions().stream()
                .sorted(Comparator.comparing(CandidateOption::id))
                .forEach(c -> sb.append(c.id()).append('|')
                        .append(c.buildingId()).append('|')
                        .append(c.interventionTypeId()).append('|')
                        .append(c.investmentCostCents()).append('|')
                        .append(c.annualEnergySavingScaled()).append('|')
                        .append(c.annualEconomicSavingCents()).append('|')
                        .append(c.annualCo2ReductionScaled()).append('\n'));

        sb.append("--constraints--\n");
        problem.constraints().stream()
                .map(ProblemHasher::canonicalConstraint)
                .sorted()
                .forEach(s -> sb.append(s).append('\n'));

        return sha256(sb.toString());
    }

    private static String canonicalConstraint(ScenarioConstraint c) {
        if (c instanceof ScenarioConstraint.BudgetConstraint b) {
            return "BUDGET:" + b.budgetCents();
        }
        if (c instanceof ScenarioConstraint.IncompatibilityConstraint i) {
            String a = i.optionA(), b = i.optionB();
            return "INCOMPAT:" + (a.compareTo(b) <= 0 ? a + "|" + b : b + "|" + a);
        }
        if (c instanceof ScenarioConstraint.PrerequisiteConstraint p) {
            return "PREREQ:" + p.option() + "->" + p.requiredOption();
        }
        if (c instanceof ScenarioConstraint.MaxNumberConstraint m) {
            List<String> ids = new ArrayList<>(m.optionIds());
            Collections.sort(ids);
            return "MAXN:" + m.maxNumber() + ":" + String.join(",", ids);
        }
        if (c instanceof ScenarioConstraint.IncludeConstraint i) {
            return "INCLUDE:" + i.optionId();
        }
        if (c instanceof ScenarioConstraint.ExcludeConstraint e) {
            return "EXCLUDE:" + e.optionId();
        }
        // Interfaccia sealed: non raggiungibile, ma difensiva.
        return "UNKNOWN:" + c;
    }

    private static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 non disponibile", e);
        }
    }
}