import { API_URL, CLASSROOM_KEY, TIMEOUT_MS, RETRIES } from "./config.js";

export class ChatClient {
  constructor({ baseUrl = API_URL, classroomKey = CLASSROOM_KEY } = {}) {
    this.baseUrl = baseUrl;
    this.classroomKey = classroomKey;
  }

  async send({ prompt, sessionId, signal }) {
    const headers = { "Content-Type": "application/json" };
    if (this.classroomKey) headers["x-classroom-key"] = this.classroomKey;

    const body = JSON.stringify({ prompt, sessionId });
    const doFetch = () => fetch(this.baseUrl, { method: "POST", headers, body, signal });

    const withTimeout = (p) =>
      Promise.race([
        p,
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error("Request timed out")), TIMEOUT_MS)
        ),
      ]);

    let lastErr;
    for (let i = 0; i <= RETRIES; i++) {
      try {
        const r = await withTimeout(doFetch());
        let data = null;
        try { data = await r.json(); } catch {}
        if (!r.ok) {
          const msg =
            typeof data?.error === "string"
              ? data.error
              : data?.error?.message || "Unknown server error";
          throw new Error(`Server error ${r.status}: ${msg}`);
        }
        return data?.choices?.[0]?.message?.content ?? "No response from model.";
      } catch (e) {
        lastErr = e;
        if (i === RETRIES) throw e;
        await new Promise((res) => setTimeout(res, 600));
      }
    }
    throw lastErr;
  }
}
