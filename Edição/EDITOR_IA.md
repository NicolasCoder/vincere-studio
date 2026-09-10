# Editor-IA — camada visual DVP sobre os masters do DocuPulse

Projeto Remotion **único** que recebe os vídeos já renderizados pelo DocuPulse.AI e devolve a versão
com camada visual aplicada, pronta para postar.

Nunca criar outro `package.json`, `node_modules` ou projeto Remotion dentro das pastas de material.
Existe um projeto só, na raiz de `Edição/`.

---

## Fluxo de pastas

Entra em `Projetos/<slug>/`, sai em `Edições/<slug>/`.

```text
Projetos/<slug>/      master do DocuPulse, transcrição exportada, referências
src/videos/<slug>/    cenas Remotion deste trabalho
docs/videos/<slug>.md plano de inserções (uma linha por inserção)
Edições/<slug>/       render final — nada mais
Assets/               identidade visual DVP (referência fixa, compartilhada)
```

Um master de entrada = um trabalho. Dois masters nunca são concatenados sem pedido explícito.

O `slug` acompanha o projeto no DocuPulse (ex.: `rodovia-44-carros-vazios`).

---

## O master é intocável

O vídeo que chega de `Projetos/` já saiu do pipeline com **narração, legendas queimadas, cortes,
Ken Burns por cena, crossfades entre cenas e mixagem final prontos**. Sobre ele eu só componho
camada visual por cima.

**Não fazer:** cortar, reordenar, acelerar, mudar áudio, recomprimir a fonte, apagar o original.
Mexer na montagem, só a pedido explícito.

---

## O que já existe no master (não refazer)

Este é o ponto onde a maioria das ideias de edição colide com o pipeline. Antes de planejar
qualquer coisa, lembrar:

| Já existe no master | Consequência para a camada visual |
|---|---|
| **Ken Burns por cena** (`zoompan`, `packages/render/src/render.ts`) | Não aplicar um segundo zoom sobre o frame inteiro — empilha movimento e embrulha o olho. Zoom só em elemento novo que eu adiciono por cima. |
| **Legendas queimadas em ASS** (`packages/render/src/captions.ts`) | Não dá para mover nem remover. Toda a faixa inferior é zona proibida — ver "Zona segura". |
| **Crossfade entre cenas** dentro de cada ato | Não sobrepor transição própria em cima de um crossfade que já está rolando. |
| **Áudio mixado e normalizado** (-14 LUFS, AAC 192k) | O áudio existe uma vez só, vindo do master. Não adicionar trilha, não renormalizar. |
| **Transcrição alinhada por palavra** | Não rodar Whisper de novo. Ver "Transcrição". |

### Especificação do master

| | Longo (YouTube) | Short (vertical) |
|---|---|---|
| Resolução | 1920×1080 | 1080×1920 |
| FPS | 30 | 30 |
| Vídeo | H.264 (`h264_qsv`, fallback `libx264`) | idem |
| Áudio | AAC 192k, uma trilha | idem |
| Container | MP4, `+faststart` | idem |

A composição Remotion **herda largura, altura e fps do master**. Nunca fixar valores na mão.

---

## Transcrição — já pronta, não rodar Whisper

A transcrição alinhada por palavra **já existe no banco do DocuPulse**, gerada pelo job
`ALIGN_CAPTIONS`: tabela `Caption`, campo `words` (JSON `{text, startMs, endMs}[]`), uma linha por
`VoiceTrack` — ou seja, **uma por ato**.

Exportar para `Projetos/<slug>/transcript.json` antes de planejar. Não mandar áudio para serviço
externo, não instalar faster-whisper, não reprocessar nada.

### Gotcha crítico: timecode por ato ≠ timecode do master

Os `startMs`/`endMs` são **relativos ao áudio de cada ato**, não ao vídeo final. O master concatena
os atos com um silêncio (`gapMs`) entre eles. Para chegar ao timecode absoluto, repetir exatamente a
mesma acumulação que o `buildAss` faz:

```text
offsetDoAto(0) = 0
offsetDoAto(n) = offsetDoAto(n-1) + voiceDurationMs(n-1) + gapMs

tAbsoluto(palavra) = offsetDoAto(ato) + palavra.startMs
```

Errar isso desalinha a edição inteira e o erro **cresce a cada ato** — no ato 6 já são segundos de
defasagem. Sempre conferir o timecode calculado contra um frame real do master antes de implementar.

Timecode vem sempre do áudio do master, nunca estimado a partir do texto.

---

## Passo a passo

1. **Exportar a transcrição** do banco para `Projetos/<slug>/transcript.json` e `.md`, já com o
   timecode absoluto calculado.
2. **Olhar o vídeo de verdade** com a skill `/watch --no-whisper` (as legendas já vêm do passo 1).
   Extrair frames reais antes de posicionar qualquer coisa: preciso ver onde está o assunto do
   quadro, onde a legendagem cai, onde o B-roll é escuro ou claro demais para receber texto por
   cima. Zona segura genérica não vale quando o master está disponível.
3. **Planejar** em `docs/videos/<slug>.md`: uma linha por inserção com intervalo, fala-gatilho,
   layout e o que aparece.
4. **Implementar** as cenas em `src/videos/<slug>/`, registradas em `src/Root.tsx`.
5. **Validar e renderizar** para `Edições/<slug>/`.

Cada entrada de elemento casa com a palavra que introduz a ideia — o layout pode começar a se
transformar um pouco antes para já estar legível no gatilho, mas o conteúdo não aparece antes da
palavra.

---

## Sistema visual DVP

A identidade está em `Assets/assets1.png` … `assets4.png`. Usar como **referência de estilo**, não
como fonte de conteúdo: os quadros de texto e os números dentro dessas artes são preenchimento
gerado, não dados reais.

### Paleta

Os rótulos hex das artes chegaram ilegíveis ("#LI-YYADO", "#03) STONE", "WARM WMM"), então os
valores abaixo foram **amostrados a olho dos próprios quadros de cor**.

**Decisão (Igor, 09/09): estes são o padrão.** Não há manual de marca DVP com os valores oficiais,
e as artes de referência são a única fonte de verdade. Se um manual aparecer depois, é trocar os
nove valores em `DVP_PALETTE` (`packages/core/src/edit-plan.ts`) — nada mais depende deles.

| Nome | Hex (estimado) | Uso |
|---|---|---|
| Creme | `#F2EBE0` | fundo claro, texto sobre escuro |
| Areia | `#E4D9C8` | fundo secundário, texto de apoio |
| Pedra | `#A9A9A4` | linhas, eixos, texto terciário |
| Carvão | `#2E312E` | fundo escuro, texto principal |
| Cacau | `#5A3A28` | destaque quente, tarja de autoridade |
| Olive | `#6E7A5A` | subtítulo, série de dado secundária |
| Terra | `#C4674A` | destaque principal, número em evidência |
| Ardósia | `#4A5F75` | série de dado fria, contraponto |
| Cobre | `#C06A38` | rota em mapa, marca-texto, acento |

Dois nomes chegaram corrompidos nas artes e foram corrigidos aqui, **confirmado pelo Igor**:
**"Areja" → Areia** e **"Arduino" → Ardósia**.

**Regra de contraste:** o master é documentário escuro. Texto claro (Creme/Areia) sobre placa
Carvão a 80–90% de opacidade é o padrão seguro. Terra e Cobre só em elemento pequeno de destaque —
nunca como fundo de bloco grande de texto.

### Tipografia

**Decisão (Igor, 09/09):** sem fonte oficial definida na identidade, ficam as escolhas abaixo.

- **Títulos / intertítulos:** **Playfair Display** — serifada de display, é a mais próxima do
  logotipo DVP nas artes de referência.
- **Corpo / lower third:** **Inter** — sans humanista, peso médio, boa legibilidade em vídeo.
- **Legendas:** não mexer — são Segoe UI queimadas no master.

Ambas são do Google Fonts (licença SIL Open Font), então podem ser embutidas no projeto sem custo
nem limitação de uso comercial.

### Lower thirds

Três estilos, direto das artes:

| Estilo | Quando usar | Especificação |
|---|---|---|
| **A — Autoridade** | fonte, especialista, instituição citada | placa Carvão com leve gradiente, texto principal Creme, linha secundária Olive |
| **B — Emocional** | nome de pessoa, testemunho | fundo transparente, texto Areia, sem placa — só sombra suave para legibilidade |
| **C — Datado** | data, local, procedência de arquivo | caixa pequena, 80% de opacidade, texto Terra, caixa alta |

### Transições

| Efeito | Uso no nosso material |
|---|---|
| **Ken Burns** | já vem do master — **não repetir** na camada |
| **Light leak sutil** | quebra emocional ou salto temporal entre atos |
| **Corte seco com room tone** | mudança de assunto dentro do ato; o room tone já está no áudio |
| **Intertítulo em tela cheia** | virada de capítulo/ato — o mais útil pro nosso formato |

### Infográficos

Timeline modular, mapa de rota animado e gráfico comparativo. Nos nossos temas (mistérios,
desastres, história oculta) o que mais paga é: **linha do tempo** para reconstituir a cronologia e
**mapa de rota** para geografia do evento. Legendas sempre fora do gráfico, cores da paleta.

### Efeitos

Tom sépia, dessaturação parcial, luz cinematográfica, vibração de cor. Aplicar **só no elemento
inserido** (foto de arquivo, print, recorte), nunca no frame inteiro — o master já tem grade de cor
própria.

---

## Layouts

O nosso master **não tem câmera nem apresentador**: é B-roll em tela cheia com narração e legenda.
Então os layouts de split/PiP herdados de vídeo de talking head não se aplicam. Os nossos são:

| Layout | Descrição |
|---|---|
| `master-clean` | master sem nada por cima — descanso, não é falha |
| `lower-third` | master + placa inferior (estilos A/B/C), acima da faixa de legenda |
| `overlay-dado` | master + número/estatística em destaque num canto |
| `insert-arquivo` | foto/print de arquivo sobreposto em moldura, ocupando 55–70% do quadro |
| `split-evidencia` | master de um lado, evidência (print, documento, mapa) do outro |
| `graphic-fullscreen` | infográfico ou intertítulo cobrindo o quadro inteiro |

Nem todo trecho precisa de inserção. Alvo inicial: **1 inserção a cada 20–35s**, densificando nos
momentos de revelação e afrouxando na narração de contexto.

### Zona segura

Calculada a partir do `buildAss` real, não estimada:

**Longo (1920×1080):**
- Legenda ancorada embaixo, `MarginV` = 7% da altura (≈76px), fonte ≈45px, podendo ocupar 2 linhas.
- **Faixa proibida: os 18% inferiores (y > 885).** Nada de conteúdo meu ali.
- Margens laterais da legenda: 60px de cada lado.

**Short (1080×1920):**
- Legenda **centralizada no meio do quadro** (alinhamento 5, `MarginV` = 38% da altura).
- **Faixa proibida: a banda central**, aproximadamente y de 700 a 1150.
- Sobra o terço superior e o terço inferior para inserção.

### Entrada e saída de split

O ponto que mais quebra. Os dois lados usam a **mesma janela, mesma curva e mesmo progresso
normalizado**: um painel se retrai enquanto o outro expande, e ambos terminam no mesmo frame. O
master nunca ocupa área ainda coberta pelo painel, e o painel não fica parado esperando o fim de uma
`<Sequence>`.

Usar o helper compartilhado em `src/videos/_shared/synchronized-split.tsx` em vez de recalcular
posição e largura na mão. Faixa de 0,9–1,2s, `Easing.inOut(Easing.cubic)` ou spring com
`damping: 200`, sem overshoot.

### Evidência e prints

Print de notícia, documento ou registro tem que mostrar **inteira** a evidência que sustenta a fala
— manchete, número e frase citada. Marca-texto (Cobre) cobre exatamente o trecho citado e acompanha
qualquer transformação aplicada à imagem. Cuidado com `object-fit: cover` cortando justamente o que
importa.

---

## Regras Remotion

- Uma única `<Video>` contínua como master de imagem e som. O áudio existe uma vez só.
- Reenquadrar animando o contêiner; nunca reiniciar a fonte ao trocar de layout.
- Toda animação sai de `useCurrentFrame()` / `useVideoConfig()`. Sem CSS `transition`, `keyframes`
  ou classe de animação.
- Tempos em segundos, convertidos pelo fps da composição.
- `<Sequence premountFor={fps}>` em cena temporizada. Montar só as cenas ativas.
- `staticFile('<slug>/...')` para tudo que vem de `Projetos`.
- `<Img>`, `<Audio>` e `<Video>` de `@remotion/media`.
- Herdar dimensões e fps do master.
- Evitar `TransitionSeries.Transition` — encurta a duração da timeline travada.

Na dúvida sobre API, consultar a skill `remotion-best-practices` antes de improvisar.

---

## Antes de entregar

1. `npm run typecheck`
2. Stills no início, meio e fim de cada mudança de layout — e no fim de cada transição de saída de
   split.
3. Conferir que **nenhuma inserção invadiu a faixa de legenda** (amostrar frames nos momentos de
   pico de texto).
4. `ffprobe` no arquivo final: duração compatível com o master (tolerância de 1 frame), **uma**
   trilha de áudio, codec H.264, fps 30, resolução igual à do master.
5. Apagar só previews que eu mesmo criei. Nunca mídia original.

Na entrega: caminho clicável, duração, resolução, fps e codec.
