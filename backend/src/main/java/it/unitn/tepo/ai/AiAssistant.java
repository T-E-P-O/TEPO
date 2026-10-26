package it.unitn.tepo.ai;

public interface AiAssistant {
    ScenarioProposal propose(String naturalLanguageRequest);
}