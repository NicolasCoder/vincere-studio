import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Com o worker rodando jobs em paralelo (pipeline paralelo), mais de um processo
// escreve no mesmo arquivo SQLite ao mesmo tempo. busy_timeout é por conexão (não
// persiste no arquivo como o journal_mode=WAL que o worker já ativa), então cada
// processo que abre o Prisma Client — inclusive o Next.js — precisa configurar o
// seu, senão colisões de escrita falham na hora em vez de esperar a vez.
prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000;").catch(() => {});

export * from "@prisma/client";
