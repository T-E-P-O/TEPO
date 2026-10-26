package it.unitn.tepo.application;

import it.unitn.tepo.domain.InterventionType;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterventionTypeRepository extends JpaRepository<InterventionType, String> {
}