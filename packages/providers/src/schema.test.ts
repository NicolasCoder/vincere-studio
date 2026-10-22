import { describe, expect, it } from "vitest";
import { z } from "zod";
import { schemaInstruction } from "./schema";

describe("schemaInstruction", () => {
  const schema = z.object({
    ideas: z.array(z.object({ title: z.string(), ctr: z.number(), pace: z.enum(["calmo", "rapido"]), note: z.string().optional() })),
  });

  it("descreve campos, tipos e enums com tipos em minúsculas", () => {
    const text = schemaInstruction(schema);
    expect(text).toContain('"type":"object"');
    expect(text).toContain('"type":"array"');
    expect(text).toContain('"enum":["calmo","rapido"]');
    expect(text).not.toContain('"OBJECT"');
  });

  it("marca como obrigatórios só os campos não opcionais", () => {
    const text = schemaInstruction(schema);
    expect(text).toContain('"required":["title","ctr","pace"]');
  });

  it("pede JSON puro", () => {
    expect(schemaInstruction(schema)).toMatch(/APENAS com JSON válido/);
  });
});
