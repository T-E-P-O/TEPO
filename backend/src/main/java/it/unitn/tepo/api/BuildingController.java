package it.unitn.tepo.api;

import it.unitn.tepo.application.BuildingRepository;
import it.unitn.tepo.domain.Building;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/buildings")
public class BuildingController {

    private final BuildingRepository repository;

    public BuildingController(BuildingRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<Building> list() {
        return repository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Building> get(@PathVariable String id) {
        return repository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Building create(@RequestBody Building building) {
        return repository.save(building);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Building> update(@PathVariable String id, @RequestBody Building building) {
        if (!repository.existsById(id)) return ResponseEntity.notFound().build();
        building.setId(id);
        return ResponseEntity.ok(repository.save(building));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        if (!repository.existsById(id)) return ResponseEntity.notFound().build();
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}