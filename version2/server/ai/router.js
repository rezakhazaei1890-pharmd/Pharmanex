
const providers = {
  provider_a: {
    baseUrl: process.env.PROVIDER_A_BASE_URL,
    apiKey: process.env.PROVIDER_A_API_KEY,
    model: process.env.PROVIDER_A_MODEL
  },
  provider_b: {
    baseUrl: process.env.PROVIDER_B_BASE_URL,
    apiKey: process.env.PROVIDER_B_API_KEY,
    model: process.env.PROVIDER_B_MODEL
  }
};

export async function routeAIRequest(message, preferredProvider = "auto") {
  const providerNames =
    preferredProvider === "auto"
      ? ["provider_a", "provider_b"]
      : [preferredProvider];

  for (const name of providerNames) {
    const provider = providers[name];

    if (!provider?.baseUrl || !provider?.apiKey || !provider?.model) {
      continue;
    }

    try {
      const response = await fetch(
        `${provider.baseUrl.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${provider.apiKey}`
          },
          body: JSON.stringify({
            model: provider.model,
            messages: [
              {
                role: "system",
                content: "You are PHARMANEX, a professional pharmaceutical industry assistant. Provide accurate, evidence-aware answers."
              },
              {
                role: "user",
                content: message
              }
            ]
          }),
          signal: AbortSignal.timeout(60000)
        }
      );

      if (!response.ok) {
        continue;
      }

      const data = await response.json();

      return {
        provider: name,
        model: provider.model,
        answer: data.choices?.[0]?.message?.content || ""
      };
    } catch (error) {
      continue;
    }
  }

  throw new Error("No AI provider is currently available.");
}
