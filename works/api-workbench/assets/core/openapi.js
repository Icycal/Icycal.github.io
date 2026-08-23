import { createEmptyProject, touchProject } from "./model.js";
import { exportSchema, parseSchema, schemaExample } from "./schema-codec.js";
import { createId, deepClone, normalizePath, slugify, uniqueName } from "./utils.js";
import { dumpYaml, parseYaml } from "./yaml.js";

const METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);

export function parseOpenApiText(text, filename = "") {
  const source = filename.toLowerCase().endsWith(".json") ? JSON.parse(text) : parseYaml(text);
  return importOpenApi(source, filename);
}

export function importOpenApi(source, filename = "") {
  const version = source.openapi || source.swagger;
  if (!version) throw new Error("文件不是 OpenAPI 或 Swagger 文档");
  const project = createEmptyProject(source.info?.title || "OpenAPI 项目");
  project.description = source.info?.description || "";
  project.source = { type: source.swagger ? "swagger" : "openapi", files: [filename].filter(Boolean), warnings: [] };
  project.settings.openapiVersion = source.openapi || "3.0.1";
  project.rawMetadata = {
    openapiSource: {
      info: deepClone(source.info || {}),
      tags: deepClone(source.tags || []),
      security: deepClone(source.security || []),
      components: deepClone(Object.fromEntries(Object.entries(source.components || {}).filter(([key]) => key !== "schemas"))),
      topLevel: deepClone(Object.fromEntries(Object.entries(source).filter(([key]) => !["openapi", "swagger", "info", "tags", "paths", "components", "definitions", "servers", "security", "host", "schemes", "basePath"].includes(key)))),
    },
  };
  project.apiFolders = [{ id: "folder_root", parentId: null, name: "根目录", order: 0, external: {} }];
  project.modelFolders = [{ id: "folder_models", parentId: null, name: "根目录", order: 0, external: {} }];
  const tagFolders = new Map();
  const ensureTag = (tag) => {
    const name = tag || "未分组";
    if (!tagFolders.has(name)) {
      const folder = { id: `folder_tag_${slugify(name)}_${tagFolders.size}`, parentId: "folder_root", name, order: tagFolders.size, external: {} };
      tagFolders.set(name, folder.id);
      project.apiFolders.push(folder);
    }
    return tagFolders.get(name);
  };
  (source.tags || []).forEach((tag) => ensureTag(tag.name));
  const schemas = source.components?.schemas || source.definitions || {};
  const usedNames = new Set();
  const refToModelId = new Map();
  for (const name of Object.keys(schemas)) {
    const stableName = uniqueName(name, usedNames);
    const modelId = `model_${slugify(stableName)}_${usedNames.size}`;
    refToModelId.set(`#/components/schemas/${name}`, modelId);
    refToModelId.set(`#/definitions/${name}`, modelId);
  }
  project.models = Object.entries(schemas).map(([name, schema], order) => {
    const modelId = refToModelId.get(`#/components/schemas/${name}`) || refToModelId.get(`#/definitions/${name}`);
    return { id: modelId, name, displayName: schema.title || "", description: schema.description || "", folderId: "folder_models", order, root: parseSchema(schema, { refToModelId }), external: { openapiKey: name }, rawMetadata: {} };
  });

  project.endpoints = [];
  for (const [path, pathItem] of Object.entries(source.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem || {})) {
      if (!METHODS.has(method.toLowerCase())) continue;
      const tag = operation.tags?.[0] || "未分组";
      const parameters = [...(pathItem.parameters || []), ...(operation.parameters || [])].map((parameter) => {
        const resolved = parameter.$ref ? null : parameter;
        if (!resolved) return null;
        const schema = source.swagger ? { type: resolved.type, format: resolved.format, enum: resolved.enum, default: resolved.default, items: resolved.items } : resolved.schema || {};
        return { id: createId("parameter"), name: resolved.name, location: resolved.in || "query", description: resolved.description || "", required: resolved.in === "path" || Boolean(resolved.required), schema: parseSchema(schema, { refToModelId }), example: deepClone(resolved.example), rawMetadata: Object.fromEntries(Object.entries(resolved).filter(([key]) => !["name", "in", "description", "required", "schema", "example", "type", "format", "enum", "default", "items"].includes(key))) };
      }).filter(Boolean);
      let requestBody = { mode: "none", required: false, mediaType: "application/json", schema: null, examples: [] };
      if (operation.requestBody) {
        const [mediaType, media] = Object.entries(operation.requestBody.content || {})[0] || ["application/json", {}];
        requestBody = { mode: mediaType, required: Boolean(operation.requestBody.required), mediaType, schema: parseSchema(media.schema || {}, { refToModelId }), examples: media.example !== undefined ? [{ id: createId("example"), name: "示例 1", value: deepClone(media.example), description: "" }] : [] };
      } else if (source.swagger) {
        const body = parameters.find((parameter) => parameter.location === "body");
        if (body) requestBody = { mode: "application/json", required: body.required, mediaType: "application/json", schema: body.schema, examples: [] };
      }
      const responses = Object.entries(operation.responses || {}).map(([statusCode, response]) => {
        const [mediaType, media] = Object.entries(response.content || {})[0] || ["application/json", {}];
        return { id: createId("response"), statusCode, name: "", description: response.description ?? "", mediaType, headers: deepClone(response.headers || {}), schema: parseSchema(media.schema || response.schema || {}, { refToModelId }), examples: media.example !== undefined ? [{ id: createId("example"), name: "示例 1", value: deepClone(media.example), description: "" }] : [], rawMetadata: Object.fromEntries(Object.entries(response).filter(([key]) => !["description", "content", "headers", "schema"].includes(key))) };
      });
      project.endpoints.push({
        id: createId("endpoint"), folderId: ensureTag(tag), name: operation.summary || `${method.toUpperCase()} ${path}`, method: method.toUpperCase(), path: normalizePath(path), description: operation.description || "", status: operation.deprecated ? "deprecated" : "developing", tags: deepClone(operation.tags || []), operationId: operation.operationId || "", order: project.endpoints.length,
        parameters: parameters.filter((parameter) => parameter.location !== "body"), requestBody, responses, external: {}, rawMetadata: Object.fromEntries(Object.entries(operation).filter(([key]) => !["summary", "deprecated", "description", "tags", "parameters", "responses", "requestBody", "operationId"].includes(key))),
      });
    }
  }
  project.environments = (source.servers || []).map((server, index) => ({ id: createId("env"), name: server.description || `环境 ${index + 1}`, baseUrl: server.url || "", variables: deepClone(server.variables || []) }));
  if (!project.environments.length) project.environments = [{ id: createId("env"), name: "默认环境", baseUrl: source.host ? `${source.schemes?.[0] || "https"}://${source.host}${source.basePath || ""}` : "", variables: [] }];
  touchProject(project);
  return project;
}

export function exportOpenApi(project) {
  const modelIndex = new Map(project.models.map((model) => [model.id, model]));
  const used = new Set();
  const keys = new Map(project.models.map((model) => [model.id, uniqueName(model.external?.openapiKey || model.name, used)]));
  const context = { modelIdToRef: new Map([...keys].map(([id, key]) => [id, `#/components/schemas/${key}`])), modelIdToName: new Map(project.models.map((model) => [model.id, model.name])) };
  const source = project.rawMetadata?.openapiSource || {};
  const sourceTags = new Map((source.tags || []).map((tag) => [tag.name, tag]));
  const tags = [];
  const folderById = new Map(project.apiFolders.map((folder) => [folder.id, folder]));
  const tagFor = (endpoint) => {
    const folder = folderById.get(endpoint.folderId);
    const tag = endpoint.tags?.[0] || (folder?.parentId ? folder.name : "未分组");
    if (!tags.some((item) => item.name === tag)) tags.push({ ...deepClone(sourceTags.get(tag) || {}), name: tag });
    return tag;
  };
  const paths = {};
  for (const endpoint of project.endpoints) {
    const parameters = endpoint.parameters.map((parameter) => ({
      ...deepClone(parameter.rawMetadata || {}),
      name: parameter.name, in: parameter.location, description: parameter.description || "", required: parameter.location === "path" || Boolean(parameter.required), schema: exportSchema(parameter.schema, context, "openapi") || { type: "string" }, ...(parameter.example !== undefined ? { example: deepClone(parameter.example) } : {}),
    }));
    const responses = {};
    for (const response of endpoint.responses) {
      const media = { schema: exportSchema(response.schema, context, "openapi") || {} };
      if (response.examples?.[0]?.value !== undefined) media.example = deepClone(response.examples[0].value);
      responses[response.statusCode] = { ...deepClone(response.rawMetadata || {}), description: response.description ?? response.name ?? "响应", content: { [response.mediaType || "application/json"]: media }, headers: deepClone(response.headers || {}) };
    }
    const operation = { ...deepClone(endpoint.rawMetadata || {}), summary: endpoint.name, deprecated: endpoint.status === "deprecated", description: endpoint.description || "", tags: [tagFor(endpoint)], parameters, responses, security: deepClone(endpoint.rawMetadata?.security || []) };
    if (endpoint.operationId) operation.operationId = endpoint.operationId;
    if (endpoint.requestBody?.mode !== "none" && endpoint.requestBody?.schema) {
      const media = { schema: exportSchema(endpoint.requestBody.schema, context, "openapi") || {} };
      if (endpoint.requestBody.examples?.[0]?.value !== undefined) media.example = schemaExample(endpoint.requestBody.schema, modelIndex, endpoint.requestBody.examples[0].value);
      operation.requestBody = { required: Boolean(endpoint.requestBody.required), content: { [endpoint.requestBody.mediaType || "application/json"]: media } };
    }
    if (!paths[endpoint.path]) paths[endpoint.path] = {};
    paths[endpoint.path][endpoint.method.toLowerCase()] = operation;
  }
  return {
    ...deepClone(source.topLevel || {}),
    openapi: project.settings?.openapiVersion?.startsWith("3.") ? project.settings.openapiVersion : "3.0.1",
    info: { ...deepClone(source.info || {}), title: project.name, description: project.description || "", version: source.info?.version || "1.0.0" },
    tags,
    paths,
    components: { ...deepClone(source.components || {}), schemas: Object.fromEntries(project.models.map((model) => [keys.get(model.id), exportSchema(model.root, context, "openapi") || {}])), securitySchemes: deepClone(source.components?.securitySchemes || {}) },
    servers: project.environments.filter((environment) => environment.baseUrl).map((environment) => ({ url: environment.baseUrl, description: environment.name })),
    security: deepClone(source.security || []),
  };
}

export function exportOpenApiYaml(project) {
  return dumpYaml(exportOpenApi(project));
}
