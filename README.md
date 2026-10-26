# TEPO — Trento Energy Portfolio Optimizer

[![CI](https://github.com/T-E-P-O/TEPO/actions/workflows/ci.yml/badge.svg)](https://github.com/T-E-P-O/TEPO/actions)
[![Render](https://img.shields.io/badge/Render-Live%20Demo-46E3B7?logo=render&logoColor=white)](https://tepo.onrender.com)

Decision Support System per la selezione ottima di portafogli di interventi di efficientamento energetico sul patrimonio edilizio del Comune di Trento.

- **Principio architetturale:** *L'AI propone. L'utente confronta. Il Comune decide.*
- **Dataset:** DEMO — dati sintetici (100 edifici, 300 interventi, 6 tipologie). Nessun dato reale del Comune di Trento è incluso.
- **Live Demo Cloud:** [https://tepo.onrender.com](https://tepo.onrender.com)
- **Repository Deliverable D1:** [https://github.com/T-E-P-O/D1](https://github.com/T-E-P-O/D1)
- **Deploy Blueprint:** Specificato in `render.yaml` per deployment automatico su [onrender.com](https://onrender.com).

---

## Cos'è TEPO

TEPO aiuta l'Amministrazione e gli uffici tecnici del Comune di Trento a rispondere a una domanda decisionale complessa:

> *Dato un insieme di interventi energetici già individuati dai servizi tecnici, un budget limitato e una serie di vincoli tecnici e di policy, quale combinazione di interventi massimizza l'obiettivo scelto (risparmio energetico, economico o riduzione di CO₂) e perché?*

TEPO **non** progetta interventi, **non** stima costi o benefici, **non** assume decisioni amministrative in autonomia. TEPO organizza i candidati, valida gli scenari, applica i vincoli, ottimizza, confronta e spiega determinisiticamente ogni scelta. La responsabilità decisionale resta in capo alla persona e all'Amministrazione.

Progetto accademico sviluppato per il corso di **Ingegneria del Software** dell'**Università degli Studi di Trento** (A.A. 2026/2027) nell'ambito dell'iniziativa *"100 progetti per il Comune di Trento"*.

**Team di sviluppo:**
- Mirco Negri
- Gabriele Duca
- Riccardo Scheda

---

## Funzionalità Principali

- **Catalogo Edifici e Interventi:** Gestione di edifici comunali e interventi con indicazione permanente della provenienza del dato (*Sintetico/Demo*).
- **Cartografia Interattiva:** Mappa geografica di Trento basata su Leaflet con tematizzazione, geolocalizzazione degli edifici e stato di selezione visivo proporzionale all'investimento.
- **Scenario Builder:** Configurazione guidata del budget, obiettivo prioritario (energia, euro, CO₂) e vincoli di esclusione o prerequisito.
- **Ottimizzazione Esatta con OR-Tools CP-SAT:** Risoluzione certificata del problema di Knapsack/MILP binario con tie-break lessicografico canonico a 4 passi (massimizzazione obiettivo $\to$ minimizzazione costo $\to$ massimizzazione numero interventi $\to$ identificativo deterministico).
- **Motore di Spiegazione Deterministico:** Reason code chiari e verificabili per ogni intervento incluso o escluso (barriere locali di budget, incompatibilità o saturazione vincoli).
- **Confronto Scenari What-If (Slot A / B):** Analisi comparativa affiancata con calcolo automatico dei delta ($B - A$) su spesa, risparmio kWh, risparmio economico ed emissioni evitate.
- **Analisi di Sensibilità sul Budget:** Sweep deterministico su griglia configurabile (da 3 a 51 punti) per classificare gli interventi in *stabili* (sempre selezionati / mai selezionati) o *oscillanti*.
- **Importazione Dati da CSV:** Procedura guidata in tre passi (Contenuto, Validazione atomica a secco, Import) con parsing robusto di separatori, codifiche e quote.
- **Assistente AI con Fallback Deterministico:** Modulo opzionale human-in-the-loop per tradurre richieste in linguaggio naturale in parametri di scenario. L'AI non scrive mai sul database e non applica modifiche senza conferma esplicita dell'utente.

---

## Architettura e Stack Tecnologico

L'architettura di TEPO è stata selezionata per soddisfare i rigorosi requisiti di correttezza matematica, integrità referenziale e trasparenza imposti dalla Pubblica Amministrazione:

| Livello | Tecnologia | Motivazione Tecnica |
|---|---|---|
| **Backend** | Java 21, Spring Boot 3.3.4 | Robustezza enterprise, gestione avanzata dei thread e runtime nativo per il solver. |
| **Ottimizzatore** | Google OR-Tools CP-SAT 9.11 | Risoluzione esatta Knapsack/MILP binario con vincoli logici booleani (`OnlyEnforceIf`). Assente in Node.js. |
| **Database** | PostgreSQL 16 | Vincoli di integrità referenziale (`FOREIGN KEY`, incompatibilità, prerequisiti) e transazionalità ACID. |
| **Migrazioni** | Flyway | Evoluzione deterministica e versionata dello schema relazionale (`V1__init.sql`, `V2__optimization_runs.sql`). |
| **Frontend** | React 18, TypeScript, Vite | UI reattiva, tipizzazione statica completa a tempo di compilazione senza errori di runtime. |
| **Design System** | Strumento Civico (CSS puro) | Doppio registro visivo (*Relazione* carta / *Sala operativa* grafite), conforme alle linee guida WCAG 2.1 AA. |
| **Mappe** | Leaflet + OpenStreetMap / CartoDB | Rendering cartografico georeferenziato ad alte prestazioni e supporto temi chiaro/scuro. |
| **API Docs** | springdoc-openapi (Swagger UI) | Documentazione interattiva OpenAPI v3 accessibile direttamente a runtime. |
| **Infrastruttura** | Docker Compose, Render Blueprint | Containerizzazione multi-stage per collaudo locale e deploy su cloud PaaS. |

---

## Struttura della Repository

```
TEPO/
├── backend/
│   ├── src/main/java/it/unitn/tepo/
│   │   ├── ai/                 # Assistente AI (interfacce, rule-based, client LLM)
│   │   ├── api/                # Controller REST, DTO e gestione eccezioni
│   │   ├── application/        # Servizi applicativi e repository JPA
│   │   ├── configuration/      # DataLoader demo e configurazione OpenAPI
│   │   ├── domain/             # Entita del modello relazionale e invarianti
│   │   └── optimization/       # Solver CP-SAT, hasher canonico, spiegazioni
│   ├── src/main/resources/
│   │   ├── application.yaml    # Configurazione Spring Boot e porta dinamica
│   │   └── db/migration/       # Script migrazione Flyway (V1, V2)
│   ├── src/test/java/          # Suite di test backend (119 test automatici verdi)
│   ├── Dockerfile              # Immagine multi-stage backend (Maven + JRE 21)
│   └── pom.xml
├── frontend/
│   ├── src/pages/              # 9 viste applicative (Dashboard, Mappa, Edifici, Interventi,
│   │                           # Scenario, Risultato, Confronto, Sensibilita, Import)
│   ├── src/components/         # Shell applicativa, componenti UI, grafici SVG
│   ├── src/services/           # Client API REST tipizzato e store di sessione
│   ├── src/styles/             # Token design system Strumento Civico e stili di vista
│   ├── src/test/               # Suite di test frontend Vitest (69 test automatici verdi)
│   ├── Dockerfile              # Immagine multi-stage frontend (Node.js + Nginx)
│   ├── nginx.conf              # Reverse proxy Nginx per routing e proxy API
│   └── package.json
├── scripts/
│   ├── test-backend.ps1        # Script esecuzione test backend via Docker (Windows)
│   └── test-backend.sh         # Script esecuzione test backend via Docker (Linux/macOS)
├── icon/                       # Loghi vettoriali e icone dell'applicazione
├── docker-compose.yaml         # Orchestrazione locale (db + backend + frontend)
├── render.yaml                 # Blueprint Infrastructure-as-Code per Render
├── .env.example                # Modello variabili d'ambiente
├── ISTRUZIONI-AVVIO.md         # Manuale operativo di avvio e collaudo
└── README.md
```

---

## Guida all'Avvio

### 1. Avvio rapido con Docker Compose (consigliato per qualsiasi OS)
Non richiede Java o Node.js installati sull'host, solo **Docker Desktop**:

```bash
docker compose up --build
```

All'avvio:
- Database PostgreSQL attivo sulla porta `5432`;
- Backend Spring Boot attivo e inizializzato su [http://localhost:8080](http://localhost:8080);
- Frontend React accessibile su [http://localhost:5173](http://localhost:5173);
- Documentazione interattiva API Swagger UI: [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html).

### 2. Sviluppo in locale (Hot-Reload)
Richiede **JDK 21**, **Maven 3.9+**, **Node.js 20+** e un'istanza PostgreSQL attiva:

```bash
# Avvio del solo database PostgreSQL
docker compose up -d tepo-db

# Backend (in un terminale)
cd backend
mvn spring-boot:run

# Frontend (in un altro terminale)
cd frontend
npm install
npm run dev
```

### 3. Deploy su Render (onrender.com)
L'applicazione è distribuita e attiva in ambiente demo su Render all'indirizzo:

> 🌐 **[https://tepo.onrender.com](https://tepo.onrender.com)**

Il repository include il file di specifica `render.yaml` conforme ai Blueprint Infrastructure-as-Code di Render per orchestrare:
1. Istanza **PostgreSQL gestita** con credenziali sicure e persistenza;
2. Servizio web **Backend Docker** con binding dinamico della porta `${PORT:8080}`;
3. Servizio web **Frontend Docker** con reverse proxy Nginx integrato e routing SPA.

---

## Verifica e Test

Il progetto è corredato da una copertura completa di test automatici che certificano la correttezza di ogni strato applicativo:

- **Backend (119 test):** Unit test del solver CP-SAT, test del tie-break deterministico, test delle barriere di spiegazione, test di validazione importazione CSV e test transazionali con database in-memory H2.
  ```bash
  cd backend && mvn test
  # Su Windows ARM64 (Snapdragon): .\scripts\test-backend.ps1
  ```
- **Frontend (69 test):** Test di integrazione delle viste, componenti del design system, gestione della sessione A/B e formattazione con Vitest e React Testing Library.
  ```bash
  cd frontend && npm test
  ```

---

## Deliverables e Documentazione Formale

Tutta la documentazione di progetto, i diagrammi UML, le analisi dei requisiti e le specifiche formali sono raccolti nei repository dedicati ai Deliverable:
- **Deliverable D1 (Specifica dei Requisiti e Architettura):** [https://github.com/T-E-P-O/D1](https://github.com/T-E-P-O/D1)
- **Deliverables D2, D3, D4:** Verranno pubblicati nelle rispettive repository dell'organizzazione [T-E-P-O](https://github.com/T-E-P-O).

---

## Licenza e Diritti

Progetto accademico sviluppato per l'Università degli Studi di Trento.
Tutti i diritti sono riservati ai membri del team di sviluppo.
