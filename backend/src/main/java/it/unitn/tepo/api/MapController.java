package it.unitn.tepo.api;

import it.unitn.tepo.application.BuildingRepository;
import it.unitn.tepo.domain.Building;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/map")
public class MapController {

    private final BuildingRepository buildingRepository;

    public MapController(BuildingRepository buildingRepository) {
        this.buildingRepository = buildingRepository;
    }

    @GetMapping("/buildings")
    public List<Building> mapBuildings() {
        return buildingRepository.findAll();
    }
}