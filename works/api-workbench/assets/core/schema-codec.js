import {
  createArrayNode,
  createCompositionNode,
  createObjectNode,
  createPrimitiveNode,
  createProperty,
  createReferenceNode,
} from "./model.js";
import { createSlotId, deepClone } from "./utils.js";

const SCHEMA_KEYS = new Set([
  "$ref", "type", "format", "title", "description", "enum", "default", "example", "examples", "nullable",
  "properties", "required", "items", "allOf", "oneOf", "anyOf", "additionalProperties", "x-apifox-orders",
  "x-apifox-refs", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength",
  "pattern", "minItems", "maxItems", "uniqueItems", "multipleOf", "readOnly", "writeOnly", "deprecated",
]);

function rawMetadata(schema) {
  return Object.fromEntries(Object.entries(schema || {}).filter(([key]) => !SCHEMA_KEYS.has(key)));
}

function constraintsFrom(schema) {
  const keys = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength", "pattern", "minItems", "maxItems", "uniqueItems", "multipleOf", "readOnly", "writeOnly", "deprecated"];
  return Object.fromEntries(keys.filter((key) => schema?.[key] !== undefined).map((key) => [key, deepClone(schema[key])]));
}

function baseInput(schema) {
  const types = Array.isArray(schema?.type) ? schema.type : [schema?.type];
  return {
    title: schema?.title || "",
    description: schema?.description || "",
    nullable: Boolean(schema?.nullable || types.includes("null")),
    examples: deepClone(schema?.examples || (schema?.example !== undefined ? [schema.example] : [])),
    constraints: constraintsFrom(schema),
    rawMetadata: rawMetadata(schema),
  };
}

function exampleValueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function inferExampleValues(values, options) {
  const definedValues = values.filter((value) => value !== undefined);
  const nonNullValues = definedValues.filter((value) => value !== null);
  const firstValue = nonNullValues[0] ?? definedValues[0] ?? "";
  const types = new Set(nonNullValues.map(exampleValueType));

  if (types.has("object")) {
    const objects = nonNullValues.filter((value) => exampleValueType(value) === "object");
    const names = [...new Set(objects.flatMap((value) => Object.keys(value)))];
    const members = names.map((name) => {
      const propertyValues = objects.filter((value) => Object.hasOwn(value, name)).map((value) => value[name]);
      return createProperty(name, inferExampleValues(propertyValues, options), { required: Boolean(options.required) && propertyValues.length === objects.length });
    });
    return createObjectNode({ members, nullable: definedValues.some((value) => value === null) });
  }

  if (types.has("array")) {
    const arrays = nonNullValues.filter(Array.isArray);
    const items = arrays.flat();
    return createArrayNode(items.length ? inferExampleValues(items, options) : createPrimitiveNode("string"), { nullable: definedValues.some((value) => value === null) });
  }

  let type = exampleValueType(firstValue);
  if (types.has("number") || (types.has("integer") && types.size > 1)) type = "number";
  if (!["string", "integer", "number", "boolean", "null"].includes(type)) type = "string";
  return createPrimitiveNode(type, {
    default: deepClone(firstValue),
    nullable: definedValues.some((value) => value === null),
  });
}

export function inferSchemaFromExample(value, options = {}) {
  const schema = inferExampleValues([value], { required: Boolean(options.required) });
  if (options.includeExample !== false) schema.examples = [deepClone(value)];
  return schema;
}

export function parseSchema(schema, context, options = {}) {
  if (!schema || typeof schema !== "object") return null;
  const resolveRef = (sourceRef) => context.refToModelId.get(sourceRef) || null;
  const input = baseInput(schema);

  if (schema.$ref) {
    const overlaySource = Object.fromEntries(Object.entries(schema).filter(([key]) => key !== "$ref"));
    const hasOverlay = Object.keys(overlaySource).some((key) => !["properties", "x-apifox-orders", "required"].includes(key));
    return createReferenceNode(resolveRef(schema.$ref), {
      ...input,
      sourceRef: schema.$ref,
      mode: options.mode || "property",
      broken: !resolveRef(schema.$ref),
      overlay: hasOverlay ? parseSchema(overlaySource, context, { mode: "overlay" }) : null,
      rawMetadata: { ...input.rawMetadata, sourceSnapshot: deepClone(overlaySource) },
    });
  }

  for (const operator of ["allOf", "oneOf", "anyOf"]) {
    if (Array.isArray(schema[operator])) {
      return createCompositionNode(operator, schema[operator].map((item) => parseSchema(item, context, { mode: "composition" })).filter(Boolean), input);
    }
  }

  const types = Array.isArray(schema.type) ? schema.type.filter((type) => type !== "null") : [schema.type];
  const type = types[0] || (schema.properties || schema["x-apifox-refs"] ? "object" : schema.items ? "array" : "string");
  if (type === "object") {
    const properties = schema.properties || {};
    const references = schema["x-apifox-refs"] || {};
    const order = Array.isArray(schema["x-apifox-orders"]) ? schema["x-apifox-orders"] : [];
    const required = new Set(schema.required || []);
    const members = [];
    const consumedProperties = new Set();
    const consumedReferences = new Set();
    const appendToken = (token) => {
      if (Object.hasOwn(properties, token)) {
        members.push(createProperty(token, parseSchema(properties[token], context), { required: required.has(token) }));
        consumedProperties.add(token);
      } else if (Object.hasOwn(references, token)) {
        const sourceRef = references[token]?.$ref || "";
        members.push(createReferenceNode(resolveRef(sourceRef), {
          sourceRef,
          sourceSlotId: token,
          mode: "fieldGroup",
          broken: !resolveRef(sourceRef),
          rawMetadata: Object.fromEntries(Object.entries(references[token] || {}).filter(([key]) => key !== "$ref")),
        }));
        consumedReferences.add(token);
      }
    };
    order.forEach(appendToken);
    Object.keys(properties).filter((key) => !consumedProperties.has(key)).forEach(appendToken);
    Object.keys(references).filter((key) => !consumedReferences.has(key)).forEach(appendToken);
    return createObjectNode({ ...input, members, additionalProperties: deepClone(schema.additionalProperties ?? null) });
  }
  if (type === "array") return createArrayNode(parseSchema(schema.items || {}, context) || createPrimitiveNode(), input);
  return createPrimitiveNode(type, {
    ...input,
    format: schema.format || "",
    enum: deepClone(schema.enum || []),
    default: deepClone(schema.default),
  });
}

function applyCommonSchemaFields(output, node, mode) {
  if (node.title) output.title = node.title;
  if (node.description) output.description = node.description;
  if (node.format) output.format = node.format;
  if (node.enum?.length) output.enum = deepClone(node.enum);
  if (node.default !== undefined) output.default = deepClone(node.default);
  if (node.examples?.length) {
    if (mode === "apifox") output.examples = deepClone(node.examples);
    else output.example = deepClone(node.examples[0]);
  }
  Object.assign(output, deepClone(node.constraints || {}));
  if (node.nullable) {
    if (mode === "openapi") output.nullable = true;
    else if (output.type && !Array.isArray(output.type)) output.type = [output.type, "null"];
  }
  Object.assign(output, deepClone(node.rawMetadata || {}));
  delete output.sourceSnapshot;
  return output;
}

export function exportSchema(node, context, mode = "openapi") {
  if (!node) return null;
  const refFor = (targetModelId, sourceRef) => {
    if (mode === "apifox" && sourceRef?.startsWith("#/definitions/")) return sourceRef;
    return context.modelIdToRef.get(targetModelId) || sourceRef || "#/components/schemas/UnknownModel";
  };
  if (node.kind === "reference") {
    const output = { $ref: refFor(node.targetModelId, node.sourceRef) };
    if (node.overlay) {
      const overlay = exportSchema(node.overlay, context, mode);
      if (mode === "openapi") return { allOf: [output, overlay] };
      Object.assign(output, overlay);
    }
    Object.assign(output, deepClone(node.rawMetadata || {}));
    delete output.sourceSnapshot;
    return output;
  }
  if (node.kind === "composition") {
    return applyCommonSchemaFields({ [node.operator]: node.members.map((member) => exportSchema(member, context, mode)) }, node, mode);
  }
  if (node.kind === "array") {
    return applyCommonSchemaFields({ type: "array", items: exportSchema(node.items, context, mode) || {} }, node, mode);
  }
  if (node.kind === "primitive") return applyCommonSchemaFields({ type: node.type || "string" }, node, mode);

  const properties = {};
  const required = [];
  const order = [];
  const fieldGroupReferences = [];
  for (const member of node.members || []) {
    if (member.kind === "property") {
      properties[member.name] = exportSchema(member.schema, context, mode) || {};
      order.push(member.name);
      if (member.required) required.push(member.name);
    } else if (member.kind === "reference") {
      fieldGroupReferences.push(member);
      order.push(member.sourceSlotId || member.id);
    }
  }
  const localObject = applyCommonSchemaFields({ type: "object", properties }, node, mode);
  if (required.length) localObject.required = required;
  if (node.additionalProperties !== null) localObject.additionalProperties = deepClone(node.additionalProperties);
  if (!fieldGroupReferences.length) {
    if (mode === "apifox") localObject["x-apifox-orders"] = order;
    return localObject;
  }
  if (mode === "apifox") {
    localObject["x-apifox-orders"] = order.map((token) => token.startsWith("ref_") ? createSlotId() : token);
    localObject["x-apifox-refs"] = {};
    let refIndex = 0;
    for (let index = 0; index < order.length; index += 1) {
      const original = order[index];
      if (Object.hasOwn(properties, original)) continue;
      const reference = fieldGroupReferences[refIndex];
      const slot = reference.sourceSlotId || localObject["x-apifox-orders"][index] || createSlotId();
      localObject["x-apifox-orders"][index] = slot;
      localObject["x-apifox-refs"][slot] = { $ref: refFor(reference.targetModelId, reference.sourceRef), ...deepClone(reference.rawMetadata || {}) };
      refIndex += 1;
    }
    return localObject;
  }
  const members = fieldGroupReferences.map((reference) => ({ $ref: refFor(reference.targetModelId, reference.sourceRef) }));
  if (Object.keys(properties).length || node.description || required.length) members.push(localObject);
  return {
    allOf: members,
    "x-interface-workbench-order": (node.members || []).map((member) => member.kind === "property"
      ? { property: member.name }
      : { ref: context.modelIdToName.get(member.targetModelId) || member.sourceRef }),
  };
}

const NO_EXAMPLE_VALUE = Symbol("no-example-value");

function resolvedExampleValue(node, suppliedValue) {
  if (suppliedValue !== NO_EXAMPLE_VALUE) return suppliedValue;
  if (node.examples?.length) return node.examples[0];
  return NO_EXAMPLE_VALUE;
}

function schemaExampleValue(node, modelIndex, suppliedValue, stack, depth) {
  if (!node || depth > 8) return null;
  const exampleValue = resolvedExampleValue(node, suppliedValue);
  if (node.kind === "reference") {
    if (!node.targetModelId || stack.includes(node.targetModelId)) return null;
    const model = modelIndex.get(node.targetModelId);
    return model ? schemaExampleValue(model.root, modelIndex, exampleValue, [...stack, node.targetModelId], depth + 1) : null;
  }
  if (node.kind === "composition") {
    const values = node.members.map((member) => schemaExampleValue(member, modelIndex, exampleValue, stack, depth + 1));
    if (node.operator === "allOf") return Object.assign({}, ...values.filter((value) => value && typeof value === "object" && !Array.isArray(value)));
    return values[0] ?? null;
  }
  if (node.kind === "array") {
    if (Array.isArray(exampleValue)) return exampleValue.map((item) => schemaExampleValue(node.items, modelIndex, item, stack, depth + 1));
    return [schemaExampleValue(node.items, modelIndex, NO_EXAMPLE_VALUE, stack, depth + 1)];
  }
  if (node.kind === "object") {
    const source = exampleValue && typeof exampleValue === "object" && !Array.isArray(exampleValue) ? exampleValue : null;
    if (!(node.members || []).length && source) return deepClone(source);
    const output = {};
    for (const member of node.members || []) {
      if (member.kind === "property") {
        const memberValue = source && Object.hasOwn(source, member.name) ? source[member.name] : NO_EXAMPLE_VALUE;
        output[member.name] = schemaExampleValue(member.schema, modelIndex, memberValue, stack, depth + 1);
      }
      else {
        const value = schemaExampleValue(member, modelIndex, source || NO_EXAMPLE_VALUE, stack, depth + 1);
        if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(output, value);
      }
    }
    return output;
  }
  if (exampleValue !== NO_EXAMPLE_VALUE) return deepClone(exampleValue);
  if (node.default !== undefined) return deepClone(node.default);
  if (node.enum?.length) return deepClone(node.enum[0]);
  if (node.type === "integer" || node.type === "number") return 0;
  if (node.type === "boolean") return false;
  if (node.type === "null") return null;
  return "string";
}

export function schemaExample(node, modelIndex = new Map(), exampleValue = NO_EXAMPLE_VALUE) {
  return schemaExampleValue(node, modelIndex, exampleValue, [], 0);
}

export function generateSchemaPreview(node, modelIndex, options = {}) {
  const random = typeof options.random === "function" ? options.random : Math.random;
  const now = typeof options.now === "function" ? options.now : () => new Date();
  const arrayLength = Math.max(1, Math.min(5, Number(options.arrayLength) || 2));
  const randomInteger = (minimum, maximum) => Math.floor(random() * (maximum - minimum + 1)) + minimum;
  const randomDigits = (length) => Array.from({ length }, () => randomInteger(0, 9)).join("");
  const randomHex = (length) => Array.from({ length }, () => randomInteger(0, 15).toString(16)).join("");
  const choose = (items) => items[Math.min(items.length - 1, Math.floor(random() * items.length))];

  const stringValue = (current, propertyName) => {
    const format = String(current.format || "").toLowerCase();
    const hint = `${propertyName} ${current.title || ""} ${current.description || ""}`.toLowerCase();
    const date = new Date(now());
    date.setUTCMinutes(date.getUTCMinutes() + randomInteger(-1440, 1440));
    if (format === "date") return date.toISOString().slice(0, 10);
    if (format === "date-time") return date.toISOString().replace(".000Z", "Z");
    if (format === "email") return `user${randomInteger(10, 99)}@example.com`;
    if (format === "hostname") return `device-${randomInteger(1, 99)}.example.com`;
    if (format === "ipv4") return `192.168.${randomInteger(0, 20)}.${randomInteger(2, 250)}`;
    if (format === "ipv6") return `2001:db8::${randomInteger(1, 999).toString(16)}`;
    if (format === "uri") return `https://example.com/resource/${randomInteger(100, 999)}`;
    if (format === "uuid") return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${choose(["8", "9", "a", "b"])}${randomHex(3)}-${randomHex(12)}`;
    if (format === "binary") return "SGVsbG8gV29ybGQ=";
    if (/date|time/.test(hint)) return date.toISOString().replace("T", " ").slice(0, 19);
    if (/(^|[^a-z])sn([^a-z]|$)|serial/.test(hint)) return `SN${randomDigits(12)}`;
    if (/code/.test(hint)) return `CODE_${randomInteger(1000, 9999)}`;
    if (/status|state/.test(hint)) return "active";
    if (/name|title/.test(hint)) return "示例名称";
    if (/desc|description|message|remark/.test(hint)) return "示例说明";
    if (/url|uri|link/.test(hint)) return `https://example.com/${randomInteger(100, 999)}`;
    const minimumLength = Math.max(0, Number(current.constraints?.minLength) || 0);
    const maximumLength = Math.max(minimumLength, Number(current.constraints?.maxLength) || 0);
    const base = "示例文本";
    if (!minimumLength && !maximumLength) return base;
    const targetLength = maximumLength ? Math.min(maximumLength, Math.max(minimumLength, base.length)) : Math.max(minimumLength, base.length);
    return base.repeat(Math.ceil(targetLength / base.length)).slice(0, targetLength);
  };

  const numericValue = (current) => {
    const integer = current.type === "integer";
    let minimum = Number(current.constraints?.minimum);
    let maximum = Number(current.constraints?.maximum);
    if (!Number.isFinite(minimum)) minimum = 0;
    if (!Number.isFinite(maximum)) maximum = minimum + 100;
    if (maximum < minimum) [minimum, maximum] = [maximum, minimum];
    let value = integer ? randomInteger(Math.ceil(minimum), Math.floor(maximum)) : minimum + random() * (maximum - minimum);
    const multipleOf = Number(current.constraints?.multipleOf);
    if (Number.isFinite(multipleOf) && multipleOf > 0) value = Math.round(value / multipleOf) * multipleOf;
    return integer ? Math.round(value) : Number(value.toFixed(current.format === "float32" || current.format === "float" ? 6 : 10));
  };

  const generate = (current, stack = [], depth = 0, propertyName = "") => {
    if (!current || depth > 8) return null;
    if (current.examples?.length) return deepClone(current.examples[0]);
    if (current.default !== undefined) return deepClone(current.default);
    if (current.enum?.length) return deepClone(choose(current.enum));
    if (current.kind === "reference") {
      if (!current.targetModelId || stack.includes(current.targetModelId)) return null;
      const model = modelIndex.get(current.targetModelId);
      const base = model ? generate(model.root, [...stack, current.targetModelId], depth + 1, model.name) : null;
      if (!current.overlay) return base;
      const overlay = generate(current.overlay, stack, depth + 1, propertyName);
      return base && overlay && typeof base === "object" && typeof overlay === "object" && !Array.isArray(base) && !Array.isArray(overlay) ? { ...base, ...overlay } : overlay ?? base;
    }
    if (current.kind === "composition") {
      if (current.operator === "allOf") return Object.assign({}, ...current.members.map((member) => generate(member, stack, depth + 1, propertyName)).filter((value) => value && typeof value === "object" && !Array.isArray(value)));
      const member = current.members.length ? choose(current.members) : null;
      return generate(member, stack, depth + 1, propertyName);
    }
    if (current.kind === "array") return Array.from({ length: arrayLength }, () => generate(current.items, stack, depth + 1, propertyName));
    if (current.kind === "object") {
      const output = {};
      for (const member of current.members || []) {
        if (member.kind === "property") output[member.name] = generate(member.schema, stack, depth + 1, member.name);
        else {
          const value = generate(member, stack, depth + 1, propertyName);
          if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(output, value);
        }
      }
      return output;
    }
    if (current.type === "integer" || current.type === "number") return numericValue(current);
    if (current.type === "boolean") return random() >= 0.5;
    if (current.type === "null") return null;
    return stringValue(current, propertyName);
  };

  return generate(node);
}
