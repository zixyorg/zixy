const BOT_USER_AGENTS = [
  "googlebot",
  "bingbot",
  "slurp",
  "duckduckbot",
  "baiduspider",
  "yandexbot",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "telegram",
  "discord",
  "crawler",
  "spider",
  "bot",
];

export function detectBot(userAgent: string): boolean {
  const lowercaseUA = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some((botPattern) => lowercaseUA.includes(botPattern));
}
