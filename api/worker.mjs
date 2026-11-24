const levels = ["N5", "N4", "N3", "N2", "N1"];
const tabs = ["vocab", "grammar", "reading", "wrong"];
const modes = ["all", "new", "wrong"];
const count = (value, max = 1_000_000_000) =>
  Number.isSafeInteger(value) && value >= 0 && value <= max;

function validState(state) {
  return state &&
    count(state.solved) && count(state.correct, state.solved) &&
    count(state.today, state.solved) && /^\d{4}-\d{2}-\d{2}$/.test(state.day) &&
    Array.isArray(state.wrong) && state.wrong.length <= 2000 &&
    state.wrong.every(id => typeof id === "string" && /^N[1-5]:(vocab|grammar|reading):\d{1,4}$/.test(id)) &&
    levels.includes(state.level) && tabs.includes(state.tab) && modes.includes(state.mode) &&
    count(state.idx, 2000) &&
    (state.selected === -1 || count(state.selected, 4)) &&
    typeof state.checked === "boolean" && (!state.checked || state.selected >= 0);
}

const json = (value, status = 200) => Response.json(value, {
  status, headers: { "Cache-Control": "no-store" },
});

async function progress(request, env, url) {
  const provided = url.searchParams.get("username") || "";
  const username = provided.trim().normalize("NFC");
  if (!/^[\p{L}\p{N}_. -]{1,32}$/u.test(username)) {
    return json({ error: "유저명은 한글, 영문, 숫자 등을 사용해 1~32자로 입력해 주세요." }, 400);
  }

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT state_json, revision FROM study_progress WHERE username = ?"
    ).bind(username).first();
    return json(row ? { state: JSON.parse(row.state_json), revision: row.revision } : { state: null, revision: 0 });
  }

  if (request.method !== "PUT") return json({ error: "지원하지 않는 요청입니다." }, 405);
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ error: "같은 페이지에서 다시 저장해 주세요." }, 403);
  }

  const body = await request.text();
  if (body.length > 70_000) return json({ error: "학습 기록이 너무 큽니다." }, 413);
  let input;
  try {
    input = JSON.parse(body);
  } catch {
    return json({ error: "학습 기록 형식을 확인해 주세요." }, 400);
  }
  if (!count(input?.revision) || !validState(input.state)) {
    return json({ error: "학습 기록 형식을 확인해 주세요." }, 400);
  }

  const { revision, state } = input;
  const stateJson = JSON.stringify(state);
  const result = revision === 0
    ? await env.DB.prepare(
      "INSERT INTO study_progress (username, state_json) VALUES (?, ?) ON CONFLICT DO NOTHING"
    ).bind(username, stateJson).run()
    : await env.DB.prepare(
      "UPDATE study_progress SET state_json = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP " +
      "WHERE username = ? AND revision = ?"
    ).bind(stateJson, username, revision).run();

  if (result.meta.changes) return json({ revision: revision + 1 });

  return json({ error: "다른 화면에서 기록이 갱신됐어요. 유저명을 다시 불러온 뒤 이어서 풀어 주세요." }, 409);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/progress") return new Response("Not found", { status: 404 });
    const origin = request.headers.get("Origin");
    if (!origin || origin !== env.PAGE_ORIGIN) return new Response("Forbidden", { status: 403 });

    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    let response;
    try {
      response = await progress(request, env, url);
    } catch (error) {
      console.error("Unable to access study progress", error);
      response = json({ error: "학습 기록에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." }, 503);
    }
    for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
    return response;
  },
};
