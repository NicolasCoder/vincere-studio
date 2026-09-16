-- Horário entregue ao agendador nativo da plataforma (YouTube).
ALTER TABLE "Publication" ADD COLUMN "scheduledAt" DATETIME;
ALTER TABLE "Publication" ADD COLUMN "privacyStatus" TEXT;
