/**
 * Seznam dárků — uprav pole GIFTS (přidej/odeber řádky).
 * url: řetězec s odkazem nebo null, pokud odkaz není.
 * id: musí být unikátní (pro ukládání zaškrtnutí v localStorage).
 */
const STORAGE_KEY = "unicorn-gift-list-checked-v2";

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

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderGiftList() {
  const list = document.getElementById("gift-list");
  if (!list) return;

  const checked = loadCheckedIds();

  list.innerHTML = GIFTS.map((gift) => {
    const isChecked = checked.has(gift.id);
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

function onCheckboxChange(event) {
  const input = event.target;
  const id = input.dataset.giftId;
  if (!id) return;

  const checked = loadCheckedIds();
  if (input.checked) checked.add(id);
  else checked.delete(id);
  saveCheckedIds(checked);

  const card = input.closest(".gift-card");
  const badge = card && card.querySelector(".gift-card__badge");
  if (card) {
    card.classList.toggle("gift-card--reserved", input.checked);
  }
  if (badge) {
    badge.hidden = !input.checked;
  }
}

document.addEventListener("DOMContentLoaded", renderGiftList);
