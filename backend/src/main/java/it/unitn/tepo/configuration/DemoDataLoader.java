package it.unitn.tepo.configuration;

import it.unitn.tepo.application.BuildingRepository;
import it.unitn.tepo.application.InterventionOptionRepository;
import it.unitn.tepo.application.InterventionTypeRepository;
import it.unitn.tepo.domain.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Dataset DEMO sintetico: 100 edifici e 300 interventi fittizi, generati in modo deterministico. */
@Component
@Profile("demo")
public class DemoDataLoader implements CommandLineRunner {

    // Vettore elettrico (grid Trentino idro-dominante): 0.25 EUR/kWh, 0.10 kg CO2/kWh.
    private static final double TARIFF_ELECTRICITY_EUR_PER_KWH = 0.25;
    private static final double CO2_ELECTRICITY_KG_PER_KWH     = 0.10;
    // Vettore gas metano: 0.10 EUR/kWh, 0.20 kg CO2/kWh (più economico ma più sporco).
    private static final double TARIFF_GAS_EUR_PER_KWH         = 0.10;
    private static final double CO2_GAS_KG_PER_KWH             = 0.20;

    // Nuovi edifici: tipologia, prefisso del nome, nome breve usato negli interventi.
    private static final String[][] BUILDING_PLAN = {
            {"Scuola", "Scuola", "scuola"},
            {"Ufficio", "Ufficio", "ufficio"},
            {"Sport", "Palestra", "palestra"},
            {"Cultura", "Biblioteca", "biblioteca"},
            {"Magazzino", "Magazzino", "magazzino"},
            {"Civico", "Centro civico", "centro"},
            {"Biblioteca", "Biblioteca", "biblioteca"},
            {"Centro sociale", "Centro sociale", "centro sociale"}
    };

    // Vie sintetiche del territorio di Trento, usate a rotazione.
    private static final String[] STREETS = {
            "Via Mazzini", "Via Garibaldi", "Corso Buonarroti", "Via Grazioli",
            "Via Sanseverino", "Via Vittorio Veneto", "Via Cavour", "Via Galilei",
            "Via delle Laste", "Viale Verona", "Via Solteri", "Via Brescia",
            "Via del Brennero", "Via di San Martino", "Piazza Venezia", "Via degli Alpini",
            "Via Paludi", "Via Maso Dona'", "Via Soprasasso", "Via Stella"
    };

    // Tipi alternati per gli edifici nuovi: LED resta il primo intervento, gli altri ruotano.
    private static final String[] OTHER_TYPES = {
            "TYPE-WINDOWS", "TYPE-PV", "TYPE-HEATPUMP", "TYPE-INSULATION", "TYPE-BOILER"
    };

    private final BuildingRepository buildingRepo;
    private final InterventionTypeRepository typeRepo;
    private final InterventionOptionRepository optionRepo;

    public DemoDataLoader(BuildingRepository b, InterventionTypeRepository t, InterventionOptionRepository o) {
        this.buildingRepo = b;
        this.typeRepo = t;
        this.optionRepo = o;
    }

    @Override
    public void run(String... args) {
        if (buildingRepo.count() > 0) return;

        // Edifici BLD-001..BLD-010: tabella invariata, la demo documentata dipende da questi valori.
        String[][] buildings = {
                {"BLD-001", "Scuola demo 1", "Via Verdi 10, Trento", "46.0704", "11.1212", "Scuola", "2400"},
                {"BLD-002", "Scuola demo 2", "Via S. Croce 15, Trento", "46.0661", "11.1234", "Scuola", "3100"},
                {"BLD-003", "Ufficio demo 3", "Piazza Duomo 1, Trento", "46.0676", "11.1214", "Ufficio", "1800"},
                {"BLD-004", "Palestra demo 4", "Via Rosmini 5, Trento", "46.0640", "11.1220", "Sport", "2600"},
                {"BLD-005", "Biblioteca demo 5", "Via Roma 30, Trento", "46.0690", "11.1188", "Cultura", "2200"},
                {"BLD-006", "Ufficio demo 6", "Via Belenzani 20, Trento", "46.0683", "11.1206", "Ufficio", "1500"},
                {"BLD-007", "Scuola demo 7", "Via Madruzzo 8, Trento", "46.0652", "11.1257", "Scuola", "2800"},
                {"BLD-008", "Magazzino demo 8", "Via Brennero 100, Trento", "46.0775", "11.1305", "Magazzino", "1200"},
                {"BLD-009", "Ufficio demo 9", "Via Manci 12, Trento", "46.0697", "11.1191", "Ufficio", "1700"},
                {"BLD-010", "Centro civico demo 10", "Via Alfieri 3, Trento", "46.0710", "11.1175", "Civico", "2000"}
        };

        for (String[] b : buildings) {
            Building building = new Building(
                    b[0], b[1], b[2], "Trento",
                    Double.parseDouble(b[3]), Double.parseDouble(b[4]),
                    b[5], Double.parseDouble(b[6]),
                    null, null, null,
                    DataProvenance.SYNTHETIC
            );
            buildingRepo.save(building);
        }

        // Tipologie di intervento: 6, invariate.
        typeRepo.save(new InterventionType("TYPE-LED", "Illuminazione LED", "Illuminazione", "Sostituzione corpi illuminanti"));
        typeRepo.save(new InterventionType("TYPE-WINDOWS", "Serramenti", "Involucro", "Sostituzione serramenti"));
        typeRepo.save(new InterventionType("TYPE-INSULATION", "Isolamento", "Involucro", "Isolamento termico"));
        typeRepo.save(new InterventionType("TYPE-HEATPUMP", "Pompa di calore", "Impianto", "Sostituzione caldaia con PdC"));
        typeRepo.save(new InterventionType("TYPE-PV", "Fotovoltaico", "Produzione", "Installazione FV"));
        typeRepo.save(new InterventionType("TYPE-BOILER", "Caldaia", "Impianto", "Sostituzione caldaia"));

        // Interventi OPT-001..OPT-026: valori invariati, usati dai valori attesi di docs/demo.md.

        // ---- Elettricità (LED, FV) ----

        createOption("OPT-001", "BLD-001", "TYPE-LED", "LED scuola 1",         6_000_000L, 37_500L);
        createOption("OPT-003", "BLD-002", "TYPE-LED", "LED scuola 2",         7_500_000L, 45_000L);
        createOption("OPT-005", "BLD-003", "TYPE-LED", "LED ufficio 3",        4_000_000L, 24_000L);
        createOption("OPT-008", "BLD-004", "TYPE-LED", "LED palestra 4",       8_000_000L, 48_000L);
        createOption("OPT-009", "BLD-005", "TYPE-LED", "LED biblioteca 5",     6_500_000L, 39_000L);
        createOption("OPT-011", "BLD-006", "TYPE-LED", "LED ufficio 6",        3_500_000L, 21_000L);
        createOption("OPT-012", "BLD-006", "TYPE-PV",  "FV ufficio 6",         5_000_000L, 30_000L);
        createOption("OPT-013", "BLD-007", "TYPE-LED", "LED scuola 7",         8_000_000L, 48_000L);
        createOption("OPT-015", "BLD-008", "TYPE-LED", "LED magazzino 8",      3_000_000L, 18_000L);
        createOption("OPT-017", "BLD-009", "TYPE-LED", "LED ufficio 9",        4_500_000L, 27_000L);
        createOption("OPT-019", "BLD-010", "TYPE-LED", "LED centro 10",        5_500_000L, 33_000L);
        createOption("OPT-020", "BLD-010", "TYPE-PV",  "FV centro 10",         4_500_000L, 24_000L);
        createOption("OPT-021", "BLD-001", "TYPE-PV",  "FV scuola 1",          5_500_000L, 30_000L);
        createOption("OPT-022", "BLD-002", "TYPE-LED", "LED extra scuola 2",   2_000_000L,  9_000L);
        createOption("OPT-023", "BLD-003", "TYPE-PV",  "FV ufficio 3",         4_000_000L, 24_000L);
        createOption("OPT-026", "BLD-009", "TYPE-PV",  "FV ufficio 9",         3_800_000L, 21_000L);

        // ---- Gas metano (serramenti, isolamento, PdC, caldaia) ----

        createOption("OPT-002", "BLD-001", "TYPE-WINDOWS",   "Serramenti scuola 1",    4_500_000L,  9_000L);
        createOption("OPT-004", "BLD-002", "TYPE-HEATPUMP",  "PdC scuola 2",          30_000_000L, 60_000L);
        createOption("OPT-006", "BLD-003", "TYPE-WINDOWS",   "Serramenti ufficio 3",   4_500_000L, 18_000L);
        createOption("OPT-007", "BLD-004", "TYPE-INSULATION","Cappotto palestra 4",   12_000_000L, 60_000L);
        createOption("OPT-010", "BLD-005", "TYPE-WINDOWS",   "Serramenti biblioteca 5",4_200_000L, 15_000L);
        createOption("OPT-014", "BLD-007", "TYPE-HEATPUMP",  "PdC scuola 7",           9_500_000L, 30_000L);
        createOption("OPT-016", "BLD-008", "TYPE-INSULATION","Cappotto magazzino 8",   6_000_000L, 24_000L);
        createOption("OPT-018", "BLD-009", "TYPE-BOILER",    "Caldaia ufficio 9",      3_500_000L, 15_000L);
        createOption("OPT-024", "BLD-005", "TYPE-HEATPUMP",  "PdC biblioteca 5",       8_500_000L, 30_000L);
        createOption("OPT-025", "BLD-007", "TYPE-WINDOWS",   "Serramenti scuola 7",    4_000_000L, 12_000L);

        loadNewBuildings();
        loadNewOptions();
    }

    // Edifici BLD-011..BLD-100: coordinate, superfici e tipologie da pattern deterministico.
    private void loadNewBuildings() {
        for (int k = 0; k < 90; k++) {
            int number = 11 + k;
            String[] plan = BUILDING_PLAN[k % BUILDING_PLAN.length];
            Building building = new Building(
                    String.format("BLD-%03d", number),
                    plan[1] + " demo " + number,
                    STREETS[k % STREETS.length] + " " + (1 + (k * 7) % 120) + ", Trento",
                    "Trento",
                    46.050 + ((k * 37) % 40) / 1000.0,
                    11.090 + ((k * 53) % 60) / 1000.0,
                    plan[0],
                    (double) surfaceM2(k),
                    null, null, null,
                    DataProvenance.SYNTHETIC
            );
            buildingRepo.save(building);
        }
    }

    // Interventi OPT-027..OPT-300: 2-4 per edificio, payback target 6-18 anni.
    private void loadNewOptions() {
        int nextId = 27;
        for (int k = 0; k < 90; k++) {
            int number = 11 + k;
            String[] plan = BUILDING_PLAN[k % BUILDING_PLAN.length];
            int surface = surfaceM2(k);
            // Il pattern k%3 con quattro edifici a +1 chiude esattamente a 274 interventi.
            int count = 2 + (k % 3) + ((k % 3 == 0 && k < 12) ? 1 : 0);

            for (int slot = 0; slot < count; slot++) {
                String typeId = slot == 0
                        ? "TYPE-LED"
                        : OTHER_TYPES[(k + slot - 1) % OTHER_TYPES.length];
                long energyKwh = (long) surface * energyIntensity(typeId, k);
                createOption(
                        String.format("OPT-%03d", nextId++),
                        String.format("BLD-%03d", number),
                        typeId,
                        typeLabel(typeId) + " " + plan[2] + " " + number,
                        paybackCostCents(typeId, k, energyKwh),
                        energyKwh
                );
            }
        }
    }

    // Superficie 800-4000 m2, a passi di 100.
    private static int surfaceM2(int k) {
        return 800 + 100 * ((k * 37) % 33);
    }

    // Risparmio annuo in kWh/m2 per tipo, nella stessa scala dei 26 interventi storici.
    private static int energyIntensity(String typeId, int k) {
        return switch (typeId) {
            case "TYPE-LED" -> 12 + (k * 3) % 7;
            case "TYPE-PV" -> 10 + (k * 5) % 6;
            case "TYPE-WINDOWS" -> 8 + (k * 7) % 5;
            case "TYPE-INSULATION" -> 20 + (k * 11) % 7;
            case "TYPE-HEATPUMP" -> 12 + (k * 13) % 9;
            default -> 10 + (k * 17) % 5;
        };
    }

    // Costo derivato dal payback target (6-18 anni) e dal risparmio economico annuo.
    private static long paybackCostCents(String typeId, int k, long energyKwh) {
        int paybackYears = switch (typeId) {
            case "TYPE-LED" -> 6 + k % 3;
            case "TYPE-PV" -> 7 + k % 5;
            case "TYPE-WINDOWS" -> 10 + k % 7;
            case "TYPE-INSULATION" -> 12 + k % 7;
            case "TYPE-HEATPUMP" -> 8 + k % 7;
            default -> 6 + k % 5;
        };
        double tariff = isElectric(typeId) ? TARIFF_ELECTRICITY_EUR_PER_KWH : TARIFF_GAS_EUR_PER_KWH;
        long annualCents = Math.round(energyKwh * tariff * 100.0);
        // Arrotondo a 100 EUR per avere costi leggibili.
        return Math.round(annualCents * (double) paybackYears / 10_000.0) * 10_000L;
    }

    // Etichetta breve del tipo, coerente con i nomi degli interventi storici.
    private static String typeLabel(String typeId) {
        return switch (typeId) {
            case "TYPE-LED" -> "LED";
            case "TYPE-WINDOWS" -> "Serramenti";
            case "TYPE-INSULATION" -> "Cappotto";
            case "TYPE-HEATPUMP" -> "PdC";
            case "TYPE-PV" -> "FV";
            default -> "Caldaia";
        };
    }

    // Deriva economic e CO2 dal vettore del tipo, come da costanti in testa alla classe.
    private void createOption(String id, String buildingId, String typeId,
                              String name, long costCents, long energyKwh) {
        double tariff = isElectric(typeId) ? TARIFF_ELECTRICITY_EUR_PER_KWH : TARIFF_GAS_EUR_PER_KWH;
        double co2F   = isElectric(typeId) ? CO2_ELECTRICITY_KG_PER_KWH     : CO2_GAS_KG_PER_KWH;

        long economicCents = Math.round(energyKwh * tariff * 100.0);
        long co2Kg         = Math.round(energyKwh * co2F);

        InterventionOption o = new InterventionOption();
        o.setId(id);
        o.setBuildingId(buildingId);
        o.setInterventionTypeId(typeId);
        o.setName(name);
        o.setDescription(
                "Intervento demo sintetico. Vettore energetico: "
                        + (isElectric(typeId) ? "elettricità (tariffa 0.25 EUR/kWh, 0.10 kg CO2/kWh)"
                                              : "gas metano (tariffa 0.10 EUR/kWh, 0.20 kg CO2/kWh)")
        );
        o.setInvestmentCostCents(costCents);
        o.setAnnualEnergySavingScaled(energyKwh);
        o.setAnnualEconomicSavingCents(economicCents);
        o.setAnnualCo2ReductionScaled(co2Kg);
        o.setProvenance(DataProvenance.SYNTHETIC);
        o.setSource("DEMO");
        o.setRevision(1);
        optionRepo.save(o);
    }

    /** Elettricità (grid Trentino idro-dominante) vs gas metano. */
    private static boolean isElectric(String typeId) {
        return "TYPE-LED".equals(typeId) || "TYPE-PV".equals(typeId);
    }
}
