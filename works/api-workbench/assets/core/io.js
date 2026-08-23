import { importApifoxProject, exportApifoxProject } from "./apifox.js?v=20260811.2";
import { exportMarkdown, importMarkdown } from "./markdown.js?v=20260811.9";
import { exportOpenApiYaml, parseOpenApiText } from "./openapi.js?v=20260811.2";

export async function importProjectFile(file) {
  const text = await file.text();
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return importMarkdown(text, file.name);
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return parseOpenApiText(text, file.name);
  if (lower.endsWith(".json")) {
    const source = JSON.parse(text);
    if (source.format === "api-workbench") return source;
    if (source.$schema?.app === "apifox" || source.apifoxProject) return importApifoxProject(source, file.name);
    return parseOpenApiText(text, file.name);
  }
  throw new Error("仅支持 Apifox JSON、OpenAPI JSON/YAML、Markdown 和接口工坊项目文件");
}

export function exportProjectFiles(project) {
  return {
    apifox: JSON.stringify(exportApifoxProject(project), null, 2),
    openapi: exportOpenApiYaml(project),
    markdown: exportMarkdown(project),
    backup: JSON.stringify(project, null, 2),
  };
}
