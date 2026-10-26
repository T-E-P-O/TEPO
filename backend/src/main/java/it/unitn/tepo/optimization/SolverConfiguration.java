package it.unitn.tepo.optimization;

public record SolverConfiguration(
        int primaryTimeoutSeconds,
        int secondaryTimeoutSeconds,
        int lexicographicTimeoutSeconds
) {
    // Costruttore retro-compatibile: tutti i timeout derivano da un valore singolo.
    public SolverConfiguration(int maxTimeSeconds) {
        this(maxTimeSeconds, Math.max(1, maxTimeSeconds / 3), 1);
    }

    public static SolverConfiguration defaultConfig() {
        return new SolverConfiguration(10, 3, 1);
    }
}