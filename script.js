/**
 * Seznam dárků — uprav pole GIFTS (přidej/odeber řádky).
 *
 * --- Nejrychlejší sdílení zaškrtnutí (bez PHP, bez Firebase) -----------------
 * 1) Založ účet na https://jsonbin.io (zdarma).
 * 2) V „API Keys“ zkopíruj $2 *X-Master-Key*.
 * 3) Vytvoř nový Bin s obsahem:  {}
 * 4) Zkopíruj *Bin ID* z adresy (část za /b/…).
 * 5) Níže v JSONBIN_SYNC vlož binId a masterKey, soubor nahraj na web a otevři přes https.
 *
 * Kdokoli otevře stejnou stránku, uvidí stejná zaškrtnutí (obnovení cca každých pár sekund).
 *
 * BEZPEČNOST: Master key je v kódu stránky — vidí ho každý, kdo umí „Zobrazit zdroj“.
 * Používej jen soukromý odkaz v rodině; veřejný web s tímto klíčem nedávej.
 *
 * Alternativa: REMOTE_SYNC.url + sync.php na hostingu s PHP (viz sync.php v projektu).
 */

const STORAGE_KEY = "unicorn-gift-list-checked-v2";

/**
 * JSONBin.io — vyplň obě pole pro sdílení. Nech prázdné = nepoužívá se.
 * @see https://jsonbin.io
 */
const JSONBIN_SYNC = {
  binId: "69e0858b36566621a8bbb3ee",
  masterKey: "$2a$10$nFMqH3vS/mgmC2qI2.Cen.sRjmptSm9skFKATp4x3ElM8YBQjsszW",
};

/**
 * Vlastní server (sync.php). Použije se jen pokud JSONBIN_SYNC není vyplněný.
 * url: "" = nepoužívat HTTP API.
 */
const REMOTE_SYNC = {
  url: "",
  secret: "",
  pollMs: 12000,
};

const GIFTS = [
  {
    id: "sperkovnice",
    name: "\u0160perkovnice",
    url: "https://eurekakids.cz/produkt/hudebni-skrinka-jednorozec",
  },
  {
    id: "kufrik-salon-krasy",
    name: "Kuf\u0159\u00edk sal\u00f3n kr\u00e1sy",
    url: "https://www.mrakyhracek.cz/bavytoy-detsky-kosmeticky-kufrik_z189705/",
  },
  {
    id: "cestovni-kufr",
    name: "Cestovni kufr",
    url: "https://www.flordecristal.cz/detsky-cestovni-kufr-na-koleckach--prirucni-zavazadlo-jednorozec/",
  },
  {
    id: "make-up",
    name: "Make up",
    url: "https://www.nintendo.cz/product/baby-ocean-make-up-set_z192202",
  },
  {
    id: "hatchimals",
    name: "Hatchimals",
    url: "https://www.zoozoo.cz/6-12-let/hedvabi-hodinicky-pet-hatchimals-pet_z174165",
  },
  {
    id: "krecek-lego",
    name: "K\u0159e\u010dek lego",
    url: "https://pompo.cz/lego-creator-31376-roztomily-krecek-s-kvetinou_z257950",
  },
  {
    id: "nehty-nalepovaci",
    name: "Nehty nalepovac\u00ed",
    url: "https://www.dohodapetr.cz/nahod-na-nehata-klavesnice-od-7-let-balcony-480-ks-od-7-let_z161040/",
  },
  {
    id: "rainbocorns-kitty",
    name: "RainBocorns Kitty Mania Ko\u010di\u010dka",
    url: "https://www.bedra.cz/rainbocorns-kitty-mania-kocicka_z241324",
  },
  {
    id: "cary-fuc-deskovka",
    name: "\u010c\u00e1ry fu\u010d deskovka",
    url: "https://www.svet-her.cz/spolecenske-hry/caryfuc",
  },
  {
    id: "tary-triko",
    name: "Tary triko",
    url: "https://taryshop.cz/collections/trika-tary/products/tricko-tary-bubble-purple",
  },
];

/** @type {"local" | "remote"} */
let syncMode = "local";
/** Poslední známý stav ze serveru (kvůli pollingu). */
let lastKnownRemoteSet = null;
/** @type {ReturnType<typeof setInterval> | null} */
let pollTimer = null;

function setsEqual(a, b) {
  if (!(a instanceof Set) || !(b instanceof Set)) return false;
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/** @returns {"jsonbin" | "http" | null} */
function getRemoteBackend() {
  if (JSONBIN_SYNC.binId.trim() && JSONBIN_SYNC.masterKey.trim()) return "jsonbin";
  if (REMOTE_SYNC.url.trim()) return "http";
  return null;
}

function syncHttpUrl() {
  const raw = REMOTE_SYNC.url.trim();
  const base = /^https?:\/\//i.test(raw) ? raw : new URL(raw, window.location.href).href;
  const u = new URL(base);
  if (REMOTE_SYNC.secret) u.searchParams.set("key", REMOTE_SYNC.secret);
  return u.href;
}

function setFooterMessage(text, variant) {
  const el = document.getElementById("sync-footnote");
  if (!el) return;
  el.textContent = text;
  el.classList.remove("site-footer__note--remote", "site-footer__note--warn");
  if (variant === "remote") el.classList.add("site-footer__note--remote");
  if (variant === "warn") el.classList.add("site-footer__note--warn");
}

function loadCheckedIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveCheckedIds(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

function checksObjectToSet(val) {
  const s = new Set();
  if (val && typeof val === "object" && !Array.isArray(val)) {
    for (const [k, v] of Object.entries(val)) {
      if (v === true) s.add(k);
    }
  }
  return s;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderGiftList(checked) {
  const list = document.getElementById("gift-list");
  if (!list) return;

  const checkedSet = checked instanceof Set ? checked : loadCheckedIds();

  list.innerHTML = GIFTS.map((gift) => {
    const isChecked = checkedSet.has(gift.id);
    const linkHtml = gift.url
      ? `<a class="gift-card__link" href="${escapeHtml(gift.url)}" target="_blank" rel="noopener noreferrer">Otevřít nápad / obchod →</a>`
      : "";

    return `
      <li class="gift-card${isChecked ? " gift-card--reserved" : ""}" data-gift-id="${escapeHtml(gift.id)}">
        <div class="gift-card__row">
          <div class="gift-card__body">
            <h2 class="gift-card__name">${escapeHtml(gift.name)}</h2>
            ${linkHtml}
            <p class="gift-card__badge" ${isChecked ? "" : "hidden"}>${"\u2728"} Rezervov\u00e1no</p>
          </div>
          <div class="gift-card__action">
            <label class="gift-card__label">
              <input type="checkbox" class="gift-card__checkbox" data-gift-id="${escapeHtml(gift.id)}" ${isChecked ? "checked" : ""}>
              <span class="gift-card__label-text">Tento dárek si vezmu</span>
            </label>
          </div>
        </div>
      </li>
    `;
  }).join("");

  list.querySelectorAll(".gift-card__checkbox").forEach((input) => {
    input.addEventListener("change", onCheckboxChange);
  });
}

async function fetchJsonBinChecks() {
  const binId = JSONBIN_SYNC.binId.trim();
  const key = JSONBIN_SYNC.masterKey.trim();
  const readUrl = `https://api.jsonbin.io/v3/b/${encodeURIComponent(binId)}/latest?meta=false`;
  const res = await fetch(readUrl, {
    headers: { "X-Master-Key": key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("JSONBin GET failed");
  const data = await res.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) return new Set();
  return checksObjectToSet(data);
}

async function postJsonBinCheck(id, checked) {
  const binId = JSONBIN_SYNC.binId.trim();
  const key = JSONBIN_SYNC.masterKey.trim();
  const readUrl = `https://api.jsonbin.io/v3/b/${encodeURIComponent(binId)}/latest?meta=false`;
  const readRes = await fetch(readUrl, {
    headers: { "X-Master-Key": key },
    cache: "no-store",
  });
  if (!readRes.ok) throw new Error("JSONBin read failed");
  let data = await readRes.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) data = {};
  if (checked) data[id] = true;
  else delete data[id];

  const putUrl = `https://api.jsonbin.io/v3/b/${encodeURIComponent(binId)}`;
  const putRes = await fetch(putUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": key,
    },
    body: JSON.stringify(data),
    cache: "no-store",
  });
  if (!putRes.ok) throw new Error("JSONBin PUT failed");
  return checksObjectToSet(data);
}

async function fetchHttpChecks() {
  const res = await fetch(syncHttpUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error("GET failed");
  const data = await res.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("bad JSON");
  }
  return checksObjectToSet(data);
}

async function postHttpCheck(id, checked) {
  const res = await fetch(syncHttpUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, checked }),
  });
  if (!res.ok) throw new Error("POST failed");
  const data = await res.json();
  if (!data || typeof data !== "object") throw new Error("bad response");
  return checksObjectToSet(data);
}

async function fetchRemoteChecks() {
  const b = getRemoteBackend();
  if (b === "jsonbin") return fetchJsonBinChecks();
  if (b === "http") return fetchHttpChecks();
  throw new Error("no remote backend");
}

async function postRemoteCheck(id, checked) {
  const b = getRemoteBackend();
  if (b === "jsonbin") return postJsonBinCheck(id, checked);
  if (b === "http") return postHttpCheck(id, checked);
  throw new Error("no remote backend");
}

function remoteLabel() {
  return getRemoteBackend() === "jsonbin" ? "JSONBin.io" : "sync.php";
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  const ms = Math.max(3000, Number(REMOTE_SYNC.pollMs) || 12000);
  pollTimer = setInterval(async () => {
    if (syncMode !== "remote") return;
    try {
      const set = await fetchRemoteChecks();
      if (lastKnownRemoteSet && setsEqual(lastKnownRemoteSet, set)) return;
      lastKnownRemoteSet = set;
      renderGiftList(set);
    } catch {
      /* tiché obnovení při výpadku */
    }
  }, ms);
}

function onCheckboxChange(event) {
  const input = event.target;
  const id = input.dataset.giftId;
  if (!id) return;

  const card = input.closest(".gift-card");
  const badge = card && card.querySelector(".gift-card__badge");
  if (card) {
    card.classList.toggle("gift-card--reserved", input.checked);
  }
  if (badge) {
    badge.hidden = !input.checked;
  }

  if (syncMode === "remote") {
    postRemoteCheck(id, input.checked)
      .then((set) => {
        lastKnownRemoteSet = set;
        renderGiftList(set);
      })
      .catch(() => {
        setFooterMessage(
          `Nepodařilo se uložit (${remoteLabel()}). Zkontroluj klíč, Bin ID nebo internet.`,
          "warn"
        );
        fetchRemoteChecks()
          .then((set) => {
            lastKnownRemoteSet = set;
            renderGiftList(set);
          })
          .catch(() => {});
      });
    return;
  }

  const checked = loadCheckedIds();
  if (input.checked) checked.add(id);
  else checked.delete(id);
  saveCheckedIds(checked);
}

async function initRemoteSync() {
  setFooterMessage("Načítám sdílený seznam…", "warn");
  try {
    const set = await fetchRemoteChecks();
    lastKnownRemoteSet = set;
    syncMode = "remote";
    renderGiftList(set);
    const src = getRemoteBackend() === "jsonbin" ? "JSONBin.io" : "sync.php";
    setFooterMessage(`Sdílený seznam (${src}) — ostatní uvidí změny během pár sekund.`, "remote");
    startPolling();
  } catch (err) {
    console.error(err);
    syncMode = "local";
    setFooterMessage(
      "Sdílení nefunguje (špatný Bin ID / klíč, nebo stránku otevři přes https, ne z disku). Zatím jen toto zařízení.",
      "warn"
    );
    renderGiftList();
  }
}

function startApp() {
  const backend = getRemoteBackend();
  const protocol = window.location.protocol;

  if (backend && protocol !== "http:" && protocol !== "https:") {
    setFooterMessage(
      "Pro sdílení otevři stránku přes https (ne jako soubor z disku), jinak prohlížeč API blokuje.",
      "warn"
    );
    renderGiftList();
    return;
  }

  if (backend) {
    initRemoteSync();
  } else {
    setFooterMessage(
      "Jen toto zařízení. Pro sdílení: vyplň JSONBIN_SYNC v script.js (jsonbin.io) nebo REMOTE_SYNC.url (sync.php).",
      "warn"
    );
    renderGiftList();
  }
}

document.addEventListener("DOMContentLoaded", startApp);
