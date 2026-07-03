// JKids quest verification worker (Cloudflare Worker).
//
// Endpoints:
//   GET  /            -> health JSON
//   GET  /health      -> health JSON
//   POST /claim       -> student claims a quest; notifies the curator in Telegram
//
// Secrets (set in the Cloudflare dashboard, never in code):
//   TELEGRAM_BOT_TOKEN  - the bot token from BotFather
//   CURATOR_CHAT_ID     - the curator's Telegram chat id (where claims are sent)

const ALLOWED_ORIGINS = [
  "https://dagar165.github.io",
  "https://blender-buddy-app.pages.dev",
];

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, request, status = 200) {
  return Response.json(data, { status, headers: corsHeaders(request) });
}

async function sendTelegramMessage(env, text) {
  const res = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.CURATOR_CHAT_ID, text }),
    },
  );
  return res;
}

function formatClaim(body) {
  const questType = body.questType === "weekly" ? "еженедельное" : "ежедневное";
  const student = body.telegramUsername
    ? `${body.username || "Ученик"} (@${body.telegramUsername})`
    : body.username || "Ученик";
  const idLine = body.telegramUserId ? `\nID: ${body.telegramUserId}` : "";
  const reward = `+${body.xpReward ?? "?"} XP, +${body.goldReward ?? "?"} монет`;

  return (
    `🔔 Новая заявка на проверку\n\n` +
    `Ученик: ${student}${idLine}\n` +
    `Задание (${questType}): ${body.questTitle || body.questId}\n` +
    `Награда: ${reward}`
  );
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request) });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json(
        { ok: true, service: "jkids-quest-check", time: new Date().toISOString() },
        request,
      );
    }

    // Temporary diagnostic: reveals which chats have messaged this bot, so we
    // can confirm the correct CURATOR_CHAT_ID. Returns no token. Remove later.
    if (request.method === "GET" && url.pathname === "/debug/updates") {
      if (!env.TELEGRAM_BOT_TOKEN) {
        return json({ ok: false, error: "no_token" }, request, 503);
      }
      const meRes = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`,
      );
      const meData = await meRes.json().catch(() => null);
      const bot = meData?.ok
        ? { username: meData.result.username, name: meData.result.first_name }
        : { error: meData?.description || `http_${meRes.status}` };

      const res = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates`,
      );
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        return json(
          { ok: false, bot, telegram: data?.description || `http_${res.status}` },
          request,
          502,
        );
      }
      const chats = (data.result || []).map((u) => {
        const msg = u.message || u.edited_message || {};
        const chat = msg.chat || {};
        return {
          chat_id: chat.id,
          type: chat.type,
          name: chat.first_name || chat.title || null,
          username: chat.username || null,
          text: msg.text || null,
        };
      });
      return json({ ok: true, bot, configured_chat_id: env.CURATOR_CHAT_ID, chats }, request);
    }

    if (request.method === "POST" && url.pathname === "/claim") {
      if (!env.TELEGRAM_BOT_TOKEN || !env.CURATOR_CHAT_ID) {
        return json(
          { ok: false, error: "server_not_configured" },
          request,
          503,
        );
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "bad_json" }, request, 400);
      }

      if (!body || !body.questId) {
        return json({ ok: false, error: "missing_questId" }, request, 400);
      }

      const tgRes = await sendTelegramMessage(env, formatClaim(body));
      const tgData = await tgRes.json().catch(() => null);
      if (!tgRes.ok || !tgData?.ok) {
        return json(
          {
            ok: false,
            error: "telegram_failed",
            telegram: tgData?.description || `http_${tgRes.status}`,
          },
          request,
          502,
        );
      }

      return json({ ok: true }, request);
    }

    return new Response("Not found", { status: 404, headers: corsHeaders(request) });
  },
};
