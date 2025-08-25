// Tiny helpers used across modules
export const $ = (sel) => document.querySelector(sel);
export const md = (s) => (window.marked ? window.marked.parse(s) : s);
export const sanitize = (html) => (window.DOMPurify ? DOMPurify.sanitize(html) : html);

export const toMarkdownLinks = (s = "") =>
  /\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/i.test(s)
    ? s
    : s.replace(/https?:\/\/\S+/g, (url) => {
        const m = url.match(/^(.*?)([).,!?:;]*)$/);
        const core = m ? m[1] : url;
        const trail = m ? m[2] : "";
        return `[${core}](${core})${trail}`;
      });
