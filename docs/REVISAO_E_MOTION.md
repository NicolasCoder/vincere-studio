# Revisão, versões e motion

Implementado em 16/09/2026 sobre o fluxo existente de FFmpeg + Remotion, preservando o master e a camada visual DVP.

## Fluxo de revisão

1. Cada render final cria uma nova versão numerada e começa como **Aguardando revisão**.
2. A versão pode ser **Aprovada**, receber **Alterações solicitadas** ou ser **Rejeitada**, sempre com observação opcional.
3. Rejeitar não apaga o MP4. O histórico mantém a decisão e o download das versões ainda presentes em disco.
4. Publicar ou programar no YouTube exige que a versão mais recente esteja aprovada.
5. A revisão por cena permite salvar decisão, observação e motion. Alterações/rejeições na cena marcam a versão atual como necessitando ajustes.
6. **Gerar nova versão** aplica os ajustes. O cache incremental reaproveita clipes e atos cujo conteúdo não mudou.

## Presets de motion

- Estático
- Zoom suave e zoom de abertura
- Pan para direita, esquerda, cima e baixo
- Dolly in
- Flutuação suave
- Parallax suave simulado
- Handheld leve
- Punch zoom

Os presets funcionam em imagens e também em B-roll de vídeo. O nome legado `slow-pan` continua aceito e é convertido para `pan-right`.

## Segurança e armazenamento

- O master anterior nunca é sobrescrito.
- O render mantém até três MP4 finais, conforme a política já existente.
- O cache incremental possui teto de 2 GB e remove primeiro os itens mais antigos.
- Preview/prova não vira uma versão publicável.
- A camada visual continua separada e pode ser reaplicada depois de um novo master.

## Banco

A migração `20260916065000_add_render_review_and_scene_motion` adiciona:

- `RenderJob.revision`, `reviewStatus`, `reviewNote` e `reviewedAt`.
- `Scene.reviewStatus` e `reviewNote`.
