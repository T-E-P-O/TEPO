package it.unitn.tepo.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "buildings")
public class Building {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    private String address;
    private String municipality;

    private double latitude;
    private double longitude;

    @Column(name = "building_type")
    private String buildingType;

    @Column(name = "surface_m2")
    private Double surfaceM2;

    @Column(name = "annual_energy_consumption_kwh")
    private Double annualEnergyConsumptionKwh;

    @Column(name = "annual_energy_cost_eur")
    private Double annualEnergyCostEur;

    @Column(name = "annual_co2_kg")
    private Double annualCo2Kg;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DataProvenance provenance = DataProvenance.SYNTHETIC;

    public Building() {}

    public Building(String id, String name, String address, String municipality,
                    double latitude, double longitude, String buildingType,
                    Double surfaceM2, Double annualEnergyConsumptionKwh,
                    Double annualEnergyCostEur, Double annualCo2Kg,
                    DataProvenance provenance) {
        this.id = id;
        this.name = name;
        this.address = address;
        this.municipality = municipality;
        this.latitude = latitude;
        this.longitude = longitude;
        this.buildingType = buildingType;
        this.surfaceM2 = surfaceM2;
        this.annualEnergyConsumptionKwh = annualEnergyConsumptionKwh;
        this.annualEnergyCostEur = annualEnergyCostEur;
        this.annualCo2Kg = annualCo2Kg;
        this.provenance = provenance;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getMunicipality() { return municipality; }
    public void setMunicipality(String municipality) { this.municipality = municipality; }
    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }
    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }
    public String getBuildingType() { return buildingType; }
    public void setBuildingType(String buildingType) { this.buildingType = buildingType; }
    public Double getSurfaceM2() { return surfaceM2; }
    public void setSurfaceM2(Double surfaceM2) { this.surfaceM2 = surfaceM2; }
    public Double getAnnualEnergyConsumptionKwh() { return annualEnergyConsumptionKwh; }
    public void setAnnualEnergyConsumptionKwh(Double v) { this.annualEnergyConsumptionKwh = v; }
    public Double getAnnualEnergyCostEur() { return annualEnergyCostEur; }
    public void setAnnualEnergyCostEur(Double v) { this.annualEnergyCostEur = v; }
    public Double getAnnualCo2Kg() { return annualCo2Kg; }
    public void setAnnualCo2Kg(Double v) { this.annualCo2Kg = v; }
    public DataProvenance getProvenance() { return provenance; }
    public void setProvenance(DataProvenance p) { this.provenance = p; }
}