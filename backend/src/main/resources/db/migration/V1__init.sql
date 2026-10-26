CREATE TABLE buildings (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    municipality VARCHAR(128),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    building_type VARCHAR(64),
    surface_m2 DOUBLE PRECISION,
    annual_energy_consumption_kwh DOUBLE PRECISION,
    annual_energy_cost_eur DOUBLE PRECISION,
    annual_co2_kg DOUBLE PRECISION,
    provenance VARCHAR(32) NOT NULL DEFAULT 'SYNTHETIC'
);

CREATE TABLE intervention_types (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(128),
    description VARCHAR(2000)
);

CREATE TABLE intervention_options (
    id VARCHAR(64) PRIMARY KEY,
    building_id VARCHAR(64) NOT NULL REFERENCES buildings(id),
    intervention_type_id VARCHAR(64) NOT NULL REFERENCES intervention_types(id),
    name VARCHAR(255) NOT NULL,
    description VARCHAR(2000),
    investment_cost_cents BIGINT NOT NULL,
    annual_energy_saving_scaled BIGINT NOT NULL,
    annual_economic_saving_cents BIGINT NOT NULL,
    annual_co2_reduction_scaled BIGINT NOT NULL,
    provenance VARCHAR(32) NOT NULL DEFAULT 'SYNTHETIC',
    source VARCHAR(255),
    revision INT NOT NULL DEFAULT 1
);

CREATE INDEX idx_options_building ON intervention_options(building_id);