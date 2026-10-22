import { describe, expect, it } from "vitest";
import { acharExecutavel, prepararExecutavel, resolverAtalhoNpm } from "./agente-executavel";

// Atalho real gerado pelo npm para o Claude Code (lido deste PC).
const ATALHO_CLAUDE = [
  "@ECHO off",
  "GOTO start",
  ":find_dp0",
  "SET dp0=%~dp0",
  "EXIT /b",
  ":start",
  "SETLOCAL",
  "CALL :find_dp0",
  '"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*',
].join("\r\n");

const ATALHO_NODE = [
  "@ECHO off",
  "SETLOCAL",
  "CALL :find_dp0",
  'IF EXIST "%dp0%\\node.exe" (',
  '  SET "_prog=%dp0%\\node.exe"',
  ") ELSE (",
  '  SET "_prog=node"',
  ")",
  'endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\hyperframes\\bin\\hyperframes.mjs" %*',
].join("\r\n");

describe("resolverAtalhoNpm", () => {
  it("traduz o atalho do Claude Code para o .exe real", () => {
    const r = resolverAtalhoNpm(ATALHO_CLAUDE, "C:\\Users\\Ana\\AppData\\Roaming\\npm\\claude.cmd");
    expect(r).toEqual({
      command: "C:\\Users\\Ana\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe",
      prefixo: [],
    });
  });

  it("traduz um atalho que roda um script Node (node + script)", () => {
    const r = resolverAtalhoNpm(ATALHO_NODE, "C:\\npm\\hyperframes.cmd", "C:\\node\\node.exe");
    expect(r).toEqual({ command: "C:\\node\\node.exe", prefixo: ["C:\\npm\\node_modules\\hyperframes\\bin\\hyperframes.mjs"] });
  });

  it("devolve null para um formato desconhecido", () => {
    expect(resolverAtalhoNpm("@echo off\r\necho oi", "C:\\x\\y.cmd")).toBeNull();
  });
});

describe("prepararExecutavel", () => {
  it("não mexe em executáveis normais nem fora do Windows", () => {
    expect(prepararExecutavel("C:\\bin\\agy.exe", "win32")).toEqual({ command: "C:\\bin\\agy.exe", prefixo: [] });
    expect(prepararExecutavel("/usr/bin/claude", "linux")).toEqual({ command: "/usr/bin/claude", prefixo: [] });
  });

  it("traduz .cmd no Windows e devolve null se não der", () => {
    const ok = prepararExecutavel("C:\\npm\\claude.cmd", "win32", () => ATALHO_CLAUDE);
    expect(ok?.command).toMatch(/claude\.exe$/);
    expect(prepararExecutavel("C:\\npm\\x.cmd", "win32", () => "@echo off")).toBeNull();
    expect(prepararExecutavel("C:\\npm\\x.cmd", "win32", () => { throw new Error("sem arquivo"); })).toBeNull();
  });
});

describe("acharExecutavel", () => {
  it("usa primeiro os caminhos extras que existem", () => {
    const existe = (p: string) => p === "C:\\extra\\claude.exe";
    expect(acharExecutavel(["claude"], ["C:\\extra\\claude.exe"], { PATH: "" }, "win32", existe)).toBe("C:\\extra\\claude.exe");
  });

  it("procura no PATH com PATHEXT no Windows", () => {
    const existe = (p: string) => p === "C:\\tools\\codex.exe";
    expect(acharExecutavel(["codex"], [], { PATH: "C:\\a;C:\\tools", PATHEXT: ".EXE;.CMD" }, "win32", existe)).toBe("C:\\tools\\codex.exe");
  });

  it("procura no PATH no Linux/Mac e devolve null se não achar", () => {
    const existe = (p: string) => p === "/usr/local/bin/claude";
    expect(acharExecutavel(["claude"], [], { PATH: "/usr/bin:/usr/local/bin" }, "linux", existe)).toBe("/usr/local/bin/claude");
    expect(acharExecutavel(["codex"], [], { PATH: "/usr/bin" }, "linux", () => false)).toBeNull();
  });
});
