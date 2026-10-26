package it.unitn.tepo.optimization;

import java.util.List;

public sealed interface ScenarioConstraint {

    record BudgetConstraint(long budgetCents) implements ScenarioConstraint {}

    record IncompatibilityConstraint(String optionA, String optionB) implements ScenarioConstraint {}

    record PrerequisiteConstraint(String option, String requiredOption) implements ScenarioConstraint {}

    record MaxNumberConstraint(int maxNumber, List<String> optionIds) implements ScenarioConstraint {}

    record IncludeConstraint(String optionId) implements ScenarioConstraint {}

    record ExcludeConstraint(String optionId) implements ScenarioConstraint {}
}