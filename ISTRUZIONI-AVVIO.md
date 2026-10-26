# TEPO — Istruzioni per l'avvio

## 1. Prerequisiti

**Il metodo primario è Docker Compose.** Funziona su qualsiasi sistema
operativo con Docker installato: Windows x86_64, Windows ARM64, Linux
x86_64/ARM64, macOS Intel/Apple Silicon.

| Software | Versione | Link |
|---|---|---|
| Docker Desktop | qualsiasi recente | https://www.docker.com/products/docker-desktop |

Verifica:

```bash
docker --version
docker compose version
```

**Sviluppo nativo (hot-reload) richiede in più**:

| Software | Versione | Link |
|---|---|---|
| JDK | 21 (Temurin raccomandato) | https://adoptium.net/temurin/releases/?version=21 |
| Maven | 3.9 o superiore | https://maven.apache.org/download.cgi |
| Node.js | 24 (LTS) | https://nodejs.org/ |

**Nota per utenti Windows ARM64**: Maven nativo + OR-Tools CP-SAT non
funzionano su `win32-aarch64` (OR-Tools non distribuisce binari nativi per
quell'architettura). Usa Docker Compose per l'avvio completo, e gli script
in `scripts/` per eseguire i test backend.

---

## 2. Avvio con Docker Compose (consigliato, portabile)

Da `tepobozza/`:

```bash
docker compose up --build
```

Atteso (dopo ~30-40 s dalla prima esecuzione):
- `tepo-db` → `healthy`
- `tepo-backend` → `healthy`
- `tepo-frontend` → `healthy`

Apri `http://localhost:5173`.

Per fermare: `docker compose down` (mantiene il DB).
Per fermare e cancellare il DB: `docker compose down -v`.

---

## 3. Avvio nativo (hot-reload, per sviluppo frontend)

Richiede JDK 21, Maven 3.9, Node 24, e PostgreSQL (o solo il container `db`).

### Terminale 1 — Database

```powershell
cd C:\Users\tuonome\progetti\tepobozza
docker compose up -d db
docker compose ps   # atteso: tepo-db healthy
```

### Terminale 2 — Backend

**Windows PowerShell**:

```powershell
cd C:\Users\tuonome\progetti\tepobozza\backend
$env:JAVA_HOME   = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
$env:Path        = "$env:JAVA_HOME\bin;$env:Path"
$env:DB_URL      = "jdbc:postgresql://localhost:5432/tepo"
$env:DB_USERNAME = "tepo"
$env:DB_PASSWORD = "tepo"
mvn spring-boot:run "-Dspring-boot.run.profiles=demo"
```

**Linux / macOS**:

```bash
cd /home/tuonome/progetti/tepobozza/backend
export JAVA_HOME=/usr/lib/jvm/temurin-21-jdk
export PATH="$JAVA_HOME/bin:$PATH"
export DB_URL=jdbc:postgresql://localhost:5432/tepo
export DB_USERNAME=tepo
export DB_PASSWORD=tepo
mvn spring-boot:run -Dspring-boot.run.profiles=demo
```

Atteso: `Started TepoApplication in X.XXX seconds`.

### Terminale 3 — Frontend

```powershell
cd C:\Users\tuonome\progetti\tepobozza\frontend
npm install
npm run dev
```

Atteso: `Local: http://localhost:5173/`.

---

## 4. Esecuzione test

### Backend (universale, via Docker)

```powershell
# Windows PowerShell
.\scripts\test-backend.ps1
```

```bash
# Linux / macOS
./scripts/test-backend.sh
```

Atteso: **119 test verdi** in `maven:3.9-eclipse-temurin-21`.

### Frontend (nativo)

```powershell
cd C:\Users\tuonome\progetti\tepobozza\frontend
npm test -- --run
npm run build
```

Atteso: **69 test verdi**, build Vite pulita.

---

## 5. Cosa trovi nel progetto

```
tepobozza/
├── backend/                Backend Spring Boot + solver OR-Tools
├── frontend/               Frontend React + Leaflet
├── docs/                   Documentazione tecnica
├── scripts/                Script di supporto (test via Docker)
├── docker-compose.yaml     Configurazione Docker (percorso primario)
├── README.md               Panoramica del progetto
└── ISTRUZIONI-AVVIO.md     Questo file
```

### Documentazione chiave

| File | Contenuto |
|---|---|
| `README.md` | Panoramica generale, stack, architettura |
| `docs/requirements.md` | Requisiti funzionali e non funzionali |
| `docs/architecture.md` | Architettura a layer |
| `docs/domain-model.md` | Entità del dominio |
| `docs/optimization.md` | Modello matematico, tie-break, reason code |
| `docs/api.md` | Endpoint REST |
| `docs/ai-integration.md` | Provider LLM, configurazione, HITL |
| `docs/testing.md` | Strategia di test |
| `docs/traceability.md` | Matrice requisiti → componente → test |
| `docs/collaudo.md` | Protocollo di collaudo eseguito |
| `docs/demo.md` | Script per la presentazione |
| `docs/audit-report.md` | Audit tecnico |
| `docs/uml/` | Diagrammi PlantUML |

---

## 6. Interfacce utili

| URL | Cosa |
|---|---|
| `http://localhost:5173` | Applicazione TEPO |
| `http://localhost:8080/swagger-ui.html` | Documentazione API interattiva |
| `http://localhost:8080/api/buildings` | Esempio risposta JSON |

---

## 7. Dataset demo

Il dataset è **sintetico** (100 edifici, 300 interventi). **Non sono dati reali del Comune di Trento.** Ogni valore è marcato `SYNTHETIC` in interfaccia, con badge "DEMO — dati sintetici" sempre visibile.

Il dataset viene caricato automaticamente la prima volta che avvii il backend con profilo `demo`. Ai riavvii successivi non viene duplicato.

### Ipotesi sintetiche dichiarate

- Due vettori energetici:
  - Elettricità (LED, FV): 0.25 EUR/kWh, **0.10 kg CO2/kWh** (ipotesi non calibrata, vedi docs/audit-report.md);
  - Gas metano (involucro, impianti): 0.10 EUR/kWh, 0.20 kg CO2/kWh.
- Scala: 1:1 per energia (kWh), CO2 (kg), importi (cent).
- Payback: 5–25 anni per la maggior parte degli interventi.

Vedi `docs/domain-model.md` per i dettagli.
