package it.unitn.tepo.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "intervention_options")
public class InterventionOption {

    @Id
    private String id;

    @Column(name = "building_id", nullable = false)
    private String buildingId;

    @Column(name = "intervention_type_id", nullable = false)
    private String interventionTypeId;

    @Column(nullable = false)
    private String name;

    @Column(length = 2000)
    private String description;

    @Column(name = "investment_cost_cents", nullable = false)
    private long investmentCostCents;

    @Column(name = "annual_energy_saving_scaled", nullable = false)
    private long annualEnergySavingScaled;

    @Column(name = "annual_economic_saving_cents", nullable = false)
    private long annualEconomicSavingCents;

    @Column(name = "annual_co2_reduction_scaled", nullable = false)
    private long annualCo2ReductionScaled;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DataProvenance provenance = DataProvenance.SYNTHETIC;

    private String source;

    private int revision = 1;

    public InterventionOption() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getBuildingId() { return buildingId; }
    public void setBuildingId(String buildingId) { this.buildingId = buildingId; }
    public String getInterventionTypeId() { return interventionTypeId; }
    public void setInterventionTypeId(String v) { this.interventionTypeId = v; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public long getInvestmentCostCents() { return investmentCostCents; }
    public void setInvestmentCostCents(long v) { this.investmentCostCents = v; }
    public long getAnnualEnergySavingScaled() { return annualEnergySavingScaled; }
    public void setAnnualEnergySavingScaled(long v) { this.annualEnergySavingScaled = v; }
    public long getAnnualEconomicSavingCents() { return annualEconomicSavingCents; }
    public void setAnnualEconomicSavingCents(long v) { this.annualEconomicSavingCents = v; }
    public long getAnnualCo2ReductionScaled() { return annualCo2ReductionScaled; }
    public void setAnnualCo2ReductionScaled(long v) { this.annualCo2ReductionScaled = v; }
    public DataProvenance getProvenance() { return provenance; }
    public void setProvenance(DataProvenance p) { this.provenance = p; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public int getRevision() { return revision; }
    public void setRevision(int revision) { this.revision = revision; }
}