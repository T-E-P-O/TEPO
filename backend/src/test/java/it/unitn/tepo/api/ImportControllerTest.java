package it.unitn.tepo.api;

import it.unitn.tepo.application.BuildingRepository;
import it.unitn.tepo.application.InterventionOptionRepository;
import it.unitn.tepo.domain.Building;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

// Test del percorso import: righe valide, errori di validazione, scarti e intestazioni mancanti.
class ImportControllerTest {

    private BuildingRepository buildingRepo;
    private InterventionOptionRepository optionRepo;
    private ImportController controller;

    @BeforeEach
    void setUp() {
        buildingRepo = mock(BuildingRepository.class);
        optionRepo = mock(InterventionOptionRepository.class);
        controller = new ImportController(buildingRepo, optionRepo);
        when(buildingRepo.existsById(anyString())).thenReturn(false);
    }

    // Funzioni di supporto

    private static String csv(String... dataRows) {
        String header = "id,name,address,municipality,latitude,longitude,buildingType,surfaceM2";
        StringBuilder sb = new StringBuilder(header).append('\n');
        for (String row : dataRows) sb.append(row).append('\n');
        return sb.toString();
    }

    private ImportController.ImportPreview validate(String content) {
        ResponseEntity<ImportController.ImportPreview> r =
                controller.validateBuildings(new ImportController.CsvPayload(content));
        assertEquals(200, r.getStatusCode().value());
        return r.getBody();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> commit(String content) {
        ResponseEntity<Map<String, Object>> r =
                controller.commitBuildings(new ImportController.CsvPayload(content));
        assertEquals(200, r.getStatusCode().value());
        return r.getBody();
    }

    // Test

    @Test
    void validRowIsValidatedAndCommitted() {
        String content = csv("BLD-101,Scuola,Via Roma 5,Trento,46.06,11.12,Scuola,2200");

        ImportController.ImportPreview preview = validate(content);
        assertEquals(1, preview.valid());
        assertEquals(0, preview.invalid());

        Map<String, Object> result = commit(content);
        assertEquals(1, result.get("inserted"));
        assertEquals(0, result.get("skipped"));

        ArgumentCaptor<Building> captor = ArgumentCaptor.forClass(Building.class);
        verify(buildingRepo, times(1)).save(captor.capture());
        Building saved = captor.getValue();
        assertEquals("BLD-101", saved.getId());
        assertEquals(2200.0, saved.getSurfaceM2(), 0.001);
    }

    @Test
    void nonNumericSurfaceIsRejectedNotSilentlyZeroed() {
        String content = csv("BLD-101,Scuola,Via Roma 5,Trento,46.06,11.12,Scuola,abc");

        ImportController.ImportPreview preview = validate(content);
        assertEquals(0, preview.valid());
        assertEquals(1, preview.invalid());
        assertTrue(preview.rows().get(0).errors().stream()
                .anyMatch(e -> e.contains("Superficie")));

        Map<String, Object> result = commit(content);
        assertEquals(0, result.get("inserted"));
        assertEquals(1, result.get("skipped"));

        // Nessuna scrittura
        verify(buildingRepo, never()).save(any());
    }

    @Test
    void zeroOrNegativeSurfaceIsRejected() {
        String content = csv(
                "BLD-101,A,Via B,Trento,46.06,11.12,Scuola,0",
                "BLD-102,B,Via C,Trento,46.06,11.12,Scuola,-100");

        ImportController.ImportPreview preview = validate(content);
        assertEquals(0, preview.valid());
        assertEquals(2, preview.invalid());
        for (ImportController.ImportRow r : preview.rows()) {
            assertTrue(r.errors().stream().anyMatch(e -> e.contains("> 0")),
                    "Atteso errore 'Superficie deve essere > 0' per riga " + r.rowNumber());
        }
    }

    @Test
    void emptyMunicipalityIsRejected() {
        String content = csv("BLD-101,Scuola,Via Roma 5,,46.06,11.12,Scuola,2200");

        ImportController.ImportPreview preview = validate(content);
        assertEquals(0, preview.valid());
        assertTrue(preview.rows().get(0).errors().stream()
                .anyMatch(e -> e.contains("Comune")));
    }

    @Test
    void emptyBuildingTypeIsRejected() {
        String content = csv("BLD-101,Scuola,Via Roma 5,Trento,46.06,11.12,,2200");

        ImportController.ImportPreview preview = validate(content);
        assertEquals(0, preview.valid());
        assertTrue(preview.rows().get(0).errors().stream()
                .anyMatch(e -> e.contains("Tipo edificio")));
    }

    @Test
    void existingIdIsRejected() {
        when(buildingRepo.existsById("BLD-101")).thenReturn(true);
        String content = csv("BLD-101,Scuola,Via Roma 5,Trento,46.06,11.12,Scuola,2200");

        ImportController.ImportPreview preview = validate(content);
        assertEquals(0, preview.valid());
        assertTrue(preview.rows().get(0).errors().stream()
                .anyMatch(e -> e.contains("già esistente")));

        Map<String, Object> result = commit(content);
        assertEquals(0, result.get("inserted"));
        assertEquals(1, result.get("skipped"));
        verify(buildingRepo, never()).save(any());
    }

    @Test
    void missingHeadersReturns400() {
        String content = "id,name\nBLD-101,Scuola\n";
        ResponseEntity<ImportController.ImportPreview> r =
                controller.validateBuildings(new ImportController.CsvPayload(content));
        assertEquals(400, r.getStatusCode().value());
    }

    @Test
    void emptyContentReturns400() {
        ResponseEntity<ImportController.ImportPreview> r =
                controller.validateBuildings(new ImportController.CsvPayload(""));
        assertEquals(400, r.getStatusCode().value());
    }

    @Test
    void partialCommitWritesOnlyValidRows() {
        String content = csv(
                "BLD-101,Scuola,Via Roma 5,Trento,46.06,11.12,Scuola,2200",
                "BLD-102,Broken,Via X,Trento,46.06,11.12,Scuola,notanumber",
                "BLD-103,Ufficio,Via Y,Trento,46.06,11.12,Ufficio,1500");

        ImportController.ImportPreview preview = validate(content);
        assertEquals(2, preview.valid());
        assertEquals(1, preview.invalid());

        Map<String, Object> result = commit(content);
        assertEquals(2, result.get("inserted"));
        assertEquals(1, result.get("skipped"));
        verify(buildingRepo, times(2)).save(any());
    }

    @Test
    void skipDetailsAreReturnedOnCommit() {
        String content = csv(
                "BLD-101,Scuola,Via Roma 5,Trento,46.06,11.12,Scuola,2200",
                "BLD-102,Broken,Via X,Trento,46.06,11.12,Scuola,notanumber");

        Map<String, Object> result = commit(content);
        assertTrue(result.containsKey("skippedDetails"));
        Object details = result.get("skippedDetails");
        assertInstanceOf(List.class, details);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> list = (List<Map<String, Object>>) details;
        assertEquals(1, list.size());
        assertEquals("BLD-102", list.get(0).get("id"));
    }
}