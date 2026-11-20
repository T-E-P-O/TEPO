package it.unitn.tepo.api;

import it.unitn.tepo.application.OptimizationRunRepository;
import it.unitn.tepo.domain.OptimizationRun;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/runs")
public class AuditController {

    private final OptimizationRunRepository repo;

    public AuditController(OptimizationRunRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public List<OptimizationRun> list() {
        return repo.findAll();
    }

    @GetMapping("/{id}")
    public OptimizationRun get(@PathVariable String id) {
        return repo.findById(id).orElseThrow();
    }

    @GetMapping("/scenario/{scenarioId}")
    public List<OptimizationRun> byScenario(@PathVariable String scenarioId) {
        return repo.findByScenarioIdOrderByCreatedAtDesc(scenarioId);
    }
}