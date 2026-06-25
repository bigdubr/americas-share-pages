// ============================================================
//  app.js — Catálogo de Criativos · Américas Imóveis
// ============================================================

// ── Estado global ────────────────────────────────────────────
let currentQuery = "";

// ── Inicialização ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    bindSearch();
    render(VIDEOS);
});

// ── Busca ────────────────────────────────────────────────────
function bindSearch() {
    const input = document.getElementById("search-input");

    input.addEventListener("input", (e) => {
        currentQuery = e.target.value.trim().toLowerCase();
        const filtered = filterVideos(currentQuery);
        render(filtered);
    });

    // Limpar busca com Escape
    input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            input.value = "";
            currentQuery = "";
            render(VIDEOS);
        }
    });
}

// ── Filtro ───────────────────────────────────────────────────
function filterVideos(query) {
    if (!query) return VIDEOS;

    return VIDEOS.filter((v) => {
        const haystack = [
            v.referencia,
            v.titulo,
            v.codigo,
            v.bairro,
            v.valor,
        ]
            .join(" ")
            .toLowerCase();

        return haystack.includes(query);
    });
}

// ── Renderização ─────────────────────────────────────────────
function render(list) {
    const grid = document.getElementById("video-grid");
    const counter = document.getElementById("video-counter");
    const empty = document.getElementById("empty-state");

    // Atualiza contador
    const total = VIDEOS.length;
    const showing = list.length;
    counter.textContent =
        currentQuery
            ? `${showing} de ${total} vídeos`
            : `${total} vídeos`;

    // Estado vazio
    if (list.length === 0) {
        grid.innerHTML = "";
        empty.hidden = false;
        return;
    }

    empty.hidden = true;
    grid.innerHTML = [...list].reverse().map(buildCard).join("");

    // Bind de ações após injetar HTML
    bindCardActions();
}

// ── Construção do card ────────────────────────────────────────
function buildCard(video) {
    const hasThumb = Boolean(video.thumb);
    const thumbUrl = hasThumb ? extractThumbUrl(video) : "";

    const imgTag = hasThumb
        ? `<img
          class="card__thumb-img"
          src="${thumbUrl}"
          alt="Thumb ${escapeHtml(video.titulo)}"
          loading="lazy"
          onerror="this.closest('.card__thumb').classList.add('card__thumb--error')"
        />`
        : "";

    return `
    <article class="card" data-instagram="${escapeHtml(video.instagram)}">
      <div class="card__thumb">
        ${imgTag}
        <div class="card__thumb-placeholder">
          <svg class="placeholder-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="40" height="40" rx="6" stroke="currentColor" stroke-width="2.5"/>
            <path d="M4 32 l10-10 8 8 8-8 14 14" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
            <circle cx="15" cy="17" r="4" stroke="currentColor" stroke-width="2.5"/>
            <polygon points="22,20 36,27 22,34" fill="currentColor" opacity="0.35"/>
          </svg>
          <span>Sem prévia</span>
        </div>
        <span class="card__ref">${escapeHtml(video.referencia)}</span>
      </div>

      <div class="card__body">
        <p class="card__titulo">${escapeHtml(video.titulo)}</p>

        <ul class="card__meta">
          <li>
            <span class="card__meta-label">Código</span>
            <span class="card__meta-value card__codigo">${escapeHtml(video.codigo)}</span>
          </li>
          <li>
            <span class="card__meta-label">Bairro</span>
            <span class="card__meta-value">${escapeHtml(video.bairro)}</span>
          </li>
          <li>
            <span class="card__meta-label">Valor</span>
            <span class="card__meta-value card__valor">R$ ${escapeHtml(video.valor)}</span>
          </li>
        </ul>

        <div class="card__actions">
          <a
            class="btn btn--primary"
            href="${escapeHtml(video.instagram)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/>
            </svg>
            Abrir Instagram
          </a>
          <button
            class="btn btn--secondary js-copy"
            data-url="${escapeHtml(video.instagram)}"
            title="Copiar link"
          >
            <svg class="icon-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <svg class="icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span class="btn-label">Copiar Link</span>
          </button>
        </div>
      </div>
    </article>
  `;
}

// ── Ações dos cards ───────────────────────────────────────────
function bindCardActions() {
    document.querySelectorAll(".js-copy").forEach((btn) => {
        btn.addEventListener("click", handleCopy);
    });
}

async function handleCopy(e) {
    const btn = e.currentTarget;
    const url = btn.dataset.url;

    try {
        await navigator.clipboard.writeText(url);
        showCopyFeedback(btn, true);
    } catch {
        // Fallback para ambientes sem Clipboard API
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showCopyFeedback(btn, true);
    }
}

function showCopyFeedback(btn, success) {
    if (!success) return;
    btn.classList.add("btn--copied");
    const label = btn.querySelector(".btn-label");
    const original = label.textContent;
    label.textContent = "Copiado!";

    setTimeout(() => {
        btn.classList.remove("btn--copied");
        label.textContent = original;
    }, 2000);
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Retorna o caminho da thumbnail local baseada na referência.
 */
function extractThumbUrl(video) {
    return `thumbs/${video.referencia}.webp`;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}