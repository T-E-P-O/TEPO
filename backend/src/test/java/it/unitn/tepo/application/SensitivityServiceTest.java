package it.unitn.tepo.application;

import it.unitn.tepo.domain.InterventionOption;
import it.unitn.tepo.domain.Objective;
import it.unitn.tepo.optimization.OrToolsSolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

// Test dell'analisi di sensibilità: forma, proprietà strutturali, casi limite e determinismo.
class SensitivityServiceTest {

    private InterventionOptionRepository repo;
    private SensitivityService service;

    @BeforeEach
    void setup() {
        repo = Mockito.mock(InterventionOptionRepository.class);
        service = new SensitivityService(repo, new OrToolsSolver());
    }

    private static InterventionOption opt(String id, long cost, long energy) {
        InterventionOption o = new InterventionOption();
        o.setId(id);
        o.setBuildingId("B1");
        o.setInterventionTypeId("T1");
        o.setInvestmentCostCents(cost);
        o.setAnnualEnergySavingScaled(energy);
        o.setAnnualEconomicSavingCents(energy * 20);
        o.setAnnualCo2ReductionScaled(energy / 4);
        return o;
    }

    private static List<InterventionOption> smallCatalog() {
        return List.of(
                opt("OPT-001", 1000, 900),
                opt("OPT-002", 1000, 800),
                opt("OPT-003", 1000, 700),
                opt("OPT-004", 1000, 600)
        );
    }

    private void stubAll() {
        List<InterventionOption> all = smallCatalog();
        when(repo.findAllById(Mockito.any())).thenAnswer(inv -> {
            Iterable<String> ids = inv.getArgument(0);
            Set<String> set = new HashSet<>();
            for (String id : ids) set.add(id);
            return all.stream().filter(o -> set.contains(o.getId())).toList();
        });
    }

    private Set<String> allIds() {
        return Set.of("OPT-001", "OPT-002", "OPT-003", "OPT-004");
    }

    // Forma

    @Test
    void resultHasRequestedNumberOfPoints() {
        stubAll();
        SensitivityService.Result r = service.analyze(
                "SCN-TEST", 2000, Objective.ENERGY_SAVING, allIds(),
                5, 0.5, 1.5);

        assertEquals(5, r.points());
        assertEquals(5, r.grid().size());
        assertEquals(1000, r.minBudgetCents());
        assertEquals(3000, r.maxBudgetCents());
        assertEquals(1000, r.grid().get(0).budgetCents());
        assertEquals(3000, r.grid().get(4).budgetCents());
    }

    @Test
    void gridIsMonotonicallyIncreasingInBudget() {
        stubAll();
        SensitivityService.Result r = service.analyze(
                "SCN-TEST", 2000, Objective.ENERGY_SAVING, allIds(),
                7, 0.5, 2.0);

        long prev = -1;
        for (SensitivityService.Point p : r.grid()) {
            assertTrue(p.budgetCents() >= prev,
                    "budget non monotono: " + p.budgetCents() + " dopo " + prev);
            prev = p.budgetCents();
        }
    }

    // Proprietà strutturali

    @Test
    void alwaysNeverSwingAreDisjointAndCoverAll() {
        stubAll();
        SensitivityService.Result r = service.analyze(
                "SCN-TEST", 2000, Objective.ENERGY_SAVING, allIds(),
                5, 0.25, 2.0);

        assertTrue(Collections.disjoint(r.alwaysSelected(), r.neverSelected()),
                "always e never non disgiunti: " + r);
        assertTrue(Collections.disjoint(r.alwaysSelected(), r.swing()),
                "always e swing non disgiunti: " + r);
        assertTrue(Collections.disjoint(r.neverSelected(), r.swing()),
                "never e swing non disgiunti: " + r);

        Set<String> union = new HashSet<>();
        union.addAll(r.alwaysSelected());
        union.addAll(r.neverSelected());
        union.addAll(r.swing());
        assertEquals(allIds(), union,
                "unione always+never+swing non copre il catalogo: " + r);
    }

    // Casi limite

    @Test
    void allOptionsAreAlwaysSelectedWhenBudgetAlwaysExceedsTotalCost() {
        stubAll();
        SensitivityService.Result r = service.analyze(
                "SCN-TEST", 5000, Objective.ENERGY_SAVING, allIds(),
                3, 0.9, 1.1);

        assertEquals(allIds().size(), r.alwaysSelected().size(),
                "Tutte le opzioni dovrebbero essere sempre selezionate: " + r);
        assertTrue(r.neverSelected().isEmpty(),
                "Nessuna opzione dovrebbe essere mai selezionata: " + r);
        assertTrue(r.swing().isEmpty(),
                "Nessuna opzione dovrebbe oscillare: " + r);
    }

    @Test
    void allOptionsAreNeverSelectedWhenBudgetNeverReachesMinimumCost() {
        stubAll();
        SensitivityService.Result r = service.analyze(
                "SCN-TEST", 500, Objective.ENERGY_SAVING, allIds(),
                3, 0.9, 1.1);

        assertTrue(r.alwaysSelected().isEmpty(),
                "Nessuna opzione dovrebbe essere sempre selezionata: " + r);
        assertEquals(allIds().size(), r.neverSelected().size(),
                "Tutte le opzioni dovrebbero essere mai selezionate: " + r);
        assertTrue(r.swing().isEmpty(),
                "Nessuna opzione dovrebbe oscillare: " + r);
    }

    // Determinismo

    @Test
    void resultIsDeterministicAcrossCalls() {
        stubAll();
        SensitivityService.Result r1 = service.analyze(
                "SCN-TEST", 2000, Objective.ENERGY_SAVING, allIds(), 5, 0.5, 1.5);
        SensitivityService.Result r2 = service.analyze(
                "SCN-TEST", 2000, Objective.ENERGY_SAVING, allIds(), 5, 0.5, 1.5);

        assertEquals(r1.grid().size(), r2.grid().size());
        for (int i = 0; i < r1.grid().size(); i++) {
            assertEquals(r1.grid().get(i).budgetCents(), r2.grid().get(i).budgetCents());
            assertEquals(r1.grid().get(i).selectedOptionsId(), r2.grid().get(i).selectedOptionsId());
            assertEquals(r1.grid().get(i).objectiveValue(), r2.grid().get(i).objectiveValue());
        }
        assertEquals(r1.alwaysSelected(), r2.alwaysSelected());
        assertEquals(r1.neverSelected(), r2.neverSelected());
        assertEquals(r1.swing(), r2.swing());
    }

    // Validazione dei parametri

    @Test
    void pointsBelowMinimumAreRejected() {
        stubAll();
        assertThrows(IllegalArgumentException.class, () -> service.analyze(
                "SCN-TEST", 2000, Objective.ENERGY_SAVING, allIds(), 2, 0.5, 1.5));
    }

    @Test
    void pointsAboveMaximumAreRejected() {
        stubAll();
        assertThrows(IllegalArgumentException.class, () -> service.analyze(
                "SCN-TEST", 2000, Objective.ENERGY_SAVING, allIds(), 100, 0.5, 1.5));
    }

    @Test
    void invertedFactorsAreRejected() {
        stubAll();
        assertThrows(IllegalArgumentException.class, () -> service.analyze(
                "SCN-TEST", 2000, Objective.ENERGY_SAVING, allIds(), 5, 1.5, 0.5));
    }

    @Test
    void zeroOrNegativeFactorsAreRejected() {
        stubAll();
        assertThrows(IllegalArgumentException.class, () -> service.analyze(
                "SCN-TEST", 2000, Objective.ENERGY_SAVING, allIds(), 5, 0.0, 1.5));
        assertThrows(IllegalArgumentException.class, () -> service.analyze(
                "SCN-TEST", 2000, Objective.ENERGY_SAVING, allIds(), 5, -0.5, 1.5));
    }

    @Test
    void negativeBaseBudgetIsRejected() {
        stubAll();
        assertThrows(IllegalArgumentException.class, () -> service.analyze(
                "SCN-TEST", -1, Objective.ENERGY_SAVING, allIds(), 5, 0.5, 1.5));
    }

    @Test
    void emptyCandidatesAreRejected() {
        stubAll();
        assertThrows(IllegalArgumentException.class, () -> service.analyze(
                "SCN-TEST", 2000, Objective.ENERGY_SAVING, Set.of(), 5, 0.5, 1.5));
    }

    @Test
    void missingCandidatesAreReported() {
        stubAll();
        Set<String> withGhost = Set.of("OPT-001", "OPT-999");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.analyze(
                "SCN-TEST", 2000, Objective.ENERGY_SAVING, withGhost, 5, 0.5, 1.5));
        assertTrue(ex.getMessage().contains("OPT-999"));
    }
}