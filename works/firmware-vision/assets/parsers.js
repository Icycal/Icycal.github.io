const textDecoder = new TextDecoder('utf-8');

const MACHINE_NAMES = {
  3: 'x86', 8: 'MIPS', 20: 'PowerPC', 40: 'ARM', 42: 'SuperH', 62: 'x86-64',
  83: 'AVR', 94: 'Xtensa', 183: 'AArch64', 243: 'RISC-V'
};

const SECTION_TYPES = {
  0: 'NULL', 1: 'PROGBITS', 2: 'SYMTAB', 3: 'STRTAB', 4: 'RELA', 5: 'HASH', 6: 'DYNAMIC',
  7: 'NOTE', 8: 'NOBITS', 9: 'REL', 10: 'SHLIB', 11: 'DYNSYM', 14: 'INIT_ARRAY', 15: 'FINI_ARRAY', 16: 'PREINIT_ARRAY'
};

const SYMBOL_TYPES = { 0: 'other', 1: 'object', 2: 'function', 3: 'section', 4: 'file', 5: 'common', 6: 'tls' };
const SYMBOL_BINDINGS = { 0: 'local', 1: 'global', 2: 'weak', 10: 'unique' };
const ELF_TYPES = { 0: 'None', 1: 'Relocatable', 2: 'Executable', 3: 'Shared Object / PIE', 4: 'Core' };

function readUint64(view, offset, littleEndian) {
  const lowOffset = littleEndian ? offset : offset + 4;
  const highOffset = littleEndian ? offset + 4 : offset;
  return Number((BigInt(view.getUint32(highOffset, littleEndian)) << 32n) | BigInt(view.getUint32(lowOffset, littleEndian)));
}

function readCString(bytes, offset) {
  if (!Number.isFinite(offset) || offset < 0 || offset >= bytes.length) return '';
  let end = offset;
  while (end < bytes.length && bytes[end] !== 0) end += 1;
  return textDecoder.decode(bytes.subarray(offset, end));
}

function normalizeAddress(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function hex(value, width = 8) {
  return `0x${Math.max(0, Number(value) || 0).toString(16).toUpperCase().padStart(width, '0')}`;
}

function categoryFor(name, flags = 0, type = '') {
  const lower = String(name || '').toLowerCase();
  if (lower.includes('bss') || lower.includes('zi') || type === 'NOBITS') return 'bss';
  if (lower.includes('text') || lower.includes('code') || lower.includes('init') || lower.includes('fini') || (flags & 0x4)) return 'code';
  if (lower.includes('rodata') || lower.includes('const') || lower.includes('arm.ex') || lower.includes('isr_vector')) return 'rodata';
  if (lower.includes('data') || lower.includes('rw') || /(^|[._-])ram([._-]|$)/.test(lower) || (flags & 0x1)) return 'data';
  return 'other';
}

function isMetadataSection(name) {
  return /^(?:\.debug|\.zdebug|\.comment|\.stab|\.gnu_debug|\.symtab|\.strtab|\.shstrtab)/i.test(String(name || ''));
}

function buildTotals(sections) {
  const totals = { flash: 0, ram: 0, code: 0, rodata: 0, data: 0, bss: 0, other: 0, total: 0 };
  const topLevel = sections.filter((section) => section.level !== 'input' && section.alloc !== false);
  for (const section of topLevel) {
    const size = Number(section.size) || 0;
    const category = section.category || categoryFor(section.name, section.flags, section.type);
    totals[category] = (totals[category] || 0) + size;
    totals.total += size;
    if (category !== 'bss') totals.flash += size;
    if (category === 'data' || category === 'bss') totals.ram += size;
  }
  return totals;
}

function finalizeResult(result) {
  result.sections = result.sections
    .filter((item) => item && Number(item.size) >= 0)
    .map((item, index) => ({ id: `section-${index}`, ...item, address: normalizeAddress(item.address), size: Number(item.size) || 0 }));
  const uniqueSymbols = new Map();
  for (const symbol of result.symbols) {
    if (!symbol?.name || symbol.name === '$d' || symbol.name === '$t') continue;
    const key = [symbol.name, Number(symbol.address) || 0, Number(symbol.size) || 0, symbol.type || '', symbol.section || ''].join('\u0000');
    if (!uniqueSymbols.has(key)) uniqueSymbols.set(key, symbol);
  }
  result.symbols = [...uniqueSymbols.values()]
    .map((item, index) => ({ id: `symbol-${index}`, ...item, address: normalizeAddress(item.address), size: Number(item.size) || 0 }));
  result.regions = result.regions.map((item, index) => ({ id: `region-${index}`, ...item, address: normalizeAddress(item.address), size: Number(item.size) || 0 }));
  result.totals = buildTotals(result.sections);

  for (const region of result.regions) {
    if (!Number.isFinite(region.used)) {
      region.used = result.sections
        .filter((section) => section.level !== 'input' && section.address >= region.address && section.address < region.address + region.size)
        .reduce((sum, section) => sum + section.size, 0);
    }
  }
  return result;
}

function parseElf(buffer, file) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes.length < 52) throw new Error('ELF 文件过小或已损坏。');
  const elfClass = bytes[4];
  const dataEncoding = bytes[5];
  if (![1, 2].includes(elfClass)) throw new Error('暂不支持该 ELF 位数。');
  if (![1, 2].includes(dataEncoding)) throw new Error('无法识别 ELF 字节序。');
  const is64 = elfClass === 2;
  const littleEndian = dataEncoding === 1;
  const readWord = (offset) => is64 ? readUint64(view, offset, littleEndian) : view.getUint32(offset, littleEndian);
  const elfTypeValue = view.getUint16(16, littleEndian);
  const machine = view.getUint16(18, littleEndian);
  const entry = readWord(is64 ? 24 : 24);
  const programOffset = readWord(is64 ? 32 : 28);
  const sectionOffset = readWord(is64 ? 40 : 32);
  const programEntrySize = view.getUint16(is64 ? 54 : 42, littleEndian);
  const programCount = view.getUint16(is64 ? 56 : 44, littleEndian);
  const sectionEntrySize = view.getUint16(is64 ? 58 : 46, littleEndian);
  const sectionCount = view.getUint16(is64 ? 60 : 48, littleEndian);
  const sectionNameIndex = view.getUint16(is64 ? 62 : 50, littleEndian);

  if (sectionCount > 65535 || sectionOffset + sectionCount * sectionEntrySize > bytes.length) throw new Error('ELF 段表越界，文件可能不完整。');

  const rawSections = [];
  for (let index = 0; index < sectionCount; index += 1) {
    const offset = sectionOffset + index * sectionEntrySize;
    const nameOffset = view.getUint32(offset, littleEndian);
    const typeValue = view.getUint32(offset + 4, littleEndian);
    const flags = is64 ? readUint64(view, offset + 8, littleEndian) : view.getUint32(offset + 8, littleEndian);
    const address = readWord(offset + (is64 ? 16 : 12));
    const fileOffset = readWord(offset + (is64 ? 24 : 16));
    const size = readWord(offset + (is64 ? 32 : 20));
    const link = view.getUint32(offset + (is64 ? 40 : 24), littleEndian);
    const entrySize = readWord(offset + (is64 ? 56 : 36));
    rawSections.push({ index, nameOffset, typeValue, flags, address, fileOffset, size, link, entrySize });
  }

  const namesSection = rawSections[sectionNameIndex];
  const namesBytes = namesSection ? bytes.subarray(namesSection.fileOffset, namesSection.fileOffset + namesSection.size) : new Uint8Array();
  for (const section of rawSections) section.name = readCString(namesBytes, section.nameOffset) || `(section ${section.index})`;

  const sections = rawSections
    .filter((section) => section.index > 0 && section.size > 0 && section.flags & 0x2)
    .map((section) => ({
      name: section.name,
      address: section.address,
      size: section.size,
      offset: section.fileOffset,
      flags: section.flags,
      alloc: true,
      type: SECTION_TYPES[section.typeValue] || `TYPE_${section.typeValue}`,
      category: categoryFor(section.name, section.flags, SECTION_TYPES[section.typeValue]),
      attributes: [section.flags & 0x2 ? 'ALLOC' : '', section.flags & 0x2 ? 'READ' : '', section.flags & 0x1 ? 'WRITE' : '', section.flags & 0x4 ? 'EXEC' : ''].filter(Boolean).join(' · ')
    }));

  const symbols = [];
  for (const symbolSection of rawSections.filter((section) => section.typeValue === 2 || section.typeValue === 11)) {
    const stringSection = rawSections[symbolSection.link];
    if (!stringSection || !symbolSection.entrySize) continue;
    const stringBytes = bytes.subarray(stringSection.fileOffset, stringSection.fileOffset + stringSection.size);
    const count = Math.min(Math.floor(symbolSection.size / symbolSection.entrySize), 1000000);
    for (let index = 0; index < count; index += 1) {
      const offset = symbolSection.fileOffset + index * symbolSection.entrySize;
      if (offset + symbolSection.entrySize > bytes.length) break;
      const nameOffset = view.getUint32(offset, littleEndian);
      const info = view.getUint8(offset + (is64 ? 4 : 12));
      const sectionIndex = view.getUint16(offset + (is64 ? 6 : 14), littleEndian);
      const address = is64 ? readUint64(view, offset + 8, littleEndian) : view.getUint32(offset + 4, littleEndian);
      const size = is64 ? readUint64(view, offset + 16, littleEndian) : view.getUint32(offset + 8, littleEndian);
      const name = readCString(stringBytes, nameOffset);
      const type = SYMBOL_TYPES[info & 0x0f] || 'other';
      if (!name || type === 'file' || type === 'section' || sectionIndex === 0) continue;
      const ownerSection = rawSections[sectionIndex];
      symbols.push({
        name,
        address,
        size,
        type,
        binding: SYMBOL_BINDINGS[info >> 4] || 'other',
        section: ownerSection?.name || `#${sectionIndex}`,
        category: categoryFor(ownerSection?.name || '', ownerSection?.flags || 0, SECTION_TYPES[ownerSection?.typeValue]),
        object: ''
      });
    }
  }

  const dependencies = [];
  let soname = '';
  for (const dynamicSection of rawSections.filter((section) => section.typeValue === 6)) {
    const stringSection = rawSections[dynamicSection.link];
    if (!stringSection) continue;
    const stringBytes = bytes.subarray(stringSection.fileOffset, stringSection.fileOffset + stringSection.size);
    const entrySize = dynamicSection.entrySize || (is64 ? 16 : 8);
    const count = Math.min(Math.floor(dynamicSection.size / entrySize), 100000);
    for (let index = 0; index < count; index += 1) {
      const offset = dynamicSection.fileOffset + index * entrySize;
      if (offset + entrySize > bytes.length) break;
      const tag = is64 ? readUint64(view, offset, littleEndian) : view.getUint32(offset, littleEndian);
      const value = is64 ? readUint64(view, offset + 8, littleEndian) : view.getUint32(offset + 4, littleEndian);
      if (tag === 0) break;
      if (tag === 1) {
        const dependency = readCString(stringBytes, value);
        if (dependency && !dependencies.includes(dependency)) dependencies.push(dependency);
      }
      if (tag === 14) soname = readCString(stringBytes, value);
    }
  }

  const regions = [];
  let interpreter = '';
  if (programCount && programEntrySize && programOffset + programCount * programEntrySize <= bytes.length) {
    for (let index = 0; index < programCount; index += 1) {
      const offset = programOffset + index * programEntrySize;
      const typeValue = view.getUint32(offset, littleEndian);
      const fileOffset = readWord(offset + (is64 ? 8 : 4));
      const fileSize = readWord(offset + (is64 ? 32 : 16));
      if (typeValue === 3) {
        interpreter = readCString(bytes, fileOffset);
        continue;
      }
      if (typeValue !== 1) continue;
      const flags = view.getUint32(offset + (is64 ? 4 : 24), littleEndian);
      const virtualAddress = readWord(offset + (is64 ? 16 : 8));
      const physicalAddress = readWord(offset + (is64 ? 24 : 12));
      const memorySize = readWord(offset + (is64 ? 40 : 20));
      regions.push({
        name: `LOAD ${regions.length + 1}`,
        address: virtualAddress,
        size: memorySize,
        used: memorySize,
        fileSize,
        fileOffset,
        physicalAddress,
        attributes: `${flags & 4 ? 'R' : ''}${flags & 2 ? 'W' : ''}${flags & 1 ? 'X' : ''}`,
        kind: flags & 2 ? 'ram' : 'flash'
      });
    }
  }

  const executableByName = !/\.so(?:\.|$)/i.test(file.name);
  const role = elfTypeValue === 2 || Boolean(interpreter) || (elfTypeValue === 3 && executableByName && !soname && entry > 0) ? 'executable' : elfTypeValue === 3 ? 'shared-library' : 'other';
  const roleLabel = role === 'executable' ? '可执行程序' : role === 'shared-library' ? '共享库' : '其他 ELF';

  return finalizeResult({
    format: 'ELF', file,
    elf: { typeValue: elfTypeValue, type: ELF_TYPES[elfTypeValue] || `Type ${elfTypeValue}`, role, interpreter, soname, dependencies, entry },
    metadata: {
      格式: `${is64 ? 'ELF64' : 'ELF32'} ${littleEndian ? 'Little Endian' : 'Big Endian'}`,
      架构: MACHINE_NAMES[machine] || `Machine ${machine}`,
      'ELF 类型': ELF_TYPES[elfTypeValue] || `Type ${elfTypeValue}`,
      运行角色: roleLabel,
      入口地址: hex(entry, is64 ? 16 : 8),
      动态依赖: dependencies.length,
      段数量: sections.length,
      符号数量: symbols.length
    },
    regions, sections, symbols, warnings: symbols.length ? [] : ['文件中未找到可用符号表，可能已经 strip。']
  });
}

function parseNumber(value) {
  if (!value) return 0;
  const normalized = String(value).replace(/,/g, '').trim();
  return normalized.toLowerCase().startsWith('0x') ? Number.parseInt(normalized, 16) : Number.parseInt(normalized, 10);
}

function inferSymbolSizes(symbols, sections) {
  const sectionMap = new Map(sections.filter((section) => section.level !== 'input').map((section) => [section.name, section]));
  const groups = new Map();
  for (const symbol of symbols) {
    const key = symbol.section || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(symbol);
  }
  for (const [sectionName, entries] of groups) {
    entries.sort((left, right) => left.address - right.address);
    const owner = sectionMap.get(sectionName);
    for (let index = 0; index < entries.length; index += 1) {
      if (entries[index].size > 0) continue;
      const nextAddress = entries[index + 1]?.address;
      const sectionEnd = owner ? owner.address + owner.size : entries[index].address;
      const end = Number.isFinite(nextAddress) ? nextAddress : sectionEnd;
      entries[index].size = Math.max(0, end - entries[index].address);
    }
  }
}

function detectMapFlavor(text) {
  if (/Execution Region|Load Region|Image component sizes|ARM Linker/i.test(text)) return 'Keil MAP';
  if (/Memory Configuration|Linker script and memory map|OUTPUT\(/i.test(text)) return 'GCC MAP';
  return 'MAP';
}

function parseGccMap(text, file) {
  const lines = text.split(/\r?\n/);
  const regions = [];
  const sections = [];
  const symbols = [];
  let inMemoryConfiguration = false;
  let currentSection = '';
  let pendingSectionName = '';

  for (const line of lines) {
    if (/^Memory Configuration\s*$/i.test(line.trim())) { inMemoryConfiguration = true; continue; }
    if (/^Linker script and memory map\s*$/i.test(line.trim())) { inMemoryConfiguration = false; continue; }
    if (inMemoryConfiguration) {
      const match = line.match(/^\s*([*A-Za-z_][\w.*-]*)\s+(0x[\da-fA-F]+)\s+(0x[\da-fA-F]+)(?:\s+([!rwxal]+))?\s*$/);
      if (match && match[1] !== 'Name') {
        const address = parseNumber(match[2]);
        const size = parseNumber(match[3]);
        if (match[1] !== '*default*') regions.push({ name: match[1], address, size, attributes: match[4] || '', kind: /RAM|TCM/i.test(match[1]) || (!/FLASH|ROM|XIP/i.test(match[1]) && /w/i.test(match[4] || '') && !/x/i.test(match[4] || '')) ? 'ram' : 'flash' });
      }
      continue;
    }

    const sectionMatch = line.match(/^(\s*)(\.[\w.$+-]+)\s+(0x[\da-fA-F]+)\s+(0x[\da-fA-F]+)(?:\s+(.+))?$/);
    if (sectionMatch) {
      const indent = sectionMatch[1].length;
      const name = sectionMatch[2];
      const address = parseNumber(sectionMatch[3]);
      const size = parseNumber(sectionMatch[4]);
      const tail = (sectionMatch[5] || '').trim();
      const objectMatch = tail.match(/([^\s()]+\.(?:o|obj)|[^\s]+\.a\([^)]*\))/i);
      const level = objectMatch ? 'input' : 'output';
      if (level === 'output') currentSection = name;
      sections.push({
        name, address, size, level, object: objectMatch?.[1] || '', source: tail,
        alloc: !isMetadataSection(name), category: categoryFor(name), attributes: objectMatch?.[1] || (level === 'input' ? '输入段' : '输出段')
      });
      pendingSectionName = '';
      continue;
    }

    const wrappedSectionName = line.match(/^\s*(\.[\w.$+-]+)\s*$/);
    if (wrappedSectionName) { pendingSectionName = wrappedSectionName[1]; continue; }
    const wrappedSectionBody = pendingSectionName && line.match(/^\s*(0x[\da-fA-F]+)\s+(0x[\da-fA-F]+)(?:\s+(.+))?$/);
    if (wrappedSectionBody) {
      const name = pendingSectionName;
      const address = parseNumber(wrappedSectionBody[1]);
      const size = parseNumber(wrappedSectionBody[2]);
      const tail = (wrappedSectionBody[3] || '').trim();
      const objectMatch = tail.match(/([^\s()]+\.(?:o|obj)|[^\s]+\.a\([^)]*\))/i);
      const level = objectMatch ? 'input' : 'output';
      if (level === 'output') currentSection = name;
      sections.push({ name, address, size, level, object: objectMatch?.[1] || '', source: tail, alloc: !isMetadataSection(name), category: categoryFor(name), attributes: objectMatch?.[1] || (level === 'input' ? '输入段' : '输出段') });
      pendingSectionName = '';
      continue;
    }
    pendingSectionName = '';

    const addressSymbolMatch = line.match(/^\s*(0x[\da-fA-F]+)\s+([A-Za-z_.$][\w.$@+-]*)(?:\s*=.*)?\s*$/);
    if (addressSymbolMatch && !/[=*]/.test(addressSymbolMatch[2])) {
      symbols.push({ name: addressSymbolMatch[2], address: parseNumber(addressSymbolMatch[1]), size: 0, type: 'other', binding: '', section: currentSection, category: categoryFor(currentSection), object: '' });
      continue;
    }

    const sizedSymbolMatch = line.match(/^\s*(0x[\da-fA-F]+)\s+(0x[\da-fA-F]+)\s+([A-Za-z_.$][\w.$@+-]+)(?:\s+(.+))?$/);
    if (sizedSymbolMatch) {
      symbols.push({ name: sizedSymbolMatch[3], address: parseNumber(sizedSymbolMatch[1]), size: parseNumber(sizedSymbolMatch[2]), type: 'other', binding: '', section: currentSection, category: categoryFor(currentSection), object: sizedSymbolMatch[4] || '' });
    }
  }

  const topSections = sections.filter((section) => section.level !== 'input');
  for (const symbol of symbols) {
    const owner = topSections.find((section) => symbol.address >= section.address && symbol.address < section.address + section.size);
    if (owner) {
      symbol.section = owner.name;
      symbol.category = owner.category;
      symbol.type = owner.category === 'code' ? 'function' : owner.category === 'data' || owner.category === 'bss' ? 'object' : 'other';
    }
  }
  inferSymbolSizes(symbols, topSections);

  return finalizeResult({
    format: 'GCC MAP', file,
    metadata: { 格式: 'GNU ld / GCC MAP', 内存区域: regions.length, 输出段: topSections.length, 符号数量: symbols.length },
    regions, sections, symbols,
    warnings: regions.length ? [] : ['未读取到 Memory Configuration，区域容量占用将仅按段统计。']
  });
}

function parseKeilMap(text, file) {
  const lines = text.split(/\r?\n/);
  const regions = [];
  const sections = [];
  const symbols = [];
  let symbolTable = false;

  for (const line of lines) {
    const regionMatch = line.match(/^\s*(Execution|Load) Region\s+(\S+)\s+\(Base:\s*(0x[\da-fA-F]+),\s*Size:\s*(0x[\da-fA-F]+),\s*Max:\s*(0x[\da-fA-F]+)/i);
    if (regionMatch) {
      const regionType = regionMatch[1].toLowerCase();
      const name = regionMatch[2];
      const address = parseNumber(regionMatch[3]);
      const used = parseNumber(regionMatch[4]);
      const size = parseNumber(regionMatch[5]);
      const exists = regions.some((region) => region.name === name && region.address === address);
      if (!exists) regions.push({ name, address, size, used, regionType, attributes: /RAM|RW|ZI/i.test(name) || address >= 0x20000000 ? 'RW' : 'RX', kind: /RAM|RW|ZI/i.test(name) || address >= 0x20000000 ? 'ram' : 'flash' });
      continue;
    }

    if (/Image Symbol Table|Local Symbols|Global Symbols/i.test(line)) { symbolTable = true; continue; }
    if (/Memory Map of the image/i.test(line)) { symbolTable = false; continue; }

    const sectionMatch = line.match(/^\s*(0x[\da-fA-F]+)\s+(0x[\da-fA-F]+)\s+(Code|Data|Zero)\s+(RO|RW)\s+\d+\s+(\S+)\s+(.+)$/i);
    if (sectionMatch) {
      const address = parseNumber(sectionMatch[1]);
      const size = parseNumber(sectionMatch[2]);
      const memoryType = sectionMatch[3];
      const access = sectionMatch[4];
      const name = sectionMatch[5];
      const object = sectionMatch[6].trim();
      const category = /zero/i.test(memoryType) ? 'bss' : /code/i.test(memoryType) ? 'code' : /ro/i.test(access) ? 'rodata' : 'data';
      sections.push({ name, address, size, level: 'output', object, category, attributes: `${memoryType} · ${access}` });
      continue;
    }

    if (symbolTable) {
      const symbolMatch = line.match(/^\s*(\S+)\s+(0x[\da-fA-F]+)\s+(?:Thumb Code|ARM Code|Code|Data|Number|Section)\s+(0x[\da-fA-F]+|\d+)\s*(.*)$/i);
      if (symbolMatch) {
        const name = symbolMatch[1];
        const address = parseNumber(symbolMatch[2]);
        const size = parseNumber(symbolMatch[3]);
        const detail = symbolMatch[4].trim();
        const owner = sections.find((section) => address >= section.address && address < section.address + section.size);
        const category = owner?.category || categoryFor(detail);
        symbols.push({ name, address, size, type: category === 'code' ? 'function' : category === 'data' || category === 'bss' ? 'object' : 'other', binding: '', section: owner?.name || '', category, object: detail });
      }
    }
  }

  const displayRegions = regions.some((region) => region.regionType === 'execution') ? regions.filter((region) => region.regionType === 'execution') : regions;
  if (!sections.length && displayRegions.length) {
    for (const region of displayRegions) sections.push({ name: region.name, address: region.address, size: region.used, level: 'output', category: region.kind === 'ram' ? 'data' : 'code', attributes: region.attributes });
  }
  inferSymbolSizes(symbols, sections);

  return finalizeResult({
    format: 'Keil MAP', file,
    metadata: { 格式: 'Keil / Arm Linker MAP', 执行区域: displayRegions.length, 段数量: sections.length, 符号数量: symbols.length },
    regions: displayRegions,
    loadRegions: regions.filter((region) => region.regionType === 'load'),
    sections, symbols,
    warnings: symbols.length ? [] : ['当前 MAP 中未识别到 Image Symbol Table；资源区域仍可正常查看。']
  });
}

function parseMap(buffer, file) {
  const text = textDecoder.decode(buffer);
  const flavor = detectMapFlavor(text);
  if (flavor === 'Keil MAP') return parseKeilMap(text, file);
  return parseGccMap(text, file);
}

export function parseFirmware(buffer, file) {
  const bytes = new Uint8Array(buffer);
  const isElf = bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46;
  if (isElf) return parseElf(buffer, file);
  const preview = textDecoder.decode(bytes.subarray(0, Math.min(bytes.length, 8192)));
  if (/Memory Configuration|Linker script and memory map|Execution Region|Load Region|Image Symbol Table|Memory Map of the image/i.test(preview) || /\.map$/i.test(file.name)) return parseMap(buffer, file);
  throw new Error('无法识别文件格式。请选择有效的 ELF、AXF、OUT 或 MAP 文件。');
}
