# USD per 1M tokens (input, output). Free-tier providers cost 0.
PRICES: dict[str, tuple[float, float]] = {
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1": (2.00, 8.00),
    "gpt-4.1-nano": (0.10, 0.40),
    "gpt-4o-mini": (0.15, 0.60),
}

# Unknown OpenAI models are billed at gpt-4.1 rates so budget guards stay conservative.
FALLBACK_PAID = (2.00, 8.00)


def cost_usd(provider: str, model: str, prompt_tokens: int, completion_tokens: int) -> float:
    if provider != "openai":
        return 0.0
    pin, pout = PRICES.get(model, FALLBACK_PAID)
    return (prompt_tokens * pin + completion_tokens * pout) / 1_000_000
