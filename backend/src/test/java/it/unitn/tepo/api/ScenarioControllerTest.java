package it.unitn.tepo.api;

import it.unitn.tepo.application.OptimizationService;
import it.unitn.tepo.domain.Objective;
import it.unitn.tepo.optimization.OptimizationResult;
import it.unitn.tepo.optimization.SolverStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ScenarioController.class)
class ScenarioControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OptimizationService service;

    @Test
    void pingWorks() throws Exception {
        mockMvc.perform(get("/api/scenarios/ping"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void optimizeReturnsResult() throws Exception {
        OptimizationResult fake = new OptimizationResult(
                "run-1", "hash", List.of("OPT-001"), List.of("OPT-002"),
                100L, 0L, 500L, 500L, 500L, 500L,
                SolverStatus.OPTIMAL, true, true, List.of()
        );
        when(service.optimize(eq("SCN"), any(Long.class), any(Objective.class), any(), any()))
                .thenReturn(fake);

        String body = """
                {
                  "budgetCents": 1000000,
                  "objective": "ENERGY_SAVING",
                  "candidateOptionIds": ["OPT-001", "OPT-002"],
                  "incompatibilities": [],
                  "prerequisites": [],
                  "maxNumber": null,
                  "maxNumberOptionIds": []
                }
                """;

        mockMvc.perform(post("/api/scenarios/SCN/optimize")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runId").value("run-1"))
                .andExpect(jsonPath("$.solverStatus").value("OPTIMAL"));
    }
}