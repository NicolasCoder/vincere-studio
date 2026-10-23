import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ensureStarterProject, hasHyperframesProjects, listWorkspaceProjects } from "./hyperframes-runtime";

describe("hyperframes-runtime & auto-healing de workspace", () => {
  it("detecta corretamente quando uma pasta tem ou não projetos com index.html", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hf-test-empty-"));
    try {
      expect(hasHyperframesProjects(tmp)).toBe(false);

      const projDir = path.join(tmp, "meu-projeto");
      await fs.mkdir(projDir, { recursive: true });
      expect(hasHyperframesProjects(tmp)).toBe(false);

      await fs.writeFile(path.join(projDir, "index.html"), "<html></html>", "utf8");
      expect(hasHyperframesProjects(tmp)).toBe(true);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("cria automaticamente o projeto inicial referenciamotion-pro quando o workspace está vazio", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hf-test-starter-"));
    try {
      const list = await ensureStarterProject(tmp, "starter-auto-heal");
      const found = list.find((p) => p.name === "starter-auto-heal");
      expect(found).toBeDefined();
      const html = await fs.readFile(path.join(tmp, "starter-auto-heal", "index.html"), "utf8");
      expect(html).toContain('data-composition-id="main"');
      expect(html).toContain('window.__timelines["main"]');
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("lista projetos mesclando o diretório primário e os diretórios candidatos", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hf-test-merge-"));
    try {
      const p1 = path.join(tmp, "projeto-um");
      await fs.mkdir(p1, { recursive: true });
      await fs.writeFile(path.join(p1, "index.html"), "<html></html>", "utf8");

      const list = listWorkspaceProjects(tmp);
      expect(list.some((p) => p.name === "projeto-um")).toBe(true);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
