# Roadmap OpenAI e qualidade de vídeo

Registrado em 16/09/2026 para retomada no próximo ciclo.

## Integrações com API — status atualizado

- [x] Configurar `OPENAI_API_KEY` apenas no servidor e testar a conexão (implementado via `api-keys.ts` e `SettingsPage`).
- [x] Implementar `OpenAITextProvider` pela Responses API, mantendo Gemini como alternativa (atendido por `OpenAICompatTextProvider` que suporta OpenAI oficial, NVIDIA NIM, OpenRouter e Ollama).
- [x] Usar saída estruturada validada pelos schemas Zod atuais (`generateJson` integrado com Zod schemas do core).
- [x] Adicionar seleção de provedor e modelo nas configurações do Studio (`TEXT_PROVIDER`, `TEXT_PROVIDER_IDEIAS`, `TEXT_PROVIDER_ROTEIRO`, `TEXT_PROVIDER_FALLBACK`).
- [x] Criar “Gerar imagens das cenas” para preencher automaticamente cenas pendentes (implementado via job `GENERATE_IMAGES` com `forPendingScenes: true` e fallback no pipeline de ações).
- [x] Motores de imagem unificados com teto de orçamento obrigatório (Pollinations, Cloudflare, Hugging Face, Together, Gemini, OpenAI GPT Image, Kie.ai).
- [ ] Atualizar imagens OpenAI de `gpt-image-1` para GPT Image 2.5 / DALL-E 3 conforme disponibilidade de endpoint.
- [ ] Usar Flare para cenas em lote e Sunburst para thumbnails/cenas principais.
- [ ] Criar bíblia visual por projeto e usar imagens aprovadas como referência de continuidade.
- [ ] Validar imagens por visão e regenerar, com limite, quando houver defeitos ou baixa aderência.
- [ ] Acrescentar pesquisa com fontes, revisão crítica e checagem de fatos ao roteiro.
- [x] Exibir estimativa antes da execução, teto por projeto e consumo por provedor (painel `Orçamento de IA paga` no `/settings`).

## Melhorias locais — ciclo atual

- [x] Modelos selecionáveis de legenda no render.
- [x] Oito identidades de legenda por nicho, além do automático e personalizado.
- [x] Editor visual de fonte, cores, tamanho, posição, contorno, sombra e ritmo de palavras.
- [x] Prévia instantânea e validação de contraste/área inferior em formato vertical.
- [x] Modelo personalizado persistente por projeto.
- [x] A mesma legenda na prova e no render final.
- [x] Bloqueio de render legendado sem alinhamento.
- [x] Pré-voo de qualidade de mídia no passo de render.
- [x] Arquivo ausente vira fallback seguro em vez de derrubar o FFmpeg.
- [x] Validação do conteúdo real das palavras alinhadas.
- [x] Cores dos modelos de legenda respeitadas no karaokê.
- [x] Botão “Gerar com GPT” exporta um TXT completo, nomeado por cena e compatível com a inbox.
- [x] Leitura de largura, altura e duração na importação/upload de mídia.
- [x] Backfill das dimensões das cenas antigas do projeto usado na validação.
- [x] Planejamento denso exposto como “Alta retenção” (ritmo de 2–4s em Shorts).
- [x] Botão “Programar postagem” com data/hora e agendamento nativo do YouTube.
- [x] Reutilização do upload privado ao programar/publicar, sem duplicar vídeo no canal.
- [x] Estados separados na interface: privado, programado e publicado.

## Próximas melhorias locais priorizadas

- [x] Presets de criação de Shorts com 30, 45, 60 e 90 segundos.
- [x] Capa vertical para Shorts/Reels/TikTok, mantendo thumbnail 16:9 para YouTube.
- [x] Detecção de arquivos de mídia idênticos mesmo com nomes/caminhos diferentes.
- [ ] Detecção perceptual de imagens apenas parecidas (não idênticas).
- [x] Verificação automática de quadros pretos e silêncio excessivo no master.
- [ ] Verificação visual automatizada da área segura das legendas.
- [x] Calendário de postagens na publicação, com reagendamento e cancelamento.
- [x] Mais movimento em stills e B-roll: pans direcionais, zooms, dolly, parallax suave, handheld e punch zoom.
- [ ] Biblioteca de efeitos sonoros sincronizados por evento/palavra.
- [x] Pontuação de retenção e checklist editorial antes do render final.
- [x] Aprovação, rejeição e solicitação de alterações por versão renderizada.
- [x] Revisão por cena com observação e seleção de motion.
- [x] Versionamento e render incremental com cache limitado a 2 GB.

## Regra de implementação

Gemini permanece disponível. OpenAI entra como opção, nunca como substituição obrigatória. Todo
motor pago deve passar pelo teto de orçamento antes da chamada e registrar o custo depois do
sucesso.
