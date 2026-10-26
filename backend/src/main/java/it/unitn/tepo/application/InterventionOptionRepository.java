package it.unitn.tepo.application;

import it.unitn.tepo.domain.InterventionOption;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface InterventionOptionRepository extends JpaRepository<InterventionOption, String> {
    List<InterventionOption> findByBuildingId(String buildingId);
}