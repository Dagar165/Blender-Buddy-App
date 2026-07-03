// JKids quest verification worker (Cloudflare Worker).
// Session 1 scope: health check only — proves the deploy pipeline works.
// Quest claim endpoints arrive in the next session.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://dagar165.github.io",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json(
        { ok: true, service: "jkids-quest-check", time: new Date().toISOString() },
        { headers: CORS_HEADERS },
      );
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
};
