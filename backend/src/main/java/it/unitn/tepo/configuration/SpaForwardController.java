package it.unitn.tepo.configuration;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Controller per il reindirizzamento (forward) delle rotte SPA (Single Page Application)
 * all'index.html servito da Spring Boot.
 *
 * Consente al router frontend (React Router) di gestire la navigazione lato client
 * anche in caso di ricaricamento diretto (F5) o accesso a URL profondi
 * (es. /map, /buildings, /interventions, /scenario, /result, /compare, /sensitivity, /import),
 * garantendo che le risorse statiche (/logo/**, /fonts/**, /assets/**, favicon.ico)
 * e gli endpoint backend (/api/**, /v3/api-docs/**, /swagger-ui/**) siano serviti direttamente.
 */
@Controller
public class SpaForwardController {

    @GetMapping(value = {
        "/map", "/map/**",
        "/mappa", "/mappa/**",
        "/buildings", "/buildings/**",
        "/edifici", "/edifici/**",
        "/interventions", "/interventions/**",
        "/interventi", "/interventi/**",
        "/scenario", "/scenario/**",
        "/result", "/result/**",
        "/risultato", "/risultato/**",
        "/compare", "/compare/**",
        "/confronto", "/confronto/**",
        "/sensitivity", "/sensitivity/**",
        "/sensibilita", "/sensibilita/**",
        "/import", "/import/**"
    })
    public String forwardSpa() {
        return "forward:/index.html";
    }
}
