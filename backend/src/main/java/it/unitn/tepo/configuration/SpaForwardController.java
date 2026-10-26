package it.unitn.tepo.configuration;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Controller per il reindirizzamento (forward) delle rotte SPA (Single Page Application)
 * all'index.html servito da Spring Boot.
 *
 * Consente al router frontend (React Router) di gestire la navigazione lato client
 * anche in caso di ricaricamento diretto (F5) o accesso a URL profondi
 * (es. /scenario, /edifici, /mappa, /confronto, /sensibilita, /import).
 */
@Controller
public class SpaForwardController {

    @GetMapping(value = {
        "/{path:^(?!api|swagger-ui|v3|actuator|assets|favicon\\.ico)[^\\.]*}",
        "/{path:^(?!api|swagger-ui|v3|actuator|assets)[^\\.]*}/**"
    })
    public String forwardSpa() {
        return "forward:/index.html";
    }
}
