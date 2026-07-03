// JKids quest verification worker (Cloudflare Worker).
//
// Flow: the student's "Выполнить" click files a claim here; the curator gets a
// Telegram message with Approve/Reject buttons; the app polls claim statuses
// and grants the reward only after approval.
//
// Endpoints:
//   GET  /                  -> health JSON
//   GET  /health            -> health JSON
//   POST /claim             -> file a claim (dedupes per user+quest+cycle)
//   GET  /claims?ids=a,b    -> statuses for up to 20 claim ids
//   POST /telegram/webhook  -> curator button presses (guarded by secret token)
//   GET  /setup             -> (re)register the webhook with Telegram
//
// Secrets (managed in GitHub Secrets, applied on every deploy):
//   TELEGRAM_BOT_TOKEN  - curator-notification bot token
//   CURATOR_CHAT_ID     - curator's Telegram user id
//
// KV binding: CLAIMS (namespace jkids-claims). Keys: claim:<id> -> JSON record.

const ALLOWED_ORIGINS = [
  "https://dagar165.github.io",
  "https://blender-buddy-app.pages.dev",
];

const CLAIM_TTL_SECONDS = 60 * 24 * 60 * 60; // keep records for 60 days
const MAX_STATUS_IDS = 20;

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

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Deterministic claim id: the same student re-claiming the same quest in the
// same cycle maps to the same record, so double-clicks and re-opens can't
// spam the curator or double-grant.
async function computeClaimId(body) {
  const raw = `${body.telegramUserId}:${body.questType}:${body.questId}:${body.cycleKey}`;
  return (await sha256Hex(raw)).slice(0, 16);
}

// The webhook secret is derived from the bot token, so no extra secret needs
// to be provisioned. Telegram echoes it back on every webhook call.
function webhookSecret(env) {
  return sha256Hex(`webhook:${env.TELEGRAM_BOT_TOKEN}`);
}

async function telegramApi(env, method, payload) {
  const res = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return res.json().catch(() => null);
}

function formatClaim(claim) {
  const questType = claim.questType === "weekly" ? "еженедельное" : "ежедневное";
  const handle = claim.telegramUsername ? ` (@${claim.telegramUsername})` : "";
  const student = `${claim.username || "Ученик"}${handle}`;
  const reward = `+${claim.xpReward} XP, +${claim.goldReward} монет`;

  return (
    `🔔 Новая заявка на проверку\n\n` +
    `Ученик: ${student}\n` +
    `ID: ${claim.telegramUserId}\n` +
    `Задание (${questType}): ${claim.questTitle || claim.questId}\n` +
    `Награда: ${reward}`
  );
}

async function handleClaim(request, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.CURATOR_CHAT_ID) {
    return json({ ok: false, error: "server_not_configured" }, request, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, request, 400);
  }

  if (!body?.questId || !body?.cycleKey || !body?.questType) {
    return json({ ok: false, error: "missing_fields" }, request, 400);
  }

  // The immutable Telegram id is the tally key; without it the claim can't be
  // tracked or paid out, so it is required.
  if (!body.telegramUserId) {
    return json({ ok: false, error: "no_telegram_user" }, request, 403);
  }

  const xpReward = Number(body.xpReward) || 0;
  const goldReward = Number(body.goldReward) || 0;
  const claimId = await computeClaimId(body);
  const kvKey = `claim:${claimId}`;

  const existing = await env.CLAIMS.get(kvKey, "json");
  if (existing && existing.status !== "rejected") {
    // Already filed (and possibly already approved) — don't re-notify.
    return json(
      { ok: true, claimId, status: existing.status, duplicate: true },
      request,
    );
  }

  const claim = {
    id: claimId,
    telegramUserId: body.telegramUserId,
    telegramUsername: body.telegramUsername || null,
    username: String(body.username || "").slice(0, 64),
    questId: String(body.questId).slice(0, 64),
    questTitle: String(body.questTitle || "").slice(0, 128),
    questType: body.questType === "weekly" ? "weekly" : "daily",
    cycleKey: String(body.cycleKey).slice(0, 32),
    xpReward,
    goldReward,
    status: "pending",
    createdAt: new Date().toISOString(),
    decidedAt: null,
  };

  const tgData = await telegramApi(env, "sendMessage", {
    chat_id: env.CURATOR_CHAT_ID,
    text: formatClaim(claim),
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Подтвердить", callback_data: `a:${claimId}` },
          { text: "❌ Отклонить", callback_data: `r:${claimId}` },
        ],
      ],
    },
  });

  if (!tgData?.ok) {
    return json(
      {
        ok: false,
        error: "telegram_failed",
        telegram: tgData?.description || "no_response",
      },
      request,
      502,
    );
  }

  await env.CLAIMS.put(kvKey, JSON.stringify(claim), {
    expirationTtl: CLAIM_TTL_SECONDS,
  });

  return json({ ok: true, claimId, status: "pending" }, request);
}

async function handleClaimStatuses(request, env, url) {
  const idsParam = url.searchParams.get("ids") || "";
  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^[0-9a-f]{16}$/.test(id))
    .slice(0, MAX_STATUS_IDS);

  if (ids.length === 0) {
    return json({ ok: false, error: "no_ids" }, request, 400);
  }

  const entries = await Promise.all(
    ids.map(async (id) => {
      const claim = await env.CLAIMS.get(`claim:${id}`, "json");
      return [id, claim?.status ?? "unknown"];
    }),
  );

  return json({ ok: true, statuses: Object.fromEntries(entries) }, request);
}

async function handleWebhook(request, env) {
  const secret = await webhookSecret(env);
  if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secret) {
    return new Response("Forbidden", { status: 403 });
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return new Response("OK"); // acknowledge malformed updates, nothing to do
  }

  const cb = update?.callback_query;
  if (!cb) return new Response("OK");

  const answer = (text) =>
    telegramApi(env, "answerCallbackQuery", {
      callback_query_id: cb.id,
      text,
    });

  if (String(cb.from?.id) !== String(env.CURATOR_CHAT_ID)) {
    await answer("Эта кнопка только для куратора");
    return new Response("OK");
  }

  const match = /^([ar]):([0-9a-f]{16})$/.exec(cb.data || "");
  if (!match) {
    await answer("Непонятная кнопка");
    return new Response("OK");
  }

  const [, action, claimId] = match;
  const kvKey = `claim:${claimId}`;
  const claim = await env.CLAIMS.get(kvKey, "json");

  if (!claim) {
    await answer("Заявка не найдена (истекла?)");
    return new Response("OK");
  }

  if (claim.status !== "pending") {
    await answer(
      claim.status === "approved" ? "Уже подтверждено" : "Уже отклонено",
    );
    return new Response("OK");
  }

  claim.status = action === "a" ? "approved" : "rejected";
  claim.decidedAt = new Date().toISOString();

  await env.CLAIMS.put(kvKey, JSON.stringify(claim), {
    expirationTtl: CLAIM_TTL_SECONDS,
  });

  const decisionLine =
    claim.status === "approved" ? "\n\n✅ Подтверждено" : "\n\n❌ Отклонено";

  if (cb.message) {
    await telegramApi(env, "editMessageText", {
      chat_id: cb.message.chat.id,
      message_id: cb.message.message_id,
      text: (cb.message.text || formatClaim(claim)) + decisionLine,
    });
  }

  await answer(claim.status === "approved" ? "Награда одобрена ✅" : "Отклонено ❌");
  return new Response("OK");
}

async function handleSetup(request, env, url) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return json({ ok: false, error: "server_not_configured" }, request, 503);
  }

  const result = await telegramApi(env, "setWebhook", {
    url: `${url.origin}/telegram/webhook`,
    secret_token: await webhookSecret(env),
    allowed_updates: ["callback_query"],
  });

  return json({ ok: Boolean(result?.ok), telegram: result?.description }, request);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "GET" && (pathname === "/" || pathname === "/health")) {
      return json(
        { ok: true, service: "jkids-quest-check", time: new Date().toISOString() },
        request,
      );
    }

    if (request.method === "POST" && pathname === "/claim") {
      return handleClaim(request, env);
    }

    if (request.method === "GET" && pathname === "/claims") {
      return handleClaimStatuses(request, env, url);
    }

    if (request.method === "POST" && pathname === "/telegram/webhook") {
      return handleWebhook(request, env);
    }

    if (request.method === "GET" && pathname === "/setup") {
      return handleSetup(request, env, url);
    }

    return new Response("Not found", { status: 404, headers: corsHeaders(request) });
  },
};
