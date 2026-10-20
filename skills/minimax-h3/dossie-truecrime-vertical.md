# Tratamento "Dossiê" — HyperFrames & Remotion 9:16

Referência canônica de direção de arte para vídeos verticais (1080×1920) de curiosidades, crimes reais, conspirações e histórias de marca (validado no projeto Nike em 19/10/2026).

## As 6 Regras de Ouro

1. **Um Artefato Físico por Cena:**
   - Foto, documento de arquivo ou trecho de vídeo curto com borda branca de papel fotográfico.
   - Sempre inclinado em perspectiva 3D (`perspective: 1200px`, `transform: rotateY(...) rotateX(...)`) sobre mesa escura texturizada.
   - NUNCA esticar a imagem cobrindo toda a tela. O espaço ao redor cria profundidade de dossiê.

2. **A Câmera Nunca Para (Deriva Contínua):**
   - Parallax contínuo entre o plano de fundo e o cartão inclinado.
   - Movimento lento de drift (`translate3d`) ou zoom sutil constante. Sem cortes secos bruscos dentro da mesma cena.

3. **Anotações em Carimbo Vermelho (#c4302b):**
   - Tarja de censura que varre o texto, carimbo de borracha rotacionado que bate e assenta na mesa, etiquetas numeradas.
   - Usar tons de vermelho carimbo/sangue escuro (`#c4302b` ou `#e5332b`), jamais vermelho neon digital.

4. **Fotos Modernas em Escala de Cinza de Arquivo:**
   - Filtro CSS/Canvas: `grayscale(1) contrast(1.15) brightness(0.92)`.
   - Transforma fotos de produtos ou retratos modernos instantaneamente em evidências de arquivo histórico.

5. **Legenda em Rail Mono no Rodapé:**
   - Legenda discreta, alinhada a 78-82% da altura, estilo teleimpressora/máquina de escrever.
   - Fim de frase SEMPRE fecha o grupo de palavras. Nenhum frame abre com ponta solta da frase anterior.

6. **Vinheta Pesada e Grão de Película:**
   - Vinheta radial escura nas bordas para focar a atenção no centro do documento.
   - Ruído/grão sutil (film grain) sobre todo o render.
