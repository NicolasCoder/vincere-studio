# MiniMax H3 — Prompt Writing Reference

Guia oficial e prático de engenharia de prompts para geração de vídeo com MiniMax H3 e modelos cinematográficos.

## 1. Estrutura Canônica em 3 Camadas

Todo prompt avançado para o MiniMax H3 deve ser dividido em 3 blocos:

```text
integrated_multimodal_description: [Shot 1] ... [Shot 2] ...

overall_soundscape: ...

non_diegetic_music: ...
```

### Bloco 1: `integrated_multimodal_description`
- **Shot 1**: Descreva estilo global, iluminação, composição inicial, lente e enquadramento. Ex: `[Shot 1] Live-action, cinematic 35mm lens, shallow depth of field...`
- **Shots seguintes**: Use cortes com minutagem exata: `[Shot 2] At 00:03.500, the camera cuts to...`
- **Movimentos de Câmera**: `slow push-in`, `subtle tilt-up`, `dynamic 45-degree orbit`, `dolly zoom`, `steadicam tracking shot`.
- **Ações e Físicas**: Descreva ações contínuas naturais e consistência espacial.

### Bloco 2: `overall_soundscape`
- Efeitos sonoros sincronizados (diegese):
  - Passos sobre o piso, vento batendo em tecido, ruído de sala (room tone), clique mecânico, motor distante, chuva fina sobre vidro.

### Bloco 3: `non_diegetic_music`
- A trilha sonora que só o público ouve:
  - Estilo, instrumentação, BPM, tom emocional. Ex: `Deep atmospheric low-frequency drone with minimal Rhodes piano chords at 70 BPM, conveying suspense and wonder.`

---

## 2. Modos de Geração
- **T2VA (Text-to-Video)**: Sem imagem inicial. O prompt constrói visual e som do zero.
- **I2VA (Image-to-Video)**: Inicia a partir de `<Picture 1>` no segundo 0.00 e desenvolve a ação para a frente.
- **FL2VA (First & Last Frame)**: Interpolação suave e contínua entre a imagem inicial e a final.
