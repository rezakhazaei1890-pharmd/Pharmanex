
const API_URL = "/api/ai/chat";

export async function sendAIMessage(message, options = {}) {
  if (!message || !message.trim()) {
    throw new Error("لطفاً پیام خود را وارد کنید.");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: message.trim(),
      preferredProvider: options.provider || "auto"
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || "ارتباط با دستیار هوشمند برقرار نشد."
    );
  }

  return data;
}
