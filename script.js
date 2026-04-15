/**
 * Seznam dárků — uprav pole GIFTS (přidej/odeber řádky).
 * url: řetězec s odkazem nebo null, pokud odkaz není.
 * id: musí být unikátní (malá písmena, čísla, pomlčky).
 *
 * Sdílení mezi lidmi (bez Firebase):
 * - Nahraj stránku + sync.php na hosting s PHP, nebo spusť node server.mjs lokálně.
 * - Nastav REMOTE_SYNC.url na "sync.php" (stejná složka) nebo plnou adresu k sync.php.
 * - Volitelně stejný tajný klíč v REMOTE_SYNC.secret a v sync.php ($SYNC_SECRET).
 */

const STORAGE_KEY = "unicorn-gift-list-checked-v2";

/**
 * Sdílení přes jednoduchý HTTP endpoint (sync.php nebo server.mjs).
 * url: "" → jen localStorage na tomto zařízení.
 */
const REMOTE_SYNC = {
  url: "sync.php",
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

function isRemoteConfigured() {
  return typeof REMOTE_SYNC.url === "string" && REMOTE_SYNC.url.trim().length > 0;
}

function syncRequestUrl() {
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

async function fetchRemoteChecks() {
  const res = await fetch(syncRequestUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error("GET failed");
  const data = await res.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("bad JSON");
  }
  return checksObjectToSet(data);
}

async function postRemoteCheck(id, checked) {
  const res = await fetch(syncRequestUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, checked }),
  });
  if (!res.ok) throw new Error("POST failed");
  const data = await res.json();
  if (!data || typeof data !== "object") throw new Error("bad response");
  return checksObjectToSet(data);
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
          "Nepodařilo se uložit na server (sync.php). Zkontroluj připojení a adresu REMOTE_SYNC.url.",
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
  setFooterMessage("Načítám sdílený seznam ze serveru…", "warn");
  try {
    const set = await fetchRemoteChecks();
    lastKnownRemoteSet = set;
    syncMode = "remote";
    renderGiftList(set);
    setFooterMessage(
      "Sdílený seznam — změny uvidí kdokoli se stejnou stránkou (API sync.php).",
      "remote"
    );
    startPolling();
  } catch (err) {
    console.error(err);
    syncMode = "local";
    setFooterMessage(
      "Server pro sdílení nedostupný (zkus otevřít přes http, ne file://, a zkontroluj REMOTE_SYNC.url). Zatím jen toto zařízení.",
      "warn"
    );
    renderGiftList();
  }
}

function startApp() {
  const protocol = window.location.protocol;
  if (isRemoteConfigured() && protocol !== "http:" && protocol !== "https:") {
    setFooterMessage(
      "Pro sdílení otevři stránku přes http(s), ne jako soubor z disku — jinak prohlížeč API nezavolá.",
      "warn"
    );
    renderGiftList();
    return;
  }

  if (isRemoteConfigured()) {
    initRemoteSync();
  } else {
    setFooterMessage(
      "Jen toto zařízení (localStorage). Pro sdílení nastav REMOTE_SYNC.url na sync.php a nahraj ho na web.",
      "warn"
    );
    renderGiftList();
  }
}

document.addEventListener("DOMContentLoaded", startApp);
