package it.unitn.tepo.ai.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

// Registra il client LLM solo col profilo "llm" attivo; senza, l'app resta avviabile.
@Configuration
@Profile("llm")
@EnableConfigurationProperties(AiProviderProperties.class)
public class AiConfiguration {

    @Bean
    @ConditionalOnMissingBean(LlmClient.class)
    public LlmClient llmClient(AiProviderProperties props, ObjectMapper objectMapper) {
        return new OpenAiCompatibleClient(props, objectMapper);
    }
}