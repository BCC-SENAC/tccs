const CONFIG = {
  owner: "BCC-SENAC",
  repo: "tccs",
  branch: "main",
};

const endpoints = {
  tree: `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/git/trees/${CONFIG.branch}?recursive=1`,
  rawBase: `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${CONFIG.branch}/`,
  blobBase: `https://github.com/${CONFIG.owner}/${CONFIG.repo}/blob/${CONFIG.branch}/`,
};

const ui = {
  searchInput: document.getElementById("searchInput"),
  clearButton: document.getElementById("clearButton"),
  statusText: document.getElementById("statusText"),
  messageArea: document.getElementById("messageArea"),
  cardsGrid: document.getElementById("cardsGrid"),
  cardTemplate: document.getElementById("cardTemplate"),
};

const state = {
  allWorks: [],
  filteredWorks: [],
};

function normalize(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractYear(path) {
  const match = path.match(/^(\d{4})\//);
  if (!match) return 0;
  return Number.parseInt(match[1], 10);
}

function formatTitle(path) {
  const filename = path.split("/").pop() || "";
  return filename.replace(/\.pdf$/i, "").replace(/_/g, " ").trim();
}

function compareWorksDesc(a, b) {
  if (b.year !== a.year) return b.year - a.year;
  return a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" });
}

function showNotice(text, isError = false) {
  ui.messageArea.innerHTML = "";

  const notice = document.createElement("div");
  notice.className = `notice${isError ? " notice--error" : ""}`;
  notice.textContent = text;

  ui.messageArea.appendChild(notice);
}

function clearNotice() {
  ui.messageArea.innerHTML = "";
}

function updateStatus() {
  const total = state.allWorks.length;
  const shown = state.filteredWorks.length;

  if (!total) {
    ui.statusText.textContent = "Nenhum trabalho encontrado no repositorio.";
    return;
  }

  ui.statusText.textContent = `${shown} de ${total} trabalho(s) exibido(s).`;
}

function createCard(work) {
  const fragment = ui.cardTemplate.content.cloneNode(true);
  const article = fragment.querySelector(".tcc-card");
  const yearTag = fragment.querySelector(".tag-year");
  const titleEl = fragment.querySelector(".tcc-card__title");
  const openPdfLink = fragment.querySelector(".btn--primary");
  const githubLink = fragment.querySelector(".btn--ghost");

  yearTag.textContent = work.year ? String(work.year) : "Sem ano";
  titleEl.textContent = work.title;

  openPdfLink.href = work.pdfUrl;
  openPdfLink.textContent = "Abrir PDF";

  githubLink.href = work.githubUrl;
  githubLink.textContent = "Ver no GitHub";

  article.addEventListener("click", (event) => {
    const clickedLink = event.target.closest("a");
    if (!clickedLink) {
      window.open(work.pdfUrl, "_blank", "noopener");
    }
  });

  return fragment;
}

function renderCards() {
  ui.cardsGrid.innerHTML = "";

  if (!state.filteredWorks.length) {
    showNotice("Nenhum trabalho encontrado para esta busca.");
    updateStatus();
    return;
  }

  clearNotice();

  const docFragment = document.createDocumentFragment();
  for (const work of state.filteredWorks) {
    docFragment.appendChild(createCard(work));
  }

  ui.cardsGrid.appendChild(docFragment);
  updateStatus();
}

function applySearchFilter() {
  const query = normalize(ui.searchInput.value.trim());

  if (!query) {
    state.filteredWorks = [...state.allWorks];
  } else {
    state.filteredWorks = state.allWorks.filter((work) => work.searchTitle.includes(query));
  }

  renderCards();
}

function mapTreeToWorks(treeNodes) {
  return treeNodes
    .filter((node) => node.type === "blob" && /\.pdf$/i.test(node.path))
    .map((node) => {
      const title = formatTitle(node.path);
      const path = node.path;

      return {
        path,
        title,
        year: extractYear(path),
        searchTitle: normalize(title),
        pdfUrl: `${endpoints.rawBase}${encodeURI(path)}`,
        githubUrl: `${endpoints.blobBase}${encodeURI(path)}`,
      };
    })
    .sort(compareWorksDesc);
}

async function loadWorksFromGithub() {
  ui.statusText.textContent = "Carregando trabalhos...";
  clearNotice();

  try {
    const response = await fetch(endpoints.tree, {
      headers: { Accept: "application/vnd.github+json" },
    });

    if (!response.ok) {
      throw new Error(`Erro na API do GitHub (status ${response.status}).`);
    }

    const data = await response.json();
    const tree = Array.isArray(data.tree) ? data.tree : [];

    state.allWorks = mapTreeToWorks(tree);
    state.filteredWorks = [...state.allWorks];

    if (!state.allWorks.length) {
      showNotice("Nenhum PDF foi encontrado no repositorio.");
    }

    renderCards();
  } catch (error) {
    state.allWorks = [];
    state.filteredWorks = [];
    ui.cardsGrid.innerHTML = "";
    ui.statusText.textContent = "Nao foi possivel carregar os trabalhos.";
    showNotice(
      "Falha ao buscar os dados no GitHub. Verifique sua conexao ou tente novamente mais tarde.",
      true
    );
    console.error(error);
  }
}

function setupEvents() {
  ui.searchInput.addEventListener("input", applySearchFilter);
  ui.clearButton.addEventListener("click", () => {
    ui.searchInput.value = "";
    applySearchFilter();
    ui.searchInput.focus();
  });
}

setupEvents();
loadWorksFromGithub();
