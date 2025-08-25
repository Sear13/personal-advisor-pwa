//imports component
import { Store } from "./store.js";
import { ChatClient } from "./chat-client.js";
import { Advisor } from "./advisor.js";
import { ChatUI } from "./chat-ui.js";
import { initBackgroundRotator } from "./background.js";
import { initPWA } from "./pwa.js";
import { API_URL, CLASSROOM_KEY } from "./config.js";

(function main() {
  initBackgroundRotator();

  const store = new Store();
  const client = new ChatClient({ baseUrl: API_URL, classroomKey: CLASSROOM_KEY });
  const advisor = new Advisor();
  new ChatUI(store, client, advisor);

  initPWA();
})();
