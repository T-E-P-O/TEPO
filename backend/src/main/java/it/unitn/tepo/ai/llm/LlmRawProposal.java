package it.unitn.tepo.ai.llm;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

// Mappatura 1:1 del JSON del provider; la validazione avviene in LlmResponseParser.
@JsonIgnoreProperties(ignoreUnknown = true)
public record LlmRawProposal(
        @JsonProperty("budgetCents") Long budgetCents,
        @JsonProperty("objective") String objective,
        @JsonProperty("maxNumber") Integer maxNumber,
        @JsonProperty("excludedOptionIds") List<String> excludedOptionIds,
        @JsonProperty("missingInformation") List<String> missingInformation,
        @JsonProperty("warnings") List<String> warnings,
        @JsonProperty("reasoning") String reasoning
) {}