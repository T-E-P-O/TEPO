package it.unitn.tepo.optimization;

import it.unitn.tepo.domain.Objective;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

// Le tre funzioni obiettivo sono distinte: istanze con rapporti economici e CO2 scorrelati.
class MultiObjectiveDiscriminativeTest {

    private final OrToolsSolver orTools = new OrToolsSolver();
    private final BruteForceSolver brute = new BruteForceSolver();

    // Opzione "elettrica": alta tariffa, fattore CO2 basso. Es. LED, FV.
    private static CandidateOption electric(String id, long costCents, long energyKwh) {
        long economicCents = energyKwh * 25;          // 0.25 EUR/kWh
        long co2Kg         = energyKwh / 10;          // 0.10 kg CO2/kWh
        return new CandidateOption(id, "B1", "TYPE-LED", costCents, energyKwh, economicCents, co2Kg);
    }

    // Opzione "gas": bassa tariffa, fattore CO2 alto. Es. isolamento, PdC.
    private static CandidateOption gas(String id, long costCents, long energyKwh) {
        long economicCents = energyKwh * 10;          // 0.10 EUR/kWh
        long co2Kg         = energyKwh / 5;           // 0.20 kg CO2/kWh
        return new CandidateOption(id, "B1", "TYPE-INSULATION", costCents, energyKwh, economicCents, co2Kg);
    }

    private OptimizationProblem problem(Objective obj, List<CandidateOption> opts, long budget) {
        return new OptimizationProblem("1.0", "test", budget, obj, 1, opts, List.of());
    }

    @Test
    void economicAndCo2ObjectivesProduceDifferentPortfolios() {
        // Due opzioni incompatibili per budget: se ne può scegliere una sola.
        List<CandidateOption> opts = List.of(
                electric("E1", 1000, 100),
                gas("G1", 1000, 100)
        );

        OptimizationResult rEnergy = orTools.solve(
                problem(Objective.ENERGY_SAVING, opts, 1000),
                SolverConfiguration.defaultConfig());
        OptimizationResult rEcon = orTools.solve(
                problem(Objective.ECONOMIC_SAVING, opts, 1000),
                SolverConfiguration.defaultConfig());
        OptimizationResult rCo2 = orTools.solve(
                problem(Objective.CO2_REDUCTION, opts, 1000),
                SolverConfiguration.defaultConfig());

        // ENERGY: pareggio, lo spareggio preferisce ID crescente -> E1
        assertEquals(List.of("E1"), rEnergy.selectedOptionsId());

        // ECONOMIC: E1 (2500 > 1000)
        assertEquals(List.of("E1"), rEcon.selectedOptionsId());

        // CO2: G1 (20 > 10)
        assertEquals(List.of("G1"), rCo2.selectedOptionsId());

        // Discriminante chiave: ECONOMIC e CO2 portano a portafogli diversi
        assertNotEquals(rEcon.selectedOptionsId(), rCo2.selectedOptionsId(),
                "Con dati scorrelati, ECONOMIC_SAVING e CO2_REDUCTION devono poter "
                        + "produrre portafogli diversi");
    }

    @Test
    void threeObjectivesProduceThreeDistinctOutcomes() {
        // Terza opzione "media" per distinguere ENERGY da ECONOMIC; budget 400: una sola scelta.
        CandidateOption e1 = electric("E1", 400, 100);
        CandidateOption g1 = gas("G1", 400, 90);
        CandidateOption m1 = new CandidateOption(
                "M1", "B1", "TYPE-HEATPUMP",
                400, 120, 2400, 24);

        List<CandidateOption> opts = List.of(e1, g1, m1);

        OptimizationResult rE   = orTools.solve(problem(Objective.ENERGY_SAVING,   opts, 400), SolverConfiguration.defaultConfig());
        OptimizationResult rEc  = orTools.solve(problem(Objective.ECONOMIC_SAVING, opts, 400), SolverConfiguration.defaultConfig());
        OptimizationResult rC   = orTools.solve(problem(Objective.CO2_REDUCTION,   opts, 400), SolverConfiguration.defaultConfig());

        assertEquals(List.of("M1"), rE.selectedOptionsId(), "ENERGY: M1 (120) > E1 (100) > G1 (90)");
        assertEquals(List.of("E1"), rEc.selectedOptionsId(), "ECONOMIC: E1 (2500) > M1 (2400) > G1 (900)");
        assertEquals(List.of("M1"), rC.selectedOptionsId(), "CO2: M1 (24) > G1 (18) > E1 (10)");

        // Almeno due dei tre sono diversi
        assertNotEquals(rE.selectedOptionsId(), rEc.selectedOptionsId());
    }

    @Test
    void orToolsAndBruteForceAgreeOnAllThreeObjectives() {
        List<CandidateOption> opts = List.of(
                electric("E1", 1000, 100),
                gas("G1", 1000, 100)
        );

        for (Objective obj : Objective.values()) {
            OptimizationProblem p = problem(obj, opts, 1000);
            OptimizationResult r1 = orTools.solve(p, SolverConfiguration.defaultConfig());
            OptimizationResult r2 = brute.solve(p, SolverConfiguration.defaultConfig());

            assertEquals(r2.selectedOptionsId(), r1.selectedOptionsId(),
                    "Parità fallita per obiettivo " + obj);
            assertEquals(r2.objectiveValue(), r1.objectiveValue(),
                    "objectiveValue diverge per obiettivo " + obj);
            assertEquals(r2.totalEconomicSavingCents(), r1.totalEconomicSavingCents());
            assertEquals(r2.totalCo2ReductionScaled(), r1.totalCo2ReductionScaled());
        }
    }
}