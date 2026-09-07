import { z } from "zod";

/**
 * Converte um schema Zod no subconjunto OpenAPI que a API do Gemini aceita em
 * `responseSchema`. Cobre objetos, arrays, strings, números, booleanos, enums,
 * opcionais e defaults — o suficiente para os payloads do DocuPulse.
 */
export function toGeminiSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = schema._def;
  const desc = schema.description ? { description: schema.description } : {};
  switch (def.typeName as string) {
    case "ZodObject": {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(shape)) {
        properties[k] = toGeminiSchema(v as z.ZodTypeAny);
        const t = (v as z.ZodTypeAny)._def.typeName;
        if (t !== "ZodOptional" && t !== "ZodDefault") required.push(k);
      }
      return { type: "OBJECT", properties, required, ...desc };
    }
    case "ZodArray":
      return { type: "ARRAY", items: toGeminiSchema(def.type), ...desc };
    case "ZodString":
      return { type: "STRING", ...desc };
    case "ZodNumber":
      return { type: "NUMBER", ...desc };
    case "ZodBoolean":
      return { type: "BOOLEAN", ...desc };
    case "ZodEnum":
      return { type: "STRING", enum: def.values, ...desc };
    case "ZodLiteral":
      return { type: "STRING", enum: [String(def.value)], ...desc };
    case "ZodOptional":
    case "ZodDefault":
    case "ZodNullable":
      return { ...toGeminiSchema(def.innerType), ...desc };
    default:
      return { type: "STRING", ...desc };
  }
}
