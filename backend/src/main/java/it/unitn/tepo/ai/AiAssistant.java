package it.unitn.tepo.ai;

import it.unitn.tepo.domain.Objective;

import java.util.List;

public interface AiAssistant {
    ScenarioProposal propose(String naturalLanguageRequest);
}