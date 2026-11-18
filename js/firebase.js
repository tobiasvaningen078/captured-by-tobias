// Firebase-initialisatie. Met ?emu in de URL wordt de lokale emulator gebruikt (alleen voor testen).
import {
  initializeApp, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, connectAuthEmulator, getDatabase, connectDatabaseEmulator, ref, onValue,
} from "./vendor/firebase.js";
import { firebaseConfig } from "./config.js";

export * from "./vendor/firebase.js";

const emulator = new URLSearchParams(location.search).has("emu");
const filled = (v) => !!v && !String(v).includes("VUL_");
export const configured = emulator || (filled(firebaseConfig.apiKey) && filled(firebaseConfig.databaseURL));

export let auth = null;
export let db = null;
let serverOffset = 0;

if (configured) {
  const cfg = emulator
    ? { apiKey: "demo-key", projectId: "demo-kerstquiz", databaseURL: "http://127.0.0.1:9000?ns=demo-kerstquiz" }
    : firebaseConfig;
  const app = initializeApp(cfg);
  // Geen pop-up/redirect-login nodig: zo laadt Firebase geen extra Google-scripts.
  auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  db = getDatabase(app);
  if (emulator) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectDatabaseEmulator(db, "127.0.0.1", 9000);
  }
  onValue(ref(db, ".info/serverTimeOffset"), (s) => { serverOffset = s.val() || 0; });
}

/** Huidige servertijd in ms (gecorrigeerd voor klokverschil van dit apparaat). */
export const serverNow = () => Date.now() + serverOffset;

/** Behoud ?emu bij links naar andere pagina's. */
export const emuSuffix = emulator ? "emu" : "";
