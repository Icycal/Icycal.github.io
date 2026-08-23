function stripComment(line) {
  let quote = "";
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if ((char === '"' || char === "'") && line[index - 1] !== "\\") {
      quote = quote === char ? "" : quote || char;
    }
    if (char === "#" && !quote && (index === 0 || /\s/.test(line[index - 1]))) {
      return line.slice(0, index).trimEnd();
    }
  }
  return line.trimEnd();
}

function splitKeyValue(value) {
  let quote = "";
  let bracketDepth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === '"' || char === "'") && value[index - 1] !== "\\") {
      quote = quote === char ? "" : quote || char;
    }
    if (!quote && "[{".includes(char)) bracketDepth += 1;
    if (!quote && "]}".includes(char)) bracketDepth -= 1;
    if (char === ":" && !quote && bracketDepth === 0 && (index === value.length - 1 || /\s/.test(value[index + 1]))) {
      return [value.slice(0, index).trim(), value.slice(index + 1).trim()];
    }
  }
  return null;
}

function parseQuoted(value) {
  if (value.startsWith('"')) return JSON.parse(value);
  return value.slice(1, -1).replaceAll("''", "'");
}

function parseScalar(value) {
  const input = value.trim();
  if (!input) return null;
  if ((input.startsWith('"') && input.endsWith('"')) || (input.startsWith("'") && input.endsWith("'"))) {
    return parseQuoted(input);
  }
  if (input === "null" || input === "Null" || input === "NULL" || input === "~") return null;
  if (/^(true|false)$/i.test(input)) return input.toLowerCase() === "true";
  if (/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(input)) return Number(input);
  if ((input.startsWith("[") && input.endsWith("]")) || (input.startsWith("{") && input.endsWith("}"))) {
    try {
      return JSON.parse(input.replace(/'/g, '"'));
    } catch {
      return input;
    }
  }
  return input;
}

function tokenize(text) {
  return String(text)
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((raw, lineNumber) => {
      const line = stripComment(raw.replace(/\t/g, "  "));
      return {
        raw,
        lineNumber: lineNumber + 1,
        indent: line.match(/^ */)[0].length,
        text: line.trim(),
      };
    })
    .filter((line) => line.text && line.text !== "---" && line.text !== "...");
}

export function parseYaml(text) {
  const lines = tokenize(text);

  function parseBlock(start, indent) {
    if (start >= lines.length) return [null, start];
    return lines[start].text.startsWith("-")
      ? parseSequence(start, indent)
      : parseMapping(start, indent);
  }

  function readBlockScalar(start, parentIndent, folded) {
    const values = [];
    let index = start;
    let contentIndent = null;
    while (index < lines.length && lines[index].indent > parentIndent) {
      if (contentIndent == null) contentIndent = lines[index].indent;
      values.push(lines[index].raw.slice(Math.min(contentIndent, lines[index].raw.length)));
      index += 1;
    }
    return [folded ? values.join(" ").replace(/\s+/g, " ").trim() : values.join("\n"), index];
  }

  function parseMapping(start, indent) {
    const result = {};
    let index = start;
    while (index < lines.length && lines[index].indent === indent && !lines[index].text.startsWith("-")) {
      const pair = splitKeyValue(lines[index].text);
      if (!pair) throw new Error(`YAML 第 ${lines[index].lineNumber} 行缺少键值分隔符`);
      const [rawKey, rawValue] = pair;
      const key = rawKey.startsWith('"') || rawKey.startsWith("'") ? parseQuoted(rawKey) : rawKey;
      if (/^[>|][+-]?$/.test(rawValue)) {
        [result[key], index] = readBlockScalar(index + 1, indent, rawValue.startsWith(">"));
        continue;
      }
      if (rawValue) {
        result[key] = parseScalar(rawValue);
        index += 1;
        continue;
      }
      const next = lines[index + 1];
      if (!next || next.indent <= indent) {
        result[key] = null;
        index += 1;
      } else {
        [result[key], index] = parseBlock(index + 1, next.indent);
      }
    }
    return [result, index];
  }

  function parseSequence(start, indent) {
    const result = [];
    let index = start;
    while (index < lines.length && lines[index].indent === indent && lines[index].text.startsWith("-")) {
      const rest = lines[index].text.slice(1).trim();
      if (!rest) {
        const next = lines[index + 1];
        if (!next || next.indent <= indent) {
          result.push(null);
          index += 1;
        } else {
          let value;
          [value, index] = parseBlock(index + 1, next.indent);
          result.push(value);
        }
        continue;
      }
      const pair = splitKeyValue(rest);
      if (!pair) {
        result.push(parseScalar(rest));
        index += 1;
        continue;
      }
      const object = {};
      const [rawKey, rawValue] = pair;
      const key = rawKey.startsWith('"') || rawKey.startsWith("'") ? parseQuoted(rawKey) : rawKey;
      if (/^[>|][+-]?$/.test(rawValue)) {
        [object[key], index] = readBlockScalar(index + 1, indent, rawValue.startsWith(">"));
      } else if (rawValue) {
        object[key] = parseScalar(rawValue);
        index += 1;
      } else {
        const next = lines[index + 1];
        if (next && next.indent > indent) {
          [object[key], index] = parseBlock(index + 1, next.indent);
        } else {
          object[key] = null;
          index += 1;
        }
      }
      const next = lines[index];
      if (next && next.indent > indent && !next.text.startsWith("-")) {
        let extra;
        [extra, index] = parseMapping(index, next.indent);
        Object.assign(object, extra);
      }
      result.push(object);
    }
    return [result, index];
  }

  if (!lines.length) return {};
  const [result, end] = parseBlock(0, lines[0].indent);
  if (end < lines.length) throw new Error(`YAML 第 ${lines[end].lineNumber} 行缩进无法解析`);
  return result;
}

function quoteString(value) {
  if (value === "" || /^(null|true|false|~)$/i.test(value) || /^[-+]?\d/.test(value) || /[:#\[\]{},&*!|>'"%@`\n\r\t]/.test(value) || /^\s|\s$/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}

function scalarToYaml(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return quoteString(String(value));
}

export function dumpYaml(value) {
  function write(node, indent) {
    const pad = " ".repeat(indent);
    if (Array.isArray(node)) {
      if (!node.length) return [`${pad}[]`];
      const lines = [];
      for (const item of node) {
        if (item && typeof item === "object") {
          const nested = write(item, indent + 2);
          lines.push(`${pad}-${nested[0].trimStart().startsWith("-") ? "" : " "}${nested[0].trimStart()}`);
          lines.push(...nested.slice(1));
        } else {
          lines.push(`${pad}- ${scalarToYaml(item)}`);
        }
      }
      return lines;
    }
    if (node && typeof node === "object") {
      const entries = Object.entries(node).filter(([, item]) => item !== undefined);
      if (!entries.length) return [`${pad}{}`];
      const lines = [];
      for (const [key, item] of entries) {
        const safeKey = /^[A-Za-z0-9_./{}-]+$/.test(key) ? key : JSON.stringify(key);
        if (item && typeof item === "object") {
          if (Array.isArray(item) && !item.length) lines.push(`${pad}${safeKey}: []`);
          else if (!Array.isArray(item) && !Object.keys(item).length) lines.push(`${pad}${safeKey}: {}`);
          else {
            lines.push(`${pad}${safeKey}:`);
            lines.push(...write(item, indent + 2));
          }
        } else if (typeof item === "string" && item.includes("\n")) {
          lines.push(`${pad}${safeKey}: |-`);
          lines.push(...item.split("\n").map((line) => `${" ".repeat(indent + 2)}${line}`));
        } else {
          lines.push(`${pad}${safeKey}: ${scalarToYaml(item)}`);
        }
      }
      return lines;
    }
    return [`${pad}${scalarToYaml(node)}`];
  }
  return `${write(value, 0).join("\n")}\n`;
}
