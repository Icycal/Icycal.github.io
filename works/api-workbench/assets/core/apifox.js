import { createEmptyProject, touchProject } from "./model.js";
import { exportSchema, parseSchema, schemaExample } from "./schema-codec.js";
import { createId, createNumericId, deepClone, normalizePath, safeJsonParse } from "./utils.js";

function walkCollection(nodes, parentId, folders, leaves, kind) {
  for (const node of nodes || []) {
    if (node[kind]) {
      leaves.push({ wrapper: node, parentId });
      continue;
    }
    const folder = {
      id: `${kind}_folder_${folders.length}_${node.id || node.moduleId || createNumericId(node.name)}`,
      parentId,
      name: node.name || "未命名目录",
      order: folders.filter((item) => item.parentId === parentId).length,
      external: { apifoxId: node.id || node.moduleId || null },
      rawMetadata: Object.fromEntries(Object.entries(node).filter(([key]) => !["name", "items", "children"].includes(key))),
    };
    folders.push(folder);
    walkCollection(node.items || node.children || [], folder.id, folders, leaves, kind);
  }
}

function responseExample(item) {
  const parsed = safeJsonParse(item?.data ?? item?.value, undefined);
  return { id: item?.id || createId("example"), name: item?.name || "示例", value: parsed ?? item?.data ?? item?.value ?? null, description: item?.description || "" };
}

function commonParameterIndex(source) {
  const result = new Map();
  for (const [location, parameters] of Object.entries(source?.commonParameters?.parameters || {})) {
    for (const parameter of parameters || []) result.set(parameter.name, { ...parameter, location });
  }
  return result;
}

function parseApifoxParameters(api, source) {
  const result = [];
  const append = (parameter, location, options = {}) => {
    if (!parameter?.name || result.some((item) => item.name === parameter.name && item.location === location)) return;
    const rawMetadata = Object.fromEntries(Object.entries(parameter).filter(([key]) => !["name", "description", "required", "type", "schema", "example", "location", "in"].includes(key)));
    if (options.common) rawMetadata.apifoxCommonParameter = true;
    result.push({
      id: parameter.id || createId("parameter"),
      name: parameter.name,
      location,
      description: parameter.description || "",
      required: location === "path" || Boolean(parameter.required),
      schema: parseSchema(parameter.schema || { type: parameter.type || "string", examples: parameter.example !== undefined ? [parameter.example] : [] }, { refToModelId: new Map() }),
      example: deepClone(parameter.example ?? parameter.defaultValue),
      rawMetadata,
    });
  };
  if (Array.isArray(api.parameters)) api.parameters.forEach((parameter) => append(parameter, parameter.in || parameter.location || "query"));
  else for (const [location, parameters] of Object.entries(api.parameters || {})) (parameters || []).forEach((parameter) => append(parameter, location));
  const globals = commonParameterIndex(source);
  for (const [declaredLocation, parameters] of Object.entries(api.commonParameters || {})) {
    for (const reference of parameters || []) {
      if (reference.enable === false) continue;
      const common = globals.get(reference.name);
      append(common || reference, common?.location || declaredLocation, { common: true });
    }
  }
  return result;
}

export function importApifoxProject(source, filename = "") {
  if (!source || source.$schema?.app !== "apifox" || !Array.isArray(source.apiCollection)) throw new Error("文件不是受支持的 Apifox 项目 JSON");
  const project = createEmptyProject(source.info?.name || "Apifox 项目");
  project.description = source.info?.description || "";
  project.source = { type: "apifox", files: [filename].filter(Boolean), warnings: [] };
  project.apiFolders = [];
  project.modelFolders = [];
  const apiLeaves = [];
  const modelLeaves = [];
  walkCollection(source.apiCollection, null, project.apiFolders, apiLeaves, "api");
  walkCollection(source.schemaCollection, null, project.modelFolders, modelLeaves, "schema");
  if (!project.apiFolders.length) project.apiFolders.push({ id: createId("folder"), parentId: null, name: "根目录", order: 0, external: {} });
  if (!project.modelFolders.length) project.modelFolders.push({ id: createId("folder"), parentId: null, name: "根目录", order: 0, external: {} });

  const refToModelId = new Map();
  for (const { wrapper } of modelLeaves) {
    const externalRef = wrapper.id || `#/definitions/${createNumericId(wrapper.name)}`;
    refToModelId.set(externalRef, `model_${String(externalRef).split("/").pop()}`);
  }
  const schemaContext = { refToModelId };
  project.models = modelLeaves.map(({ wrapper, parentId }, order) => ({
    id: refToModelId.get(wrapper.id),
    name: wrapper.name || `Model${order + 1}`,
    displayName: wrapper.displayName || "",
    description: wrapper.description || "",
    folderId: parentId,
    order,
    root: parseSchema(wrapper.schema?.jsonSchema || {}, schemaContext),
    external: { apifoxId: String(wrapper.id || "").split("/").pop(), apifoxRef: wrapper.id, openapiKey: wrapper.name },
    rawMetadata: Object.fromEntries(Object.entries(wrapper).filter(([key]) => !["name", "displayName", "id", "description", "schema"].includes(key))),
  }));

  project.endpoints = apiLeaves.map(({ wrapper, parentId }, order) => {
    const api = wrapper.api;
    const requestType = api.requestBody?.type || "none";
    return {
      id: `endpoint_${api.id || createNumericId(wrapper.name)}`,
      folderId: parentId,
      name: wrapper.name || api.name || "未命名接口",
      method: String(api.method || "get").toUpperCase(),
      path: normalizePath(api.path),
      description: api.description || "",
      status: api.status || "developing",
      tags: deepClone(api.tags || []),
      operationId: api.operationId || "",
      order: api.ordering ?? order,
      parameters: parseApifoxParameters(api, source),
      requestBody: {
        mode: requestType === "none" ? "none" : requestType,
        required: Boolean(api.requestBody?.required),
        mediaType: api.requestBody?.mediaType || (requestType.includes("/") ? requestType : "application/json"),
        schema: requestType === "none" ? null : parseSchema(api.requestBody?.jsonSchema || {}, schemaContext),
        examples: (api.requestBody?.examples || []).map(responseExample),
      },
      responses: (api.responses || []).map((response) => ({
        id: `response_${response.id || createNumericId(response.code)}`,
        statusCode: String(response.code ?? "default"),
        name: response.name || "",
        description: response.description || "",
        mediaType: response.mediaType || (response.contentType === "json" ? "application/json" : response.contentType || "application/json"),
        headers: deepClone(response.headers || []),
        schema: parseSchema(response.jsonSchema || {}, schemaContext),
        examples: (api.responseExamples || []).filter((example) => String(example.responseId) === String(response.id)).map(responseExample),
        external: { apifoxId: response.id },
        rawMetadata: Object.fromEntries(Object.entries(response).filter(([key]) => !["id", "code", "name", "description", "mediaType", "contentType", "headers", "jsonSchema"].includes(key))),
      })),
      external: { apifoxId: api.id },
      rawMetadata: Object.fromEntries(Object.entries(api).filter(([key]) => !["id", "method", "path", "parameters", "responses", "responseExamples", "requestBody", "description", "tags", "status", "operationId", "ordering"].includes(key))),
    };
  });

  const walkDocs = (nodes, path = []) => {
    for (const node of nodes || []) {
      const nextPath = node.name === "根目录" ? path : [...path, node.name];
      for (const item of node.items || []) {
        if (item.type !== "folder" || item.content) project.documents.push({ id: `doc_${item.id || createNumericId(item.name)}`, name: item.name, path: nextPath, content: item.content || "", order: project.documents.length, external: { apifoxId: item.id }, rawMetadata: deepClone(item) });
      }
      walkDocs(node.children || [], nextPath);
    }
  };
  walkDocs(source.docCollection);
  project.environments = (source.environments || []).map((environment) => ({ id: `env_${environment.id || createNumericId(environment.name)}`, name: environment.name || "环境", baseUrl: environment.baseUrl || environment.baseUrls?.default || "", variables: deepClone(environment.variables || []), rawMetadata: deepClone(environment) }));
  if (!project.environments.length) project.environments = [{ id: createId("env"), name: "默认环境", baseUrl: "", variables: [] }];
  project.settings = { language: source.projectSetting?.language || "zh-CN", openapiVersion: "3.0.1", statuses: deepClone(source.projectSetting?.apiStatuses || []), rawMetadata: deepClone(source.projectSetting || {}) };
  project.rawMetadata = {
    ...Object.fromEntries(Object.entries(source).filter(([key]) => !["info", "apiCollection", "schemaCollection", "docCollection", "environments", "projectSetting"].includes(key))),
    apifoxInfo: deepClone(source.info || {}),
    apifoxDocCollection: deepClone(source.docCollection || []),
  };
  touchProject(project);
  return project;
}

function folderTree(folders, parentId, leaves, leafBuilder) {
  return folders.filter((folder) => folder.parentId === parentId).sort((a, b) => a.order - b.order).map((folder) => ({
    ...deepClone(folder.rawMetadata || {}),
    name: folder.name,
    moduleId: folder.external?.apifoxId || folder.rawMetadata?.moduleId || createNumericId(folder.name),
    items: [
      ...folders.filter((item) => item.parentId === folder.id).length ? folderTree(folders, folder.id, leaves, leafBuilder) : [],
      ...leaves.filter((leaf) => leaf.folderId === folder.id).sort((a, b) => a.order - b.order).map(leafBuilder),
    ],
  }));
}

function mergeDocCollection(sourceCollection, documents) {
  const documentById = new Map(documents.filter((document) => document.external?.apifoxId != null).map((document) => [String(document.external.apifoxId), document]));
  const seen = new Set();
  const updateNodes = (nodes) => (nodes || []).map((node) => {
    const output = deepClone(node);
    output.children = updateNodes(node.children || []);
    output.items = (node.items || []).map((item) => {
      const document = documentById.get(String(item.id));
      if (!document) return item.type === "folder" ? deepClone(item) : null;
      seen.add(document.id);
      return { ...deepClone(item), ...deepClone(document.rawMetadata || {}), id: item.id, name: document.name, content: document.content || "" };
    }).filter(Boolean);
    return output;
  });
  const collection = updateNodes(sourceCollection);
  if (!collection.length) collection.push({ name: "根目录", moduleId: 0, children: [], items: [] });
  const root = collection[0];
  root.items ||= [];
  for (const document of documents.filter((item) => !seen.has(item.id))) {
    root.items.push({ ...deepClone(document.rawMetadata || {}), id: String(document.external?.apifoxId || createNumericId(document.id)), name: document.name, sidebarTitle: "", content: document.content || "", folderId: 0, type: "", tags: [], visibility: "INHERITED", moduleId: 0 });
  }
  return collection;
}

function parameterToApifox(parameter, schemaContext) {
  const schema = exportSchema(parameter.schema, schemaContext, "apifox") || { type: "string" };
  const rawMetadata = deepClone(parameter.rawMetadata || {});
  delete rawMetadata.apifoxCommonParameter;
  const output = { ...rawMetadata, name: parameter.name, description: parameter.description || "", required: Boolean(parameter.required), type: schema.type || "string", schema };
  if (parameter.example !== undefined) {
    if (Object.hasOwn(rawMetadata, "defaultValue") && !Object.hasOwn(rawMetadata, "example")) output.defaultValue = deepClone(parameter.example);
    else output.example = deepClone(parameter.example);
  }
  return output;
}

export function exportApifoxProject(project) {
  const modelIndex = new Map(project.models.map((model) => [model.id, model]));
  const modelIdToRef = new Map(project.models.map((model) => [model.id, `#/definitions/${model.external?.apifoxId || createNumericId(model.id)}`]));
  const modelIdToName = new Map(project.models.map((model) => [model.id, model.name]));
  const schemaContext = { modelIdToRef, modelIdToName };
  const modelLeaf = (model) => ({
    ...deepClone(model.rawMetadata || {}),
    name: model.name,
    displayName: model.displayName || "",
    id: modelIdToRef.get(model.id),
    description: model.description || "",
    schema: { jsonSchema: exportSchema(model.root, schemaContext, "apifox") || {} },
    visibility: model.rawMetadata?.visibility || "INHERITED",
    moduleId: model.rawMetadata?.moduleId || 0,
  });
  const apiLeaf = (endpoint) => {
    const parameters = { path: [], query: [], header: [], cookie: [] };
    endpoint.parameters.filter((parameter) => !parameter.rawMetadata?.apifoxCommonParameter).forEach((parameter) => parameters[parameter.location]?.push(parameterToApifox(parameter, schemaContext)));
    const responseExamples = [];
    const responses = endpoint.responses.map((response) => {
      const responseId = String(response.external?.apifoxId || response.id || createNumericId(response.statusCode)).replace(/^response_/, "");
      response.examples.forEach((example, index) => responseExamples.push({ name: example.name || `示例 ${index + 1}`, data: typeof example.value === "string" ? example.value : JSON.stringify(example.value, null, 4), responseId, ordering: index + 1, description: example.description || "", oasKey: "", oasExtensions: "" }));
      return { ...deepClone(response.rawMetadata || {}), id: responseId, code: /^\d+$/.test(response.statusCode) ? Number(response.statusCode) : response.statusCode, name: response.name || "", headers: deepClone(response.headers || []), jsonSchema: exportSchema(response.schema, schemaContext, "apifox") || {}, description: response.description || "", contentType: response.mediaType === "application/json" ? "json" : response.mediaType, mediaType: response.mediaType || "", oasExtensions: response.rawMetadata?.oasExtensions || "" };
    });
    return {
      name: endpoint.name,
      api: {
        ...deepClone(endpoint.rawMetadata || {}),
        id: String(endpoint.external?.apifoxId || createNumericId(endpoint.id)), method: endpoint.method.toLowerCase(), path: endpoint.path.replace(/^\//, ""), parameters,
        auth: deepClone(endpoint.rawMetadata?.auth || {}), securityScheme: deepClone(endpoint.rawMetadata?.securityScheme || {}), commonParameters: deepClone(endpoint.rawMetadata?.commonParameters || { query: [], body: [], cookie: [], header: [] }), responses, responseExamples,
        requestBody: endpoint.requestBody.mode === "none" ? { type: "none", parameters: [], jsonSchema: { type: "object", properties: {} }, mediaType: "", examples: [], oasExtensions: "" } : {
          type: endpoint.requestBody.mediaType || "application/json", parameters: [], jsonSchema: exportSchema(endpoint.requestBody.schema, schemaContext, "apifox") || {}, mediaType: endpoint.requestBody.mediaType || "application/json",
          examples: endpoint.requestBody.examples.map((example, index) => {
            const value = schemaExample(endpoint.requestBody.schema, modelIndex, example.value);
            return { name: example.name || `示例 ${index + 1}`, value: typeof value === "string" ? value : JSON.stringify(value, null, 4), mediaType: endpoint.requestBody.mediaType || "application/json" };
          }), oasExtensions: "",
        },
        description: endpoint.description || "", tags: deepClone(endpoint.tags || []), status: endpoint.status || "developing", serverId: "", operationId: endpoint.operationId || "", sourceUrl: "", ordering: endpoint.order,
        cases: deepClone(endpoint.rawMetadata?.cases || []), mocks: deepClone(endpoint.rawMetadata?.mocks || []), customApiFields: endpoint.rawMetadata?.customApiFields || "{}", advancedSettings: deepClone(endpoint.rawMetadata?.advancedSettings || { disabledSystemHeaders: {} }), mockScript: deepClone(endpoint.rawMetadata?.mockScript || {}), codeSamples: deepClone(endpoint.rawMetadata?.codeSamples || []), commonResponseStatus: deepClone(endpoint.rawMetadata?.commonResponseStatus || {}), responseChildren: responses.map((response) => `BLANK.${response.id}`), visibility: endpoint.rawMetadata?.visibility || "INHERITED", moduleId: endpoint.rawMetadata?.moduleId || 0, oasExtensions: endpoint.rawMetadata?.oasExtensions || "", type: endpoint.rawMetadata?.type || "http", preProcessors: deepClone(endpoint.rawMetadata?.preProcessors || []), postProcessors: deepClone(endpoint.rawMetadata?.postProcessors || []), inheritPostProcessors: deepClone(endpoint.rawMetadata?.inheritPostProcessors || {}), inheritPreProcessors: deepClone(endpoint.rawMetadata?.inheritPreProcessors || {}),
      },
    };
  };
  const apiCollection = folderTree(project.apiFolders, null, project.endpoints, apiLeaf);
  const schemaCollection = folderTree(project.modelFolders, null, project.models, modelLeaf);
  const raw = deepClone(project.rawMetadata || {});
  const sourceInfo = raw.apifoxInfo || {};
  const sourceDocCollection = raw.apifoxDocCollection || [];
  delete raw.apifoxInfo;
  delete raw.apifoxDocCollection;
  const sourceSetting = deepClone(project.settings?.rawMetadata || {});
  const commonParameters = deepClone(raw.commonParameters || { parameters: { query: [], header: [] } });
  for (const endpoint of project.endpoints) {
    for (const parameter of endpoint.parameters.filter((item) => item.rawMetadata?.apifoxCommonParameter)) {
      const collection = commonParameters.parameters?.[parameter.location] || [];
      const target = collection.find((item) => item.name === parameter.name);
      if (target) Object.assign(target, parameterToApifox(parameter, schemaContext));
    }
  }
  return {
    ...raw,
    apifoxProject: raw.apifoxProject || "1.0.0",
    $schema: raw.$schema || { app: "apifox", type: "project", version: "1.2.0" },
    info: { ...sourceInfo, name: project.name, description: project.description || "", mockRule: sourceInfo.mockRule || { rules: [], enableSystemRule: true } },
    apiCollection,
    socketCollection: raw.socketCollection || [],
    docCollection: mergeDocCollection(sourceDocCollection, project.documents),
    webSocketCollection: raw.webSocketCollection || [], socketIOCollection: raw.socketIOCollection || [], responseCollection: raw.responseCollection || [], schemaCollection, securitySchemeCollection: raw.securitySchemeCollection || [], requestCollection: raw.requestCollection || [], apiTestCaseCollection: raw.apiTestCaseCollection || [], testCaseReferences: raw.testCaseReferences || [],
    environments: project.environments.map((environment) => ({ ...deepClone(environment.rawMetadata || {}), name: environment.name, type: environment.rawMetadata?.type || "normal", visibility: environment.rawMetadata?.visibility || "protected", baseUrl: environment.baseUrl || "", baseUrls: { ...(environment.rawMetadata?.baseUrls || {}), default: environment.baseUrl || "" }, variables: deepClone(environment.variables || []), parameters: deepClone(environment.rawMetadata?.parameters || { cookie: [], query: [], header: [], body: [] }) })),
    commonScripts: raw.commonScripts || [], databaseConnections: raw.databaseConnections || [], globalVariables: raw.globalVariables || [], commonParameters,
    projectSetting: { ...sourceSetting, language: project.settings?.language || "zh-CN", apiStatuses: project.settings?.statuses || sourceSetting.apiStatuses || [{ id: "developing", name: "开发中" }, { id: "testing", name: "测试中" }, { id: "released", name: "已发布" }, { id: "deprecated", name: "已废弃" }], servers: sourceSetting.servers || [{ id: "default", name: "默认服务" }] },
    customFunctions: raw.customFunctions || [], projectAssociations: raw.projectAssociations || [],
  };
}
