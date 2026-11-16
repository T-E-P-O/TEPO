package it.unitn.tepo.ai;

import it.unitn.tepo.application.InterventionOptionRepository;
import it.unitn.tepo.domain.Objective;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// Assistente locale deterministico: estrae budget e obiettivo senza LLM; default 500.000 EUR.
@Service
public class RuleBasedAiAssistant implements AiAssistant {

    static final long DEFAULT_BUDGET_CENTS = 500_000_00L;   // 500.000 EUR
    static final long MAX_BUDGET_CENTS = 10_000_000_000_00L; // 10 miliardi EUR

    // Numero con suffisso di unità ("500.000", "1,5", "80k") e controlli anti-falsi positivi.
    private static final Pattern NUMBER_WITH_UNIT = Pattern.compile(
            "(?<![\\d.,])(\\d{1,3}(?:[.,]\\d{3})+|\\d+(?:[.,]\\d+)?)\\s*"
            + "(k|mila|mille|mln|milione|milioni|m)?(?![\\p{L}])",
            Pattern.CASE_INSENSITIVE);

    // Parole chiave che indicano che un numero vicino è un budget.
    private static final Pattern BUDGET_KEYWORDS = Pattern.compile(
            "budget|spesa|investimento|stanziamento|importo|disponibilit|€|euro|eur",
            Pattern.CASE_INSENSITIVE);

    private final InterventionOptionRepository optionRepo;

    public RuleBasedAiAssistant(InterventionOptionRepository optionRepo) {
        this.optionRepo = optionRepo;
    }

    @Override
    public ScenarioProposal propose(String text) {
        String lower = text == null ? "" : text.toLowerCase();

        Objective obj = detectObjective(lower);
        Optional<Long> parsedBudget = extractBudget(text);
        long budgetCents = parsedBudget.orElse(DEFAULT_BUDGET_CENTS);

        String explanation = parsedBudget.isPresent()
                ? "Proposta deterministica da testo: budget " + budgetCents + " cent, obiettivo " + obj
                : "Budget non riconosciuto nel testo; uso default " + DEFAULT_BUDGET_CENTS
                  + " cent (500.000 EUR). Obiettivo " + obj;

        List<String> ids = optionRepo.findAll().stream()
                .map(o -> o.getId())
                .toList();

        return new ScenarioProposal(
                budgetCents,
                obj,
                ids,
                explanation,
                ScenarioProposal.ProposalSource.RULE_BASED,
                List.of(),
                List.of(),
                true
        );
    }

    private Objective detectObjective(String lower) {
        if (lower.contains("co2") || lower.contains("co₂") || lower.contains("emission")) {
            return Objective.CO2_REDUCTION;
        }
        if (lower.contains("econom") || lower.contains("risparmio economic")
                || lower.contains("costo")) {
            return Objective.ECONOMIC_SAVING;
        }
        return Objective.ENERGY_SAVING;
    }

    // Estrae un budget in centesimi dal testo; visibile al package per i test.
    Optional<Long> extractBudget(String text) {
        if (text == null || text.isBlank()) return Optional.empty();

        Matcher m = NUMBER_WITH_UNIT.matcher(text);

        long bestEuros = -1;
        int bestScore = -1;

        while (m.find()) {
            String numPart = m.group(1);
            String unitPart = m.group(2);
            String unit = unitPart == null ? "" : unitPart.toLowerCase();

            Long euros = parseNumberWithUnit(numPart, unit);
            if (euros == null || euros <= 0) continue;

            long cents = euros * 100;
            if (cents > MAX_BUDGET_CENTS) continue;

            if (unit.isEmpty() && isYear(numPart)) continue;

            int score = scoreCandidate(text, m.start(), m.end(), !unit.isEmpty());
            if (score < 10) continue;

            if (score > bestScore) {
                bestScore = score;
                bestEuros = euros;
            }
        }

        return bestEuros > 0 ? Optional.of(bestEuros * 100) : Optional.empty();
    }

    private static boolean isYear(String numPart) {
        if (numPart.length() != 4) return false;
        if (numPart.contains(".") || numPart.contains(",")) return false;
        try {
            long n = Long.parseLong(numPart);
            return n >= 1900 && n <= 2100;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private Long parseNumberWithUnit(String numPart, String unit) {
        String normalized;
        if (numPart.matches("\\d{1,3}([.,]\\d{3})+")) {
            normalized = numPart.replaceAll("[.,]", "");
        } else {
            normalized = numPart.replace(',', '.');
        }

        double value;
        try {
            value = Double.parseDouble(normalized);
        } catch (NumberFormatException e) {
            return null;
        }

        return switch (unit) {
            case "k", "mila", "mille" -> Math.round(value * 1_000);
            case "m", "mln", "milione", "milioni" -> Math.round(value * 1_000_000);
            default -> Math.round(value);
        };
    }

    private int scoreCandidate(String text, int start, int end, boolean hasUnit) {
        int score = hasUnit ? 10 : 0;

        // Contesto di budget entro 30 caratteri a sinistra
        int ctxStart = Math.max(0, start - 30);
        if (BUDGET_KEYWORDS.matcher(text.substring(ctxStart, end)).find()) {
            score += 20;
        }

        // "budget", "euro" o "€" entro 20 caratteri a destra
        int afterEnd = Math.min(text.length(), end + 20);
        String after = text.substring(end, afterEnd);
        if (BUDGET_KEYWORDS.matcher(after).find()) {
            score += 15;
        }

        return score;
    }
}