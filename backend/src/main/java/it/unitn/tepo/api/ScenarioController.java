package it.unitn.tepo.api;

import it.unitn.tepo.application.OptimizationService;
import it.unitn.tepo.domain.Objective;
import it.unitn.tepo.optimization.OptimizationResult;
import it.unitn.tepo.optimization.ScenarioConstraint;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/scenarios")
public class ScenarioController {

    private final OptimizationService optimizationService;

    public ScenarioController(OptimizationService optimizationService) {
        this.optimizationService = optimizationService;
    }

    @GetMapping("/ping")
    public Map<String, String> ping() {
        return Map.of("status", "ok");
    }

    @PostMapping("/{id}/optimize")
    public ResponseEntity<OptimizationResult> optimize(
            @PathVariable String id,
            @RequestBody OptimizeRequest request) {

        List<ScenarioConstraint> constraints = new ArrayList<>();
        if (request.incompatibilities() != null) {
            for (var pair : request.incompatibilities()) {
                if (pair.size() >= 2) {
                    constraints.add(new ScenarioConstraint.IncompatibilityConstraint(pair.get(0), pair.get(1)));
                }
            }
        }
        if (request.prerequisites() != null) {
            for (var pair : request.prerequisites()) {
                if (pair.size() >= 2) {
                    constraints.add(new ScenarioConstraint.PrerequisiteConstraint(pair.get(0), pair.get(1)));
                }
            }
        }
        if (request.maxNumber() != null && request.maxNumberOptionIds() != null
                && !request.maxNumberOptionIds().isEmpty()) {
            constraints.add(new ScenarioConstraint.MaxNumberConstraint(
                    request.maxNumber(), request.maxNumberOptionIds()));
        }

        OptimizationResult result = optimizationService.optimize(
                id,
                request.budgetCents(),
                request.objective(),
                constraints,
                new HashSet<>(request.candidateOptionIds())
        );
        return ResponseEntity.ok(result);
    }

    public record OptimizeRequest(
            long budgetCents,
            Objective objective,
            List<String> candidateOptionIds,
            List<List<String>> incompatibilities,
            List<List<String>> prerequisites,
            Integer maxNumber,
            List<String> maxNumberOptionIds
    ) {}
}