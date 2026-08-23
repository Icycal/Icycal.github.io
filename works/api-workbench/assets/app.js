import {
  buildReferenceIndex,
  collectReferences,
  createArrayNode,
  createCompositionNode,
  createEmptyProject,
  createEndpoint,
  createModel,
  createObjectNode,
  createPrimitiveNode,
  createProperty,
  createReferenceNode,
  extractSchemaToModel,
  primitiveFormatOptions,
  touchProject,
  validateProject,
} from "./core/model.js?v=20260811.2";
import { exportProjectFiles, importProjectFile } from "./core/io.js?v=20260811.9";
import { loadLastProject, saveProject } from "./core/storage.js";
import { createId, createNumericId, downloadText, escapeHtml, normalizePath, slugify } from "./core/utils.js";
import { generateSchemaPreview, inferSchemaFromExample, schemaExample } from "./core/schema-codec.js?v=20260811.5";
import { generateRequestExamples } from "./core/markdown.js?v=20260811.3";

const icons = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="9"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 20h14"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 4v12m0 0 5-5m-5 5-5-5M5 20h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7h7l2 2h9v9H3z"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m8 9-3 3 3 3m8-6 3 3-3 3m-3-9-2 12"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 18 6-6-6-6"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M9 10V7a4 4 0 0 1 7.5-2"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8.2A7 7 0 0 1 18.7 7M17.9 15.8A7 7 0 0 1 5.3 17"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
};

document.querySelectorAll("[data-icon]").forEach((node) => { node.innerHTML = icons[node.dataset.icon] || ""; });

const elements = {
  main: document.querySelector("#main-content"),
  tree: document.querySelector("#resource-tree"),
  search: document.querySelector("#tree-search"),
  projectName: document.querySelector("#project-name"),
  source: document.querySelector("#project-source"),
  saveState: document.querySelector("#save-state"),
  fileInput: document.querySelector("#file-input"),
  modalRoot: document.querySelector("#modal-root"),
  toastRoot: document.querySelector("#toast-root"),
  dropOverlay: document.querySelector("#drop-overlay"),
  sidebarResizer: document.querySelector("#sidebar-resizer"),
};

const TREE_COLLAPSE_STORAGE_KEY = "api-workbench:collapsed-tree-folders";
const SIDEBAR_WIDTH_STORAGE_KEY = "api-workbench:sidebar-width";
const SIDEBAR_DEFAULT_WIDTH = 288;
const SIDEBAR_MIN_WIDTH = 0;
const SIDEBAR_MIN_EXPANDED_WIDTH = 210;
const SIDEBAR_MAX_WIDTH = 560;
const SIDEBAR_COLLAPSE_THRESHOLD = 96;

function loadCollapsedTreeFolders() {
  try {
    const value = JSON.parse(localStorage.getItem(TREE_COLLAPSE_STORAGE_KEY) || "[]");
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

function saveCollapsedTreeFolders(folders) {
  try { localStorage.setItem(TREE_COLLAPSE_STORAGE_KEY, JSON.stringify([...folders])); } catch {}
}

function loadSidebarWidth() {
  try {
    const storedWidth = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (storedWidth === null) return SIDEBAR_DEFAULT_WIDTH;
    const width = Number(storedWidth);
    return Number.isFinite(width) && width >= 0 ? width : SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

let preferredSidebarWidth = loadSidebarWidth();

function sidebarWidthBounds() {
  return { min: SIDEBAR_MIN_WIDTH, max: Math.max(SIDEBAR_MIN_EXPANDED_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, window.innerWidth - 480)) };
}

function applySidebarWidth(width = preferredSidebarWidth, persist = false) {
  preferredSidebarWidth = Number.isFinite(Number(width)) ? Number(width) : SIDEBAR_DEFAULT_WIDTH;
  const { min, max } = sidebarWidthBounds();
  const appliedWidth = Math.round(preferredSidebarWidth <= SIDEBAR_COLLAPSE_THRESHOLD ? 0 : Math.min(max, Math.max(SIDEBAR_MIN_EXPANDED_WIDTH, preferredSidebarWidth)));
  preferredSidebarWidth = appliedWidth;
  document.documentElement.style.setProperty("--sidebar-width", `${appliedWidth}px`);
  document.body.classList.toggle("sidebar-collapsed", appliedWidth === 0);
  elements.sidebarResizer?.setAttribute("aria-valuemin", String(min));
  elements.sidebarResizer?.setAttribute("aria-valuemax", String(max));
  elements.sidebarResizer?.setAttribute("aria-valuenow", String(appliedWidth));
  elements.sidebarResizer?.setAttribute("aria-valuetext", appliedWidth === 0 ? "侧边栏已隐藏" : `${appliedWidth} 像素`);
  if (elements.sidebarResizer) {
    elements.sidebarResizer.title = appliedWidth === 0 ? "侧边栏已隐藏：向右拖动、按右方向键或双击恢复" : "左右拖动调整侧边栏；拖到最左侧可隐藏，双击恢复默认宽度";
  }
  if (persist) {
    try { localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(preferredSidebarWidth)); } catch {}
  }
  return appliedWidth;
}

function initializeSidebarResizer() {
  const resizer = elements.sidebarResizer;
  if (!resizer) return;
  let resizing = false;
  const stopResizing = () => {
    if (!resizing) return;
    resizing = false;
    document.body.classList.remove("sidebar-resizing");
    applySidebarWidth(preferredSidebarWidth, true);
  };
  resizer.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || window.matchMedia("(max-width: 640px)").matches) return;
    resizing = true;
    document.body.classList.add("sidebar-resizing");
    resizer.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  resizer.addEventListener("pointermove", (event) => {
    if (resizing) applySidebarWidth(event.clientX);
  });
  resizer.addEventListener("pointerup", stopResizing);
  resizer.addEventListener("pointercancel", stopResizing);
  resizer.addEventListener("lostpointercapture", stopResizing);
  resizer.addEventListener("dblclick", () => {
    preferredSidebarWidth = SIDEBAR_DEFAULT_WIDTH;
    applySidebarWidth(preferredSidebarWidth, true);
  });
  resizer.addEventListener("keydown", (event) => {
    const { min, max } = sidebarWidthBounds();
    const currentWidth = applySidebarWidth();
    let nextWidth = null;
    if (event.key === "ArrowLeft") nextWidth = currentWidth <= SIDEBAR_MIN_EXPANDED_WIDTH ? 0 : currentWidth - 16;
    else if (event.key === "ArrowRight") nextWidth = currentWidth === 0 ? SIDEBAR_MIN_EXPANDED_WIDTH : currentWidth + 16;
    else if (event.key === "Home") nextWidth = min;
    else if (event.key === "End") nextWidth = max;
    if (nextWidth === null) return;
    event.preventDefault();
    applySidebarWidth(nextWidth, true);
  });
  window.addEventListener("resize", () => applySidebarWidth());
  applySidebarWidth();
}

const state = {
  project: createEmptyProject(),
  nav: "apis",
  selection: { type: "overview", id: null },
  search: "",
  saveTimer: null,
  responseSelection: new Map(),
  requestExampleSelection: new Map(),
  collapsedTreeFolders: loadCollapsedTreeFolders(),
  openSchemaEditors: new Set(),
  rangeEnabledNodes: new Set(),
  editUnlocked: false,
};

function htmlToElement(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function button(label, className = "button small", action = null) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.textContent = label;
  if (action) node.addEventListener("click", action);
  return node;
}

function input(value, onInput, options = {}) {
  const node = document.createElement(options.multiline ? "textarea" : "input");
  node.value = value ?? "";
  if (options.placeholder) node.placeholder = options.placeholder;
  if (options.type && !options.multiline) node.type = options.type;
  node.addEventListener(options.change ? "change" : "input", () => onInput(node.value, node));
  return node;
}

function select(value, options, onChange) {
  const node = document.createElement("select");
  for (const option of options) {
    const item = document.createElement("option");
    item.value = typeof option === "string" ? option : option.value;
    item.textContent = typeof option === "string" ? option : option.label;
    item.selected = item.value === value;
    node.append(item);
  }
  node.addEventListener("change", () => onChange(node.value, node));
  return node;
}

function field(label, control, className = "field") {
  const wrapper = document.createElement("label");
  wrapper.className = className;
  const title = document.createElement("span");
  title.textContent = label;
  wrapper.append(title, control);
  return wrapper;
}

function toast(title, message = "", type = "success") {
  const node = htmlToElement(`<div class="toast ${type}"><span>${type === "error" ? icons.info : icons.check}</span><p><strong>${escapeHtml(title)}</strong>${escapeHtml(message)}</p></div>`);
  elements.toastRoot.append(node);
  setTimeout(() => node.remove(), 4200);
}

function closeModal() {
  elements.modalRoot.replaceChildren();
}

function showModal(title, content, actions = []) {
  const backdrop = htmlToElement(`<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><header class="modal-head"><h2>${escapeHtml(title)}</h2><button class="icon-button" type="button" aria-label="关闭">×</button></header><div class="modal-body"></div><footer class="modal-actions"></footer></section></div>`);
  backdrop.querySelector(".modal-head button").addEventListener("click", closeModal);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeModal(); });
  const body = backdrop.querySelector(".modal-body");
  if (typeof content === "string") body.innerHTML = content;
  else body.append(content);
  const footer = backdrop.querySelector(".modal-actions");
  for (const action of actions) footer.append(button(action.label, action.className || "button", action.onClick));
  if (!actions.length) footer.remove();
  elements.modalRoot.replaceChildren(backdrop);
  backdrop.querySelector("button, input, select, textarea")?.focus();
}

function showDeleteConfirmation(resourceType, resourceName, onConfirm) {
  const content = document.createElement("div");
  content.className = "confirm-message";
  content.innerHTML = `<span class="confirm-message-icon">${icons.trash}</span><div><strong>删除后无法从当前项目中恢复</strong><p>确定删除${escapeHtml(resourceType)}“${escapeHtml(resourceName)}”吗？导出文件和本地保存数据也会同步更新。</p></div>`;
  showModal(`删除${resourceType}`, content, [
    { label: "取消", onClick: closeModal },
    { label: "确认删除", className: "button danger", onClick: () => { closeModal(); onConfirm(); } },
  ]);
}

function changed(rerender = false) {
  touchProject(state.project);
  elements.saveState.textContent = "保存中…";
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(async () => {
    try {
      await saveProject(state.project);
      elements.saveState.textContent = "已保存";
    } catch (error) {
      elements.saveState.textContent = "保存失败";
      toast("本地保存失败", error.message, "error");
    }
  }, 350);
  updateCounters();
  if (rerender) render();
}

function updateCounters() {
  document.querySelector("#api-count").textContent = state.project.endpoints.length;
  document.querySelector("#model-count").textContent = state.project.models.length;
  const count = [...buildReferenceIndex(state.project).values()].reduce((sum, items) => sum + items.length, 0);
  document.querySelector("#reference-count").textContent = count;
  elements.projectName.value = state.project.name;
  elements.projectName.disabled = state.selection.type !== "overview" && !state.editUnlocked;
  const sourceLabels = { apifox: "Apifox 项目", openapi: "OpenAPI", swagger: "Swagger", markdown: "Markdown", "markdown-metadata": "接口工坊 Markdown", new: "本地项目" };
  elements.source.textContent = sourceLabels[state.project.source?.type] || "本地项目";
}

function setSelection(type, id = null) {
  state.selection = { type, id };
  state.editUnlocked = false;
  state.openSchemaEditors.clear();
  state.rangeEnabledNodes.clear();
  render();
  elements.main.focus({ preventScroll: true });
}

function renderTree() {
  const query = state.search.trim().toLowerCase();
  elements.tree.replaceChildren();
  const folders = state.nav === "apis" ? state.project.apiFolders : state.nav === "models" ? state.project.modelFolders : [];
  const resources = state.nav === "apis" ? state.project.endpoints : state.nav === "models" ? state.project.models : state.project.documents;
  const matches = (resource) => !query || [resource.name, resource.path, resource.description].some((value) => String(value || "").toLowerCase().includes(query));
  if (state.nav === "docs") {
    const wrapper = document.createElement("div");
    wrapper.className = "tree-items";
    resources.filter(matches).forEach((document) => wrapper.append(treeItem(document, "doc")));
    if (!wrapper.children.length) wrapper.innerHTML = '<div class="empty-inline">暂无自定义文档</div>';
    elements.tree.append(wrapper);
    return;
  }
  const childrenOf = (parentId) => folders.filter((folder) => folder.parentId === parentId).sort((a, b) => a.order - b.order);
  const renderFolder = (folder) => {
    const direct = resources.filter((resource) => resource.folderId === folder.id && matches(resource)).sort((a, b) => a.order - b.order);
    const childNodes = childrenOf(folder.id).map(renderFolder).filter(Boolean);
    if (query && !direct.length && !childNodes.length) return null;
    const node = document.createElement("section");
    node.className = `tree-folder ${folder.parentId === null ? "root" : ""}`;
    const items = document.createElement("div");
    items.className = "tree-items";
    direct.forEach((resource) => items.append(treeItem(resource, state.nav === "apis" ? "endpoint" : "model")));
    const content = document.createElement("div");
    content.className = "tree-folder-content";
    content.append(items, ...childNodes);
    const visibleCount = direct.length + childNodes.reduce((sum, child) => sum + Number(child.dataset.visibleCount || 0), 0);
    node.dataset.visibleCount = String(visibleCount);
    if (folder.parentId !== null) {
      const folderKey = `${state.nav}:${folder.id}`;
      const collapsed = !query && state.collapsedTreeFolders.has(folderKey);
      const label = button("", "tree-folder-label", () => {
        if (state.collapsedTreeFolders.has(folderKey)) state.collapsedTreeFolders.delete(folderKey);
        else state.collapsedTreeFolders.add(folderKey);
        saveCollapsedTreeFolders(state.collapsedTreeFolders);
        renderTree();
      });
      label.dataset.allowLocked = "true";
      label.setAttribute("aria-expanded", String(!collapsed));
      label.innerHTML = `<span class="tree-folder-chevron">${icons.arrow}</span><span class="tree-folder-icon">${icons.folder}</span><span class="tree-folder-name">${escapeHtml(folder.name)}</span><span class="tree-folder-count">${visibleCount}</span>`;
      content.hidden = collapsed;
      node.append(label);
    }
    node.append(content);
    return node;
  };
  const roots = childrenOf(null).map(renderFolder).filter(Boolean);
  roots.forEach((node) => elements.tree.append(node));
  if (!elements.tree.children.length) elements.tree.innerHTML = '<div class="empty-inline">没有匹配的资源</div>';
}

function treeItem(resource, type) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = `tree-item ${state.selection.type === type && state.selection.id === resource.id ? "active" : ""}`;
  if (type === "endpoint") node.innerHTML = `<span class="method ${resource.method}">${resource.method}</span><span class="item-copy"><strong>${escapeHtml(resource.name)}</strong><small>${escapeHtml(resource.path)}</small></span>`;
  else if (type === "model") node.innerHTML = `<span class="model-glyph">{ }</span><span class="item-copy"><strong>${escapeHtml(resource.name)}</strong><small>${escapeHtml(schemaLabel(resource.root))}</small></span>`;
  else node.innerHTML = `<span class="model-glyph">MD</span><span class="item-copy"><strong>${escapeHtml(resource.name)}</strong><small>自定义文档</small></span>`;
  node.addEventListener("click", () => setSelection(type, resource.id));
  return node;
}

function render() {
  document.querySelectorAll(".nav-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.nav === state.nav));
  updateCounters();
  renderTree();
  if (state.selection.type === "endpoint") renderEndpoint(state.project.endpoints.find((endpoint) => endpoint.id === state.selection.id));
  else if (state.selection.type === "model") renderModel(state.project.models.find((model) => model.id === state.selection.id));
  else if (state.selection.type === "doc") renderDocument(state.project.documents.find((document) => document.id === state.selection.id));
  else renderOverview();
}

function renderOverview() {
  const refs = [...buildReferenceIndex(state.project).values()].reduce((sum, items) => sum + items.length, 0);
  const issues = validateProject(state.project);
  if (!state.project.environments?.length) state.project.environments = [{ id: createId("env"), name: "默认环境", baseUrl: "", variables: [] }];
  const environment = state.project.environments[0];
  const emptyProject = state.project.source?.type === "new" && !state.project.endpoints.length && !state.project.models.length && !state.project.documents.length;
  const heroTitle = emptyProject ? "从协议文件到可维护的接口项目" : "继续维护当前接口项目";
  const heroDescription = emptyProject
    ? "所有解析、编辑、模型引用和导出都在当前浏览器完成。导入 Apifox、OpenAPI 或 Markdown，维护统一结构，再生成三种交付文件。"
    : `当前项目已有 ${state.project.endpoints.length} 个接口、${state.project.models.length} 个数据模型和 ${refs} 个模型引用，可以继续完善接口、模型和文档后再统一导出。`;
  const importLabel = emptyProject ? "导入协议文件" : "重新导入协议";
  const addEndpointLabel = emptyProject ? "添加第一个接口" : "添加新接口";
  elements.main.innerHTML = `<div class="page"><div class="overview-hero"><section class="hero-panel"><div><p class="eyebrow">LOCAL-FIRST API DESIGN</p><h2>${escapeHtml(heroTitle)}</h2><p>${escapeHtml(heroDescription)}</p></div><div class="hero-actions"><button class="button primary" data-action="import">${escapeHtml(importLabel)}</button><button class="button" data-action="new-api">${escapeHtml(addEndpointLabel)}</button></div></section><div class="metric-grid"><div class="metric"><strong>${state.project.endpoints.length}</strong><span>HTTP 接口</span></div><div class="metric"><strong>${state.project.models.length}</strong><span>数据模型</span></div><div class="metric"><strong>${refs}</strong><span>模型引用</span></div><div class="metric"><strong>${issues.length}</strong><span>待处理问题</span></div></div></div><div class="feature-grid"><article class="feature-card">${icons.layers}<h3>引用关系图</h3><p>引用不展开复制，支持字段组引用、直接引用、组合模型和循环检测。</p></article><article class="feature-card">${icons.code}<h3>三格式生成</h3><p>同步导出 Apifox 项目 JSON、OpenAPI YAML 和可阅读 Markdown。</p></article><article class="feature-card">${icons.check}<h3>导出前校验</h3><p>检查重复路径、缺失参数、失效引用和重复模型名称。</p></article></div></div>`;
  const environmentPanel = panel("环境与基础 URL", "基础 URL 会用于 CURL、HTTP、JavaScript 请求示例以及 Markdown 的 Base URLs。");
  environmentPanel.classList.add("environment-panel");
  const environmentGrid = document.createElement("div");
  environmentGrid.className = "form-grid";
  const nameControl = input(environment.name, (value) => { environment.name = value.trim() || "默认环境"; changed(); }, { placeholder: "例如 正式环境" });
  const urlStatus = document.createElement("small");
  urlStatus.className = "environment-url-status";
  urlStatus.id = createId("base-url-status");
  const updateUrlStatus = (value, control) => {
    const baseUrl = value.trim();
    let valid = true;
    if (baseUrl) {
      try { valid = ["http:", "https:"].includes(new URL(baseUrl).protocol); }
      catch { valid = false; }
    }
    control.classList.toggle("invalid", !valid);
    control.setAttribute("aria-invalid", String(!valid));
    urlStatus.classList.toggle("warning", !valid);
    urlStatus.textContent = !baseUrl ? "未设置时，请求示例使用 example.com。" : valid ? `请求示例将以 ${baseUrl.replace(/\/$/, "")} 为基础地址。` : "建议填写完整的 http:// 或 https:// 地址。";
  };
  const urlControl = input(environment.baseUrl, (value, control) => {
    environment.baseUrl = value.trim();
    updateUrlStatus(value, control);
    changed();
  }, { type: "url", placeholder: "例如 http://192.168.7.177:8011" });
  urlControl.autocomplete = "url";
  urlControl.setAttribute("aria-describedby", urlStatus.id);
  updateUrlStatus(environment.baseUrl, urlControl);
  const urlField = field("基础 URL", urlControl, "field full");
  urlField.append(urlStatus);
  environmentGrid.append(field("环境名称", nameControl, "field third"), urlField);
  environmentPanel.querySelector(".panel-body").append(environmentGrid);
  elements.main.querySelector(".feature-grid").before(environmentPanel);
  elements.main.querySelector('[data-action="import"]').addEventListener("click", () => elements.fileInput.click());
  elements.main.querySelector('[data-action="new-api"]').addEventListener("click", addEndpoint);
}

function pageShell(eyebrow, title, description, actions = []) {
  const page = document.createElement("div");
  page.className = "page";
  const head = document.createElement("header");
  head.className = "page-head";
  head.innerHTML = `<div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description || "")}</p></div>`;
  const actionBox = document.createElement("div");
  actionBox.className = "head-actions";
  const lockToggle = button("", `button small ${state.editUnlocked ? "editing-active" : ""}`, () => {
    state.editUnlocked = !state.editUnlocked;
    if (!state.editUnlocked) {
      state.openSchemaEditors.clear();
      state.rangeEnabledNodes.clear();
    }
    render();
  });
  lockToggle.dataset.lockToggle = "true";
  lockToggle.innerHTML = `${state.editUnlocked ? icons.unlock : icons.lock}${state.editUnlocked ? "完成编辑" : "解锁编辑"}`;
  lockToggle.setAttribute("aria-pressed", String(state.editUnlocked));
  lockToggle.title = state.editUnlocked ? "结束编辑并恢复只读状态" : "当前为只读状态，点击后允许修改";
  actionBox.append(lockToggle);
  actions.forEach((action) => {
    const control = button(action.label, action.className || "button small", action.onClick);
    if (action.icon && icons[action.icon]) control.innerHTML = `${icons[action.icon]}${escapeHtml(action.label)}`;
    if (action.allowLocked) control.dataset.allowLocked = "true";
    actionBox.append(control);
  });
  head.append(actionBox);
  page.append(head);
  elements.main.replaceChildren(page);
  return page;
}

function applyPageLock(page) {
  page.classList.toggle("edit-locked", !state.editUnlocked);
  page.classList.toggle("edit-unlocked", state.editUnlocked);
  if (state.editUnlocked) return;
  page.querySelectorAll("textarea").forEach((control) => {
    control.readOnly = true;
    control.setAttribute("aria-readonly", "true");
  });
  page.querySelectorAll("input").forEach((control) => {
    if (["checkbox", "radio", "range", "color", "file", "button", "submit", "reset"].includes(control.type)) control.disabled = true;
    else {
      control.readOnly = true;
      control.setAttribute("aria-readonly", "true");
    }
  });
  page.querySelectorAll("select").forEach((control) => { control.disabled = true; });
  page.querySelectorAll("button").forEach((control) => {
    if (control.dataset.lockToggle === "true" || control.dataset.allowLocked === "true" || control.classList.contains("response-tab") || control.classList.contains("reference-item")) return;
    control.disabled = true;
  });
}

function panel(title, subtitle = "") {
  const node = document.createElement("section");
  node.className = "panel";
  node.innerHTML = `<header class="panel-head"><div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}</div><div class="panel-actions"></div></header><div class="panel-body"></div>`;
  return node;
}

function folderOptions(folders) {
  return folders.filter((folder) => folder.parentId !== null || folders.length === 1).map((folder) => ({ value: folder.id, label: folderPath(folders, folder.id) }));
}

function folderPath(folders, id) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const names = [];
  let current = byId.get(id);
  while (current) {
    if (current.parentId !== null) names.unshift(current.name);
    current = byId.get(current.parentId);
  }
  return names.join(" / ") || "根目录";
}

function renderRequestExamples(endpoint, snippets) {
  const languages = Object.entries(snippets);
  const available = new Set(languages.map(([language]) => language));
  let selectedLanguage = state.requestExampleSelection.get(endpoint.id);
  if (!available.has(selectedLanguage)) selectedLanguage = languages[0]?.[0] || "curl";
  state.requestExampleSelection.set(endpoint.id, selectedLanguage);

  const viewer = document.createElement("div");
  viewer.className = "request-example-viewer";
  const tabs = document.createElement("div");
  tabs.className = "request-example-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "请求示例语言");
  const code = document.createElement("pre");
  code.className = "request-example-code";
  code.tabIndex = 0;
  code.setAttribute("role", "tabpanel");

  const activate = (language) => {
    selectedLanguage = language;
    state.requestExampleSelection.set(endpoint.id, language);
    code.textContent = snippets[language] || "";
    code.setAttribute("aria-label", `${language.toUpperCase()} 请求示例`);
    tabs.querySelectorAll("button").forEach((control) => {
      const active = control.dataset.language === language;
      control.classList.toggle("active", active);
      control.setAttribute("aria-selected", String(active));
      control.tabIndex = active ? 0 : -1;
    });
  };

  languages.forEach(([language]) => {
    const label = language === "javascript" ? "JavaScript" : language.toUpperCase();
    const tab = button(label, "request-example-tab", () => activate(language));
    tab.dataset.language = language;
    tab.dataset.allowLocked = "true";
    tab.setAttribute("role", "tab");
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const index = languages.findIndex(([item]) => item === selectedLanguage);
      const offset = event.key === "ArrowRight" ? 1 : -1;
      const nextLanguage = languages[(index + offset + languages.length) % languages.length][0];
      activate(nextLanguage);
      tabs.querySelector(`[data-language="${nextLanguage}"]`)?.focus();
    });
    tabs.append(tab);
  });
  viewer.append(tabs, code);
  activate(selectedLanguage);
  return viewer;
}

function renderEndpoint(endpoint) {
  if (!endpoint) return setSelection("overview");
  const page = pageShell("HTTP ENDPOINT", endpoint.name, `${endpoint.method} ${endpoint.path}`, [
    { label: "复制接口", onClick: () => duplicateEndpoint(endpoint) },
    { label: "删除", className: "button small danger", onClick: () => deleteEndpoint(endpoint) },
  ]);
  const basic = panel("接口定义", "维护方法、路径、目录和说明");
  const grid = document.createElement("div");
  grid.className = "form-grid";
  const methodPath = document.createElement("div");
  methodPath.className = "inline-fields";
  methodPath.append(select(endpoint.method, ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"], (value) => { endpoint.method = value; changed(true); }), input(endpoint.path, (value) => { endpoint.path = normalizePath(value); changed(); }, { change: true }));
  grid.append(field("接口名称", input(endpoint.name, (value) => { endpoint.name = value; changed(); renderTree(); }), "field full"), field("方法与路径", methodPath, "field full"), field("接口目录", select(endpoint.folderId, folderOptions(state.project.apiFolders), (value) => { endpoint.folderId = value; changed(true); })), field("接口状态", select(endpoint.status, [{ value: "developing", label: "开发中" }, { value: "testing", label: "测试中" }, { value: "released", label: "已发布" }, { value: "deprecated", label: "已废弃" }], (value) => { endpoint.status = value; changed(); })), field("接口说明", input(endpoint.description, (value) => { endpoint.description = value; changed(); }, { multiline: true }), "field full"));
  basic.querySelector(".panel-body").append(grid);
  page.append(basic);

  const parameters = panel("请求参数", "Path、Query、Header 和 Cookie 参数");
  parameters.querySelector(".panel-actions").append(button("添加参数", "button small", () => { endpoint.parameters.push({ id: createId("parameter"), name: "parameter", location: "query", description: "", required: false, schema: createPrimitiveNode("string"), example: "", rawMetadata: {} }); changed(true); }));
  renderParameters(endpoint, parameters.querySelector(".panel-body"));
  page.append(parameters);

  const request = panel("请求体", "支持 JSON、表单、文本以及模型引用");
  const requestBody = request.querySelector(".panel-body");
  const requestControls = document.createElement("div");
  requestControls.className = "request-body-controls";
  requestControls.append(select(endpoint.requestBody.mode, [
    { value: "none", label: "无请求体" }, { value: "application/json", label: "application/json" }, { value: "multipart/form-data", label: "multipart/form-data" }, { value: "application/x-www-form-urlencoded", label: "URL Encoded" }, { value: "text/plain", label: "text/plain" },
  ], (value) => { endpoint.requestBody.mode = value; endpoint.requestBody.mediaType = value === "none" ? "application/json" : value; if (value !== "none" && !endpoint.requestBody.schema) endpoint.requestBody.schema = createObjectNode(); changed(true); }));
  if (endpoint.requestBody.mode !== "none") {
    const required = document.createElement("label");
    required.className = "required-toggle";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(endpoint.requestBody.required);
    checkbox.addEventListener("change", () => { endpoint.requestBody.required = checkbox.checked; changed(); });
    required.append(checkbox, "请求体必填");
    requestControls.append(required);
  }
  requestBody.append(requestControls);
  if (endpoint.requestBody.mode !== "none") requestBody.append(renderSchemaEditor(endpoint.requestBody.schema, (next) => { endpoint.requestBody.schema = next; changed(); }, 0, { suggestedModelName: `${endpoint.name}Request` }));
  page.append(request);

  const examples = panel("请求示例", "仅生成示例代码，不会发送真实 HTTP 请求");
  const snippets = generateRequestExamples(endpoint, state.project.environments[0]?.baseUrl || "", new Map(state.project.models.map((model) => [model.id, model])));
  examples.querySelector(".panel-body").append(renderRequestExamples(endpoint, snippets));
  page.append(examples);

  const responsesPanel = panel("响应定义", "维护状态码、响应结构和示例");
  responsesPanel.querySelector(".panel-actions").append(button("添加响应", "button small", () => { endpoint.responses.push({ id: createId("response"), statusCode: "200", name: "成功", description: "", mediaType: "application/json", headers: [], schema: createObjectNode(), examples: [], external: { apifoxId: createNumericId("response") }, rawMetadata: {} }); state.responseSelection.set(endpoint.id, endpoint.responses.at(-1).id); changed(true); }));
  renderResponses(endpoint, responsesPanel.querySelector(".panel-body"));
  page.append(responsesPanel);
  applyPageLock(page);
}

function renderParameters(endpoint, container) {
  if (!endpoint.parameters.length) {
    container.innerHTML = '<div class="empty-inline">当前接口没有请求参数</div>';
    return;
  }
  const table = document.createElement("div");
  table.className = "table-wrap";
  table.innerHTML = '<table class="data-table"><thead><tr><th>名称</th><th>位置</th><th>类型</th><th class="parameter-required-heading">必填</th><th>格式与取值</th><th>说明</th><th></th></tr></thead><tbody></tbody></table>';
  const body = table.querySelector("tbody");
  endpoint.parameters.forEach((parameter) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td"); nameCell.append(input(parameter.name, (value) => { parameter.name = value; changed(); }));
    const locationCell = document.createElement("td"); locationCell.append(select(parameter.location, ["path", "query", "header", "cookie"], (value) => { parameter.location = value; if (value === "path") parameter.required = true; changed(true); }));
    const typeCell = document.createElement("td"); typeCell.append(select(parameter.schema?.type || "string", ["string", "integer", "number", "boolean"], (value) => { parameter.schema = createPrimitiveNode(value, { description: parameter.schema?.description }); changed(); }));
    const requiredCell = document.createElement("td"); requiredCell.className = "parameter-required-cell";
    const required = document.createElement("input"); required.type = "checkbox"; required.setAttribute("aria-label", `${parameter.name || "请求参数"}是否必填`); required.checked = parameter.required; required.disabled = parameter.location === "path"; required.addEventListener("change", () => { parameter.required = required.checked; changed(); }); requiredCell.append(required);
    const valueCell = document.createElement("td");
    valueCell.className = "parameter-value-cell";
    const valuePanel = renderPrimitiveValuePanel(parameter.schema);
    let valueSummary = valuePanel.querySelector(".schema-value-summary");
    if (!valueSummary) {
      valueSummary = document.createElement("div");
      valueSummary.className = "schema-value-summary";
      valuePanel.prepend(valueSummary);
    }
    const parameterExampleEditor = document.createElement("div");
    parameterExampleEditor.className = "parameter-example-editor";
    parameterExampleEditor.append(field("参数示例（可选）", renderPrimitiveValueControl(parameter.schema, parameter.example, (value) => { parameter.example = value; changed(true); })));
    valuePanel.append(parameterExampleEditor);
    const duplicatesSchemaExample = parameter.schema.examples?.some((value) => jsonValueText(value) === jsonValueText(parameter.example));
    if (parameter.example !== undefined && parameter.example !== "" && !duplicatesSchemaExample) {
      const group = document.createElement("div");
      group.className = "schema-value-group";
      group.innerHTML = `<span class="schema-value-label">参数示例</span><div class="schema-value-chips"><code class="schema-value-chip">${escapeHtml(jsonValueText(parameter.example))}</code></div>`;
      valueSummary.append(group);
    }
    if (!valueSummary.children.length) valueSummary.innerHTML = '<span class="parameter-value-empty">未设置格式、枚举、默认值、示例或约束</span>';
    valueCell.append(valuePanel);
    const descCell = document.createElement("td"); descCell.append(input(parameter.description, (value) => { parameter.description = value; changed(); }));
    const actionCell = document.createElement("td"); actionCell.append(button("删除", "button small danger", () => { endpoint.parameters = endpoint.parameters.filter((item) => item.id !== parameter.id); changed(true); }));
    row.append(nameCell, locationCell, typeCell, requiredCell, valueCell, descCell, actionCell); body.append(row);
  });
  container.append(table);
}

function renderResponses(endpoint, container) {
  if (!endpoint.responses.length) {
    container.innerHTML = '<div class="empty-inline">至少添加一个响应定义</div>';
    return;
  }
  let selectedId = state.responseSelection.get(endpoint.id);
  if (!endpoint.responses.some((response) => response.id === selectedId)) selectedId = endpoint.responses[0].id;
  state.responseSelection.set(endpoint.id, selectedId);
  const tabs = document.createElement("div"); tabs.className = "response-tabs";
  endpoint.responses.forEach((response) => {
    const tab = button(response.statusCode, `response-tab ${response.id === selectedId ? "active" : ""}`, () => { state.responseSelection.set(endpoint.id, response.id); render(); });
    tabs.append(tab);
  });
  const response = endpoint.responses.find((item) => item.id === selectedId);
  const grid = document.createElement("div"); grid.className = "form-grid"; grid.style.marginTop = "16px";
  grid.append(field("状态码", input(response.statusCode, (value) => { response.statusCode = value; changed(true); }, { change: true }), "field quarter"), field("名称", input(response.name, (value) => { response.name = value; changed(); }), "field quarter"), field("媒体类型", input(response.mediaType, (value) => { response.mediaType = value; changed(); }), "field third"), field("说明", input(response.description, (value) => { response.description = value; changed(); }), "field full"));
  const schema = renderSchemaEditor(response.schema || createObjectNode(), (next) => { response.schema = next; changed(); }, 0, { suggestedModelName: `${endpoint.name}${response.statusCode}Response` });
  const exampleValue = response.examples?.[0]?.value ?? schemaExample(response.schema, new Map(state.project.models.map((model) => [model.id, model])));
  let example;
  if (state.editUnlocked) {
    example = input(JSON.stringify(exampleValue, null, 2), (value, node) => {
      try {
        const parsed = JSON.parse(value);
        response.examples = [{ id: response.examples?.[0]?.id || createId("example"), name: "示例 1", value: parsed, description: "" }];
        node.style.borderColor = "";
        changed();
      } catch { node.style.borderColor = "var(--red)"; }
    }, { multiline: true });
    example.className = "response-example-editor";
  } else {
    example = document.createElement("pre");
    example.className = "response-example-preview";
    example.tabIndex = 0;
    example.textContent = JSON.stringify(exampleValue, null, 2);
    example.setAttribute("aria-label", "响应示例 JSON，只读预览");
  }
  container.append(tabs, grid, schema, field("响应示例 JSON", example, "field full"));
  if (endpoint.responses.length > 1) container.append(button("删除当前响应", "button small danger", () => { endpoint.responses = endpoint.responses.filter((item) => item.id !== response.id); state.responseSelection.delete(endpoint.id); changed(true); }));
}

function schemaLabel(node) {
  if (!node) return "未定义";
  if (node.kind === "reference") return "模型引用";
  if (node.kind === "composition") return node.operator;
  if (node.kind === "array") return `array<${schemaLabel(node.items)}>`;
  return node.kind === "primitive" ? node.type : "object";
}

function schemaPreviewLabel(node) {
  if (!node) return "未定义";
  if (node.kind === "reference") return state.project.models.find((model) => model.id === node.targetModelId)?.name || "失效引用";
  if (node.kind === "array") return `array<${schemaPreviewLabel(node.items)}>`;
  if (node.kind === "composition") return node.operator;
  if (node.kind === "primitive") return `${node.type}${node.enum?.length ? " · enum" : ""}${node.format ? `(${node.format})` : ""}`;
  return "object";
}

function primitiveTypeOptions() {
  const labels = { string: "字符串 String", integer: "整数 Integer", number: "数值 Number", boolean: "布尔 Boolean" };
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}

function jsonValueText(value) {
  if (value === undefined) return "";
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function enumMetadata(node) {
  const items = node?.rawMetadata?.["x-apifox-enum"];
  return Array.isArray(items) ? items : [];
}

function enumItemDetail(node, value) {
  const valueKey = jsonValueText(value);
  return enumMetadata(node).find((item) => jsonValueText(item?.value) === valueKey) || null;
}

function primitiveValueItems(node) {
  const items = [];
  if (node.format) items.push({ label: "格式", values: [node.format] });
  if (node.enum?.length) items.push({
    label: "枚举值",
    values: node.enum.map((value) => {
      const detail = enumItemDetail(node, value);
      const description = detail?.description || detail?.name || "";
      return description ? `${jsonValueText(value)} ${description}` : jsonValueText(value);
    }),
  });
  if (node.default !== undefined) items.push({ label: "默认值", values: [jsonValueText(node.default)] });
  if (node.examples?.length) items.push({ label: "示例", values: node.examples.map(jsonValueText) });
  const minimum = node.constraints?.minimum;
  const maximum = node.constraints?.maximum;
  if (minimum !== undefined || maximum !== undefined) items.push({ label: "有效范围", values: [`${minimum ?? "−∞"} ≤ 值 ≤ ${maximum ?? "+∞"}`] });
  const minLength = node.constraints?.minLength;
  const maxLength = node.constraints?.maxLength;
  if (minLength !== undefined || maxLength !== undefined) items.push({ label: "长度范围", values: [`${minLength ?? 0} ～ ${maxLength ?? "不限"}`] });
  if (node.constraints?.pattern) items.push({ label: "正则", values: [node.constraints.pattern] });
  if (node.constraints?.multipleOf !== undefined) items.push({ label: "数值步长", values: [jsonValueText(node.constraints.multipleOf)] });
  for (const [key, value] of Object.entries(node.constraints || {}).filter(([key]) => !["minimum", "maximum", "minLength", "maxLength", "pattern", "multipleOf"].includes(key))) items.push({ label: key, values: [jsonValueText(value)] });
  return items;
}

function renderEnumToggle(node) {
  const label = document.createElement("label");
  label.className = "enum-toggle";
  label.title = "可选设置：字符串、整数、数值和布尔字段都可以限制为枚举值";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(node.enum?.length);
  checkbox.addEventListener("change", () => {
    node.rawMetadata ||= {};
    if (checkbox.checked) {
      const value = nextEnumValue(node);
      node.enum = [value];
      node.rawMetadata["x-apifox-enum"] = [{ value, name: "", description: "" }];
      delete node.constraints?.minimum;
      delete node.constraints?.maximum;
      state.rangeEnabledNodes.delete(node.id);
    } else {
      node.enum = [];
      delete node.rawMetadata["x-apifox-enum"];
    }
    state.openSchemaEditors.add(node.id);
    changed(true);
  });
  label.append(checkbox, "枚举");
  return label;
}

function renderPrimitiveValueSummary(node, className = "schema-value-summary") {
  const summary = document.createElement("div");
  summary.className = className;
  for (const item of primitiveValueItems(node)) {
    const group = document.createElement("div");
    group.className = "schema-value-group";
    const label = document.createElement("span");
    label.className = "schema-value-label";
    label.textContent = item.label;
    const values = document.createElement("div");
    values.className = "schema-value-chips";
    for (const value of item.values) {
      const chip = document.createElement("code");
      chip.className = "schema-value-chip";
      chip.textContent = value;
      values.append(chip);
    }
    group.append(label, values);
    summary.append(group);
  }
  return summary;
}

function syncEnumMetadata(node) {
  const metadata = enumMetadata(node);
  if (!metadata.length && !node.enum?.length) return;
  node.rawMetadata ||= {};
  node.rawMetadata["x-apifox-enum"] = (node.enum || []).map((value) => {
    const existing = metadata.find((item) => jsonValueText(item?.value) === jsonValueText(value));
    return existing ? { ...existing, value } : { value, name: "", description: "" };
  });
}

function enumInputValue(value) {
  return typeof value === "string" ? value : jsonValueText(value);
}

function parseEnumValue(rawValue, type) {
  const value = rawValue.trim();
  if (type === "string") return rawValue;
  if (type === "integer") {
    const number = Number(value);
    if (!Number.isInteger(number)) throw new Error("请输入整数");
    return number;
  }
  if (type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error("请输入有效数值");
    return number;
  }
  if (type === "boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
    throw new Error("布尔枚举只能填写 true 或 false");
  }
  return JSON.parse(value);
}

function nextEnumValue(node) {
  if (node.type === "integer" || node.type === "number") {
    let value = 0;
    while ((node.enum || []).some((item) => item === value)) value += 1;
    return value;
  }
  if (node.type === "boolean") return !(node.enum || []).includes(false) ? false : true;
  let index = (node.enum || []).length + 1;
  let value = `VALUE_${index}`;
  while ((node.enum || []).includes(value)) value = `VALUE_${++index}`;
  return value;
}

function renderEnumEditor(node) {
  const section = document.createElement("section");
  section.className = "enum-editor field full";
  const head = document.createElement("div");
  head.className = "enum-editor-head";
  head.innerHTML = `<div><strong>枚举项</strong><small>只需填写实际取值；含义可选，但建议填写。</small></div>`;
  const add = button("添加枚举项", "button small", () => {
    node.enum ||= [];
    node.rawMetadata ||= {};
    const value = nextEnumValue(node);
    node.enum.push(value);
    const metadata = enumMetadata(node);
    node.rawMetadata["x-apifox-enum"] = [...metadata, { value, name: "", description: "" }];
    state.openSchemaEditors.add(node.id);
    changed(true);
  });
  head.append(add);
  section.append(head);
  if (!node.enum?.length) return section;

  syncEnumMetadata(node);
  const list = document.createElement("div");
  list.className = "enum-detail-list";
  node.enum.forEach((value, index) => {
    const detail = enumMetadata(node)[index];
    const row = document.createElement("div");
    row.className = "enum-detail-row";
    const valueInput = input(enumInputValue(value), (rawValue, control) => {
      try {
        const nextValue = parseEnumValue(rawValue, node.type);
        if (node.enum.some((item, itemIndex) => itemIndex !== index && jsonValueText(item) === jsonValueText(nextValue))) throw new Error("枚举值不能重复");
        node.enum[index] = nextValue;
        detail.value = nextValue;
        control.classList.remove("invalid");
        control.removeAttribute("title");
        changed(true);
      } catch (error) {
        control.classList.add("invalid");
        control.title = error.message;
        toast("枚举值格式错误", error.message, "error");
      }
    }, { change: true });
    valueInput.setAttribute("aria-label", `枚举值 ${index + 1}`);
    const descriptionInput = input(detail?.description || detail?.name || "", (description) => {
      detail.description = description;
      changed();
    }, { placeholder: "含义（可选）" });
    descriptionInput.setAttribute("aria-label", `枚举含义 ${index + 1}`);
    row.append(valueInput, descriptionInput, button("删除", "button small danger", () => {
      node.enum.splice(index, 1);
      node.rawMetadata["x-apifox-enum"].splice(index, 1);
      if (!node.enum.length) delete node.rawMetadata["x-apifox-enum"];
      changed(true);
    }));
    list.append(row);
  });
  section.append(list);
  return section;
}

function renderNumericRangeEditor(node) {
  const section = document.createElement("section");
  section.className = "range-editor field full";
  const hasRange = node.constraints?.minimum !== undefined || node.constraints?.maximum !== undefined;
  const enabled = hasRange || state.rangeEnabledNodes.has(node.id);
  const head = document.createElement("label");
  head.className = "range-editor-toggle";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = enabled;
  checkbox.addEventListener("change", () => {
    node.constraints ||= {};
    if (checkbox.checked) state.rangeEnabledNodes.add(node.id);
    else {
      state.rangeEnabledNodes.delete(node.id);
      delete node.constraints.minimum;
      delete node.constraints.maximum;
    }
    state.openSchemaEditors.add(node.id);
    changed(true);
  });
  head.append(checkbox, "定义有效范围");
  section.append(head);
  if (!enabled) return section;

  const controls = document.createElement("div");
  controls.className = "range-editor-controls";
  const updateConstraint = (key, rawValue, control) => {
    const value = rawValue.trim();
    if (!value) delete node.constraints[key];
    else {
      const number = Number(value);
      if (!Number.isFinite(number) || (node.type === "integer" && !Number.isInteger(number))) {
        control.classList.add("invalid");
        control.title = node.type === "integer" ? "请输入整数" : "请输入有效数值";
        return toast("有效范围格式错误", control.title, "error");
      }
      node.constraints[key] = number;
    }
    control.classList.remove("invalid");
    control.removeAttribute("title");
    changed();
  };
  const minimum = input(node.constraints?.minimum, (value, control) => updateConstraint("minimum", value, control), { type: "number", change: true, placeholder: "不限制" });
  const maximum = input(node.constraints?.maximum, (value, control) => updateConstraint("maximum", value, control), { type: "number", change: true, placeholder: "不限制" });
  if (node.type === "integer") {
    minimum.step = "1";
    maximum.step = "1";
  }
  controls.append(field("最小值（可选）", minimum), field("最大值（可选）", maximum));
  section.append(controls);
  return section;
}

function primitiveOptionLabel(node, value) {
  const detail = enumItemDetail(node, value);
  const description = detail?.description || detail?.name || "";
  return description ? `${enumInputValue(value)} · ${description}` : enumInputValue(value);
}

function renderPrimitiveValueControl(node, currentValue, onChange, placeholder = "未设置") {
  if (node.enum?.length) {
    const selectedIndex = node.enum.findIndex((value) => jsonValueText(value) === jsonValueText(currentValue));
    return select(selectedIndex < 0 ? "" : String(selectedIndex), [{ value: "", label: placeholder }, ...node.enum.map((value, index) => ({ value: String(index), label: primitiveOptionLabel(node, value) }))], (value) => onChange(value === "" ? undefined : node.enum[Number(value)]));
  }
  if (node.type === "boolean") {
    return select(currentValue === undefined ? "" : String(currentValue), [{ value: "", label: placeholder }, { value: "true", label: "true" }, { value: "false", label: "false" }], (value) => onChange(value === "" ? undefined : value === "true"));
  }
  const control = input(currentValue, (rawValue, inputControl) => {
    const value = rawValue.trim();
    if (!value) {
      inputControl.classList.remove("invalid");
      inputControl.removeAttribute("title");
      return onChange(undefined);
    }
    if (["integer", "number"].includes(node.type)) {
      const number = Number(value);
      if (!Number.isFinite(number) || (node.type === "integer" && !Number.isInteger(number))) {
        inputControl.classList.add("invalid");
        inputControl.title = node.type === "integer" ? "请输入整数" : "请输入有效数值";
        return toast("字段值格式错误", inputControl.title, "error");
      }
      inputControl.classList.remove("invalid");
      inputControl.removeAttribute("title");
      return onChange(number);
    }
    inputControl.classList.remove("invalid");
    inputControl.removeAttribute("title");
    onChange(rawValue);
  }, { type: ["integer", "number"].includes(node.type) ? "number" : "text", change: true, placeholder });
  if (node.type === "integer") control.step = "1";
  return control;
}

function renderStringConstraintsEditor(node) {
  const section = document.createElement("section");
  section.className = "string-constraints field full";
  section.innerHTML = '<div class="typed-setting-title"><strong>字符串限制（可选）</strong><small>留空表示不限制。</small></div>';
  const controls = document.createElement("div");
  controls.className = "typed-setting-grid";
  const updateLength = (key, rawValue, control) => {
    const value = rawValue.trim();
    if (!value) delete node.constraints[key];
    else {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 0) {
        control.classList.add("invalid");
        control.title = "请输入大于或等于 0 的整数";
        return toast("字符串长度格式错误", control.title, "error");
      }
      node.constraints[key] = number;
    }
    control.classList.remove("invalid");
    control.removeAttribute("title");
    changed();
  };
  const minLength = input(node.constraints?.minLength, (value, control) => updateLength("minLength", value, control), { type: "number", change: true, placeholder: "不限制" });
  const maxLength = input(node.constraints?.maxLength, (value, control) => updateLength("maxLength", value, control), { type: "number", change: true, placeholder: "不限制" });
  minLength.min = "0";
  maxLength.min = "0";
  minLength.step = "1";
  maxLength.step = "1";
  const pattern = input(node.constraints?.pattern || "", (value) => {
    if (value) node.constraints.pattern = value;
    else delete node.constraints.pattern;
    changed();
  }, { placeholder: "例如 ^[A-Z0-9]+$" });
  controls.append(field("最小长度", minLength), field("最大长度", maxLength), field("正则表达式", pattern));
  section.append(controls);
  return section;
}

function formatOptions(node) {
  return primitiveFormatOptions(node.type, node.format).map((value) => ({ value, label: value || "无特殊格式" }));
}

function renderDefaultExampleEditor(node) {
  const section = document.createElement("section");
  section.className = "default-example-editor field full";
  section.innerHTML = '<div class="typed-setting-title"><strong>默认值与示例</strong><small>示例未单独填写时，自动使用默认值。</small></div>';
  const controls = document.createElement("div");
  controls.className = "typed-setting-grid two-columns";
  const defaultControl = renderPrimitiveValueControl(node, node.default, (value) => {
    node.default = value;
    state.openSchemaEditors.add(node.id);
    changed(true);
  });
  const followsDefault = !node.examples?.length;
  const exampleControl = renderPrimitiveValueControl(node, followsDefault ? node.default : node.examples[0], (value) => {
    node.examples = value === undefined || jsonValueText(value) === jsonValueText(node.default) ? [] : [value];
    state.openSchemaEditors.add(node.id);
    changed(true);
  }, followsDefault && node.default !== undefined ? `跟随默认值：${enumInputValue(node.default)}` : "未设置");
  controls.append(field("默认值（可选）", defaultControl), field(followsDefault ? "示例值（跟随默认值）" : "示例值（已单独设置）", exampleControl));
  section.append(controls);
  return section;
}

function renderPrimitiveValueEditor(node) {
  const editor = document.createElement("details");
  editor.className = "schema-value-editor";
  editor.open = state.openSchemaEditors.has(node.id);
  editor.addEventListener("toggle", () => {
    if (editor.open) state.openSchemaEditors.add(node.id);
    else state.openSchemaEditors.delete(node.id);
  });
  const summary = document.createElement("summary");
  summary.innerHTML = `<span>${node.enum?.length ? "枚举设置" : "字段设置"}</span><small>${node.enum?.length ? "维护枚举值与含义" : "范围、默认值和示例均为可选"}</small>`;
  const content = document.createElement("div");
  content.className = "schema-value-editor-body form-grid";
  if (node.enum?.length) content.append(renderEnumEditor(node));
  else if (["integer", "number"].includes(node.type)) content.append(renderNumericRangeEditor(node));
  if (node.type === "string" && !node.enum?.length) content.append(renderStringConstraintsEditor(node));
  content.append(renderDefaultExampleEditor(node));
  const advanced = document.createElement("details");
  advanced.className = "schema-advanced-editor field full";
  advanced.innerHTML = '<summary>更多设置（可选）</summary>';
  const advancedGrid = document.createElement("div");
  advancedGrid.className = "form-grid";
  const nullable = document.createElement("label");
  nullable.className = "required-toggle field third";
  const nullableCheckbox = document.createElement("input");
  nullableCheckbox.type = "checkbox";
  nullableCheckbox.checked = node.nullable;
  nullableCheckbox.addEventListener("change", () => { node.nullable = nullableCheckbox.checked; changed(); });
  nullable.append(nullableCheckbox, "允许为 null");
  advancedGrid.append(field("格式 Format", select(node.format || "", formatOptions(node), (value) => { node.format = value; changed(); }), "field third"), nullable);
  if (["integer", "number"].includes(node.type)) {
    const multipleOf = input(node.constraints?.multipleOf, (value, control) => {
      const rawValue = value.trim();
      if (!rawValue) delete node.constraints.multipleOf;
      else {
        const number = Number(rawValue);
        if (!Number.isFinite(number) || number <= 0) {
          control.classList.add("invalid");
          control.title = "请输入大于 0 的数值";
          return toast("数值步长格式错误", control.title, "error");
        }
        node.constraints.multipleOf = number;
      }
      control.classList.remove("invalid");
      control.removeAttribute("title");
      changed();
    }, { type: "number", change: true, placeholder: "不限制" });
    advancedGrid.append(field("数值步长 Multiple Of", multipleOf, "field third"));
  }
  advanced.append(advancedGrid);
  content.append(advanced);
  editor.append(summary, content);
  return editor;
}

function renderPrimitiveValuePanel(node) {
  const panel = document.createElement("div");
  panel.className = "schema-value-panel";
  const summary = renderPrimitiveValueSummary(node);
  if (summary.children.length) panel.append(summary);
  panel.append(renderPrimitiveValueEditor(node));
  return panel;
}

function renderResolvedSchema(node, visitedModelIds = [], depth = 0) {
  const container = document.createElement("div");
  container.className = "resolved-schema";
  if (!node || depth > 7) {
    container.innerHTML = '<div class="resolved-notice">结构层级过深，已停止展开。</div>';
    return container;
  }
  if (node.kind === "reference") {
    container.append(renderReferencePreview(node, visitedModelIds, depth));
    return container;
  }
  if (node.kind === "composition") {
    node.members.forEach((member, index) => {
      const group = document.createElement("section");
      group.className = "resolved-composition";
      group.innerHTML = `<div class="resolved-composition-title"><span>${escapeHtml(node.operator)} #${index + 1}</span><small>${escapeHtml(schemaPreviewLabel(member))}</small></div>`;
      group.append(renderResolvedSchema(member, visitedModelIds, depth + 1));
      container.append(group);
    });
    return container;
  }
  if (node.kind === "array") {
    const group = document.createElement("section");
    group.className = "resolved-composition";
    group.innerHTML = `<div class="resolved-composition-title"><span>数组元素</span><small>${escapeHtml(schemaPreviewLabel(node.items))}</small></div>`;
    if (["object", "reference", "composition", "array"].includes(node.items?.kind)) group.append(renderResolvedSchema(node.items, visitedModelIds, depth + 1));
    container.append(group);
    return container;
  }
  if (node.kind !== "object") {
    container.innerHTML = `<div class="resolved-notice">${escapeHtml(schemaPreviewLabel(node))}${node.description ? ` · ${escapeHtml(node.description)}` : ""}</div>`;
    if (node.kind === "primitive") {
      const values = renderPrimitiveValueSummary(node, "resolved-field-values");
      if (values.children.length) container.append(values);
    }
    return container;
  }
  const fields = document.createElement("div");
  fields.className = "resolved-fields";
  for (const member of node.members || []) {
    if (member.kind === "reference") {
      fields.append(renderReferencePreview(member, visitedModelIds, depth + 1));
      continue;
    }
    const fieldNode = document.createElement("div");
    fieldNode.className = "resolved-field";
    fieldNode.innerHTML = `<div class="resolved-field-line"><code>${escapeHtml(member.name)}</code><span class="resolved-type">${escapeHtml(schemaPreviewLabel(member.schema))}</span>${member.required ? '<span class="resolved-required">必填</span>' : '<span class="resolved-optional">可选</span>'}<p>${escapeHtml(member.schema?.description || "暂无字段说明")}</p></div>`;
    if (member.schema?.kind === "primitive") {
      const values = renderPrimitiveValueSummary(member.schema, "resolved-field-values");
      if (values.children.length) fieldNode.append(values);
    }
    if (["object", "reference", "composition", "array"].includes(member.schema?.kind)) {
      const nested = document.createElement("div");
      nested.className = "resolved-field-nested";
      nested.append(renderResolvedSchema(member.schema, visitedModelIds, depth + 1));
      fieldNode.append(nested);
    }
    fields.append(fieldNode);
  }
  if (!fields.children.length) fields.innerHTML = '<div class="resolved-notice">该对象暂未定义字段。</div>';
  container.append(fields);
  return container;
}

function renderReferencePreview(reference, visitedModelIds = [], depth = 0) {
  const model = state.project.models.find((item) => item.id === reference.targetModelId);
  const preview = document.createElement("details");
  preview.className = "reference-preview";
  preview.open = true;
  if (!model) {
    preview.innerHTML = `<summary>${icons.info}<span>失效模型引用</span></summary><div class="resolved-notice">找不到 ${escapeHtml(reference.sourceRef || reference.targetModelId || "目标模型")}。</div>`;
    return preview;
  }
  const cyclic = visitedModelIds.includes(model.id);
  const summary = document.createElement("summary");
  summary.innerHTML = `${icons.link}<span><strong>${escapeHtml(model.name)}</strong><small>${escapeHtml(schemaPreviewLabel(model.root))} · ${cyclic ? "循环引用" : "展开字段结构"}</small></span>`;
  preview.append(summary);
  const body = document.createElement("div");
  body.className = "reference-preview-body";
  const actions = document.createElement("div");
  actions.className = "reference-preview-actions";
  actions.innerHTML = `<span>来源模型：${escapeHtml(folderPath(state.project.modelFolders, model.folderId))} / ${escapeHtml(model.name)}</span>`;
  const openButton = button("查看模型", "button small", () => setSelection("model", model.id));
  openButton.dataset.allowLocked = "true";
  actions.append(openButton);
  body.append(actions);
  if (cyclic) body.insertAdjacentHTML("beforeend", '<div class="resolved-notice">检测到循环引用，已停止继续展开。</div>');
  else body.append(renderResolvedSchema(model.root, [...visitedModelIds, model.id], depth + 1));
  preview.append(body);
  return preview;
}

function convertSchema(node, type) {
  const common = { title: node?.title || "", description: node?.description || "", examples: node?.examples || [] };
  if (type === "object") return createObjectNode(common);
  if (type === "array") return createArrayNode(createPrimitiveNode("string"), common);
  if (type === "reference") return createReferenceNode(state.project.models[0]?.id || null, common);
  if (["allOf", "oneOf", "anyOf"].includes(type)) return createCompositionNode(type, [], common);
  return createPrimitiveNode(type, common);
}

function countInferredFields(node) {
  if (!node) return 0;
  if (node.kind === "object") return (node.members || []).reduce((sum, member) => sum + (member.kind === "property" ? 1 + countInferredFields(member.schema) : 0), 0);
  if (node.kind === "array") return countInferredFields(node.items);
  return 0;
}

function hasSchemaExampleContent(node) {
  if (!node) return false;
  if (node.examples?.length) return true;
  if (node.kind === "object") return Boolean(node.members?.length);
  if (node.kind === "array") return Boolean(node.items);
  return false;
}

function jsonErrorLocation(source, error) {
  const lineColumn = String(error?.message || "").match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineColumn) return `第 ${lineColumn[1]} 行，第 ${lineColumn[2]} 列附近`;
  const positionMatch = String(error?.message || "").match(/position\s+(\d+)/i);
  if (!positionMatch) return "输入内容中";
  const position = Math.min(Number(positionMatch[1]), source.length);
  const before = source.slice(0, position);
  const line = before.split("\n").length;
  const lastLineBreak = before.lastIndexOf("\n");
  const column = position - lastLineBreak;
  return `第 ${line} 行，第 ${column} 列附近`;
}

function nextModelName(suggestedName = "ExtractedModel") {
  const words = String(suggestedName || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9_\u3400-\u9fff]+/)
    .filter(Boolean);
  let base = words.map((word) => /^[A-Za-z]/.test(word) ? `${word[0].toUpperCase()}${word.slice(1)}` : word).join("") || "ExtractedModel";
  if (/^[0-9]/.test(base)) base = `Model${base}`;
  let name = base;
  let suffix = 2;
  while (state.project.models.some((model) => model.name === name)) name = `${base}${suffix++}`;
  return name;
}

function showExtractSchemaModal(node, replace, options = {}) {
  const content = document.createElement("div");
  content.className = "schema-extract-form";
  const notice = document.createElement("div");
  notice.className = "schema-extract-notice";
  notice.innerHTML = `${icons.link}<div><strong>原位置将替换为模型引用</strong><p>${escapeHtml(schemaPreviewLabel(node))} 的完整结构、默认值、示例和约束会复制到新模型；字段名与必填状态保持不变。</p></div>`;
  const nameControl = input(nextModelName(options.suggestedModelName), () => {}, { placeholder: "例如 DeviceEvent" });
  nameControl.setAttribute("aria-label", "模型名称");
  const rootFolder = state.project.modelFolders.find((folder) => folder.parentId === null);
  const folderControl = select(options.folderId || rootFolder?.id || "", folderOptions(state.project.modelFolders), () => {});
  content.append(notice, field("模型名称", nameControl), field("模型目录", folderControl));
  showModal("提取为数据模型", content, [
    { label: "取消", onClick: closeModal },
    { label: "提取并引用", className: "button primary", onClick: () => {
      try {
        const { model, reference } = extractSchemaToModel(state.project, node, { name: nameControl.value, folderId: folderControl.value });
        replace(reference);
        closeModal();
        changed(true);
        toast("模型提取完成", `已创建 ${model.name}，原位置已替换为引用`);
      } catch (error) {
        nameControl.classList.add("invalid");
        nameControl.title = error.message;
        nameControl.focus();
        toast("无法提取模型", error.message, "error");
      }
    } },
  ]);
}

function showSchemaExampleGenerator(node, replace) {
  const content = document.createElement("div");
  content.className = "schema-example-generator";
  const hint = document.createElement("p");
  hint.className = "schema-example-hint";
  const modelIndex = new Map(state.project.models.map((model) => [model.id, model]));
  const initialValue = hasSchemaExampleContent(node) ? JSON.stringify(schemaExample(node, modelIndex), null, 2) : "";
  hint.textContent = initialValue
    ? "已加载当前位置的字段和值。修改 JSON 后生成，将替换当前位置的结构。"
    : "粘贴对象或数组 JSON，将替换当前位置的结构，并根据叶子值生成字段类型和默认值。";
  let generateButton = null;
  const source = input(initialValue, () => validateSource(), { multiline: true, placeholder: '{\n  "code": 200,\n  "message": "success",\n  "data": {}\n}' });
  source.className = "schema-example-source";
  source.setAttribute("aria-label", "JSON 示例");
  source.setAttribute("aria-describedby", "schema-example-validation");
  source.spellcheck = false;
  const validation = document.createElement("div");
  validation.id = "schema-example-validation";
  validation.className = "schema-example-validation";
  validation.setAttribute("role", "status");
  validation.setAttribute("aria-live", "polite");
  const options = document.createElement("div");
  options.className = "schema-example-options";
  const requiredLabel = document.createElement("label");
  const required = document.createElement("input");
  required.type = "checkbox";
  requiredLabel.append(required, "示例中出现的字段标记为必填");
  const exampleLabel = document.createElement("label");
  const includeExample = document.createElement("input");
  includeExample.type = "checkbox";
  includeExample.checked = true;
  exampleLabel.append(includeExample, "同时保存原 JSON 为示例");
  options.append(requiredLabel, exampleLabel);
  content.append(hint, source, validation, options);
  function validateSource() {
    const text = source.value.trim();
    source.classList.remove("invalid");
    source.removeAttribute("title");
    source.setAttribute("aria-invalid", "false");
    validation.className = "schema-example-validation";
    if (!text) {
      validation.textContent = "请输入 JSON 对象或数组后再生成字段。";
      if (generateButton) generateButton.disabled = true;
      return null;
    }
    try {
      const value = JSON.parse(text);
      if (value === null || typeof value !== "object") throw new TypeError("根节点必须是 JSON 对象或数组");
      const inferred = inferSchemaFromExample(value, { required: required.checked, includeExample: includeExample.checked });
      const rootType = Array.isArray(value) ? "数组 Array" : "对象 Object";
      validation.classList.add("valid");
      validation.textContent = `JSON 格式正确 · 根节点：${rootType} · 可推导 ${countInferredFields(inferred)} 个命名字段`;
      if (generateButton) generateButton.disabled = false;
      return value;
    } catch (error) {
      const message = error instanceof SyntaxError
        ? `JSON 格式错误：${jsonErrorLocation(source.value, error)}，请检查逗号、引号或括号。`
        : error.message;
      source.classList.add("invalid");
      source.setAttribute("aria-invalid", "true");
      source.title = message;
      validation.classList.add("error");
      validation.textContent = message;
      if (generateButton) generateButton.disabled = true;
      return null;
    }
  }
  showModal("从 JSON 示例生成字段", content, [
    { label: "取消", onClick: closeModal },
    { label: "生成字段", className: "button primary", onClick: () => {
      const value = validateSource();
      if (!value) return;
      const next = inferSchemaFromExample(value, { required: required.checked, includeExample: includeExample.checked });
      replace(next);
      closeModal();
      changed(true);
      toast("字段生成完成", `已生成 ${countInferredFields(next)} 个字段`);
    } },
  ]);
  generateButton = [...elements.modalRoot.querySelectorAll(".modal-actions button")].find((item) => item.textContent.trim() === "生成字段");
  validateSource();
  source.focus();
}

function renderSchemaEditor(node, replace, depth, options = {}) {
  const root = document.createElement("div"); root.className = "schema-editor";
  const toolbar = document.createElement("div"); toolbar.className = "schema-toolbar";
  const currentType = node?.kind === "primitive" ? node.type : node?.kind === "composition" ? node.operator : node?.kind || "object";
  toolbar.append(select(currentType, [
    { value: "object", label: "对象 Object" }, { value: "array", label: "数组 Array" }, ...primitiveTypeOptions(), { value: "reference", label: "模型引用 $ref" }, { value: "allOf", label: "组合 allOf" }, { value: "oneOf", label: "选择 oneOf" }, { value: "anyOf", label: "任一 anyOf" },
  ], (value) => { replace(convertSchema(node, value)); changed(true); }));
  if (["object", "array"].includes(node?.kind)) {
    const generate = button("JSON 生成字段", "button small schema-generate-button", () => showSchemaExampleGenerator(node, replace));
    generate.title = "粘贴 JSON 示例，自动生成当前位置的字段结构";
    toolbar.append(generate);
  }
  if (node && node.kind !== "reference" && options.allowExtract !== false) {
    const extract = button("提取为模型", "button small schema-extract-button", () => showExtractSchemaModal(node, replace, options));
    extract.title = "创建独立数据模型，并将当前位置替换为模型引用";
    toolbar.append(extract);
  }
  if (node?.kind === "primitive") toolbar.append(renderEnumToggle(node));
  const summary = document.createElement("span"); summary.className = "schema-summary"; summary.textContent = depth ? `层级 ${depth + 1}` : "根结构"; toolbar.append(summary); root.append(toolbar);
  if (!node) return root;

  if (node.kind === "primitive") {
    const grid = document.createElement("div"); grid.className = "form-grid";
    grid.append(field("说明", input(node.description, (value) => { node.description = value; changed(); }), "field full"));
    root.append(grid, renderPrimitiveValuePanel(node)); return root;
  }
  if (node.kind === "reference") {
    const row = document.createElement("div"); row.className = "schema-member";
    const content = document.createElement("div"); content.className = "schema-row reference"; content.innerHTML = `<span class="reference-chip">${icons.link}模型引用</span>`;
    const openModel = button("查看模型", "button small", () => { if (node.targetModelId) setSelection("model", node.targetModelId); });
    openModel.dataset.allowLocked = "true";
    content.append(select(node.targetModelId || "", [{ value: "", label: "选择数据模型" }, ...state.project.models.map((model) => ({ value: model.id, label: model.name }))], (value) => { node.targetModelId = value || null; node.broken = !value; changed(true); }), input(node.description, (value) => { node.description = value; changed(); }, { placeholder: "当前引用的补充说明" }), openModel);
    row.append(content); root.append(row, renderReferencePreview(node, [], depth)); return root;
  }
  if (node.kind === "array") {
    const nested = document.createElement("div"); nested.className = "schema-nested";
    nested.append(renderSchemaEditor(node.items, (next) => { node.items = next; replace(node); }, depth + 1, { ...options, allowExtract: true, suggestedModelName: `${options.suggestedModelName || "Array"}Item` }));
    root.append(nested); return root;
  }
  if (node.kind === "composition") {
    node.members.forEach((member, index) => {
      const wrapper = document.createElement("div"); wrapper.className = "schema-member";
      const head = document.createElement("div"); head.className = "panel-head"; head.innerHTML = `<h3>${node.operator} #${index + 1}</h3>`; head.append(button("删除", "button small danger", () => { node.members.splice(index, 1); replace(node); changed(true); }));
      const nested = document.createElement("div"); nested.className = "schema-nested"; nested.append(renderSchemaEditor(member, (next) => { node.members[index] = next; replace(node); }, depth + 1, { ...options, allowExtract: true, suggestedModelName: `${options.suggestedModelName || "Composition"}${index + 1}` }));
      wrapper.append(head, nested); root.append(wrapper);
    });
    root.append(button("添加组合成员", "button small", () => { node.members.push(createReferenceNode(state.project.models[0]?.id || null, { mode: "composition" })); replace(node); changed(true); }));
    return root;
  }
  for (const member of node.members || []) {
    const wrapper = document.createElement("div"); wrapper.className = "schema-member";
    if (member.kind === "reference") {
      const row = document.createElement("div"); row.className = "schema-row reference"; row.innerHTML = `<span class="reference-chip">${icons.link}引用字段组</span>`;
      row.append(select(member.targetModelId || "", [{ value: "", label: "选择数据模型" }, ...state.project.models.map((model) => ({ value: model.id, label: model.name }))], (value) => { member.targetModelId = value || null; member.broken = !value; changed(true); }), input(member.description, (value) => { member.description = value; changed(); }, { placeholder: "引用说明" }), button("删除", "button small danger", () => { node.members = node.members.filter((item) => item.id !== member.id); replace(node); changed(true); })); wrapper.append(row, renderReferencePreview(member, [], depth));
    } else {
      const row = document.createElement("div"); row.className = "schema-row";
      const typeControl = document.createElement("div");
      typeControl.className = "schema-type-control";
      typeControl.append(select(member.schema.kind === "primitive" ? member.schema.type : member.schema.kind === "composition" ? member.schema.operator : member.schema.kind, [...primitiveTypeOptions(), { value: "object", label: "对象 Object" }, { value: "array", label: "数组 Array" }, { value: "reference", label: "模型引用" }, "allOf", "oneOf", "anyOf"], (value) => { member.schema = convertSchema(member.schema, value); replace(node); changed(true); }));
      if (member.schema.kind === "primitive") typeControl.append(renderEnumToggle(member.schema));
      row.append(input(member.name, (value) => { member.name = value; changed(); }), typeControl);
      const required = document.createElement("label"); required.className = "required-toggle"; const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = member.required; checkbox.addEventListener("change", () => { member.required = checkbox.checked; changed(); }); required.append(checkbox, "必填"); row.append(required, input(member.schema.description, (value) => { member.schema.description = value; changed(); }, { placeholder: "字段说明" }));
      const rowActions = document.createElement("div");
      rowActions.className = "schema-row-actions";
      rowActions.append(
        button("提取模型", "button small schema-extract-button", () => showExtractSchemaModal(member.schema, (next) => { member.schema = next; replace(node); }, { ...options, suggestedModelName: member.name })),
        button("删除", "button small danger", () => { node.members = node.members.filter((item) => item.id !== member.id); replace(node); changed(true); }),
      );
      row.append(rowActions);
      wrapper.append(row);
      if (member.schema.kind === "primitive") wrapper.append(renderPrimitiveValuePanel(member.schema));
      if (["object", "array", "reference", "composition"].includes(member.schema.kind)) {
        const nested = document.createElement("div"); nested.className = "schema-nested"; nested.append(renderSchemaEditor(member.schema, (next) => { member.schema = next; replace(node); }, depth + 1, { ...options, allowExtract: member.schema.kind === "array", suggestedModelName: member.name })); wrapper.append(nested);
      }
    }
    root.append(wrapper);
  }
  const actions = document.createElement("div"); actions.className = "schema-toolbar";
  actions.append(button("添加字段", "button small", () => { node.members.push(createProperty(`field${node.members.filter((member) => member.kind === "property").length + 1}`, createPrimitiveNode("string"))); replace(node); changed(true); }), button("引用模型字段", "button small", () => { node.members.push(createReferenceNode(state.project.models[0]?.id || null, { mode: "fieldGroup" })); replace(node); changed(true); })); root.append(actions);
  return root;
}

function renderModel(model) {
  if (!model) return setSelection("overview");
  const references = buildReferenceIndex(state.project).get(model.id) || [];
  const page = pageShell("DATA SCHEMA", model.name, `${schemaLabel(model.root)} · ${references.length} 个引用位置`, [
    { label: "预览数据", icon: "eye", onClick: () => showModelPreview(model), allowLocked: true },
    { label: "复制模型", onClick: () => duplicateModel(model) },
    { label: "删除", className: "button small danger", onClick: () => deleteModel(model) },
  ]);
  const basic = panel("模型定义", "模型名称可以修改，内部引用使用稳定 ID，不会因此失效");
  const grid = document.createElement("div"); grid.className = "form-grid";
  grid.append(field("模型名称", input(model.name, (value) => { model.name = value; changed(); renderTree(); })), field("模型目录", select(model.folderId, folderOptions(state.project.modelFolders), (value) => { model.folderId = value; changed(true); })), field("模型说明", input(model.description, (value) => { model.description = value; changed(); }, { multiline: true }), "field full")); basic.querySelector(".panel-body").append(grid); page.append(basic);
  const schema = panel("字段与引用", "引用字段默认跟随原模型更新；需要独立修改时请转换为普通字段");
  schema.querySelector(".panel-body").append(renderSchemaEditor(model.root, (next) => { model.root = next; changed(); }, 0, { suggestedModelName: `${model.name}Part`, folderId: model.folderId })); page.append(schema);
  const usage = panel("引用位置", "查看该模型被哪些接口或其他模型使用");
  const list = document.createElement("div"); list.className = "reference-list";
  if (!references.length) list.innerHTML = '<div class="empty-inline">当前模型尚未被引用</div>';
  references.forEach(({ owner }) => {
    const item = document.createElement("button"); item.type = "button"; item.className = "reference-item"; item.innerHTML = `<span><strong>${escapeHtml(owner.name)}</strong><br><small>${owner.type === "model" ? "数据模型" : owner.type === "request" ? "请求体" : `响应 ${owner.statusCode || ""}`}</small></span><span>${icons.arrow}</span>`; item.addEventListener("click", () => setSelection(owner.type === "model" ? "model" : "endpoint", owner.id)); list.append(item);
  }); usage.querySelector(".panel-body").append(list); page.append(usage);
  applyPageLock(page);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {}
  }
  const control = document.createElement("textarea");
  control.value = text;
  control.style.position = "fixed";
  control.style.opacity = "0";
  document.body.append(control);
  control.select();
  const copied = document.execCommand("copy");
  control.remove();
  if (!copied) throw new Error("浏览器未允许复制，请手动选择预览内容");
}

function showModelPreview(model) {
  const modelIndex = new Map(state.project.models.map((item) => [item.id, item]));
  const content = document.createElement("div");
  content.className = "model-preview";
  const toolbar = document.createElement("div");
  toolbar.className = "model-preview-toolbar";
  toolbar.innerHTML = `<div><strong>${escapeHtml(model.name)}</strong><small>优先使用字段示例、默认值和枚举；缺失值按类型与格式生成。</small></div>`;
  const actions = document.createElement("div");
  actions.className = "model-preview-actions";
  const viewer = document.createElement("div");
  viewer.className = "model-preview-viewer";
  const lineNumbers = document.createElement("pre");
  lineNumbers.className = "model-preview-lines";
  lineNumbers.setAttribute("aria-hidden", "true");
  const code = document.createElement("pre");
  code.className = "model-preview-code";
  code.tabIndex = 0;
  code.setAttribute("aria-label", `${model.name} JSON 数据预览`);
  const updatePreview = () => {
    const text = JSON.stringify(generateSchemaPreview(model.root, modelIndex), null, 2);
    code.textContent = text;
    lineNumbers.textContent = text.split("\n").map((_, index) => index + 1).join("\n");
  };
  const refresh = button("重新生成", "button small", updatePreview);
  refresh.innerHTML = `${icons.refresh}重新生成`;
  const copy = button("复制 JSON", "button small", async () => {
    try {
      await copyText(code.textContent);
      toast("复制完成", `${model.name} 预览 JSON 已复制`);
    } catch (error) {
      toast("复制失败", error.message, "error");
    }
  });
  copy.innerHTML = `${icons.copy}复制 JSON`;
  actions.append(refresh, copy);
  toolbar.append(actions);
  viewer.append(lineNumbers, code);
  updatePreview();
  content.append(toolbar, viewer);
  showModal(`数据预览 · ${model.name}`, content, [{ label: "关闭", onClick: closeModal }]);
  elements.modalRoot.querySelector(".modal")?.classList.add("model-preview-modal");
}

function renderDocument(doc) {
  if (!doc) return setSelection("overview");
  const page = pageShell("MARKDOWN PAGE", doc.name, "自定义文档会写入 Apifox 项目和 Markdown 输出", [{ label: "删除", className: "button small danger", onClick: () => showDeleteConfirmation("文档", doc.name, () => { state.project.documents = state.project.documents.filter((item) => item.id !== doc.id); state.selection = { type: "overview", id: null }; changed(true); toast("文档已删除", doc.name); }) }]);
  const editor = panel("文档内容", "支持 Markdown；Apifox 的 DataSchema 标签会原样保留");
  const grid = document.createElement("div"); grid.className = "form-grid";
  const content = input(doc.content, (value) => { doc.content = value; changed(); }, { multiline: true }); content.style.minHeight = "420px";
  grid.append(field("文档名称", input(doc.name, (value) => { doc.name = value; changed(); renderTree(); }), "field full"), field("Markdown", content, "field full")); editor.querySelector(".panel-body").append(grid); page.append(editor);
  applyPageLock(page);
}

function addEndpoint() {
  const folder = state.project.apiFolders.find((item) => item.parentId !== null) || state.project.apiFolders[0];
  const endpoint = createEndpoint(state.project, folder?.id); state.selection = { type: "endpoint", id: endpoint.id }; state.editUnlocked = true; changed(true);
}

function addModel() {
  const folder = state.project.modelFolders.find((item) => item.parentId !== null) || state.project.modelFolders[0];
  const model = createModel(state.project, `NewModel${state.project.models.length + 1}`, "object", folder?.id); state.selection = { type: "model", id: model.id }; state.editUnlocked = true; changed(true);
}

function addDocument() {
  const document = { id: createId("doc"), name: `新建文档 ${state.project.documents.length + 1}`, path: [], content: "# 新建文档\n", order: state.project.documents.length, external: {}, rawMetadata: {} };
  state.project.documents.push(document); state.selection = { type: "doc", id: document.id }; state.editUnlocked = true; changed(true);
}

function duplicateEndpoint(endpoint) {
  const copy = structuredClone(endpoint); copy.id = createId("endpoint"); copy.name = `${endpoint.name} 副本`; copy.path = `${endpoint.path}-copy`; copy.external = {}; state.project.endpoints.push(copy); state.selection = { type: "endpoint", id: copy.id }; state.editUnlocked = true; changed(true);
}

function duplicateModel(model) {
  const copy = structuredClone(model); copy.id = createId("model"); copy.name = `${model.name}Copy`; copy.external = { openapiKey: copy.name }; state.project.models.push(copy); state.selection = { type: "model", id: copy.id }; state.editUnlocked = true; changed(true);
}

function deleteEndpoint(endpoint) {
  showDeleteConfirmation("接口", endpoint.name, () => {
    state.project.endpoints = state.project.endpoints.filter((item) => item.id !== endpoint.id);
    state.responseSelection.delete(endpoint.id);
    state.selection = { type: "overview", id: null };
    changed(true);
    toast("接口已删除", endpoint.name);
  });
}

function deleteModel(model) {
  const references = buildReferenceIndex(state.project).get(model.id) || [];
  if (references.length) return toast("模型仍被引用", `请先处理 ${references.length} 个引用位置。`, "error");
  showDeleteConfirmation("数据模型", model.name, () => {
    state.project.models = state.project.models.filter((item) => item.id !== model.id);
    state.selection = { type: "overview", id: null };
    changed(true);
    toast("数据模型已删除", model.name);
  });
}

async function handleFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  showModal("正在导入", `<div class="empty-inline">正在解析 ${files.length} 个文件，请稍候…</div>`);
  const results = [];
  for (const file of files) {
    try { results.push({ file, project: await importProjectFile(file), error: null }); }
    catch (error) { results.push({ file, project: null, error }); }
  }
  const valid = results.filter((result) => result.project);
  if (!valid.length) {
    showModal("导入失败", `<div class="issues">${results.map((result) => `<div class="issue error"><span>${icons.info}</span><div><strong>${escapeHtml(result.file.name)}</strong><p>${escapeHtml(result.error?.message || "无法解析")}</p></div></div>`).join("")}</div>`, [{ label: "关闭", onClick: closeModal }]);
    return;
  }
  const priority = { apifox: 4, "markdown-metadata": 4, openapi: 3, swagger: 2, markdown: 1 };
  valid.sort((a, b) => (priority[b.project.source.type] || 0) - (priority[a.project.source.type] || 0));
  const chosen = valid[0];
  state.project = chosen.project;
  state.project.source.files = files.map((file) => file.name);
  state.selection = { type: "overview", id: null };
  state.editUnlocked = false;
  await saveProject(state.project);
  const report = document.createElement("div");
  report.innerHTML = `<div class="metric-grid"><div class="metric"><strong>${state.project.endpoints.length}</strong><span>识别接口</span></div><div class="metric"><strong>${state.project.models.length}</strong><span>识别模型</span></div><div class="metric"><strong>${[...buildReferenceIndex(state.project).values()].reduce((sum, items) => sum + items.length, 0)}</strong><span>模型引用</span></div><div class="metric"><strong>${state.project.source.warnings?.length || 0}</strong><span>导入警告</span></div></div><div class="issues" style="margin-top:16px">${results.map((result) => `<div class="issue ${result.error ? "error" : ""}"><span>${result.error ? icons.info : icons.check}</span><div><strong>${escapeHtml(result.file.name)}</strong><p>${result.error ? escapeHtml(result.error.message) : `已识别为 ${escapeHtml(result.project.source.type)}${result === chosen ? "，用作主数据源" : "，检测为同批辅助文件"}`}</p></div></div>`).join("")}</div>`;
  showModal("导入完成", report, [{ label: "进入项目", className: "button primary", onClick: () => { closeModal(); render(); } }]);
  updateCounters(); renderTree();
}

function showExport() {
  const issues = validateProject(state.project);
  const content = document.createElement("div");
  content.innerHTML = `${issues.some((issue) => issue.level === "error") ? `<div class="issue error" style="margin-bottom:14px"><span>${icons.info}</span><div><strong>项目存在导出错误</strong><p>建议先完成校验；仍可导出项目备份。</p></div></div>` : ""}<div class="export-grid"></div>`;
  const grid = content.querySelector(".export-grid");
  const formats = [
    ["apifox", "Apifox 项目 JSON", "保留接口目录、模型目录、引用槽位和项目元数据。", ".apifox.json", "application/json"],
    ["openapi", "OpenAPI YAML", "标准 OpenAPI 3.x 文档，模型引用写入 components.schemas。", ".openapi.yaml", "application/yaml"],
    ["markdown", "Markdown 文档", "纯文档格式，包含全部接口、请求示例、响应结构和数据模型。", ".md", "text/markdown"],
    ["backup", "接口工坊备份", "无损保存全部编辑状态，适合继续维护。", ".api-workbench.json", "application/json"],
  ];
  formats.forEach(([key, title, description, suffix, mime]) => {
    const card = button("", "export-card", () => {
      try {
        const files = exportProjectFiles(state.project);
        downloadText(`${slugify(state.project.name, "api-project")}${suffix}`, files[key], mime);
        toast("导出完成", title);
      } catch (error) { toast("导出失败", error.message, "error"); }
    });
    card.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span>`;
    grid.append(card);
  });
  showModal("导出项目", content, [{ label: "关闭", onClick: closeModal }]);
}

function showValidation() {
  const issues = validateProject(state.project);
  const content = document.createElement("div");
  if (!issues.length) content.innerHTML = `<div class="empty-inline">${icons.check}<br><strong>校验通过</strong><br>未发现重复接口、失效引用或模型命名问题。</div>`;
  else content.innerHTML = `<div class="issues">${issues.map((issue) => `<div class="issue ${issue.level}"><span>${icons.info}</span><div><strong>${escapeHtml(issue.code)}</strong><p>${escapeHtml(issue.message)}</p></div></div>`).join("")}</div>`;
  showModal(`项目校验 · ${issues.length} 个问题`, content, [{ label: "关闭", onClick: closeModal }]);
}

document.querySelectorAll(".nav-tab").forEach((tab) => tab.addEventListener("click", () => { state.nav = tab.dataset.nav; state.selection = { type: "overview", id: null }; state.editUnlocked = false; render(); }));
document.querySelector("#home-button").addEventListener("click", () => setSelection("overview"));
document.querySelector("#add-resource").addEventListener("click", () => state.nav === "apis" ? addEndpoint() : state.nav === "models" ? addModel() : addDocument());
document.querySelector("#import-button").addEventListener("click", () => elements.fileInput.click());
document.querySelector("#export-button").addEventListener("click", showExport);
document.querySelector("#validate-button").addEventListener("click", showValidation);
elements.fileInput.addEventListener("change", () => { handleFiles(elements.fileInput.files); elements.fileInput.value = ""; });
elements.search.addEventListener("input", () => { state.search = elements.search.value; renderTree(); });
elements.projectName.addEventListener("input", () => { state.project.name = elements.projectName.value; changed(); });
initializeSidebarResizer();

let dragDepth = 0;
document.addEventListener("dragenter", (event) => { event.preventDefault(); dragDepth += 1; elements.dropOverlay.classList.remove("hidden"); });
document.addEventListener("dragleave", () => { dragDepth -= 1; if (dragDepth <= 0) elements.dropOverlay.classList.add("hidden"); });
document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", (event) => { event.preventDefault(); dragDepth = 0; elements.dropOverlay.classList.add("hidden"); handleFiles(event.dataTransfer.files); });

try {
  const saved = await loadLastProject();
  if (saved?.format === "api-workbench") state.project = saved;
} catch (error) {
  toast("读取本地项目失败", error.message, "error");
}
render();
