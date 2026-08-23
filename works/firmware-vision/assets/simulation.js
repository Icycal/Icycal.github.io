export function alignDown(value, alignment) {
  return Math.floor(value / alignment) * alignment;
}

export function alignUp(value, alignment) {
  return Math.ceil(value / alignment) * alignment;
}

export function parseAddress(value, fallback = 0) {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  const parsed = text.toLowerCase().startsWith('0x') ? Number.parseInt(text, 16) : Number.parseInt(text, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function seedValue(seed) {
  let value = 2166136261;
  for (const character of String(seed || 'firmware-vision')) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return value >>> 0 || 1;
}

function createRandom(seed) {
  let value = seedValue(seed);
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

function moduleRange(result, pageSize) {
  const loadRanges = result.regions.map((region) => ({ address: region.address, size: region.size, attributes: region.attributes || '', name: region.name, kind: 'load' }));
  const sections = result.sections.filter((section) => section.level !== 'input' && section.alloc !== false && section.size > 0)
    .map((section) => ({ address: section.address, size: section.size, attributes: section.attributes || '', name: section.name, category: section.category, kind: 'section' }));
  const bounds = loadRanges.length ? loadRanges : sections;
  if (!bounds.length) return null;
  const minimum = alignDown(Math.min(...bounds.map((range) => range.address)), pageSize);
  const maximum = alignUp(Math.max(...bounds.map((range) => range.address + range.size)), pageSize);
  return { minimum, maximum, span: Math.max(pageSize, maximum - minimum), ranges: sections.length ? sections : bounds, loadRanges };
}

export function buildSimulatedLayout(results, options = {}) {
  const pageSize = Math.max(4096, parseAddress(options.pageSize, 4096));
  const moduleAlignment = Math.max(pageSize, parseAddress(options.moduleAlignment, 0x200000));
  const gapMinimum = Math.max(0, parseAddress(options.gapMinimum, 0x100000));
  const gapMaximum = Math.max(gapMinimum, parseAddress(options.gapMaximum, 0x1000000));
  const startBase = alignUp(parseAddress(options.startBase, 0x00007f0000000000), moduleAlignment);
  const random = createRandom(options.seed);
  const modules = [];
  let cursor = startBase;

  for (const result of results) {
    const range = moduleRange(result, pageSize);
    if (!range) continue;
    cursor = alignUp(cursor, moduleAlignment);
    const loadBias = cursor - range.minimum;
    const segments = range.ranges.map((segment) => ({
      ...segment,
      runtimeAddress: loadBias + segment.address,
      runtimeEnd: loadBias + segment.address + segment.size
    }));
    const module = {
      name: result.moduleName,
      format: result.format,
      fileSize: result.file.size,
      loadBias,
      internalStart: range.minimum,
      internalEnd: range.maximum,
      runtimeStart: cursor,
      runtimeEnd: cursor + range.span,
      span: range.span,
      addressRanges: [{ start: range.minimum, end: range.maximum }],
      segments,
      loadSegments: range.loadRanges.map((segment) => ({ ...segment, runtimeAddress: loadBias + segment.address, runtimeEnd: loadBias + segment.address + segment.size }))
    };
    modules.push(module);
    const randomGap = gapMinimum + Math.floor(random() * (gapMaximum - gapMinimum + 1));
    cursor = module.runtimeEnd + alignUp(randomGap, pageSize);
  }

  return {
    startAddress: modules[0]?.runtimeStart || startBase,
    endAddress: modules.at(-1)?.runtimeEnd || startBase,
    span: modules.length ? (modules.at(-1).runtimeEnd - modules[0].runtimeStart) : 0,
    modules,
    options: { startBase, pageSize, moduleAlignment, gapMinimum, gapMaximum, seed: String(options.seed || '') }
  };
}

function derivedMcuRegions(result, pageSize) {
  if (result.regions.length) return result.regions;
  const sections = result.sections.filter((section) => section.level !== 'input' && section.alloc !== false && section.size > 0);
  const groups = new Map();
  for (const section of sections) {
    const kind = ['data', 'bss'].includes(section.category) ? 'ram' : 'flash';
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(section);
  }
  return [...groups.entries()].map(([kind, entries]) => {
    const address = alignDown(Math.min(...entries.map((entry) => entry.address)), pageSize);
    const end = alignUp(Math.max(...entries.map((entry) => entry.address + entry.size)), pageSize);
    return { name: kind === 'ram' ? 'RAM（由段推断）' : 'FLASH（由段推断）', address, size: end - address, used: entries.reduce((sum, entry) => sum + entry.size, 0), kind, attributes: kind === 'ram' ? 'RW' : 'RX' };
  });
}

export function buildMcuLayout(results, options = {}) {
  const pageSize = Math.max(256, parseAddress(options.pageSize, 0x1000));
  const modules = results.map((result) => {
    const regions = derivedMcuRegions(result, pageSize).map((region) => {
      const sections = result.sections.filter((section) => section.level !== 'input' && section.alloc !== false && section.size > 0 && section.address >= region.address && section.address < region.address + region.size)
        .map((section) => ({ ...section, runtimeAddress: section.address, runtimeEnd: section.address + section.size }));
      return { ...region, runtimeAddress: region.address, runtimeEnd: region.address + region.size, sections };
    });
    const addressRanges = regions.map((region) => ({ start: region.address, end: region.address + region.size }));
    const allStarts = addressRanges.map((range) => range.start);
    const allEnds = addressRanges.map((range) => range.end);
    const startupActions = [];
    for (const section of result.sections.filter((section) => section.level !== 'input' && section.size > 0)) {
      const ownerRegion = regions.find((region) => section.address >= region.address && section.address < region.address + region.size);
      const loadAddress = ownerRegion && Number.isFinite(ownerRegion.physicalAddress) && ownerRegion.physicalAddress !== ownerRegion.address
        ? ownerRegion.physicalAddress + (section.address - ownerRegion.address)
        : null;
      if (section.category === 'data') startupActions.push({ type: 'copy', section: section.name, address: section.address, loadAddress, size: section.size, description: loadAddress === null ? '启动代码将已初始化数据从非易失存储加载镜像复制到可写 RAM。' : '启动代码将该段从 Flash 加载地址复制到 RAM 执行地址。' });
      if (section.category === 'bss') startupActions.push({ type: 'zero', section: section.name, address: section.address, size: section.size, description: '启动代码在进入 main 之前将该区域清零。' });
    }
    return {
      name: result.moduleName,
      format: result.format,
      loadBias: 0,
      internalStart: allStarts.length ? Math.min(...allStarts) : 0,
      internalEnd: allEnds.length ? Math.max(...allEnds) : 0,
      runtimeStart: allStarts.length ? Math.min(...allStarts) : 0,
      runtimeEnd: allEnds.length ? Math.max(...allEnds) : 0,
      span: regions.reduce((sum, region) => sum + region.size, 0),
      addressRanges,
      memoryRegions: regions,
      loadRegions: result.loadRegions || [],
      startupActions
    };
  }).filter((module) => module.addressRanges.length);
  const starts = modules.flatMap((module) => module.addressRanges.map((range) => range.start));
  const ends = modules.flatMap((module) => module.addressRanges.map((range) => range.end));
  return {
    mode: 'mcu',
    startAddress: starts.length ? Math.min(...starts) : 0,
    endAddress: ends.length ? Math.max(...ends) : 0,
    span: modules.reduce((sum, module) => sum + module.span, 0),
    modules,
    options: { pageSize }
  };
}

export function simulatedAddressFor(layout, moduleName, internalAddress) {
  const module = layout?.modules.find((entry) => entry.name === moduleName);
  const address = Number(internalAddress || 0);
  const insideRange = module?.addressRanges?.some((range) => address >= range.start && address < range.end)
    ?? (module && address >= module.internalStart && address < module.internalEnd);
  return module && insideRange ? module.loadBias + address : null;
}

function moduleBasename(result) {
  return String(result.moduleName || result.file?.name || '').split(/[\\/]/).at(-1);
}

export function buildLinuxProcessGroups(results) {
  const elfResults = results.filter((result) => result.format === 'ELF');
  const lookup = new Map();
  for (const result of elfResults) {
    const names = [moduleBasename(result), result.file?.name, result.elf?.soname].filter(Boolean);
    for (const name of names) if (!lookup.has(name)) lookup.set(name, result);
  }

  const executables = elfResults.filter((result) => result.elf?.role === 'executable');
  if (!executables.length) {
    return results.length ? [{
      id: 'all-modules',
      name: results.length === 1 ? moduleBasename(results[0]) : '共享库集合',
      entry: null,
      modules: results,
      unresolvedDependencies: [],
      directDependencies: []
    }] : [];
  }

  return executables.map((entry) => {
    const modules = [];
    const visited = new Set();
    const unresolved = new Set();
    const queue = [entry];
    while (queue.length) {
      const current = queue.shift();
      if (!current || visited.has(current.moduleName)) continue;
      visited.add(current.moduleName);
      modules.push(current);
      for (const dependencyName of current.elf?.dependencies || []) {
        const dependency = lookup.get(dependencyName);
        if (dependency) queue.push(dependency);
        else unresolved.add(dependencyName);
      }
    }
    return {
      id: entry.moduleName,
      name: moduleBasename(entry),
      entry,
      modules,
      directDependencies: entry.elf?.dependencies || [],
      unresolvedDependencies: [...unresolved].sort()
    };
  }).sort((left, right) => right.modules.length - left.modules.length || left.name.localeCompare(right.name));
}
