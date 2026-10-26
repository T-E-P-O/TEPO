package it.unitn.tepo.api;

import it.unitn.tepo.application.BuildingRepository;
import it.unitn.tepo.application.InterventionOptionRepository;
import it.unitn.tepo.domain.Building;
import it.unitn.tepo.domain.DataProvenance;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.StringReader;
import java.util.*;

// Import CSV edifici: nessun valore malformato viene convertito; gli scarti non vengono scritti.
@RestController
@RequestMapping("/api/imports")
public class ImportController {

    private static final Set<String> REQUIRED_HEADERS = Set.of(
            "id", "name", "address", "municipality",
            "latitude", "longitude", "buildingType", "surfaceM2"
    );

    private final BuildingRepository buildingRepo;
    private final InterventionOptionRepository optionRepo;

    public ImportController(BuildingRepository b, InterventionOptionRepository o) {
        this.buildingRepo = b;
        this.optionRepo = o;
    }

    @PostMapping("/buildings/validate")
    public ResponseEntity<ImportPreview> validateBuildings(@RequestBody CsvPayload payload) {
        List<ImportRow> rows = new ArrayList<>();
        int valid = 0, invalid = 0;

        CSVParser parser;
        try {
            parser = parseCsv(payload.content());
        } catch (IOException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new ImportPreview(0, 0, List.of(
                    new ImportRow(0, "", List.of("CSV non valido: " + ex.getMessage()))
            )));
        }

        if (!parser.getHeaderNames().containsAll(REQUIRED_HEADERS)) {
            Set<String> missing = new HashSet<>(REQUIRED_HEADERS);
            missing.removeAll(parser.getHeaderNames());
            return ResponseEntity.badRequest().body(new ImportPreview(0, 0, List.of(
                    new ImportRow(0, "", List.of("Header mancanti: " + missing))
            )));
        }

        for (CSVRecord record : parser) {
            List<String> errors = validateBuildingRecord(record);
            String id = safeGet(record, "id");
            if (errors.isEmpty()) valid++; else invalid++;
            rows.add(new ImportRow((int) record.getRecordNumber(), id, errors));
        }

        return ResponseEntity.ok(new ImportPreview(valid, invalid, rows));
    }

    @PostMapping("/buildings/commit")
    public ResponseEntity<Map<String, Object>> commitBuildings(@RequestBody CsvPayload payload) {
        int inserted = 0, skipped = 0;
        List<Map<String, Object>> skippedDetails = new ArrayList<>();

        CSVParser parser;
        try {
            parser = parseCsv(payload.content());
        } catch (IOException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "CSV non valido: " + ex.getMessage(),
                    "inserted", 0,
                    "skipped", 0
            ));
        }

        if (!parser.getHeaderNames().containsAll(REQUIRED_HEADERS)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Header mancanti",
                    "inserted", 0,
                    "skipped", 0
            ));
        }

        for (CSVRecord record : parser) {
            List<String> errors = validateBuildingRecord(record);
            if (!errors.isEmpty()) {
                skipped++;
                skippedDetails.add(Map.of(
                        "row", record.getRecordNumber(),
                        "id", safeGet(record, "id"),
                        "errors", errors
                ));
                continue;
            }

            String id = safeGet(record, "id");
            // L'assenza dell'ID è già verificata; il doppio check difende da corse concorrenti.
            if (buildingRepo.existsById(id)) {
                skipped++;
                skippedDetails.add(Map.of(
                        "row", record.getRecordNumber(),
                        "id", id,
                        "errors", List.of("ID già esistente")
                ));
                continue;
            }

            Building b = new Building(
                    id,
                    safeGet(record, "name"),
                    safeGet(record, "address"),
                    safeGet(record, "municipality"),
                    requireDouble(record, "latitude"),
                    requireDouble(record, "longitude"),
                    safeGet(record, "buildingType"),
                    requireDouble(record, "surfaceM2"),
                    null, null, null,
                    DataProvenance.SYNTHETIC
            );
            buildingRepo.save(b);
            inserted++;
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("inserted", inserted);
        body.put("skipped", skipped);
        if (!skippedDetails.isEmpty()) {
            body.put("skippedDetails", skippedDetails);
        }
        return ResponseEntity.ok(body);
    }

    // Funzioni di supporto

    private CSVParser parseCsv(String content) throws IOException {
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("Contenuto CSV mancante o vuoto");
        }
        String cleaned = content.startsWith("\uFEFF") ? content.substring(1) : content;
        cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n");

        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreEmptyLines(true)
                .setTrim(true)
                .setIgnoreSurroundingSpaces(true)
                .build();

        return CSVParser.parse(new StringReader(cleaned), format);
    }

    private List<String> validateBuildingRecord(CSVRecord record) {
        List<String> errors = new ArrayList<>();

        String id = safeGet(record, "id");
        if (id.isEmpty()) {
            errors.add("ID mancante");
        } else if (buildingRepo.existsById(id)) {
            errors.add("ID già esistente nel catalogo");
        }

        if (safeGet(record, "name").isEmpty())        errors.add("Nome mancante");
        if (safeGet(record, "address").isEmpty())     errors.add("Indirizzo mancante");
        if (safeGet(record, "municipality").isEmpty())errors.add("Comune mancante");
        if (safeGet(record, "buildingType").isEmpty())errors.add("Tipo edificio mancante");

        if (tryParseDouble(safeGet(record, "latitude")) == null)
            errors.add("Latitudine non valida");
        if (tryParseDouble(safeGet(record, "longitude")) == null)
            errors.add("Longitudine non valida");

        Double surface = tryParseDouble(safeGet(record, "surfaceM2"));
        if (surface == null) {
            errors.add("Superficie non valida");
        } else if (surface <= 0.0) {
            errors.add("Superficie deve essere > 0");
        }

        return errors;
    }

    private String safeGet(CSVRecord record, String column) {
        try {
            String v = record.get(column);
            return v == null ? "" : v.trim();
        } catch (Exception e) {
            return "";
        }
    }

    // Estrae un double obbligatorio: guard difensivo, il chiamante ha già validato la riga.
    private double requireDouble(CSVRecord record, String column) {
        Double v = tryParseDouble(safeGet(record, column));
        if (v == null) {
            throw new IllegalArgumentException(
                    "Campo '" + column + "' non valido alla riga " + record.getRecordNumber());
        }
        return v;
    }

    // Tenta il parsing; restituisce null se il valore è assente o malformato.
    private Double tryParseDouble(String s) {
        if (s == null || s.isEmpty()) return null;
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException e) {
            try {
                return Double.parseDouble(s.replace(',', '.'));
            } catch (NumberFormatException e2) {
                return null;
            }
        }
    }

    public record CsvPayload(String content) {}
    public record ImportRow(int rowNumber, String id, List<String> errors) {}
    public record ImportPreview(int valid, int invalid, List<ImportRow> rows) {}
}