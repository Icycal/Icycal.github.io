import { buildLinuxProcessGroups, buildMcuLayout, buildSimulatedLayout, parseAddress, simulatedAddressFor } from './simulation.js';
import { explainMemoryItem } from './memory-help.js';

const elements = {
  emptyState: document.querySelector('#empty-state'),
  workspace: document.querySelector('#workspace'),
  fileInput: document.querySelector('#file-input'),
  folderInput: document.querySelector('#folder-input'),
  openFileButton: document.querySelector('#open-file-button'),
  openFolderButton: document.querySelector('#open-folder-button'),
  replaceFileButton: document.querySelector('#replace-file-button'),
  dropZone: document.querySelector('#drop-zone'),
  loadingPanel: document.querySelector('#loading-panel'),
  loadingMessage: document.querySelector('#loading-message'),
  loadingProgress: document.querySelector('.loading-progress'),
  loadingProgressBar: document.querySelector('#loading-progress-bar'),
  loadingDetail: document.querySelector('#loading-detail'),
  errorPanel: document.querySelector('#error-panel'),
  errorMessage: document.querySelector('#error-message'),
  retryButton: document.querySelector('#retry-button'),
  fileName: document.querySelector('#file-name'),
  fileMeta: document.querySelector('#file-meta'),
  fileIcon: document.querySelector('#file-icon'),
  parserStatus: document.querySelector('#parser-status'),
  symbolCountBadge: document.querySelector('#symbol-count-badge'),
  globalSearch: document.querySelector('#global-search'),
  viewKicker: document.querySelector('#view-kicker'),
  viewTitle: document.querySelector('#view-title'),
  metricGrid: document.querySelector('#metric-grid'),
  regionList: document.querySelector('#region-list'),
  memoryLegend: document.querySelector('#memory-legend'),
  regionPanelKicker: document.querySelector('#region-panel-kicker'),
  regionPanelTitle: document.querySelector('#region-panel-title'),
  compositionDonut: document.querySelector('#composition-donut'),
  compositionLegend: document.querySelector('#composition-legend'),
  largestSymbols: document.querySelector('#largest-symbols'),
  infoList: document.querySelector('#info-list'),
  addressLayout: document.querySelector('#address-layout'),
  treemapLayout: document.querySelector('#treemap-layout'),
  simulationView: document.querySelector('#simulation-view'),
  linuxSimulationControls: document.querySelector('#linux-simulation-controls'),
  processContext: document.querySelector('#process-context'),
  processSelector: document.querySelector('#process-selector'),
  processContextDetail: document.querySelector('#process-context-detail'),
  mcuSimulationInfo: document.querySelector('#mcu-simulation-info'),
  simulationRecommendation: document.querySelector('#simulation-recommendation'),
  simulationBase: document.querySelector('#simulation-base'),
  simulationAlignment: document.querySelector('#simulation-alignment'),
  simulationGap: document.querySelector('#simulation-gap'),
  simulationSeed: document.querySelector('#simulation-seed'),
  regenerateSimulation: document.querySelector('#regenerate-simulation'),
  simulationSummary: document.querySelector('#simulation-summary'),
  simulationLayout: document.querySelector('#simulation-layout'),
  simulationSymbolSearch: document.querySelector('#simulation-symbol-search'),
  simulationSymbolCount: document.querySelector('#simulation-symbol-count'),
  simulationSymbolList: document.querySelector('#simulation-symbol-list'),
  symbolResultCount: document.querySelector('#symbol-result-count'),
  symbolTableBody: document.querySelector('#symbol-table-body'),
  prevPage: document.querySelector('#prev-page'),
  nextPage: document.querySelector('#next-page'),
  pageInfo: document.querySelector('#page-info'),
  sectionCount: document.querySelector('#section-count'),
  sectionTableBody: document.querySelector('#section-table-body'),
  regionCards: document.querySelector('#region-cards'),
  exportButton: document.querySelector('#export-button'),
  tooltip: document.querySelector('#chart-tooltip'),
  toast: document.querySelector('#toast')
};

const categoryMeta = {
  code: { label: '代码', color: '#35d3b4', className: 'code' },
  rodata: { label: '只读数据', color: '#62a7ff', className: 'rodata' },
  data: { label: '已初始化数据', color: '#f6c75b', className: 'data' },
  bss: { label: 'BSS / ZI', color: '#b68cff', className: 'bss' },
  other: { label: '其他', color: '#69788d', className: 'other' }
};

const viewMeta = {
  overview: ['FIRMWARE OVERVIEW', '资源总览'],
  layout: ['MEMORY VISUALIZATION', '内存布局'],
  symbols: ['SYMBOL EXPLORER', '符号检索'],
  sections: ['SECTIONS & REGIONS', '段与区域']
};

const state = {
  result: null,
  results: [],
  failures: [],
  processGroups: [],
  activeProcessId: '',
  activeView: 'overview',
  symbolFilter: 'all',
  symbolQuery: '',
  symbolSort: { key: 'size', direction: 'desc' },
  symbolPage: 1,
  pageSize: 80,
  worker: null,
  simulation: { active: false, layout: null, mode: 'linux', recommendedMode: 'linux' }
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes.toLocaleString()} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KiB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MiB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
}

function formatAddress(value) {
  const number = Math.max(0, Number(value) || 0);
  const width = number > 0xffffffff ? 16 : 8;
  return `0x${number.toString(16).toUpperCase().padStart(width, '0')}`;
}

function formatPercent(used, total) {
  if (!total) return '—';
  return `${Math.min(999, used / total * 100).toFixed(1)}%`;
}

function tooltipPayload(item, overrides = {}) {
  const data = { ...item, ...overrides };
  return { ...data, ...explainMemoryItem(data) };
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => elements.toast.classList.add('hidden'), 3200);
}

function showLoading(message = '读取文件结构…') {
  elements.emptyState.classList.add('hidden');
  elements.workspace.classList.remove('hidden');
  elements.loadingPanel.classList.remove('hidden');
  elements.errorPanel.classList.add('hidden');
  document.querySelectorAll('.view').forEach((view) => view.classList.add('hidden'));
  elements.loadingMessage.textContent = message;
  elements.loadingProgressBar.style.width = '0%';
  elements.loadingProgress.setAttribute('aria-valuenow', '0');
  elements.loadingDetail.textContent = '文件仅在当前页面内存中处理';
  elements.parserStatus.textContent = '正在解析';
}

function updateLoadingProgress(completed, total, message, detail = '') {
  const percent = total ? Math.min(100, completed / total * 100) : 0;
  elements.loadingProgressBar.style.width = `${percent}%`;
  elements.loadingProgress.setAttribute('aria-valuenow', String(Math.round(percent)));
  if (message) elements.loadingMessage.textContent = message;
  elements.loadingDetail.textContent = detail || `${completed} / ${total} 个文件`;
}

function waitForPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function showError(message) {
  elements.loadingPanel.classList.add('hidden');
  elements.errorPanel.classList.remove('hidden');
  elements.errorMessage.textContent = message;
  elements.parserStatus.textContent = '解析失败';
}

async function fingerprintBuffer(buffer) {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  const bytes = new Uint8Array(buffer);
  const step = Math.max(1, Math.floor(bytes.length / 65536));
  let firstHash = 2166136261;
  let secondHash = 2246822519;
  for (let index = 0; index < bytes.length; index += step) {
    firstHash = Math.imul(firstHash ^ bytes[index], 16777619);
    secondHash = Math.imul(secondHash ^ bytes[index], 3266489917);
  }
  return `${bytes.length}:${firstHash >>> 0}:${secondHash >>> 0}`;
}

function parseFile(file) {
  return new Promise(async (resolve, reject) => {
    try {
      const buffer = await file.arrayBuffer();
      const fingerprint = await fingerprintBuffer(buffer);
      const worker = new Worker('./assets/parser-worker.js', { type: 'module' });
      state.worker = worker;
      worker.addEventListener('message', (event) => {
        if (event.data.type === 'error') {
          worker.terminate();
          reject(new Error(event.data.message));
        }
        if (event.data.type === 'result') {
          worker.terminate();
          resolve({ result: event.data.result, fingerprint });
        }
      });
      worker.addEventListener('error', () => {
        worker.terminate();
        reject(new Error('解析线程运行失败。'));
      });
      worker.postMessage({ buffer, name: file.name, size: file.size }, [buffer]);
    } catch (error) {
      reject(error);
    }
  });
}

function attachModule(result, file, moduleIndex) {
  const moduleName = file.webkitRelativePath || file.name;
  return {
    ...result,
    moduleName,
    sections: result.sections.map((section, index) => ({ ...section, id: `section-${moduleIndex}-${index}`, module: moduleName })),
    symbols: result.symbols.map((symbol, index) => ({ ...symbol, id: `symbol-${moduleIndex}-${index}`, module: moduleName })),
    regions: result.regions.map((region, index) => ({ ...region, id: `region-${moduleIndex}-${index}`, module: moduleName }))
  };
}

function aggregateResults(results, failures) {
  if (results.length === 1) {
    return {
      ...results[0],
      modules: [{ name: results[0].moduleName, size: results[0].file.size, format: results[0].format, role: results[0].elf?.role || '', soname: results[0].elf?.soname || '', dependencies: results[0].elf?.dependencies || [], totals: results[0].totals, sections: results[0].sections.length, symbols: results[0].symbols.length }],
      warnings: [...results[0].warnings, ...failures]
    };
  }

  const totals = { flash: 0, ram: 0, code: 0, rodata: 0, data: 0, bss: 0, other: 0, total: 0 };
  for (const result of results) for (const key of Object.keys(totals)) totals[key] += Number(result.totals[key]) || 0;
  const modules = results.map((result) => ({
    name: result.moduleName,
    size: result.file.size,
    format: result.format,
    role: result.elf?.role || '',
    soname: result.elf?.soname || '',
    dependencies: result.elf?.dependencies || [],
    totals: result.totals,
    sections: result.sections.length,
    symbols: result.symbols.length
  }));
  const formatCounts = results.reduce((counts, result) => ({ ...counts, [result.format]: (counts[result.format] || 0) + 1 }), {});
  return {
    aggregate: true,
    format: '工程模块集合',
    file: { name: `工程分析（${results.length} 个模块）`, size: results.reduce((sum, result) => sum + result.file.size, 0) },
    metadata: {
      模块数量: results.length,
      文件构成: Object.entries(formatCounts).map(([format, count]) => `${format} × ${count}`).join('，'),
      段数量: results.reduce((sum, result) => sum + result.sections.length, 0),
      符号数量: results.reduce((sum, result) => sum + result.symbols.length, 0)
    },
    totals,
    modules,
    sections: results.flatMap((result) => result.sections),
    symbols: results.flatMap((result) => result.symbols),
    regions: results.flatMap((result) => result.regions),
    warnings: [...results.flatMap((result) => result.warnings.map((warning) => `${result.moduleName}：${warning}`)), ...failures]
  };
}

const maxModuleCount = 300;
const directoryScanBatchSize = 16;
const firmwareHeaderBytes = 8192;
const firmwareHeaderDecoder = new TextDecoder('utf-8');

function firmwareCandidateKind(file) {
  const name = file.name.toLowerCase();
  if (/\.map$/.test(name)) return 'map';
  if (/\.(?:elf|axf|out)$/.test(name) || /\.so(?:\.|$)/.test(name)) return 'elf';
  return name.includes('.') ? '' : 'unknown';
}

function directoryRelativeDepth(file) {
  const parts = String(file.webkitRelativePath || file.name).split('/').filter(Boolean);
  return Math.max(0, parts.length - 1);
}

async function inspectFirmwareFile(file) {
  const candidateKind = firmwareCandidateKind(file);
  if (!candidateKind || file.size < 4) return false;
  try {
    const buffer = await file.slice(0, Math.min(file.size, firmwareHeaderBytes)).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) return true;
    if (candidateKind === 'elf') return false;
    const preview = firmwareHeaderDecoder.decode(bytes);
    return /Memory Configuration|Linker script and memory map|Execution Region|Load Region|Image Symbol Table|Memory Map of the image/i.test(preview) || candidateKind === 'map';
  } catch {
    return false;
  }
}

async function scanDirectoryFiles(selected) {
  const recognized = [];
  for (let index = 0; index < selected.length; index += directoryScanBatchSize) {
    const batch = selected.slice(index, index + directoryScanBatchSize);
    const matches = await Promise.all(batch.map(inspectFirmwareFile));
    for (let batchIndex = 0; batchIndex < batch.length; batchIndex += 1) {
      if (matches[batchIndex]) recognized.push(batch[batchIndex]);
    }
    const completed = Math.min(selected.length, index + batch.length);
    elements.fileMeta.textContent = `阶段 1/2 · 已筛选 ${completed.toLocaleString()} / ${selected.length.toLocaleString()} · 发现 ${recognized.length.toLocaleString()} 个模块`;
    updateLoadingProgress(completed, Math.max(1, selected.length),
      `阶段 1/2 · 正在筛选目录文件… ${completed.toLocaleString()} / ${selected.length.toLocaleString()}`,
      `已发现 ${recognized.length.toLocaleString()} 个 ELF、SO 或 MAP · 已忽略 ${(completed - recognized.length).toLocaleString()} 个其他文件`);
    await waitForPaint();
  }

  const shallowModules = recognized.filter((file) => directoryRelativeDepth(file) <= 2);
  const useShallowModules = recognized.length > maxModuleCount && shallowModules.length > 0 && shallowModules.length <= maxModuleCount;
  return {
    files: useShallowModules ? shallowModules : recognized,
    recognizedCount: recognized.length,
    ignoredNonFirmware: selected.length - recognized.length,
    ignoredNestedModules: useShallowModules ? recognized.length - shallowModules.length : 0
  };
}

function recommendSimulationMode(results) {
  const hasSharedLibrary = results.some((result) => /\.so(?:\.|$)/i.test(result.file.name));
  if (hasSharedLibrary) return 'linux';
  const hasExplicitMcuFormat = results.some((result) => result.format === 'Keil MAP' || /\.axf$/i.test(result.file.name));
  const hasMcuRegions = results.some((result) => result.regions.some((region) => /FLASH|RAM|IROM|IRAM|ER_|LR_/i.test(region.name) || (Number.isFinite(region.physicalAddress) && region.physicalAddress !== region.address)));
  if (hasExplicitMcuFormat || hasMcuRegions) return 'mcu';
  const hasLinuxArtifacts = results.some((result) => result.sections.some((section) => /^\.(?:interp|dynamic|dynsym|dynstr|plt|got)(?:\.|$)/i.test(section.name)));
  if (hasLinuxArtifacts) return 'linux';
  const hasEmbeddedArchitecture = results.length <= 3 && results.some((result) => /ARM|AVR|RISC-V|Xtensa|Cortex/i.test(Object.values(result.metadata || {}).join(' ')));
  return hasEmbeddedArchitecture ? 'mcu' : 'linux';
}

async function openFiles(fileList, fromDirectory = false) {
  const selectedCount = Number(fileList?.length || 0);
  const firstRelativePath = fileList?.[0]?.webkitRelativePath || '';
  const directoryName = firstRelativePath.split('/')[0] || '所选目录';
  elements.fileName.textContent = fromDirectory ? directoryName : selectedCount === 1 ? fileList[0].name : `已选择 ${selectedCount} 个文件`;
  elements.fileMeta.textContent = fromDirectory ? `正在扫描 ${selectedCount.toLocaleString()} 个目录项` : '正在准备解析';
  showLoading(fromDirectory ? `阶段 1/2 · 正在扫描目录中的 ${selectedCount.toLocaleString()} 个文件…` : `正在读取 ${selectedCount.toLocaleString()} 个文件…`);
  elements.parserStatus.textContent = fromDirectory ? '正在筛选目录' : '正在解析';
  updateLoadingProgress(0, Math.max(1, selectedCount), '', '正在识别 ELF、SO 和 MAP 文件，请稍候');
  await waitForPaint();

  const selected = Array.from(fileList || []);
  const directoryScan = fromDirectory ? await scanDirectoryFiles(selected) : null;
  const files = directoryScan ? directoryScan.files : selected;
  if (!files.length) {
    showError(fromDirectory ? '目录扫描完成，但没有发现有效的 ELF、SO、GCC MAP 或 Keil MAP 文件。' : '请选择至少一个文件。');
    return;
  }
  if (files.length > maxModuleCount) {
    const recognizedText = directoryScan ? `扫描到 ${directoryScan.recognizedCount.toLocaleString()} 个有效模块，` : '';
    showError(`一次最多分析 ${maxModuleCount} 个模块。${recognizedText}当前仍需分析 ${files.length.toLocaleString()} 个，请选择更具体的 bin、lib 或模块子目录。`);
    return;
  }

  state.worker?.terminate();
  state.result = null;
  state.results = [];
  state.simulation = { active: false, layout: null, mode: 'linux', recommendedMode: 'linux' };
  elements.simulationSymbolSearch.value = '';
  elements.fileName.textContent = files.length === 1 ? files[0].name : `工程分析（${files.length} 个候选文件）`;
  elements.fileMeta.textContent = `${formatBytes(files.reduce((sum, file) => sum + file.size, 0))} · 等待识别`;
  const ignoredDetail = directoryScan
    ? [directoryScan.ignoredNonFirmware ? `非固件文件 ${directoryScan.ignoredNonFirmware.toLocaleString()} 个` : '', directoryScan.ignoredNestedModules ? `深层依赖模块 ${directoryScan.ignoredNestedModules.toLocaleString()} 个` : ''].filter(Boolean).join(' · ')
    : '';
  elements.parserStatus.textContent = '正在解析模块';
  updateLoadingProgress(0, files.length, `阶段 2/2 · 筛选完成，准备解析 ${files.length.toLocaleString()} 个模块…`, fromDirectory ? `已忽略：${ignoredDetail || '0 个'}` : '文件仅在当前页面内存中处理');
  await waitForPaint();

  const results = [];
  const failures = [];
  const fingerprints = new Set();
  const maxSize = 512 * 1024 * 1024;
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    updateLoadingProgress(index, files.length, `阶段 2/2 · [${index + 1}/${files.length}] ${file.webkitRelativePath || file.name}`, `已成功 ${results.length} 个 · 已跳过 ${failures.length} 个`);
    await waitForPaint();
    if (file.size > maxSize) {
      failures.push(`${file.name}：超过 512 MiB，已跳过`);
      continue;
    }
    try {
      const { result, fingerprint } = await parseFile(file);
      if (fingerprints.has(fingerprint)) {
        failures.push(`${file.webkitRelativePath || file.name}：内容与已导入模块重复，已跳过`);
        continue;
      }
      fingerprints.add(fingerprint);
      results.push(attachModule(result, file, results.length));
    } catch (error) {
      failures.push(`${file.webkitRelativePath || file.name}：${error instanceof Error ? error.message : String(error)}`);
    }
    updateLoadingProgress(index + 1, files.length, `阶段 2/2 · [${index + 1}/${files.length}] 已处理 ${file.name}`, `已成功 ${results.length} 个 · 已跳过 ${failures.length} 个`);
  }

  state.worker = null;
  if (!results.length) {
    showError(`没有成功解析的文件。${failures.slice(0, 3).join('；')}`);
    return;
  }
  state.results = results;
  state.failures = failures;
  state.processGroups = buildLinuxProcessGroups(results);
  state.activeProcessId = state.processGroups[0]?.id || '';
  state.result = resultForActiveProcess();
  renderProcessContext();
  state.simulation.recommendedMode = recommendSimulationMode(activeResults());
  state.simulation.mode = state.simulation.recommendedMode;
  state.symbolPage = 1;
  state.symbolQuery = '';
  elements.globalSearch.value = '';
  document.querySelectorAll('[data-layout-mode]').forEach((button) => button.classList.toggle('active', button.dataset.layoutMode === 'address'));
  elements.addressLayout.classList.remove('hidden');
  elements.treemapLayout.classList.add('hidden');
  elements.simulationView.classList.add('hidden');
  renderAll();
  switchView('overview');
  elements.loadingPanel.classList.add('hidden');
  elements.parserStatus.textContent = failures.length ? `完成 · 跳过 ${failures.length} 个文件` : `解析完成 · ${results.length} 个模块`;
  showToast(`已分析 ${results.length} 个模块、${state.result.symbols.length.toLocaleString()} 个符号`);
}

function activeProcessGroup() {
  return state.processGroups.find((group) => group.id === state.activeProcessId) || state.processGroups[0] || null;
}

function activeResults() {
  return activeProcessGroup()?.modules || state.results;
}

function resultForActiveProcess() {
  const group = activeProcessGroup();
  const result = aggregateResults(group?.modules || state.results, state.failures);
  if (!group?.entry) return result;
  const unresolved = group.unresolvedDependencies || [];
  return {
    ...result,
    file: { ...result.file, name: `${group.name} 进程` },
    metadata: {
      分析进程: group.name,
      入口文件: group.entry.moduleName,
      已加载模块: group.modules.length,
      未找到依赖: unresolved.length,
      ...result.metadata
    },
    warnings: [...result.warnings, ...(unresolved.length ? [`${group.name} 仍有 ${unresolved.length} 个 DT_NEEDED 依赖未在导入目录中找到：${unresolved.join('、')}`] : [])]
  };
}

function renderProcessContext() {
  const group = activeProcessGroup();
  const executableGroups = state.processGroups.filter((entry) => entry.entry);
  elements.processContext.classList.toggle('hidden', executableGroups.length === 0);
  if (!group || !executableGroups.length) return;
  elements.processSelector.innerHTML = executableGroups.map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.name)} · ${entry.modules.length} 个模块</option>`).join('');
  elements.processSelector.value = group.id;
  const unresolved = group.unresolvedDependencies.length;
  elements.processContextDetail.textContent = unresolved ? `已匹配 ${group.modules.length} 个模块 · 缺失 ${unresolved} 个依赖` : `已匹配 ${group.modules.length} 个模块 · 依赖完整`;
  elements.processContextDetail.classList.toggle('warning', unresolved > 0);
}

function selectProcess(processId) {
  if (!state.processGroups.some((group) => group.id === processId)) return;
  state.activeProcessId = processId;
  state.result = resultForActiveProcess();
  state.symbolPage = 1;
  state.symbolQuery = '';
  elements.globalSearch.value = '';
  state.simulation.layout = null;
  state.simulation.recommendedMode = recommendSimulationMode(activeResults());
  state.simulation.mode = state.simulation.recommendedMode;
  renderProcessContext();
  renderAll();
  if (state.simulation.active) renderSimulation();
  const group = activeProcessGroup();
  showToast(`已切换到 ${group.name}，展示 ${group.modules.length} 个相关模块`);
}

function derivedRegions() {
  if (state.result.regions.length) return state.result.regions;
  const allocSections = state.result.sections.filter((section) => section.level !== 'input' && section.size > 0 && section.address > 0);
  const groups = new Map();
  for (const section of allocSections) {
    const kind = ['data', 'bss'].includes(section.category) ? 'ram' : 'flash';
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(section);
  }
  return [...groups.entries()].map(([kind, sections]) => {
    const address = Math.min(...sections.map((section) => section.address));
    const end = Math.max(...sections.map((section) => section.address + section.size));
    return { name: kind === 'flash' ? 'FLASH（推断）' : 'RAM（推断）', address, size: end - address, used: sections.reduce((sum, section) => sum + section.size, 0), kind, attributes: kind === 'flash' ? 'RX' : 'RW' };
  });
}

function renderAll() {
  const { result } = state;
  elements.fileName.textContent = result.file.name;
  elements.fileMeta.textContent = result.aggregate ? `${formatBytes(result.file.size)} · ${result.modules.length} 个模块` : `${formatBytes(result.file.size)} · ${result.format}`;
  elements.fileIcon.textContent = result.aggregate ? 'ALL' : result.format.includes('MAP') ? 'MAP' : 'ELF';
  elements.symbolCountBadge.textContent = result.symbols.length.toLocaleString();
  renderMetrics();
  renderRegions();
  renderComposition();
  renderLargestSymbols();
  renderInfo();
  renderAddressLayout();
  renderTreemap();
  renderSymbolTable();
  renderSections();
}

function renderMetrics() {
  const totals = state.result.totals;
  const metrics = [
    { label: 'Flash 占用', value: totals.flash, detail: `代码与常量 ${formatBytes(totals.code + totals.rodata)}`, icon: 'flash' },
    { label: 'RAM 占用', value: totals.ram, detail: `DATA + BSS`, icon: 'ram' },
    { label: '代码', value: totals.code, detail: `${state.result.symbols.filter((item) => item.type === 'function').length.toLocaleString()} 个函数`, icon: 'code' },
    { label: '数据', value: totals.data + totals.bss, detail: `BSS ${formatBytes(totals.bss)}`, icon: 'data' }
  ];
  elements.metricGrid.innerHTML = metrics.map((metric) => `
    <article class="metric-card ${metric.icon}">
      <div class="metric-icon" aria-hidden="true">${metric.icon === 'flash' ? 'F' : metric.icon === 'ram' ? 'R' : metric.icon === 'code' ? '&lt;/&gt;' : 'D'}</div>
      <div><span>${metric.label}</span><strong>${formatBytes(metric.value)}</strong><small>${metric.detail}</small></div>
    </article>`).join('');
}

function renderRegions() {
  if (state.result.aggregate) {
    const modules = [...state.result.modules].sort((left, right) => right.totals.total - left.totals.total);
    const maxSize = Math.max(...modules.map((module) => module.totals.total), 1);
    elements.regionPanelKicker.textContent = 'MODULE COMPARISON';
    elements.regionPanelTitle.textContent = '模块资源占用';
    elements.memoryLegend.innerHTML = `<span>${modules.length} 个模块，进度条按最大模块相对比较</span>`;
    elements.regionList.classList.add('module-list');
    elements.regionList.innerHTML = modules.map((module) => `<div class="region-row">
      <div class="region-head"><div><strong title="${escapeHtml(module.name)}">${escapeHtml(module.name)}</strong><span>${escapeHtml(module.role === 'executable' ? '入口程序' : module.role === 'shared-library' ? '共享库' : module.format)} · ${module.sections} 段 · ${module.symbols.toLocaleString()} 符号</span></div><div><strong>${formatBytes(module.totals.total)}</strong><span>RAM ${formatBytes(module.totals.ram)}</span></div></div>
      <div class="progress-track"><span class="flash" style="width:${Math.max(1, module.totals.total / maxSize * 100)}%"></span></div>
    </div>`).join('');
    return;
  }
  const regions = derivedRegions();
  elements.regionPanelKicker.textContent = 'MEMORY REGIONS';
  elements.regionPanelTitle.textContent = '存储区域占用';
  elements.regionList.classList.remove('module-list');
  elements.memoryLegend.innerHTML = '<span><i class="flash"></i>Flash</span><span><i class="ram"></i>RAM</span>';
  if (!regions.length) {
    elements.regionList.innerHTML = '<div class="empty-inline">没有可显示的内存区域</div>';
    return;
  }
  elements.regionList.innerHTML = regions.map((region) => {
    const used = Number.isFinite(region.used) ? region.used : 0;
    const percent = region.size ? Math.min(100, used / region.size * 100) : 0;
    return `<div class="region-row">
      <div class="region-head"><div><strong>${escapeHtml(region.name)}</strong><span>${formatAddress(region.address)} — ${formatAddress(region.address + region.size)}</span></div><div><strong>${formatBytes(used)} / ${formatBytes(region.size)}</strong><span>${formatPercent(used, region.size)}</span></div></div>
      <div class="progress-track"><span class="${region.kind === 'ram' ? 'ram' : 'flash'}" style="width:${percent}%"></span></div>
    </div>`;
  }).join('');
}

function renderComposition() {
  const totals = state.result.totals;
  const entries = Object.entries(categoryMeta).map(([key, meta]) => ({ key, ...meta, value: totals[key] || 0 })).filter((entry) => entry.value > 0);
  const sum = entries.reduce((total, entry) => total + entry.value, 0) || 1;
  let cursor = 0;
  const stops = entries.map((entry) => {
    const start = cursor;
    cursor += entry.value / sum * 100;
    return `${entry.color} ${start}% ${cursor}%`;
  });
  elements.compositionDonut.style.background = `conic-gradient(${stops.join(',') || '#263245 0 100%'})`;
  elements.compositionDonut.querySelector('strong').textContent = formatBytes(sum);
  elements.compositionLegend.innerHTML = entries.map((entry) => `<div><span><i style="background:${entry.color}"></i>${entry.label}</span><strong>${formatBytes(entry.value)}</strong><small>${(entry.value / sum * 100).toFixed(1)}%</small></div>`).join('');
}

function renderLargestSymbols() {
  const entries = [...state.result.symbols].filter((item) => item.size > 0).sort((left, right) => right.size - left.size).slice(0, 6);
  if (!entries.length) {
    elements.largestSymbols.innerHTML = '<div class="empty-inline">该文件没有可用的符号大小信息</div>';
    return;
  }
  const max = entries[0].size || 1;
  elements.largestSymbols.innerHTML = entries.map((item) => `<button class="compact-row" type="button" data-symbol-id="${item.id}">
    <span class="symbol-type ${item.type}">${item.type === 'function' ? 'ƒ' : item.type === 'object' ? 'v' : '·'}</span>
    <span class="compact-name"><strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong><small>${escapeHtml([item.module, item.section || '未分段'].filter(Boolean).join(' · '))}</small></span>
    <span class="mini-track"><i class="${item.category}" style="width:${Math.max(3, item.size / max * 100)}%"></i></span>
    <strong class="size-cell">${formatBytes(item.size)}</strong>
  </button>`).join('');
}

function renderInfo() {
  const metadata = { ...state.result.metadata, 文件大小: formatBytes(state.result.file.size) };
  elements.infoList.innerHTML = Object.entries(metadata).map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
  if (state.result.warnings.length) {
    elements.infoList.insertAdjacentHTML('beforeend', `<div class="info-warning"><dt>解析提示</dt><dd>${escapeHtml(state.result.warnings.join('；'))}</dd></div>`);
  }
}

function sectionsForRegion(region) {
  return state.result.sections
    .filter((section) => section.level !== 'input' && section.alloc !== false && section.size > 0 && (!region.module || section.module === region.module) && section.address >= region.address && section.address < region.address + region.size)
    .sort((left, right) => left.address - right.address);
}

function layoutRegions() {
  if (!state.result.aggregate) return derivedRegions();
  return activeResults().map((result) => {
    const sections = result.sections.filter((section) => section.level !== 'input' && section.alloc !== false && section.size > 0);
    if (!sections.length) return null;
    const address = Math.min(...sections.map((section) => section.address));
    const end = Math.max(...sections.map((section) => section.address + section.size));
    return {
      name: result.moduleName,
      module: result.moduleName,
      address,
      size: Math.max(1, end - address),
      used: result.totals.total,
      kind: 'module',
      attributes: `${result.format} · ${sections.length} 段`
    };
  }).filter(Boolean).sort((left, right) => right.used - left.used);
}

function renderAddressLayout() {
  const regions = layoutRegions();
  if (!regions.length) {
    elements.addressLayout.innerHTML = '<div class="empty-inline">文件中没有可定位的地址数据</div>';
    return;
  }
  elements.addressLayout.innerHTML = regions.map((region) => {
    const sections = sectionsForRegion(region);
    const regionSize = region.size || 1;
    const blocks = sections.map((section) => {
      const left = Math.max(0, (section.address - region.address) / regionSize * 100);
      const width = Math.max(0.35, Math.min(100 - left, section.size / regionSize * 100));
      return `<button class="address-block ${section.category}" type="button" style="left:${left}%;width:${width}%" data-tooltip="${escapeHtml(JSON.stringify(tooltipPayload(section)))}" aria-label="${escapeHtml(section.name)}，${formatAddress(section.address)}，${formatBytes(section.size)}"><span>${width > 7 ? escapeHtml(section.name) : ''}</span></button>`;
    }).join('');
    return `<div class="address-region">
      <button class="address-region-title region-help" type="button" data-tooltip="${escapeHtml(JSON.stringify(tooltipPayload(region, { category: region.kind === 'ram' ? 'data' : 'code' })))}"><div><strong>${escapeHtml(region.name)}</strong><span>${escapeHtml(region.attributes || '')}</span></div><strong>${formatBytes(region.size)}</strong></button>
      <div class="address-ruler"><span>${formatAddress(region.address)}</span><span>${formatAddress(region.address + region.size / 2)}</span><span>${formatAddress(region.address + region.size)}</span></div>
      <div class="address-track ${region.kind === 'ram' ? 'ram' : 'flash'}">${blocks || '<span class="no-blocks">没有已识别段</span>'}</div>
    </div>`;
  }).join('');
}

function simulationOptions() {
  const gapPresets = {
    compact: [0x100000, 0x400000],
    normal: [0x100000, 0x1000000],
    wide: [0x1000000, 0x4000000]
  };
  const [gapMinimum, gapMaximum] = gapPresets[elements.simulationGap.value] || gapPresets.normal;
  return {
    startBase: parseAddress(elements.simulationBase.value, 0x00007f0000000000),
    pageSize: 0x1000,
    moduleAlignment: parseAddress(elements.simulationAlignment.value, 0x200000),
    gapMinimum,
    gapMaximum,
    seed: elements.simulationSeed.value
  };
}

function simulationCategory(segment) {
  if (segment.category) return segment.category;
  if (/x/i.test(segment.attributes || '')) return 'code';
  if (/w/i.test(segment.attributes || '')) return 'data';
  return 'rodata';
}

function updateSimulationTypeUi() {
  const mode = state.simulation.mode;
  document.querySelectorAll('[data-simulation-type]').forEach((button) => {
    const active = button.dataset.simulationType === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  elements.linuxSimulationControls.classList.toggle('hidden', mode !== 'linux');
  elements.mcuSimulationInfo.classList.toggle('hidden', mode !== 'mcu');
  const recommendedLabel = state.simulation.recommendedMode === 'mcu' ? 'MCU 固定地址启动' : 'Linux 动态加载';
  const currentLabel = mode === 'mcu' ? 'MCU 固定地址启动' : 'Linux 动态加载';
  elements.simulationRecommendation.textContent = `自动识别建议：${recommendedLabel} · 当前：${currentLabel}`;
}

function renderLinuxSimulation() {
  const group = activeProcessGroup();
  const options = simulationOptions();
  const layout = buildSimulatedLayout(activeResults(), { ...options, seed: `${options.seed}:${group?.id || 'all'}` });
  state.simulation.layout = layout;
  elements.simulationBase.value = formatAddress(layout.options.startBase);
  elements.simulationSummary.innerHTML = `<div><span>独立进程入口</span><strong>${escapeHtml(group?.name || '模块集合')}</strong></div><div><span>已加载模块</span><strong>${layout.modules.length}</strong></div><div><span>未找到依赖</span><strong>${(group?.unresolvedDependencies.length || 0).toLocaleString()}</strong></div><div><span>地址空间跨度</span><strong>${formatBytes(layout.span)}</strong></div>`;
  elements.simulationLayout.innerHTML = layout.modules.length ? layout.modules.map((module) => {
    const segments = module.segments.map((segment) => {
      const left = Math.max(0, (segment.runtimeAddress - module.runtimeStart) / module.span * 100);
      const width = Math.max(.3, Math.min(100 - left, segment.size / module.span * 100));
      const category = simulationCategory(segment);
      return `<button class="simulation-segment ${category}" type="button" style="left:${left}%;width:${width}%" data-tooltip="${escapeHtml(JSON.stringify(tooltipPayload(segment, { module: module.name, address: segment.runtimeAddress, internalAddress: segment.address, category })))}" aria-label="${escapeHtml(module.name)} ${escapeHtml(segment.name)}，模拟地址 ${formatAddress(segment.runtimeAddress)}"><span>${width > 6 ? escapeHtml(segment.name) : ''}</span></button>`;
    }).join('');
    return `<article class="simulation-module">
      <div class="simulation-module-head"><div><strong title="${escapeHtml(module.name)}">${escapeHtml(module.name)}</strong><span>${escapeHtml(module.format)} · load bias ${formatAddress(module.loadBias)}</span></div><div><strong>${formatAddress(module.runtimeStart)}</strong><span>— ${formatAddress(module.runtimeEnd)}</span></div></div>
      <div class="simulation-track">${segments}</div>
      <div class="simulation-module-foot"><span>内部 ${formatAddress(module.internalStart)} — ${formatAddress(module.internalEnd)}</span><span>${formatBytes(module.span)}</span></div>
    </article>`;
  }).join('') : '<div class="empty-inline">没有可用于模拟加载的段</div>';
}

function renderMcuSimulation() {
  const layout = buildMcuLayout(activeResults());
  state.simulation.layout = layout;
  const allRegions = layout.modules.flatMap((module) => module.memoryRegions);
  const flashRegions = allRegions.filter((region) => region.kind !== 'ram');
  const ramRegions = allRegions.filter((region) => region.kind === 'ram');
  const flashUsed = flashRegions.reduce((sum, region) => sum + (region.used || region.sections.reduce((total, section) => total + section.size, 0)), 0);
  const ramUsed = ramRegions.reduce((sum, region) => sum + (region.used || region.sections.reduce((total, section) => total + section.size, 0)), 0);
  elements.simulationSummary.innerHTML = `<div><span>固件映像</span><strong>${layout.modules.length}</strong></div><div><span>Flash 使用</span><strong>${formatBytes(flashUsed)}</strong></div><div><span>RAM 使用</span><strong>${formatBytes(ramUsed)}</strong></div><div><span>地址策略</span><strong>固定链接地址</strong></div>`;
  elements.simulationLayout.innerHTML = layout.modules.length ? layout.modules.map((module) => {
    const loadRegions = module.loadRegions.length ? `<div class="mcu-load-regions"><strong>Load Region</strong>${module.loadRegions.map((region) => `<span>${escapeHtml(region.name)} · ${formatAddress(region.address)} · ${formatBytes(region.used || region.size)}</span>`).join('')}</div>` : '';
    const regions = module.memoryRegions.map((region) => {
      const regionSize = region.size || 1;
      const blocks = region.sections.map((section) => {
        const left = Math.max(0, (section.address - region.address) / regionSize * 100);
        const width = Math.max(.35, Math.min(100 - left, section.size / regionSize * 100));
        return `<button class="simulation-segment ${section.category || 'other'}" type="button" style="left:${left}%;width:${width}%" data-tooltip="${escapeHtml(JSON.stringify(tooltipPayload(section, { module: module.name, address: section.address, internalAddress: section.address })))}"><span>${width > 6 ? escapeHtml(section.name) : ''}</span></button>`;
      }).join('');
      const used = region.used || region.sections.reduce((sum, section) => sum + section.size, 0);
      const loadAddressNote = Number.isFinite(region.physicalAddress) && region.physicalAddress !== region.address ? ` · LMA ${formatAddress(region.physicalAddress)}` : '';
      return `<div class="mcu-memory-region"><div class="mcu-region-head"><div><span class="region-kind ${region.kind === 'ram' ? 'ram' : 'flash'}">${region.kind === 'ram' ? 'RAM' : 'FLASH'}</span><strong>${escapeHtml(region.name)}</strong><small>${escapeHtml(region.attributes || '')}${loadAddressNote}</small></div><div><strong>${formatAddress(region.address)} — ${formatAddress(region.address + region.size)}</strong><small>${formatBytes(used)} / ${formatBytes(region.size)}</small></div></div><div class="simulation-track">${blocks || '<span class="no-blocks">未识别到内部段</span>'}</div></div>`;
    }).join('');
    const actions = module.startupActions.length ? `<div class="mcu-startup-actions"><strong>启动初始化</strong>${module.startupActions.map((action) => `<div class="mcu-action ${action.type}"><span>${action.type === 'copy' ? 'COPY' : 'ZERO'}</span><div><strong>${escapeHtml(action.section)} · ${action.loadAddress === null || action.loadAddress === undefined ? '' : `${formatAddress(action.loadAddress)} → `}${formatAddress(action.address)} · ${formatBytes(action.size)}</strong><small>${escapeHtml(action.description)}</small></div></div>`).join('')}</div>` : '<div class="mcu-startup-actions"><strong>启动初始化</strong><div class="empty-inline">未识别到 DATA 拷贝或 BSS 清零区域</div></div>';
    return `<article class="mcu-module"><div class="simulation-module-head"><div><strong>${escapeHtml(module.name)}</strong><span>${escapeHtml(module.format)} · 固定绝对地址</span></div><div><strong>${formatBytes(module.span)}</strong><span>区域容量合计</span></div></div>${loadRegions}<div class="mcu-region-list">${regions}</div>${actions}</article>`;
  }).join('') : '<div class="empty-inline">没有可用于 MCU 启动布局的区域</div>';
}

function renderSimulation() {
  if (!state.results.length) return;
  updateSimulationTypeUi();
  if (state.simulation.mode === 'mcu') renderMcuSimulation();
  else renderLinuxSimulation();
  renderSimulationSymbols();
  if (state.simulation.active) renderSymbolTable();
}

function runtimeAddress(symbol) {
  return state.simulation.active ? simulatedAddressFor(state.simulation.layout, symbol.module, symbol.address) : null;
}

function renderSimulationSymbols() {
  if (!state.simulation.layout) return;
  const query = elements.simulationSymbolSearch.value.trim().toLowerCase();
  const numericQuery = /^0x[\da-f]+$/i.test(query) ? Number.parseInt(query, 16) : null;
  const matches = state.result.symbols.map((symbol) => ({ symbol, runtimeAddress: simulatedAddressFor(state.simulation.layout, symbol.module, symbol.address) }))
    .filter(({ symbol, runtimeAddress: address }) => {
      if (address === null) return false;
      if (!query) return symbol.size > 0;
      if (numericQuery !== null && numericQuery >= address && numericQuery < address + Math.max(1, symbol.size)) return true;
      return [symbol.name, symbol.module, symbol.section, formatAddress(address), formatAddress(symbol.address)].some((value) => String(value || '').toLowerCase().includes(query));
    })
    .sort((left, right) => query ? left.runtimeAddress - right.runtimeAddress : right.symbol.size - left.symbol.size);
  const visible = matches.slice(0, 100);
  elements.simulationSymbolCount.textContent = matches.length > visible.length ? `显示 ${visible.length} / ${matches.length.toLocaleString()}` : `${matches.length.toLocaleString()} 个符号`;
  elements.simulationSymbolList.innerHTML = visible.length ? visible.map(({ symbol, runtimeAddress: address }) => `<button class="simulation-symbol-row" data-symbol-id="${symbol.id}" type="button">
    <span class="symbol-type ${symbol.type}">${symbol.type === 'function' ? 'ƒ' : symbol.type === 'object' ? 'v' : '·'}</span>
    <span class="simulation-symbol-name"><strong title="${escapeHtml(symbol.name)}">${escapeHtml(symbol.name)}</strong><small>${escapeHtml([symbol.module, symbol.section].filter(Boolean).join(' · '))}</small></span>
    <span class="simulation-symbol-address"><strong>${formatAddress(address)}</strong><small>${state.simulation.mode === 'mcu' ? 'MCU 固定链接地址' : `模块内 ${formatAddress(symbol.address)}`}</small></span>
    <span class="simulation-symbol-size">${formatBytes(symbol.size)}</span>
  </button>`).join('') : '<div class="empty-inline">没有匹配的可换算符号</div>';
}

function partition(items, rectangle, depth = 0) {
  if (!items.length) return [];
  if (items.length === 1) return [{ ...items[0], rectangle }];
  const total = items.reduce((sum, item) => sum + item.size, 0) || 1;
  let leftTotal = 0;
  let splitIndex = 0;
  while (splitIndex < items.length - 1 && leftTotal < total / 2) {
    leftTotal += items[splitIndex].size;
    splitIndex += 1;
  }
  const ratio = Math.max(0.08, Math.min(0.92, leftTotal / total));
  const first = items.slice(0, splitIndex);
  const second = items.slice(splitIndex);
  if ((depth % 2 === 0 && rectangle.width >= rectangle.height) || rectangle.height < 120) {
    const firstWidth = rectangle.width * ratio;
    return [
      ...partition(first, { ...rectangle, width: firstWidth }, depth + 1),
      ...partition(second, { x: rectangle.x + firstWidth, y: rectangle.y, width: rectangle.width - firstWidth, height: rectangle.height }, depth + 1)
    ];
  }
  const firstHeight = rectangle.height * ratio;
  return [
    ...partition(first, { ...rectangle, height: firstHeight }, depth + 1),
    ...partition(second, { x: rectangle.x, y: rectangle.y + firstHeight, width: rectangle.width, height: rectangle.height - firstHeight }, depth + 1)
  ];
}

function renderTreemap() {
  const candidates = state.result.symbols.filter((item) => item.size > 0).sort((left, right) => right.size - left.size).slice(0, 100);
  const items = candidates.length >= 3 ? candidates : state.result.sections.filter((item) => item.level !== 'input' && item.size > 0).sort((left, right) => right.size - left.size).slice(0, 100);
  if (!items.length) {
    elements.treemapLayout.innerHTML = '<div class="empty-inline">没有可用于层级图的大小数据</div>';
    return;
  }
  const width = 1200;
  const height = 520;
  const cells = partition(items, { x: 0, y: 0, width, height });
  elements.treemapLayout.innerHTML = cells.map((item) => {
    const { x, y, width: cellWidth, height: cellHeight } = item.rectangle;
    const showLabel = cellWidth > 78 && cellHeight > 42;
    return `<button class="treemap-cell ${item.category || 'other'}" type="button" style="left:${x / width * 100}%;top:${y / height * 100}%;width:${cellWidth / width * 100}%;height:${cellHeight / height * 100}%" data-tooltip="${escapeHtml(JSON.stringify(tooltipPayload(item)))}" aria-label="${escapeHtml(item.name)}，${formatBytes(item.size)}">${showLabel ? `<strong>${escapeHtml(item.name)}</strong><span>${formatBytes(item.size)}</span>` : ''}</button>`;
  }).join('');
}

function filteredSymbols() {
  const query = state.symbolQuery.trim().toLowerCase();
  const numericQuery = /^0x[\da-f]+$/i.test(query) ? Number.parseInt(query, 16) : null;
  return state.result.symbols.filter((symbol) => {
    if (state.symbolFilter !== 'all' && (state.symbolFilter === 'other' ? ['function', 'object'].includes(symbol.type) : symbol.type !== state.symbolFilter)) return false;
    if (!query) return true;
    if (numericQuery !== null && numericQuery >= symbol.address && numericQuery < symbol.address + Math.max(1, symbol.size)) return true;
    const simulatedAddress = runtimeAddress(symbol);
    if (numericQuery !== null && simulatedAddress !== null && numericQuery >= simulatedAddress && numericQuery < simulatedAddress + Math.max(1, symbol.size)) return true;
    return [symbol.name, symbol.module, symbol.section, symbol.object, formatAddress(symbol.address), simulatedAddress === null ? '' : formatAddress(simulatedAddress)].some((value) => String(value || '').toLowerCase().includes(query));
  });
}

function renderSymbolTable() {
  if (!state.result) return;
  const filtered = filteredSymbols();
  const { key, direction } = state.symbolSort;
  filtered.sort((left, right) => {
    const leftValue = left[key];
    const rightValue = right[key];
    const comparison = typeof leftValue === 'string' ? leftValue.localeCompare(rightValue) : leftValue - rightValue;
    return direction === 'asc' ? comparison : -comparison;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.symbolPage = Math.min(state.symbolPage, pageCount);
  const offset = (state.symbolPage - 1) * state.pageSize;
  const page = filtered.slice(offset, offset + state.pageSize);
  elements.symbolResultCount.textContent = `${filtered.length.toLocaleString()} 个符号`;
  elements.pageInfo.textContent = `${state.symbolPage} / ${pageCount}`;
  elements.prevPage.disabled = state.symbolPage <= 1;
  elements.nextPage.disabled = state.symbolPage >= pageCount;
  elements.symbolTableBody.innerHTML = page.length ? page.map((symbol) => {
    const simulatedAddress = runtimeAddress(symbol);
    const addressCell = simulatedAddress === null
      ? formatAddress(symbol.address)
      : state.simulation.mode === 'mcu'
        ? `<div class="address-stack"><strong>${formatAddress(simulatedAddress)}</strong><small>MCU 固定链接地址</small></div>`
        : `<div class="address-stack"><strong>${formatAddress(simulatedAddress)}</strong><small>模块内 ${formatAddress(symbol.address)}</small></div>`;
    return `<tr data-symbol-id="${symbol.id}">
    <td><div class="name-cell"><span class="symbol-type ${symbol.type}">${symbol.type === 'function' ? 'ƒ' : symbol.type === 'object' ? 'v' : '·'}</span><strong title="${escapeHtml(symbol.name)}">${escapeHtml(symbol.name)}</strong></div></td>
    <td class="mono">${addressCell}</td><td class="mono">${formatBytes(symbol.size)}</td>
    <td><span class="type-pill ${symbol.type}">${symbol.type === 'function' ? '函数' : symbol.type === 'object' ? '变量' : escapeHtml(symbol.type)}</span></td>
    <td><span class="category-dot ${symbol.category}"></span>${escapeHtml(symbol.section || '—')}</td><td title="${escapeHtml([symbol.module, symbol.object].filter(Boolean).join(' · '))}">${escapeHtml([symbol.module, symbol.object].filter(Boolean).join(' · ') || '—')}</td>
  </tr>`;
  }).join('') : '<tr><td colspan="6"><div class="empty-inline">没有匹配的符号，请尝试其他关键词或筛选条件</div></td></tr>';
}

function regionsForResult(result) {
  if (result.regions.length) return result.regions.map((region) => ({ ...region, module: result.moduleName, format: result.format }));
  const allocSections = result.sections.filter((section) => section.level !== 'input' && section.alloc !== false && section.size > 0);
  const groups = new Map();
  for (const section of allocSections) {
    const kind = ['data', 'bss'].includes(section.category) ? 'ram' : 'flash';
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(section);
  }
  return [...groups.entries()].map(([kind, groupSections]) => {
    const address = Math.min(...groupSections.map((section) => section.address));
    const end = Math.max(...groupSections.map((section) => section.address + section.size));
    return { name: kind === 'ram' ? 'RAM（由段推断）' : 'FLASH（由段推断）', address, size: end - address, used: groupSections.reduce((sum, section) => sum + section.size, 0), kind, attributes: kind === 'ram' ? 'RW' : 'RX', module: result.moduleName, format: result.format };
  });
}

function regionSections(region) {
  return state.result.sections
    .filter((section) => section.level !== 'input' && section.alloc !== false && section.size > 0 && (!region.module || section.module === region.module) && section.address < region.address + region.size && section.address + section.size > region.address)
    .sort((left, right) => left.address - right.address);
}

function regionVisualMeta(region) {
  if (region.format === 'ELF' || /^LOAD\b/i.test(region.name)) {
    const tokens = String(region.attributes || '').toUpperCase().split(/[^A-Z]+/).filter(Boolean);
    const compact = tokens.find((token) => /^[RWXE]+$/.test(token)) || '';
    const writable = tokens.includes('WRITE') || compact.includes('W');
    const executable = tokens.includes('EXEC') || tokens.includes('EXECUTE') || compact.includes('X') || compact.includes('E');
    return { label: 'PT_LOAD', className: 'load', category: writable ? 'data' : executable ? 'code' : 'rodata' };
  }
  return { label: region.kind === 'ram' ? 'RAM' : 'FLASH', className: region.kind === 'ram' ? 'ram' : 'flash', category: region.kind === 'ram' ? 'data' : 'code' };
}

function renderRegionCard(region) {
  const sections = regionSections(region);
  const visual = regionVisualMeta(region);
  const explanation = explainMemoryItem({ ...region, category: visual.category });
  const zeroFill = Number.isFinite(region.fileSize) ? Math.max(0, region.size - region.fileSize) : null;
  const payload = tooltipPayload(region, { category: visual.category, sectionCount: sections.length, containedSections: sections.map((section) => section.name), endAddress: region.address + region.size });
  const sectionChips = sections.length ? sections.map((section) => {
    const sectionHelp = explainMemoryItem(section);
    return `<button class="region-section-chip ${section.category || 'other'}" type="button" data-tooltip="${escapeHtml(JSON.stringify(tooltipPayload(section, { endAddress: section.address + section.size })))}" aria-label="${escapeHtml(section.name)}，${escapeHtml(sectionHelp.role)}，${formatBytes(section.size)}"><strong>${escapeHtml(section.name)}</strong><span>${formatBytes(section.size)}</span></button>`;
  }).join('') : '<span class="region-empty-sections">没有识别到位于该范围内的 section</span>';
  return `<article class="region-card detailed" tabindex="0" data-tooltip="${escapeHtml(JSON.stringify(payload))}" aria-label="${escapeHtml(region.name)}，${escapeHtml(explanation.role)}">
    <div class="region-card-title"><span class="region-kind ${visual.className}">${visual.label}</span><strong title="${escapeHtml(region.name)}">${escapeHtml(region.name)}</strong><span class="region-permission">${escapeHtml(region.attributes || '—')}</span></div>
    <p><strong>${escapeHtml(explanation.role)}</strong><span>${escapeHtml(explanation.description)}</span></p>
    <dl><div><dt>虚拟地址</dt><dd>${formatAddress(region.address)}</dd></div><div><dt>结束地址</dt><dd>${formatAddress(region.address + region.size)}</dd></div><div><dt>内存大小</dt><dd>${formatBytes(region.size)}</dd></div><div><dt>文件映射</dt><dd>${Number.isFinite(region.fileSize) ? formatBytes(region.fileSize) : formatBytes(region.used || 0)}</dd></div>${zeroFill === null ? '' : `<div><dt>零填充</dt><dd>${formatBytes(zeroFill)}</dd></div>`}<div><dt>内部段</dt><dd>${sections.length.toLocaleString()}</dd></div></dl>
    <div class="region-contained-sections"><div><strong>包含的 section</strong><span>悬停查看用途与权限</span></div><div class="region-section-chips">${sectionChips}</div></div>
  </article>`;
}

function renderSections() {
  const sections = [...state.result.sections].filter((section) => section.size > 0).sort((left, right) => left.address - right.address);
  elements.sectionCount.textContent = `${sections.length.toLocaleString()} 个段 · 悬停或聚焦查看完整说明`;
  elements.sectionTableBody.innerHTML = sections.length ? sections.map((section) => {
    const explanation = explainMemoryItem(section);
    return `<tr class="section-row" tabindex="0" data-tooltip="${escapeHtml(JSON.stringify(tooltipPayload(section, { endAddress: section.address + section.size })))}" aria-label="${escapeHtml(section.name)}，${escapeHtml(explanation.role)}">
      <td><div class="name-cell"><span class="category-dot ${section.category}"></span><strong>${escapeHtml(section.name)}</strong></div></td>
      <td><div class="section-role"><strong>${escapeHtml(explanation.role)}</strong><small>${escapeHtml(explanation.description)}</small></div></td>
      <td class="mono">${formatAddress(section.address)}</td><td class="mono">${formatAddress(section.address + section.size)}</td><td class="mono">${formatBytes(section.size)}</td>
      <td>${categoryMeta[section.category]?.label || '其他'}</td><td title="${escapeHtml([section.module, section.object || section.source || section.attributes].filter(Boolean).join(' · '))}">${escapeHtml([section.module, section.object || section.attributes || section.type].filter(Boolean).join(' · ') || '—')}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="7"><div class="empty-inline">没有可显示的段</div></td></tr>';

  const resultGroups = activeResults().map((result) => ({ result, regions: regionsForResult(result) })).filter((group) => group.regions.length);
  if (!resultGroups.length) {
    elements.regionCards.classList.remove('grouped');
    elements.regionCards.innerHTML = '<div class="empty-inline">没有读取到内存区域定义</div>';
    return;
  }
  if (resultGroups.length === 1) {
    elements.regionCards.classList.remove('grouped');
    elements.regionCards.innerHTML = resultGroups[0].regions.map(renderRegionCard).join('');
    return;
  }
  const entryModule = activeProcessGroup()?.entry?.moduleName;
  elements.regionCards.classList.add('grouped');
  elements.regionCards.innerHTML = resultGroups.map(({ result, regions }) => `<details class="region-module-group" ${result.moduleName === entryModule ? 'open' : ''}>
    <summary><div><span class="region-kind ${result.elf?.role === 'executable' ? 'executable' : 'module'}">${result.elf?.role === 'executable' ? 'EXE' : 'SO'}</span><strong>${escapeHtml(result.moduleName)}</strong></div><span>${regions.length} 个加载区域 · ${result.sections.filter((section) => section.level !== 'input').length} 个 section</span></summary>
    <div class="region-module-regions">${regions.map(renderRegionCard).join('')}</div>
  </details>`).join('');
}

function switchView(viewName) {
  if (!state.result && viewName !== 'overview') return;
  state.activeView = viewName;
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === viewName));
  document.querySelectorAll('.view').forEach((view) => view.classList.add('hidden'));
  document.querySelector(`#view-${viewName}`)?.classList.remove('hidden');
  [elements.viewKicker.textContent, elements.viewTitle.textContent] = viewMeta[viewName];
  if (viewName === 'symbols') renderSymbolTable();
}

function focusSymbol(symbolId) {
  const symbol = state.result.symbols.find((entry) => entry.id === symbolId);
  if (!symbol) return;
  state.symbolQuery = symbol.name;
  elements.globalSearch.value = symbol.name;
  state.symbolPage = 1;
  switchView('symbols');
  renderSymbolTable();
  document.querySelector(`tr[data-symbol-id="${CSS.escape(symbolId)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function showTooltip(event, target) {
  let data;
  try { data = JSON.parse(target.dataset.tooltip); } catch { return; }
  const meta = categoryMeta[data.category] || categoryMeta.other;
  const details = [
    `<div><dt>${data.internalAddress === undefined ? '地址' : '模拟地址'}</dt><dd>${formatAddress(data.address)}</dd></div>`,
    data.internalAddress === undefined ? '' : `<div><dt>模块内地址</dt><dd>${formatAddress(data.internalAddress)}</dd></div>`,
    Number.isFinite(data.endAddress) ? `<div><dt>结束地址</dt><dd>${formatAddress(data.endAddress)}</dd></div>` : '',
    `<div><dt>大小</dt><dd>${formatBytes(data.size)}</dd></div>`,
    Number.isFinite(data.fileOffset) ? `<div><dt>文件偏移</dt><dd>${formatAddress(data.fileOffset)}</dd></div>` : '',
    Number.isFinite(data.fileSize) ? `<div><dt>文件映射</dt><dd>${formatBytes(data.fileSize)}</dd></div>` : '',
    Number.isFinite(data.physicalAddress) && data.physicalAddress !== data.address ? `<div><dt>物理/LMA</dt><dd>${formatAddress(data.physicalAddress)}</dd></div>` : '',
    Number.isFinite(data.sectionCount) ? `<div><dt>内部段</dt><dd>${data.sectionCount.toLocaleString()}</dd></div>` : '',
    data.containedSections?.length ? `<div><dt>包含段</dt><dd>${escapeHtml(data.containedSections.slice(0, 8).join('、'))}${data.containedSections.length > 8 ? '…' : ''}</dd></div>` : '',
    data.attributes ? `<div><dt>属性</dt><dd>${escapeHtml(data.attributes)}</dd></div>` : ''
  ].filter(Boolean).join('');
  elements.tooltip.innerHTML = `<strong>${escapeHtml(data.name)}</strong><span><i style="background:${meta.color}"></i>${escapeHtml(data.role || meta.label)}${data.module ? ` · ${escapeHtml(data.module)}` : ''}</span><p>${escapeHtml(data.description || '')}</p>${data.permissions ? `<small>${escapeHtml(data.permissions)}</small>` : ''}<dl>${details}</dl>`;
  elements.tooltip.classList.remove('hidden');
  const bounds = elements.tooltip.getBoundingClientRect();
  const x = Math.max(12, Math.min(window.innerWidth - bounds.width - 12, event.clientX + 14));
  const y = Math.max(12, Math.min(window.innerHeight - bounds.height - 12, event.clientY + 14));
  elements.tooltip.style.transform = `translate(${x}px, ${y}px)`;
}

function exportResult() {
  if (!state.result) return;
  const blob = new Blob([JSON.stringify(state.result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${state.result.file.name.replace(/\.[^.]+$/, '')}-firmware-vision.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast('分析结果已导出');
}

function chooseFile() {
  elements.fileInput.value = '';
  elements.fileInput.click();
}

function chooseFolder() {
  elements.folderInput.value = '';
  elements.folderInput.click();
}

elements.openFileButton.addEventListener('click', chooseFile);
elements.openFolderButton.addEventListener('click', chooseFolder);
elements.replaceFileButton.addEventListener('click', chooseFile);
elements.dropZone.addEventListener('click', chooseFile);
elements.retryButton.addEventListener('click', chooseFile);
elements.fileInput.addEventListener('change', () => openFiles(elements.fileInput.files));
elements.folderInput.addEventListener('change', () => openFiles(elements.folderInput.files, true));
elements.exportButton.addEventListener('click', exportResult);

for (const eventName of ['dragenter', 'dragover']) {
  elements.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); elements.dropZone.classList.add('dragging'); });
  document.body.addEventListener(eventName, (event) => event.preventDefault());
}
for (const eventName of ['dragleave', 'drop']) elements.dropZone.addEventListener(eventName, () => elements.dropZone.classList.remove('dragging'));
elements.dropZone.addEventListener('drop', (event) => { event.preventDefault(); openFiles(event.dataTransfer.files); });
document.body.addEventListener('drop', (event) => {
  event.preventDefault();
  if (!elements.emptyState.contains(event.target) && event.dataTransfer.files.length) openFiles(event.dataTransfer.files);
});

document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
document.querySelectorAll('[data-jump]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.jump)));
document.querySelectorAll('[data-layout-mode]').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('[data-layout-mode]').forEach((item) => item.classList.toggle('active', item === button));
  elements.addressLayout.classList.toggle('hidden', button.dataset.layoutMode !== 'address');
  elements.treemapLayout.classList.toggle('hidden', button.dataset.layoutMode !== 'treemap');
  elements.simulationView.classList.toggle('hidden', button.dataset.layoutMode !== 'simulation');
  state.simulation.active = button.dataset.layoutMode === 'simulation';
  if (state.simulation.active) renderSimulation();
  else if (state.result) renderSymbolTable();
}));
elements.regenerateSimulation.addEventListener('click', renderSimulation);
elements.processSelector.addEventListener('change', () => selectProcess(elements.processSelector.value));
elements.simulationSymbolSearch.addEventListener('input', renderSimulationSymbols);
document.querySelectorAll('[data-simulation-type]').forEach((button) => button.addEventListener('click', () => {
  state.simulation.mode = button.dataset.simulationType;
  renderSimulation();
}));

document.querySelectorAll('#symbol-filters .filter').forEach((button) => button.addEventListener('click', () => {
  state.symbolFilter = button.dataset.filter;
  state.symbolPage = 1;
  document.querySelectorAll('#symbol-filters .filter').forEach((item) => item.classList.toggle('active', item === button));
  renderSymbolTable();
}));

elements.globalSearch.addEventListener('input', () => {
  state.symbolQuery = elements.globalSearch.value;
  state.symbolPage = 1;
  if (state.result && state.symbolQuery.trim()) switchView('symbols');
  if (state.result) renderSymbolTable();
});
elements.prevPage.addEventListener('click', () => { state.symbolPage -= 1; renderSymbolTable(); });
elements.nextPage.addEventListener('click', () => { state.symbolPage += 1; renderSymbolTable(); });
document.querySelectorAll('[data-sort]').forEach((button) => button.addEventListener('click', () => {
  const key = button.dataset.sort;
  state.symbolSort = { key, direction: state.symbolSort.key === key && state.symbolSort.direction === 'asc' ? 'desc' : 'asc' };
  renderSymbolTable();
}));

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-symbol-id]');
  if (target) focusSymbol(target.dataset.symbolId);
});
document.addEventListener('pointermove', (event) => {
  const target = event.target.closest('[data-tooltip]');
  if (target) showTooltip(event, target); else elements.tooltip.classList.add('hidden');
});
document.addEventListener('focusin', (event) => {
  const target = event.target.closest?.('[data-tooltip]');
  if (!target) return;
  const bounds = target.getBoundingClientRect();
  showTooltip({ clientX: bounds.left + bounds.width / 2, clientY: bounds.bottom }, target);
});
document.addEventListener('focusout', (event) => {
  if (event.target.closest?.('[data-tooltip]')) elements.tooltip.classList.add('hidden');
});
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && document.activeElement !== elements.globalSearch) {
    event.preventDefault();
    elements.globalSearch.focus();
  }
  if (event.key === 'Escape') elements.globalSearch.blur();
});
