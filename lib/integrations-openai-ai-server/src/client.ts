import OpenAI from "openai";

export function getOpenAI() {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) throw new Error("Replit OpenAI integration is not configured");
  return new OpenAI({ baseURL, apiKey });
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, property) {
    return Reflect.get(getOpenAI(), property);
  },
});