package it.unitn.tepo.application;

import it.unitn.tepo.domain.OptimizationRun;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OptimizationRunRepository extends JpaRepository<OptimizationRun, String> {
    List<OptimizationRun> findByScenarioIdOrderByCreatedAtDesc(String scenarioId);
}