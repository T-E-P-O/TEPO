package it.unitn.tepo.api;

import it.unitn.tepo.application.SensitivityService;
import it.unitn.tepo.domain.Objective;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

// Analisi di sensibilità sul budget: nessuna persistenza, ogni chiamata è isolata.
@RestController
@RequestMapping("/api/sensitivity")
public class SensitivityController {

    private final SensitivityService sensitivityService;

    public SensitivityController(SensitivityService sensitivityService) {
        this.sensitivityService = sensitivityService;
    }

    @PostMapping("/{scenarioId}/budget")
    public ResponseEntity<SensitivityService.Result> budget(
            @PathVariable String scenarioId,
            @Valid @RequestBody Request request) {

        SensitivityService.Result r = sensitivityService.analyze(
                scenarioId,
                request.baseBudgetCents(),
                request.objective(),
                Set.copyOf(request.candidateOptionIds()),
                request.pointsOrDefault(),
                request.minFactorOrDefault(),
                request.maxFactorOrDefault()
        );
        return ResponseEntity.ok(r);
    }

    public record Request(
            @Min(value = 0, message = "baseBudgetCents non può essere negativo")
            long baseBudgetCents,

            @NotNull(message = "objective obbligatorio")
            Objective objective,

            @NotEmpty(message = "candidateOptionIds non può essere vuoto")
            List<String> candidateOptionIds,

            @Min(value = SensitivityService.POINTS_MIN, message = "points >= 3")
            @Max(value = SensitivityService.POINTS_MAX, message = "points <= 51")
            Integer points,

            Double minFactor,
            Double maxFactor
    ) {
        int pointsOrDefault()         { return points == null ? 11 : points; }
        double minFactorOrDefault()   { return minFactor == null ? 0.5 : minFactor; }
        double maxFactorOrDefault()   { return maxFactor == null ? 1.5 : maxFactor; }
    }
}