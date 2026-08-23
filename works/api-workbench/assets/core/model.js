import { createId, createNumericId, createSlotId, deepClone, normalizePath } from "./utils.js";

export const PROJECT_VERSION = 1;

export const PRIMITIVE_FORMATS = Object.freeze({
  string: Object.freeze(["", "date", "date-time", "email", "hostname", "ipv4", "ipv6", "uri", "uuid", "binary"]),
  integer: Object.freeze(["", "int32", "int64", "long", "uint32", "uint64", "uint", "ulong", "sint32", "sint64", "fixed32", "fixed64", "sfixed32", "sfixed64"]),
  number: Object.freeze(["", "float", "double", "float32", "float64"]),
  boolean: Object.freeze([""]),
});

export function primitiveFormatOptions(type, currentFormat = "") {
  const options = [...(PRIMITIVE_FORMATS[type] || [""])];
  if (currentFormat && !options.includes(currentFormat)) options.push(currentFormat);
  return options;
}

export function createEmptyProject(name = "未命名接口项目") {
  const rootFolderId = createId("folder");
  const modelRootId = createId("folder");
  return {
    format: "api-workbench",
    version: PROJECT_VERSION,
    id: createId("project"),
    name,
    description: "",
    source: { type: "new", files: [], warnings: [] },
    apiFolders: [{ id: rootFolderId, parentId: null, name: "根目录", order: 0, external: { apifoxId: createNumericId("api-root") } }],
    modelFolders: [{ id: modelRootId, parentId: null, name: "根目录", order: 0, external: { apifoxId: createNumericId("model-root") } }],
    endpoints: [],
    models: [],
    documents: [],
    environments: [{ id: createId("env"), name: "默认环境", baseUrl: "", variables: [] }],
    settings: { language: "zh-CN", openapiVersion: "3.0.1" },
    rawMetadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createPrimitiveNode(type = "string", input = {}) {
  return {
    id: input.id || createId("node"),
    kind: "primitive",
    type,
    format: input.format || "",
    title: input.title || "",
    description: input.description || "",
    enum: deepClone(input.enum || []),
    default: deepClone(input.default),
    examples: deepClone(input.examples || []),
    nullable: Boolean(input.nullable),
    constraints: deepClone(input.constraints || {}),
    rawMetadata: deepClone(input.rawMetadata || {}),
  };
}

export function createObjectNode(input = {}) {
  return {
    id: input.id || createId("node"),
    kind: "object",
    title: input.title || "",
    description: input.description || "",
    nullable: Boolean(input.nullable),
    members: deepClone(input.members || []),
    additionalProperties: input.additionalProperties ?? null,
    examples: deepClone(input.examples || []),
    constraints: deepClone(input.constraints || {}),
    rawMetadata: deepClone(input.rawMetadata || {}),
  };
}

export function createArrayNode(items = createPrimitiveNode(), input = {}) {
  return {
    id: input.id || createId("node"),
    kind: "array",
    title: input.title || "",
    description: input.description || "",
    nullable: Boolean(input.nullable),
    items,
    examples: deepClone(input.examples || []),
    constraints: deepClone(input.constraints || {}),
    rawMetadata: deepClone(input.rawMetadata || {}),
  };
}

export function createReferenceNode(targetModelId, input = {}) {
  return {
    id: input.id || createId("ref"),
    kind: "reference",
    targetModelId: targetModelId || null,
    sourceRef: input.sourceRef || "",
    sourceSlotId: input.sourceSlotId || (input.mode === "fieldGroup" ? createSlotId() : ""),
    mode: input.mode || "property",
    title: input.title || "",
    description: input.description || "",
    examples: deepClone(input.examples || []),
    overlay: deepClone(input.overlay || null),
    broken: Boolean(input.broken),
    rawMetadata: deepClone(input.rawMetadata || {}),
  };
}

export function createCompositionNode(operator = "allOf", members = [], input = {}) {
  return {
    id: input.id || createId("node"),
    kind: "composition",
    operator,
    members,
    title: input.title || "",
    description: input.description || "",
    nullable: Boolean(input.nullable),
    rawMetadata: deepClone(input.rawMetadata || {}),
  };
}

export function createProperty(name = "field", schema = createPrimitiveNode(), input = {}) {
  return {
    id: input.id || createId("property"),
    kind: "property",
    name,
    required: Boolean(input.required),
    schema,
    hiddenInDocs: Boolean(input.hiddenInDocs),
    rawMetadata: deepClone(input.rawMetadata || {}),
  };
}

export function createModel(project, name = "NewModel", type = "object", folderId = null) {
  const rootFolder = project.modelFolders.find((folder) => folder.parentId === null);
  const model = {
    id: createId("model"),
    name,
    displayName: "",
    description: "",
    folderId: folderId || rootFolder?.id || null,
    order: project.models.length,
    root: type === "array" ? createArrayNode() : type === "object" ? createObjectNode() : createPrimitiveNode(type),
    external: { apifoxId: createNumericId(name), openapiKey: name },
    rawMetadata: {},
  };
  project.models.push(model);
  touchProject(project);
  return model;
}

export function extractSchemaToModel(project, schema, input = {}) {
  if (!schema || schema.kind === "reference") throw new Error("当前结构不能重复提取为模型");
  const name = String(input.name || "").trim();
  if (!name) throw new Error("请输入模型名称");
  if (project.models.some((model) => model.name === name)) throw new Error(`数据模型名称已存在：${name}`);
  const model = createModel(project, name, "object", input.folderId || null);
  model.root = deepClone(schema);
  model.description = String(input.description ?? schema.description ?? "");
  return {
    model,
    reference: createReferenceNode(model.id, { mode: input.mode || "property" }),
  };
}

export function createEndpoint(project, folderId = null) {
  const rootFolder = project.apiFolders.find((folder) => folder.parentId === null);
  const endpoint = {
    id: createId("endpoint"),
    folderId: folderId || rootFolder?.id || null,
    name: "新建接口",
    method: "GET",
    path: "/api/example",
    description: "",
    status: "developing",
    tags: [],
    operationId: "",
    order: project.endpoints.length,
    parameters: [],
    requestBody: { mode: "none", required: false, mediaType: "application/json", schema: null, examples: [] },
    responses: [{ id: createId("response"), statusCode: "200", name: "成功", description: "", mediaType: "application/json", headers: [], schema: null, examples: [], external: { apifoxId: createNumericId("response") } }],
    external: { apifoxId: createNumericId("api") },
    rawMetadata: {},
  };
  project.endpoints.push(endpoint);
  touchProject(project);
  return endpoint;
}

export function touchProject(project) {
  project.updatedAt = new Date().toISOString();
}

export function buildModelIndex(project) {
  return new Map(project.models.map((model) => [model.id, model]));
}

export function collectReferences(node, result = []) {
  if (!node || typeof node !== "object") return result;
  if (node.kind === "reference") result.push(node);
  if (node.kind === "object") {
    for (const member of node.members || []) {
      if (member.kind === "property") collectReferences(member.schema, result);
      else collectReferences(member, result);
    }
  } else if (node.kind === "array") collectReferences(node.items, result);
  else if (node.kind === "composition") node.members.forEach((member) => collectReferences(member, result));
  if (node.overlay) collectReferences(node.overlay, result);
  return result;
}

export function buildReferenceIndex(project) {
  const result = new Map();
  const add = (reference, owner) => {
    if (!reference.targetModelId) return;
    if (!result.has(reference.targetModelId)) result.set(reference.targetModelId, []);
    result.get(reference.targetModelId).push({ reference, owner });
  };
  for (const model of project.models) collectReferences(model.root).forEach((reference) => add(reference, { type: "model", id: model.id, name: model.name }));
  for (const endpoint of project.endpoints) {
    collectReferences(endpoint.requestBody?.schema).forEach((reference) => add(reference, { type: "request", id: endpoint.id, name: endpoint.name }));
    endpoint.responses.forEach((response) => collectReferences(response.schema).forEach((reference) => add(reference, { type: "response", id: endpoint.id, name: endpoint.name, statusCode: response.statusCode })));
  }
  return result;
}

export function validateProject(project) {
  const issues = [];
  const models = buildModelIndex(project);
  const modelNames = new Set();
  for (const model of project.models) {
    if (!model.name.trim()) issues.push({ level: "error", code: "MODEL_NAME_EMPTY", message: "存在未命名数据模型", targetId: model.id });
    if (modelNames.has(model.name)) issues.push({ level: "error", code: "MODEL_NAME_DUPLICATE", message: `数据模型名称重复：${model.name}`, targetId: model.id });
    modelNames.add(model.name);
    for (const reference of collectReferences(model.root)) {
      if (!models.has(reference.targetModelId)) issues.push({ level: "error", code: "REFERENCE_BROKEN", message: `${model.name} 存在失效模型引用`, targetId: model.id });
    }
  }
  const endpointKeys = new Set();
  for (const endpoint of project.endpoints) {
    endpoint.path = normalizePath(endpoint.path);
    const key = `${endpoint.method.toUpperCase()} ${endpoint.path}`;
    if (endpointKeys.has(key)) issues.push({ level: "warning", code: "ENDPOINT_DUPLICATE", message: `接口重复：${key}`, targetId: endpoint.id });
    endpointKeys.add(key);
    const pathNames = [...endpoint.path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
    for (const name of pathNames) {
      if (!endpoint.parameters.some((parameter) => parameter.location === "path" && parameter.name === name)) {
        issues.push({ level: "warning", code: "PATH_PARAMETER_MISSING", message: `${key} 缺少路径参数 ${name}`, targetId: endpoint.id });
      }
    }
    const nodes = [endpoint.requestBody?.schema, ...endpoint.responses.map((response) => response.schema)];
    nodes.flatMap((node) => collectReferences(node)).forEach((reference) => {
      if (!models.has(reference.targetModelId)) issues.push({ level: "error", code: "REFERENCE_BROKEN", message: `${key} 存在失效模型引用`, targetId: endpoint.id });
    });
  }
  return issues;
}

export function semanticSnapshot(project) {
  const modelNames = new Map(project.models.map((model) => [model.id, model.name]));
  function nodeSnapshot(node, stack = []) {
    if (!node) return null;
    if (node.kind === "primitive") return { kind: node.kind, type: node.type, format: node.format || "", enum: node.enum || [], nullable: Boolean(node.nullable) };
    if (node.kind === "reference") return { kind: node.kind, target: modelNames.get(node.targetModelId) || node.sourceRef, mode: node.mode };
    if (node.kind === "array") return { kind: node.kind, items: nodeSnapshot(node.items, stack) };
    if (node.kind === "composition") return { kind: node.kind, operator: node.operator, members: node.members.map((item) => nodeSnapshot(item, stack)) };
    return {
      kind: "object",
      members: node.members.map((member) => member.kind === "property"
        ? { kind: "property", name: member.name, required: member.required, schema: nodeSnapshot(member.schema, stack) }
        : nodeSnapshot(member, stack)),
    };
  }
  return {
    name: project.name,
    endpoints: project.endpoints.map((endpoint) => ({
      key: `${endpoint.method} ${normalizePath(endpoint.path)}`,
      parameters: endpoint.parameters.map((parameter) => `${parameter.location}:${parameter.name}:${parameter.required}`),
      request: nodeSnapshot(endpoint.requestBody?.schema),
      responses: endpoint.responses.map((response) => ({ code: response.statusCode, schema: nodeSnapshot(response.schema) })),
    })),
    models: project.models.map((model) => ({ name: model.name, root: nodeSnapshot(model.root) })),
  };
}
