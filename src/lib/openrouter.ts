// The one upstream the wish generator talks to.
//
// DeepSeek's own API is no longer called directly. Every call goes through OpenRouter, held to the
// DeepSeek first-party host. The model slug moves from DeepSeek's short name (`deepseek-chat`, a
// moving pointer) to a versioned OpenRouter slug; the pin below is what keeps the host fixed.
//
// `allow_fallbacks: false` with the `order` list means exactly these hosts can serve a call, in
// this order: DeepSeek first-party, then inference.net, morph and wafer. Without the pin OpenRouter
// load-balances across every host serving the model, which silently re-routes onto a cold prompt
// cache and unknown pricing. A listed-fallbacks failure is the better failure — the caller already
// falls back to a generic wish.
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** OpenRouter model ids are slugs (`<vendor>/<model>`), not DeepSeek's short names. */
export const DEFAULT_LLM_MODEL = "deepseek/deepseek-v4.1-flash";

/** Attribution only. OpenRouter keys an app off the `HTTP-Referer` header, which this bot does not
 *  send, so the title is inert until one is added. */
export const OPENROUTER_TITLE = "discord-birthday-bot";

/** V4.1 Flash reasons by default, and the thinking spends the same `max_tokens` budget as the
 *  answer: left on, the reply arrives with `content: null` and a `length` finish reason. */
export const OPENROUTER_REASONING = { enabled: false };

/** The route, sent on every call whatever the model: provider slugs are tried in `order` and
 *  nothing outside the list can serve. `OPENROUTER_MODEL` can therefore only name a slug one of
 *  these hosts serves — anything else fails loudly on every call rather than quietly re-routing. */
export const OPENROUTER_PROVIDER_ROUTING = {
  order: ["deepseek", "inference-net", "morph", "wafer"],
  allow_fallbacks: false,
};
