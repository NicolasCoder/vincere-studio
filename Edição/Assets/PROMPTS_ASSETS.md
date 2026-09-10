# Prompts de assets — camada visual DVP

Assets reutilizáveis entre vídeos, para os layouts `insert-arquivo`, `split-evidencia` e
`graphic-fullscreen` do [plano de edição](../EDITOR_IA.md).

## Princípio: substrato vazio, texto por cima

Todo prompt aqui pede **nenhum texto na imagem**. O texto real (data, nome, manchete, citação)
é desenhado depois pelo Remotion, com a tipografia DVP.

Por quê:

1. **Texto gerado por IA sai ilegível.** As próprias artes DVP de referência mostram isso — os
   rótulos viraram "Arddulino", "Key Nillostlone", "#LI-YYADO".
2. **Reuso.** Um papel em branco serve para os 50 próximos vídeos. Um boletim de ocorrência com
   texto embutido serve para um só.
3. **Honestidade editorial.** Documento oficial fabricado apresentado como evidência real é risco
   de credibilidade para um canal de documentário. Substrato + tipografia lê como grafismo
   editorial, não como falsificação.

## O que NÃO gerar como imagem

Estes são **código**, não asset — gerar como imagem produz rótulo ilegível e número inventado:

- Linha do tempo, gráfico de pizza, gráfico de barras, dispersão
- Mapa com nomes de lugares ou rota traçada
- Lower thirds e placas de nome
- Qualquer coisa com número ou porcentagem

Tudo isso o Remotion desenha em vetor, nítido e com o dado certo.

## Especificação comum

- **Resolução:** a maior que o Gemini entregar. Mínimo 1920×1080.
- **Proporção:** 16:9 para os grupos 3 e 4; 4:3 ou quadrado para os grupos 1 e 2 (entram como
  inserção ocupando 55–70% do quadro).
- **Formato:** PNG.
- **Onde salvar:** uma subpasta por grupo, já criadas — o caminho de cada uma está no título do
  grupo. Agrupar assim deixa o Remotion sortear um substrato diferente a cada inserção sem
  repetir o mesmo papel duas vezes no mesmo vídeo.
- **Paleta DVP** citada nos prompts: Creme `#F2EBE0` · Areia `#E4D9C8` · Pedra `#A9A9A4` ·
  Carvão `#2E312E` · Cacau `#5A3A28` · Olive `#6E7A5A` · Terra `#C4674A` · Ardósia `#4A5F75` ·
  Cobre `#C06A38`.

Se alguma imagem voltar com rabisco parecido com letra, gere de novo — a limpeza importa mais que
o realismo, porque o texto de verdade entra por cima.

---

# Grupo 1 — Substratos de evidência ★ prioridade máxima

→ salvar em `Assets/props/substratos/`

Resolve diretamente o `insert-arquivo` e o `split-evidencia`, que hoje não têm nenhum asset.

### 1.1 — `papel-dossie-01.png`
> Top-down photograph of a single sheet of aged manila dossier paper lying on a dark charcoal surface. The sheet is completely blank and empty — absolutely no text, no letters, no words, no printed marks, no stamps, no signatures. Soft creases and fold lines, fibrous paper texture, slightly yellowed cream tone, one faint coffee ring stain near a corner. Single hard directional key light from the left, casting a soft shadow along the right edge. Muted desaturated documentary palette: cream and sand paper against a charcoal background. Archival photography, shallow depth of field, high detail. No people.

### 1.2 — `pasta-arquivo-aberta-01.png`
> Top-down photograph of an open cardboard file folder on a dark charcoal desk, containing a small stack of completely blank aged papers. No text, no letters, no words, no labels, no tab writing anywhere. Worn folder edges, muted olive-brown cardboard, papers in cream and sand tones. Single hard directional light from the upper left creating dramatic side shadow. Desaturated documentary color grade, archival photography, shallow depth of field. No people, no hands.

### 1.3 — `prancheta-formulario-01.png`
> Top-down photograph of a metal clipboard holding a blank sheet of paper, on a dark charcoal surface. The sheet has only faint horizontal ruled lines and a thin printed border — absolutely no words, no letters, no numbers, no handwriting. Scratched brushed-metal clip, aged cream paper. Hard directional key light from the left, strong side shadow. Muted desaturated palette, archival documentary photography, high detail. No people, no hands.

### 1.4 — `jornal-antigo-01.png`
> Top-down photograph of an old yellowed newspaper page on a dark charcoal surface. The text columns are heavily out of focus and completely illegible — soft grey blurred lines suggesting type, with no readable words or letters anywhere. Visible column rules and one empty rectangular space where a photo would sit. Aged newsprint texture, foxing spots, soft creases. Hard directional light from the left. Desaturated sepia and charcoal palette, archival photography. No people.

### 1.5 — `ficha-catalogo-01.png`
> Top-down macro photograph of a small blank index card resting on a dark charcoal surface, with a few more cards fanned out beneath it. Completely blank — no text, no letters, no numbers, no handwriting, no stamps. Only a faint printed horizontal rule line and a small punched hole at the bottom edge. Aged cream cardstock, worn corners, fibrous texture. Hard raking side light from the left. Muted desaturated documentary palette, shallow depth of field, high detail.

### 1.6 — `caixa-arquivo-01.png`
> Photograph of a worn cardboard archive box with its lid off, packed tightly with the top edges of blank aged documents, shot from a slight high angle on a dark charcoal surface. Only paper edges are visible — no text, no letters, no labels anywhere on the box or papers. Dusty muted olive-brown cardboard, cream paper edges. Single hard key light from the left, deep shadow on the right. Desaturated archival documentary grade, shallow depth of field. No people.

---

# Grupo 2 — Molduras e suportes

→ salvar em `Assets/props/molduras/`

Para apresentar B-roll ou foto dentro de um objeto, em vez de um retângulo solto na tela.

### 2.1 — `moldura-polaroid-01.png`
> Top-down photograph of a single vintage instant photo frame lying on a dark charcoal surface. The photo area is a completely flat, empty, uniform pale grey rectangle — no image, no scene, no text anywhere. Aged off-white border with slightly yellowed edges and a soft crease at one corner. Hard directional light from the left, subtle drop shadow. Muted desaturated palette, archival photography, high detail.

### 2.2 — `tira-negativo-01.png`
> Macro photograph of a strip of 35mm film negative lying diagonally on a dark charcoal surface. Each frame is completely empty and uniform dark grey — no image content, no numbers, no letters, no edge markings of any kind. Visible sprocket holes along both edges, fine dust and a few fine scratches on the emulsion. Hard raking light from one side making the sprocket holes catch highlights. Desaturated cool palette, cinematic macro photography, shallow depth of field.

### 2.3 — `monitor-crt-01.png`
> Photograph of a vintage beige CRT computer monitor on a dark charcoal desk in a dim room, shot straight on. The screen is completely blank — a uniform faint grey-green glow with subtle horizontal scanlines, no text, no letters, no interface, no icons. Yellowed plastic casing, dust on the bezel, no visible branding or labels. Single hard key light from the side, deep shadows, dark background. Desaturated documentary grade, slight film grain. No people.

### 2.4 — `quadro-investigacao-01.png`
> Photograph of a cork investigation board mounted on a dark wall, with red string stretched between empty push pins, and several completely blank sheets of aged cream paper pinned to it. No text, no letters, no photos, no writing anywhere — only blank paper, pins and red string. Dim room, single hard directional light from the left creating dramatic shadows. Muted desaturated palette with the red string as the only saturated accent. Cinematic documentary photography, shallow depth of field. No people.

---

# Grupo 3 — Fundos de tela cheia

→ salvar em `Assets/props/fundos/`

Base para `graphic-fullscreen` (intertítulo de virada de ato) — o texto entra por cima em Remotion.

### 3.1 — `fundo-papel-creme-01.png`
> Full-frame flat top-down scan of aged cream paper filling the entire image, 16:9. Completely blank — no text, no letters, no marks, no objects. Fine fibrous texture, subtle mottling and faint foxing spots, slightly darker toward the edges with a gentle vignette. Warm cream and sand tones. Evenly lit, high detail, seamless texture, no shadows, no objects.

### 3.2 — `fundo-carvao-grao-01.png`
> Full-frame dark charcoal background filling the entire image, 16:9. Completely empty — no text, no objects, no shapes. Very subtle film grain and a soft radial vignette darkening the corners, with a barely visible warm brown tint in the center. Deep near-black charcoal tone. Smooth, evenly graded, cinematic, no banding.

### 3.3 — `mapa-topografico-01.png`
> Full-frame abstract topographic contour map texture, 16:9, filling the entire image. Absolutely no text, no place names, no numbers, no legend, no route lines, no markers. Only fine concentric contour lines suggesting hills and valleys. Muted palette of sand, olive green and pale stone grey on a cream base, printed on aged paper with subtle texture. Flat top-down scan, evenly lit, high detail.

### 3.4 — `papel-milimetrado-01.png`
> Full-frame aged graph paper texture, 16:9, filling the entire image. Fine pale blue-grey grid lines on a cream paper base. Completely blank — no text, no letters, no numbers, no drawings, no annotations. Subtle paper fiber texture, soft creases, slightly worn edges with a gentle vignette. Flat top-down scan, evenly lit, high detail.

---

# Grupo 4 — Overlays de efeito ★ alta utilidade

→ salvar em `Assets/props/overlays/`

Entram com blend mode `screen` no Remotion. **Gere sobre fundo preto puro** — o Gemini não entrega
transparência confiável, e o preto some sozinho no `screen`.

### 4.1 — `light-leak-01.png`
> Full-frame abstract light leak on a pure black background, 16:9. Soft diffused streaks of warm amber, copper and pale gold bleeding in from the upper right corner and fading completely to pure black across the left two thirds of the frame. Organic analog film light leak, soft gradients, subtle lens flare bloom, slight grain. No objects, no text, no shapes, no lens elements — only light and black.

### 4.2 — `poeira-riscos-01.png`
> Full-frame film damage overlay on a pure black background, 16:9. Scattered fine white dust specks, a few thin vertical white scratches, and small irregular emulsion flecks, all on solid pure black. Authentic aged 16mm film print damage. Sparse and subtle, not crowded. No text, no shapes, no objects, no images — only the white damage marks on black.

---

## Como me entregar

Use os nomes de arquivo acima, cada um na subpasta do seu grupo. Se gerar variações do mesmo asset,
numere: `papel-dossie-01.png`, `papel-dossie-02.png` — variação ajuda a não repetir o mesmo papel
três vezes no mesmo vídeo.

Não precisa gerar tudo antes de me chamar. Os grupos 1 e 4 já destravam a maior parte do trabalho;
os grupos 2 e 3 dá para ir completando depois.

---

# RODADA 2 — Nano Banana Pro

A rodada 1 entregou 16/16 e está toda em `Assets/props/`. Esta rodada corrige os dois pontos fracos
que apareceram na inspeção, cobre um asset que faltou e adiciona variação.

## O que mudou com o Nano Banana Pro

1. **Peça a resolução explicitamente.** A rodada 1 saiu em 1376×768 (16:9) e 1024×1024. Aqui dá
   para pedir **2K ou 4K** — é o que resolve o upscale dos fundos de tela cheia.
2. **Prompt longo e estruturado funciona melhor.** Os prompts abaixo estão divididos em blocos
   (assunto / composição / luz / cor / textura / proibições) de propósito.
3. **Ele sabe escrever texto legível — e mesmo assim continuamos sem texto.** A tentação vai
   existir. O motivo não mudou: documento com texto embutido serve para um vídeo só, e documento
   oficial fabricado é risco de credibilidade. O texto real entra em Remotion.

Continue repetindo as proibições no fim de cada prompt. Elas estão funcionando.

---

### R2.1 — `fundos/mapa-topografico-02.jpg` ★ corrige o único problema real de qualidade

O da rodada 1 veio em 1376×768 e as linhas de contorno amolecem no upscale para 1080p.

> **Subject:** an abstract topographic contour map texture, printed on aged paper, filling the entire frame edge to edge.
> **Composition:** flat top-down scan, perfectly parallel to the surface, no perspective, no border, no margin, no objects resting on it. The contour pattern is continuous across the whole frame with no focal point, suggesting a river valley running diagonally with dense elevation rings toward two corners.
> **Line quality:** fine, crisp, evenly weighted contour lines with clean separation between them — thin engraved cartographic linework, not sketchy or hand-drawn.
> **Lighting:** flat, even, shadowless studio scan lighting. No vignette, no hotspots.
> **Color:** muted cartographic palette — pale stone grey and soft olive green contour lines over a warm cream paper base, with faint sand-toned fills in the lowest elevation areas. Desaturated, archival, printed decades ago.
> **Texture:** subtle paper fiber grain and very faint foxing, visible only at close inspection.
> **Strictly avoid:** no text, no letters, no words, no place names, no numbers, no elevation labels, no legend, no scale bar, no compass rose, no grid coordinates, no route lines, no markers, no pins, no borders.
> **Output:** 16:9, 4K resolution, maximum detail.

### R2.2 — `substratos/jornal-antigo-02.jpg` ★ corrige o texto de mentira

O da rodada 1 tem colunas de rabisco que denunciam a fraude em plano aberto. Esta versão resolve
com **profundidade de campo**: só a caixa de foto vazia fica nítida, o resto derrete.

> **Subject:** an old yellowed newspaper page lying flat on a dark charcoal slate surface, with a large empty rectangular photo box in the upper left area of the page.
> **Composition:** top-down, shot with a macro lens focused precisely on the empty photo box. The photo box is a clean, flat, uniform pale cream rectangle with a thin printed rule around it and nothing inside.
> **Depth of field:** extremely shallow. Only the photo box and its immediate surroundings are sharp. Every column of body type falls rapidly out of focus into soft grey horizontal smears with no resolvable letterforms whatsoever — the text reads purely as blurred texture, completely unreadable even when examined closely.
> **Lighting:** single hard directional key light raking from the left, strong falloff, deep shadow along the right edge of the page.
> **Color:** aged newsprint in warm sand and cream, foxing spots, against near-black charcoal.
> **Texture:** soft creases, a torn lower corner, fibrous newsprint grain.
> **Strictly avoid:** no readable text anywhere, no legible headlines, no legible letters or words, no logos, no dates, no page numbers, no photographs inside the box, no people, no hands.
> **Output:** 4:3, 4K resolution.

### R2.3 — `substratos/metal-escovado-01.jpg` ★ asset que faltou

A arte DVP define o lower third **Estilo A (Autoridade)** com "fundo de metal escovado sutil" — e
não geramos isso na rodada 1. Vai ser a placa de fundo desse estilo, com o texto por cima.

> **Subject:** a seamless brushed metal surface texture filling the entire frame.
> **Composition:** flat, straight-on, edge to edge, perfectly uniform with no objects, no edges, no seams, no rivets, no screws, no panel lines.
> **Texture:** fine horizontal brushed grain running left to right, very subtle, with faint micro-scratches and a soft anisotropic sheen. Restrained and premium, not industrial or scratched up.
> **Lighting:** a soft, wide, gentle horizontal highlight sweeping across the upper third and falling off smoothly toward the bottom. No hotspots, no reflections of objects, no lens flare.
> **Color:** dark gunmetal charcoal with a barely perceptible warm bronze undertone. Very dark overall so that light text placed on top stays highly legible.
> **Strictly avoid:** no text, no letters, no numbers, no logos, no branding, no engraving, no stamped marks, no objects, no reflections of a room.
> **Output:** 16:9, 4K resolution, seamless texture.

### R2.4 — `substratos/papel-dossie-02.jpg` — variação (papel pautado)

Para não repetir o mesmo papel em duas inserções do mesmo vídeo.

> **Subject:** a single sheet of aged lined notebook paper lying on a dark charcoal slate surface.
> **Composition:** top-down, the sheet occupying most of the frame, slightly rotated a few degrees off axis, one corner curling upward.
> **Detail:** only faint pale blue horizontal rule lines and a single vertical red margin line on the left — printed guide lines only, nothing written on them.
> **Lighting:** hard directional key light from the upper left, casting a soft shadow along the lower right edge and catching the curled corner.
> **Color:** slightly yellowed cream paper, pale blue rules, muted red margin, near-black charcoal background.
> **Texture:** soft creases, a small torn spot on one edge, visible paper fiber, faint age spotting.
> **Strictly avoid:** no text, no letters, no words, no numbers, no handwriting, no doodles, no stamps, no signatures, no holes punched, no spiral binding.
> **Output:** 4:3, 4K resolution.

### R2.5 — `substratos/papel-dossie-03.jpg` — variação (papel fino de cópia)

> **Subject:** a translucent sheet of thin onion-skin carbon copy paper lying on a dark charcoal slate surface.
> **Composition:** top-down, the sheet lying slightly rumpled and not perfectly flat, its edges gently lifting so light passes through the thin paper in places.
> **Detail:** completely blank surface — the visual interest comes from the translucency, the wrinkles and the way light transmits through the sheet, not from any printed content.
> **Lighting:** hard raking light from the right, making the wrinkles cast fine shadows and the thin areas glow slightly.
> **Color:** very pale bluish-grey onion skin paper, cool tone, against near-black charcoal.
> **Texture:** fine wrinkles, one soft crease across the middle, delicate fragile paper.
> **Strictly avoid:** no text, no letters, no words, no numbers, no carbon smudges forming characters, no typewriter marks, no stamps, no handwriting.
> **Output:** 4:3, 4K resolution.

### R2.6 — `overlays/light-leak-02.jpg` — variação (entrada pela esquerda, tom frio)

Um vazamento de luz só, repetido a cada virada de ato, fica visível. Este é o contraponto frio.

> **Subject:** an abstract analog film light leak on a pure black background.
> **Composition:** soft diffused light bleeding in from the lower left corner and dissipating completely into pure solid black across the right two thirds of the frame. The right half of the image must be absolutely pure black with nothing in it.
> **Quality of light:** organic, blooming, slightly streaked, as if light struck the film edge — soft gradients with no hard boundaries.
> **Color:** cool palette — pale slate blue and desaturated steel grey with a faint cyan core, no warm tones.
> **Grain:** subtle analog film grain within the lit area only.
> **Strictly avoid:** no text, no objects, no shapes, no recognizable forms, no lens elements, no rainbow flare rings, no starburst, nothing in the black area.
> **Output:** 16:9, 4K resolution.

### R2.7 — `overlays/light-leak-03.jpg` — variação (borda superior, bem sutil)

Para os momentos em que a transição precisa ser quase imperceptível.

> **Subject:** a very subtle abstract film light leak on a pure black background.
> **Composition:** a soft warm glow bleeding downward from the top edge of the frame, reaching only about one quarter of the way down and fading completely into pure solid black. The entire lower three quarters of the frame is absolutely pure black.
> **Intensity:** restrained and gentle — this is a whisper of light, not a flare. It should read as a faint warmth at the top of the picture.
> **Color:** warm amber and soft copper, very desaturated.
> **Strictly avoid:** no text, no objects, no shapes, no lens flare rings, no starburst, no bright hotspots, nothing in the black area.
> **Output:** 16:9, 4K resolution.

### R2.8 — `overlays/particulas-luz-01.jpg` — poeira suspensa

Entra com blend `screen` por cima dos fundos de tela cheia, para o intertítulo não ficar chapado.

> **Subject:** fine dust particles suspended in air, floating in a shaft of light, on a pure black background.
> **Composition:** scattered specks of varying size drifting diagonally across the frame, denser toward the upper right where the light is strongest, thinning to nothing in the lower left. The background is solid pure black.
> **Quality:** each particle is a soft out-of-focus point of light, some sharper than others, creating a natural sense of depth. Sparse and delicate, never crowded or sparkly.
> **Color:** warm off-white and pale gold particles on pure black.
> **Strictly avoid:** no text, no objects, no shapes, no smoke, no fog, no visible light beam edges, no lens flare, no bokeh circles with hard rims, no snow.
> **Output:** 16:9, 4K resolution.

---

## Prioridade da rodada 2

- **Essenciais:** R2.1 (mapa em 4K) e R2.3 (metal escovado — sem ele o lower third Autoridade não
  tem fundo).
- **Alto valor:** R2.2 (jornal utilizável) e R2.6 (segundo light leak).
- **Quando sobrar tempo:** R2.4, R2.5, R2.7, R2.8.

Salve com os nomes de arquivo indicados em cada bloco, nas mesmas subpastas de sempre.

Com os assets no lugar, o próximo passo é ligar cada layout do plano ao seu substrato e desenhar
a tipografia DVP por cima.
