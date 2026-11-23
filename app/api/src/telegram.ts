export function telegram(env: NodeJS.ProcessEnv, request = fetch) {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chat = env.TELEGRAM_CHAT_ID?.trim();
  const configured = Boolean(
    token && /^\d+:[\w-]+$/.test(token) && chat && /^-?\d+$/.test(chat),
  );
  const enabled = env.TELEGRAM_ENABLED === "true";
  return {
    status: {
      configured,
      enabled,
      ...(!enabled || !configured
        ? { reason: "Telegram belum dikonfigurasi atau dinonaktifkan." }
        : {}),
    },
    async send(text: string) {
      const response = await request(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chat, text }),
          signal: AbortSignal.timeout(8000),
          redirect: "error",
        },
      );
      if (!response.ok || (await response.json()).ok !== true)
        throw new Error("Telegram rejected the message");
    },
  };
}
