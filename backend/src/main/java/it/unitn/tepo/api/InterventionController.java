package it.unitn.tepo.api;

import it.unitn.tepo.application.InterventionOptionRepository;
import it.unitn.tepo.application.InterventionTypeRepository;
import it.unitn.tepo.domain.InterventionOption;
import it.unitn.tepo.domain.InterventionType;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class InterventionController {

    private final InterventionOptionRepository optionRepository;
    private final InterventionTypeRepository typeRepository;

    public InterventionController(InterventionOptionRepository optionRepository,
                                  InterventionTypeRepository typeRepository) {
        this.optionRepository = optionRepository;
        this.typeRepository = typeRepository;
    }

    @GetMapping("/interventions")
    public List<InterventionOption> list(@RequestParam(required = false) String buildingId) {
        if (buildingId != null) {
            return optionRepository.findByBuildingId(buildingId);
        }
        return optionRepository.findAll();
    }

    @GetMapping("/interventions/{id}")
    public InterventionOption get(@PathVariable String id) {
        return optionRepository.findById(id).orElseThrow();
    }

    @PostMapping("/interventions")
    public InterventionOption create(@RequestBody InterventionOption option) {
        return optionRepository.save(option);
    }

    @GetMapping("/intervention-types")
    public List<InterventionType> types() {
        return typeRepository.findAll();
    }
}