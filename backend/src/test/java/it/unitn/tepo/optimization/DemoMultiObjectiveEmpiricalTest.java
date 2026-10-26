package it.unitn.tepo.optimization;

import it.unitn.tepo.application.BuildingRepository;
import it.unitn.tepo.application.InterventionOptionRepository;
import it.unitn.tepo.application.InterventionTypeRepository;
import it.unitn.tepo.configuration.DemoDataLoader;
import it.unitn.tepo.domain.Objective;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Comparator;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

/** Verifica empirica sul dataset demo reale (300 opzioni): i tre obiettivi producono portafogli diversi. */
@SpringBootTest
@ActiveProfiles("test")
class DemoMultiObjectiveEmpiricalTest {

    @Autowired private BuildingRepository buildingRepo;
    @Autowired private InterventionTypeRepository typeRepo;
    @Autowired private InterventionOptionRepository optionRepo;

    private final OrToolsSolver orTools = new OrToolsSolver();

    @BeforeEach
    void setUp() {
        optionRepo.deleteAll();
        typeRepo.deleteAll();
        buildingRepo.deleteAll();
        new DemoDataLoader(buildingRepo, typeRepo, optionRepo).run();
    }

    private List<CandidateOption> candidates() {
        return optionRepo.findAll().stream()
                .map(o -> new CandidateOption(
                        o.getId(),
                        o.getBuildingId(),
                        o.getInterventionTypeId(),
                        o.getInvestmentCostCents(),
                        o.getAnnualEnergySavingScaled(),
                        o.getAnnualEconomicSavingCents(),
                        o.getAnnualCo2ReductionScaled()))
                .sorted(Comparator.comparing(CandidateOption::id))
                .toList();
    }

    private OptimizationResult solve(Objective obj, long budgetCents) {
        OptimizationProblem p = new OptimizationProblem(
                "1.0", "empirical", budgetCents, obj, 1, candidates(), List.of());
        return orTools.solve(p, SolverConfiguration.defaultConfig());
    }

    @Test
    void atLeastOnePairOfObjectivesDiffersOnSomeRealisticBudget() {
        long[] budgets = {
                30_000_000L,    // 300k EUR
                50_000_000L,    // 500k EUR
                80_000_000L,    // 800k EUR
                100_000_000L,   // 1.0M EUR
                150_000_000L    // 1.5M EUR
        };

        boolean foundDifference = false;
        StringBuilder diag = new StringBuilder();

        for (long budget : budgets) {
            OptimizationResult rE  = solve(Objective.ENERGY_SAVING,   budget);
            OptimizationResult rEc = solve(Objective.ECONOMIC_SAVING, budget);
            OptimizationResult rC  = solve(Objective.CO2_REDUCTION,   budget);

            boolean eVsEc  = !rE.selectedOptionsId().equals(rEc.selectedOptionsId());
            boolean eVsC   = !rE.selectedOptionsId().equals(rC.selectedOptionsId());
            boolean ecVsC  = !rEc.selectedOptionsId().equals(rC.selectedOptionsId());

            diag.append("\n  Budget ").append(budget / 100).append(" EUR:");
            diag.append("\n    ENERGY (").append(rE.selectedOptionsId().size()).append("): ")
                    .append(rE.selectedOptionsId());
            diag.append("\n    ECON   (").append(rEc.selectedOptionsId().size()).append("): ")
                    .append(rEc.selectedOptionsId());
            diag.append("\n    CO2    (").append(rC.selectedOptionsId().size()).append("): ")
                    .append(rC.selectedOptionsId());
            diag.append("\n    diversità:  E≠EC=").append(eVsEc)
                    .append("  E≠CO2=").append(eVsC)
                    .append("  EC≠CO2=").append(ecVsC);

            if (eVsEc || eVsC || ecVsC) foundDifference = true;
        }

        assertTrue(foundDifference,
                "I tre obiettivi non hanno mai prodotto portafogli diversi sui budget testati. "
                        + "Il dataset demo potrebbe ancora avere metriche proporzionali. "
                        + "Diagnostica:" + diag);
    }

    // Su vettori scorrelati CO2 dovrebbe privilegiare il gas, ECONOMIC l'elettricità.
    @Test
    void economicAndCo2DifferOnAtLeastOneBudget() {
        long[] budgets = {
                30_000_000L,
                50_000_000L,
                80_000_000L,
                100_000_000L,
                150_000_000L
        };

        boolean diverged = false;
        StringBuilder diag = new StringBuilder();

        for (long budget : budgets) {
            OptimizationResult rEc = solve(Objective.ECONOMIC_SAVING, budget);
            OptimizationResult rC  = solve(Objective.CO2_REDUCTION,   budget);

            if (!rEc.selectedOptionsId().equals(rC.selectedOptionsId())) {
                diverged = true;
                diag.append("\n  Budget ").append(budget / 100).append(" EUR");
                diag.append("\n    ECON: ").append(rEc.selectedOptionsId());
                diag.append("\n    CO2:  ").append(rC.selectedOptionsId());
            }
        }

        assertTrue(diverged,
                "ECONOMIC_SAVING e CO2_REDUCTION hanno prodotto lo stesso portafoglio "
                        + "su tutti i budget testati. Verifica i fattori per vettore." + diag);
    }
}