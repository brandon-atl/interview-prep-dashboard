// Vercel Serverless Function: Lightweight Gemini proxy
// Reads text and task, returns structured JSON for panelists/star/culture.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  try {
    const { task, text, model } = await readJson(req);
    if (!task || !text) {
      return res.status(400).json({ ok: false, error: 'Missing task or text' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || 'AIzaSyCphrGQrL-SDbcVkMn2NnvlQ1Fgnz4s4p8';
    const mdl = model || 'gemini-1.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent?key=${apiKey}`;

    const { prompt, responseSchema } = buildPrompt(task, text);
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }]}],
      generationConfig: {
        temperature: 0.2,
        response_mime_type: 'application/json',
      }
    };

    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const errTxt = await r.text().catch(()=> '');
      return res.status(502).json({ ok: false, error: 'Gemini error', detail: errTxt });
    }
    const data = await r.json();
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let parsed;
    try { parsed = JSON.parse(txt); } catch { parsed = null; }
    if (!parsed) {
      return res.status(200).json({ ok: true, data: [] });
    }
    // Basic schema sanity filter per task
    const cleaned = postProcess(task, parsed);
    return res.status(200).json({ ok: true, data: cleaned });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'Server error' });
  }
}

function buildPrompt(task, text) {
  const common = `Rules:\n- Use ONLY the provided text.\n- Do NOT invent or guess missing fields.\n- Return JSON that strictly matches the schema.\n`;
  if (task === 'panelists') {
    const schema = `[
      {"name":"string","role":"string","linkedin":"string|optional"}
    ]`;
    const prompt = `${common}
Task: Extract interview panelists. Look for an Interviewing With / panelists section or bullet lists.
Constraints:
- name: 2–3 tokens, Title Case; not ALLCAPS tokens like product names.
- role: concise job title.
- linkedin: include only if visible in text.
If none found, return [].
Schema: ${schema}
Text:\n${text}`;
    return { prompt, responseSchema: schema };
  }
  if (task === 'star') {
    const schema = `[
      {"title":"string","situation":"string","task":"string","action":"string","result":"string","metric":"string|optional"}
    ]`;
    const prompt = `${common}
Task: Extract STAR stories from the text.
Constraints:
- Only include items with a Result plus at least one of Situation/Task/Action.
- Keep fields concise (1-3 sentences each). Do not invent metrics.
Schema: ${schema}
Text:\n${text}`;
    return { prompt, responseSchema: schema };
  }
  if (task === 'culture') {
    const schema = `{"workMode":"string|optional","officeDays":"string|optional","values":["string"],"signals":["string"],"benefits":["string"]}`;
    const prompt = `${common}
Task: Summarize cultural/work style signals.
Fields:
- workMode (e.g., Hybrid/Remote/Onsite), if stated.
- officeDays (e.g., "3 days/week in office"), if stated.
- values: list of values/behaviors mentioned (e.g., Collaboration, Data-driven).
- signals: how the candidate should present themselves, based on text.
- benefits: any listed benefits.
Schema: ${schema}
Text:\n${text}`;
    return { prompt, responseSchema: schema };
  }
  if (task === 'companyRole') {
    const schema = `{"company":"string|optional","role":"string|optional"}`;
    const prompt = `${common}
Task: From the text, extract company name and job title if present.
Constraints: Keep concise; trim parenthetical acronyms; stop at sentence boundaries. If not present, leave empty.
Schema: ${schema}
Text:\n${text}`;
    return { prompt, responseSchema: schema };
  }
  if (task === 'metrics') {
    const schema = `[
      {"label":"string","value":"string","growth":"string|optional","context":"string|optional"}
    ]`;
    const prompt = `${common}
Task: Extract key business/technical metrics explicitly stated in the text (counts, $, %, scale). Keep each concise.
Examples: "Members: 220M+", "$11.6B revenue", "95% query reduction", "100M+ daily".
Schema: ${schema}
Text:\n${text}`;
    return { prompt, responseSchema: schema };
  }
  if (task === 'strengths') {
    const schema = `{"strengths":["string"],"gaps":["string"]}`;
    const prompt = `${common}
Task: List candidate strengths and potential gaps based ONLY on the text (resume/JD/notes).
Return concise bullet phrases.
Schema: ${schema}
Text:\n${text}`;
    return { prompt, responseSchema: schema };
  }
  if (task === 'questions') {
    const schema = `[
      {"question":"string","answer":"string|optional","category":"technical|behavioral|situational|company|role-specific|optional","likelyAsker":"string|optional"}
    ]`;
    const prompt = `${common}
Task: Extract interview questions (and optional answers) found in the text. Classify category when obvious. If no answers are present, leave answer empty.
Schema: ${schema}
Text:\n${text}`;
    return { prompt, responseSchema: schema };
  }
  const prompt = `${common}\nTask: Unknown. Return empty array.\nText:\n${text}`;
  return { prompt, responseSchema: '[]' };
}

function postProcess(task, data) {
  try {
    if (task === 'panelists' && Array.isArray(data)) {
      return data.filter(it => it && it.name && it.role)
        .map(it => ({
          name: String(it.name).trim(),
          role: String(it.role).trim(),
          linkedin: it.linkedin ? String(it.linkedin).trim() : ''
        })).slice(0, 6);
    }
    if (task === 'companyRole' && data && typeof data === 'object') {
      return { company: (data.company||'').toString().trim(), role: (data.role||'').toString().trim() };
    }
    if (task === 'metrics' && Array.isArray(data)) {
      return data.filter(m => m && m.label && m.value).map(m => ({
        label: String(m.label).trim().slice(0,60),
        value: String(m.value).trim().slice(0,40),
        growth: m.growth ? String(m.growth).trim().slice(0,40) : '',
        context: m.context ? String(m.context).trim().slice(0,80) : ''
      })).slice(0, 20);
    }
    if (task === 'strengths' && data && typeof data === 'object') {
      const strengths = Array.isArray(data.strengths)? data.strengths.map(s=>String(s).trim()).filter(Boolean):[];
      const gaps = Array.isArray(data.gaps)? data.gaps.map(s=>String(s).trim()).filter(Boolean):[];
      return { strengths, gaps };
    }
    if (task === 'questions' && Array.isArray(data)) {
      return data.filter(q => q && q.question).map(q => ({
        question: String(q.question).trim(),
        answer: q.answer ? String(q.answer).trim() : '',
        category: q.category ? String(q.category).toLowerCase() : '',
        likelyAsker: q.likelyAsker ? String(q.likelyAsker).trim() : ''
      })).slice(0, 50);
    }
    if (task === 'star' && Array.isArray(data)) {
      return data.filter(s => s && s.result).map(s => ({
        title: String(s.title || '').trim().slice(0, 100) || 'STAR Story',
        situation: String(s.situation || '').trim(),
        task: String(s.task || '').trim(),
        action: String(s.action || '').trim(),
        result: String(s.result || '').trim(),
        metric: s.metric ? String(s.metric).trim() : ''
      })).slice(0, 12);
    }
    if (task === 'culture' && data && typeof data === 'object') {
      return {
        workMode: data.workMode || '',
        officeDays: data.officeDays || '',
        values: Array.isArray(data.values) ? data.values : [],
        signals: Array.isArray(data.signals) ? data.signals : [],
        benefits: Array.isArray(data.benefits) ? data.benefits : []
      };
    }
  } catch { /* ignore */ }
  return data;
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const str = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(str); } catch { return {}; }
}
