package it.unitn.tepo.configuration;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI tepoOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("TEPO — Trento Energy Portfolio Optimizer")
                        .description("API REST per il Decision Support System di selezione di portafogli energetici. "
                                + "Dataset demo sintetico. L'AI propone. L'utente confronta. Il Comune decide.")
                        .version("0.1.0")
                        .license(new License().name("Progetto accademico — Università di Trento")));
    }
}