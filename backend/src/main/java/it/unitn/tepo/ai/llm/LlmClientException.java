package it.unitn.tepo.ai.llm;

public class LlmClientException extends RuntimeException {

    public enum Kind {
        NOT_CONFIGURED,
        TIMEOUT,
        NETWORK,
        HTTP_ERROR,
        MALFORMED_RESPONSE
    }

    private final Kind kind;

    public LlmClientException(Kind kind, String message) {
        super(message);
        this.kind = kind;
    }

    public LlmClientException(Kind kind, String message, Throwable cause) {
        super(message, cause);
        this.kind = kind;
    }

    public Kind getKind() { return kind; }
}