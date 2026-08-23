import { createEmptyProject, createObjectNode, createPrimitiveNode, createProperty, touchProject } from "./model.js";
import { schemaExample } from "./schema-codec.js";
import { createId, deepClone, escapeHtml, normalizePath, safeJsonParse, slugify } from "./utils.js";
import { parseYaml } from "./yaml.js";

const METADATA_PATTERN = /<!--\s*api-workbench-project:([A-Za-z0-9+/=]+)\s*-->/;

function decodeMetadata(value) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function parseTable(block) {
  const lines = block.split(/\r?\n/).filter((line) => line.trim().startsWith("|"));
  if (lines.length < 2) return [];
  const cells = (line) => line.trim().replace(/^\||\|$/g, "").split("|").map((value) => value.trim());
  const headers = cells(lines[0]);
  return lines.slice(2).map((line) => Object.fromEntries(cells(line).map((value, index) => [headers[index] || `column${index}`, value])));
}

function typeFromText(value) {
  const match = String(value || "string").match(/^(array|object|string|integer|number|boolean|null)(?:\(([^)]+)\))?/i);
  const type = match?.[1]?.toLowerCase() || "string";
  return createPrimitiveNode(type, { format: match?.[2] || "" });
}

function importGeneratedMetadata(text) {
  const match = text.match(METADATA_PATTERN);
  if (!match) return null;
  try {
    const project = decodeMetadata(match[1]);
    project.source = { type: "markdown-metadata", files: [], warnings: [] };
    touchProject(project);
    return project;
  } catch {
    return null;
  }
}

export function importMarkdown(text, filename = "") {
  const generated = importGeneratedMetadata(text);
  if (generated) {
    generated.source.files = [filename].filter(Boolean);
    return generated;
  }
  let body = text;
  let frontMatter = {};
  if (body.startsWith("---")) {
    const end = body.indexOf("\n---", 3);
    if (end > 0) {
      frontMatter = parseYaml(body.slice(4, end));
      body = body.slice(end + 4);
    }
  }
  const title = frontMatter.title || body.match(/^#\s+(.+)$/m)?.[1] || filename.replace(/\.md$/i, "") || "Markdown 接口文档";
  const project = createEmptyProject(title.trim());
  project.source = { type: "markdown", files: [filename].filter(Boolean), warnings: ["Markdown 为展示格式，未标记的模型引用只能尽力恢复。"] };
  project.apiFolders = [{ id: "folder_root", parentId: null, name: "根目录", order: 0, external: {} }];
  project.modelFolders = [{ id: "folder_models", parentId: null, name: "根目录", order: 0, external: {} }];
  const baseUrl = body.match(/Base URLs:[\s\S]*?href="([^"]+)"/i)?.[1] || "";
  project.environments = [{ id: createId("env"), name: "默认环境", baseUrl, variables: [] }];

  const endpointPattern = /^##\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|TRACE)\s+(.+)$/gm;
  const matches = [...body.matchAll(endpointPattern)];
  const dataModelsOffset = body.search(/^#\s+数据模型\s*$/m);
  const folderMap = new Map();
  const h1s = [...body.matchAll(/^#\s+(.+)$/gm)].filter((match) => ![title.trim(), "Authentication", "数据模型", "Schemas"].includes(match[1].trim()));
  const folderForOffset = (offset) => {
    const heading = h1s.filter((match) => match.index < offset).at(-1)?.[1]?.trim() || "未分组";
    if (!folderMap.has(heading)) {
      const id = `folder_${slugify(heading)}_${folderMap.size}`;
      folderMap.set(heading, id);
      project.apiFolders.push({ id, parentId: "folder_root", name: heading, order: folderMap.size, external: {} });
    }
    return folderMap.get(heading);
  };
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const nextEndpointOffset = matches[index + 1]?.index;
    const sectionEnd = nextEndpointOffset ?? (dataModelsOffset > match.index ? dataModelsOffset : body.length);
    const section = body.slice(match.index, sectionEnd);
    const method = match[1];
    const path = section.match(new RegExp(`^${method}\\s+(/\\S+)`, "m"))?.[1] || "/";
    const description = section.slice(section.indexOf(path) + path.length).split(/\n(?:>|###|```|\|)/)[0].trim();
    const jsonBlocks = [...section.matchAll(/```json\s*([\s\S]*?)```/g)].map((item) => safeJsonParse(item[1].trim(), null));
    const requestValue = section.includes("Body 请求参数") ? jsonBlocks[0] : null;
    const responseValue = jsonBlocks[section.includes("Body 请求参数") ? 1 : 0] ?? null;
    const parameterBlock = section.match(/### 请求参数\s*([\s\S]*?)(?=\n(?:####|>|### 返回|## |# ))/)?.[1] || "";
    const parameters = parseTable(parameterBlock).filter((row) => row["名称"] && row["名称"] !== "body" && !row["名称"].startsWith("»")).map((row) => ({
      id: createId("parameter"), name: row["名称"], location: row["位置"] || "query", description: row["说明"] || "", required: /是/.test(row["必选"] || ""), schema: typeFromText(row["类型"]), example: undefined, rawMetadata: {},
    }));
    project.endpoints.push({
      id: createId("endpoint"), folderId: folderForOffset(match.index), name: match[2].trim(), method, path: normalizePath(path), description, status: "developing", tags: [], operationId: "", order: project.endpoints.length, parameters,
      requestBody: { mode: requestValue === null ? "none" : "application/json", required: false, mediaType: "application/json", schema: requestValue === null ? null : inferSchema(requestValue), examples: requestValue === null ? [] : [{ id: createId("example"), name: "示例 1", value: requestValue, description: "" }] },
      responses: [{ id: createId("response"), statusCode: section.match(/>\s*(\d{3}) Response/)?.[1] || "200", name: "", description: "", mediaType: "application/json", headers: [], schema: responseValue === null ? null : inferSchema(responseValue), examples: responseValue === null ? [] : [{ id: createId("example"), name: "示例 1", value: responseValue, description: "" }], rawMetadata: {} }],
      external: {}, rawMetadata: {},
    });
  }

  const legacySchemaMatches = [...body.matchAll(/<h2 id="tocS_([^"]+)">([^<]+)<\/h2>/g)].map((match) => ({ index: match.index, name: match[2].trim() }));
  const standardSchemaMatches = dataModelsOffset < 0 ? [] : [...body.slice(dataModelsOffset).matchAll(/^##\s+(.+)$/gm)]
    .filter((match) => !/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|TRACE)\s+/i.test(match[1]))
    .map((match) => ({ index: dataModelsOffset + match.index, name: match[1].trim() }));
  const schemaMatches = [...legacySchemaMatches, ...standardSchemaMatches].sort((left, right) => left.index - right.index);
  project.models = schemaMatches.map((match, index) => {
    const section = body.slice(match.index, schemaMatches[index + 1]?.index ?? body.length);
    const table = parseTable(section);
    const root = createObjectNode();
    root.members = table.filter((row) => row["名称"] || row["Name"]).map((row) => {
      const name = String(row["名称"] || row["Name"]).replace(/^»\s*/, "");
      const schema = typeFromText(row["类型"] || row["Type"]);
      schema.description = row["说明"] || row["Description"] || "";
      return createProperty(name, schema, { required: /是|true/i.test(row["必选"] || row["Required"] || "") });
    });
    return { id: `model_md_${index}_${slugify(match.name)}`, name: match.name, displayName: "", description: "", folderId: "folder_models", order: index, root, external: { openapiKey: match.name }, rawMetadata: {} };
  });
  touchProject(project);
  return project;
}

function inferSchema(value) {
  if (Array.isArray(value)) return { id: createId("node"), kind: "array", title: "", description: "", nullable: false, items: inferSchema(value[0] ?? ""), examples: [deepClone(value)], constraints: {}, rawMetadata: {} };
  if (value && typeof value === "object") {
    const root = createObjectNode({ examples: [deepClone(value)] });
    root.members = Object.entries(value).map(([name, item]) => createProperty(name, inferSchema(item)));
    return root;
  }
  const type = value === null ? "null" : Number.isInteger(value) ? "integer" : typeof value === "number" ? "number" : typeof value;
  return createPrimitiveNode(type, { examples: [deepClone(value)] });
}

function schemaTypeLabel(node, modelIndex) {
  if (!node) return "—";
  if (node.kind === "reference") return modelIndex.get(node.targetModelId)?.name || "失效引用";
  if (node.kind === "composition") return node.operator;
  if (node.kind === "array") return `array<${schemaTypeLabel(node.items, modelIndex)}>`;
  return node.kind === "object" ? "object" : `${node.type}${node.format ? `(${node.format})` : ""}`;
}

function mergeAllOfRows(rows) {
  const merged = [];
  const byName = new Map();
  const mergeText = (left, right, separator) => {
    const values = [left, right].filter(Boolean);
    return [...new Set(values)].join(separator);
  };
  for (const row of rows) {
    const existing = byName.get(row.name);
    if (!existing) {
      const next = { ...row };
      byName.set(row.name, next);
      merged.push(next);
      continue;
    }
    existing.type = mergeText(existing.type, row.type, " & ");
    existing.required = existing.required || row.required;
    existing.description = mergeText(existing.description, row.description, "；");
    existing.source = mergeText(existing.source, row.source, " + ");
  }
  return merged;
}

function flattenSchema(node, modelIndex, prefix = "", stack = [], depth = 0) {
  if (!node || depth > 5) return [];
  if (node.kind === "reference") {
    const model = modelIndex.get(node.targetModelId);
    if (!model || stack.includes(model.id)) return [{ name: `${prefix || model?.name || "引用"} ↻`, type: model?.name || "失效引用", required: false, description: "循环或失效引用", source: model?.name || "" }];
    return flattenSchema(model.root, modelIndex, prefix, [...stack, model.id], depth + 1).map((row) => ({ ...row, source: row.source || model.name }));
  }
  if (node.kind === "composition") {
    const rows = node.members.flatMap((member) => flattenSchema(member, modelIndex, prefix, stack, depth + 1));
    return node.operator === "allOf" ? mergeAllOfRows(rows) : rows;
  }
  if (node.kind === "primitive") return [{ name: prefix || "根值", type: schemaTypeLabel(node, modelIndex), required: true, description: node.description || "", source: "" }];
  if (node.kind === "array") {
    const rows = prefix ? [] : [{ name: "根数组", type: schemaTypeLabel(node, modelIndex), required: true, description: node.description || "", source: "" }];
    const itemPrefix = `${prefix || ""}[]`;
    if (["object", "reference", "composition", "array"].includes(node.items?.kind)) rows.push(...flattenSchema(node.items, modelIndex, itemPrefix, stack, depth + 1));
    else if (node.items) rows.push({ name: itemPrefix, type: schemaTypeLabel(node.items, modelIndex), required: true, description: node.items.description || "", source: "" });
    return rows;
  }
  if (node.kind !== "object") return [];
  const rows = [];
  for (const member of node.members || []) {
    if (member.kind === "reference") rows.push(...flattenSchema(member, modelIndex, prefix, stack, depth + 1));
    else {
      const name = prefix ? `${prefix} » ${member.name}` : member.name;
      rows.push({ name, type: schemaTypeLabel(member.schema, modelIndex), required: member.required, description: member.schema.description || "", source: "" });
      if (["object", "array", "reference", "composition"].includes(member.schema.kind)) rows.push(...flattenSchema(member.schema, modelIndex, name, stack, depth + 1));
    }
  }
  return rows;
}

function markdownTable(headers, rows) {
  const escape = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", "<br>");
  return [`|${headers.join("|")}|`, `|${headers.map(() => "---").join("|")}|`, ...rows.map((row) => `|${row.map(escape).join("|")}|`)].join("\n");
}

function resourceGroupsInTreeOrder(resources, folders, rootGroupName = "未分组") {
  const groups = [];
  const visitedFolders = new Set();
  const visitedResources = new Set();
  const childrenOf = (parentId) => folders.filter((folder) => folder.parentId === parentId).sort((left, right) => left.order - right.order);
  const appendFolder = (folder, root = false) => {
    if (!folder || visitedFolders.has(folder.id)) return;
    visitedFolders.add(folder.id);
    const direct = resources.filter((resource) => resource.folderId === folder.id).sort((left, right) => left.order - right.order);
    direct.forEach((resource) => visitedResources.add(resource.id));
    if (direct.length) groups.push({ name: root ? rootGroupName : folder.name, resources: direct });
    childrenOf(folder.id).forEach((child) => appendFolder(child));
  };
  childrenOf(null).forEach((root) => appendFolder(root, true));
  const remaining = resources.filter((resource) => !visitedResources.has(resource.id)).sort((left, right) => left.order - right.order);
  if (remaining.length) groups.push({ name: rootGroupName, resources: remaining });
  return groups;
}

export function generateRequestExamples(endpoint, baseUrl = "", modelIndex = new Map()) {
  const url = `${baseUrl.replace(/\/$/, "")}${endpoint.path}`;
  const headers = endpoint.parameters.filter((parameter) => parameter.location === "header");
  const hasRequestBody = endpoint.requestBody?.mode && endpoint.requestBody.mode !== "none" && endpoint.requestBody.schema;
  const body = hasRequestBody ? schemaExample(endpoint.requestBody.schema, modelIndex, endpoint.requestBody.examples?.[0]?.value) : undefined;
  const curl = ["curl", `-X ${endpoint.method}`, `'${url}'`, ...headers.map((header) => `-H '${header.name}: ${header.example ?? "value"}'`), ...(body !== undefined ? [`-H 'Content-Type: ${endpoint.requestBody.mediaType || "application/json"}'`, `--data '${JSON.stringify(body)}'`] : [])].join(" \\\n  ");
  const fetchOptions = { method: endpoint.method, headers: Object.fromEntries(headers.map((header) => [header.name, header.example ?? "value"])) };
  if (body !== undefined) {
    fetchOptions.headers["Content-Type"] = endpoint.requestBody.mediaType || "application/json";
    fetchOptions.body = "__BODY__";
  }
  const fetchText = JSON.stringify(fetchOptions, null, 2).replace('"__BODY__"', `JSON.stringify(${JSON.stringify(body, null, 2)})`);
  return { curl, http: `${endpoint.method} ${endpoint.path} HTTP/1.1\nHost: ${baseUrl.replace(/^https?:\/\//, "") || "example.com"}\n${headers.map((header) => `${header.name}: ${header.example ?? "value"}`).join("\n")}${body !== undefined ? `\nContent-Type: ${endpoint.requestBody.mediaType || "application/json"}\n\n${JSON.stringify(body, null, 2)}` : ""}`, javascript: `fetch(${JSON.stringify(url)}, ${fetchText});` };
}

export function exportMarkdown(project) {
  const modelIndex = new Map(project.models.map((model) => [model.id, model]));
  const environment = project.environments[0];
  const lines = [
    `# ${project.name}`, "", project.description || "", "",
  ];
  if (environment?.baseUrl) lines.push("Base URLs:", "", `* <a href="${escapeHtml(environment.baseUrl)}">${escapeHtml(environment.name)}: ${escapeHtml(environment.baseUrl)}</a>`, "");
  const endpointGroups = resourceGroupsInTreeOrder(project.endpoints, project.apiFolders);
  for (const { name: group, resources: endpoints } of endpointGroups) {
    lines.push(`# ${group}`, "");
    for (const endpoint of endpoints) {
      const example = generateRequestExamples(endpoint, environment?.baseUrl || "", modelIndex);
      lines.push(`## ${endpoint.method} ${endpoint.name}`, "", `${endpoint.method} ${endpoint.path}`, "", endpoint.description || "", "");
      if (endpoint.requestBody?.mode !== "none") {
        const requestValue = schemaExample(endpoint.requestBody.schema, modelIndex, endpoint.requestBody.examples?.[0]?.value);
        lines.push("> Body 请求参数", "", "```json", JSON.stringify(requestValue, null, 2), "```", "");
        const requestRows = flattenSchema(endpoint.requestBody.schema, modelIndex);
        if (requestRows.length) lines.push("### 请求体数据结构", "", markdownTable(["名称", "类型", "必选", "说明", "来源"], requestRows.map((row) => [row.name, row.type, row.required ? "是" : "否", row.description, row.source])), "");
      }
      if (endpoint.parameters.length) lines.push("### 请求参数", "", markdownTable(["名称", "位置", "类型", "必选", "说明"], endpoint.parameters.map((parameter) => [parameter.name, parameter.location, schemaTypeLabel(parameter.schema, modelIndex), parameter.required ? "是" : "否", parameter.description])), "");
      lines.push("### 请求示例", "", "```shell", example.curl, "```", "", "```http", example.http, "```", "", "```javascript", example.javascript, "```", "");
      for (const response of endpoint.responses) {
        const responseValue = response.examples?.[0]?.value ?? schemaExample(response.schema, modelIndex);
        lines.push("> 返回示例", "", `> ${response.statusCode} Response`, "", "```json", JSON.stringify(responseValue, null, 2), "```", "", "### 返回结果", "", markdownTable(["状态码", "说明", "数据模型"], [[response.statusCode, response.description || response.name, schemaTypeLabel(response.schema, modelIndex)]]), "", "### 返回数据结构", "", markdownTable(["名称", "类型", "必选", "说明", "来源"], flattenSchema(response.schema, modelIndex).map((row) => [row.name, row.type, row.required ? "是" : "否", row.description, row.source])), "");
      }
    }
  }
  lines.push("# 数据模型", "");
  const orderedModels = resourceGroupsInTreeOrder(project.models, project.modelFolders).flatMap((group) => group.resources);
  for (const model of orderedModels) {
    lines.push(`## ${model.name}`, "", model.description || "", "", markdownTable(["名称", "类型", "必选", "说明", "来源"], flattenSchema(model.root, modelIndex, "", [model.id]).map((row) => [row.name, row.type, row.required ? "是" : "否", row.description, row.source])), "");
  }
  return `${lines.join("\n")}\n`;
}
