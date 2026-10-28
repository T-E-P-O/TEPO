package it.unitn.tepo.optimization;

public record Explanation(
        String optionId,
        String reasonCode,
        String message
) {}