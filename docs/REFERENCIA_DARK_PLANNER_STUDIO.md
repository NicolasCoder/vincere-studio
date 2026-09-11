# Referência: Dark Planner Studio (Web Dark) — o que copiar e por quê

Análise do vídeo **"Edição Assistida — Seu Vídeo pronto enquanto você"** (canal Web Dark,
25:46, `Gx6Hn30Nqps`), assistido com a skill `watch` em 11/09/2026. Transcrição das legendas
nativas + leitura de quadros em 06:20–12:40 (painel de Direção) e 19:00–20:55 (chat do Studio).

Ferramenta analisada: **Dark Planner v2.0.3**, produto pago (R$ 9,99 Pro no vídeo). Não é
concorrente direto — é referência de **estrutura de controle**, que é o que interessa aqui.

---

## 1. O conceito central: "Direção" como predefinição de eixos

O que eles chamam de **Direção** é o nosso `EditProfile`, só que muito mais desenvolvido. É uma
predefinição salva por canal ("vai ser uma coisa para um canal e outra para outro canal"),
composta de **eixos independentes**:

| Eixo | % visto no vídeo | O que controla |
|---|---|---|
| Templates | 24–25% | Composições de tela (moldura, dossiê, split, painel…) — ~50 itens |
| Templates Avatar | 0% | Composições com avatar (integração externa) |
| Destaques | 25% | Realce de palavra/frase — **~130+ estilos** |
| Transições | 54–78% | **200 transições**, cada uma com som próprio |
| Movimento | 56% | Movimento de imagem (família Ken Burns) |
| Filtros | 36% | Tratamento de cor / look |
| Legenda | — | Sistema de estilo de legenda (ver secão 4) |
| Cor | "projeto" | Cor de destaque — **propaga para legendas E transições** |
| Marca | — | Marca d'água: imagem, posição, tamanho |
| *(+ "Mais eixos")* | | Há mais, não abertos no vídeo |

### A mecânica de cada eixo (é aqui que está o ouro)

Todo eixo tem os mesmos quatro controles:

1. **"Usar todos" ou "Escolher"** — usa o catálogo inteiro, ou marca um subconjunto.
2. **"% DO VÍDEO"** — o texto literal na tela é:
   *"quantas cenas recebem este eixo; fora disso ficam limpas"*.
   Para transições muda para **"% DAS JUNÇÕES"** — porque transição acontece no corte, não na cena.
3. **Peso por item** — cada item marcado ganha seu próprio *"QUERO MAIS ESTE"* (ex.: 12%, 13%).
4. **Sorteio ponderado** — *"entra no sorteio com todo o catálogo"*. Aplica, e **tudo continua
   editável** depois.

> **Por que isso importa para nós:** é exatamente a ideia que o Igor pediu — *"NÃO É NO VÍDEO
> TODOOO, mas em cenas que têm ÊNFASE"*. Eles resolveram com um número, e o número vira o
> vocabulário que o usuário e a IA compartilham.

### Faixa de intensidade

No eixo Destaques há um seletor de faixa acima do slider:
**calmo · equilibrado · dinâmica · muito dinâmica**. É um dial de alto nível que ajusta o
comportamento do motor sem mexer item a item.

---

## 2. Taxonomia de destaques por função narrativa

Os destaques não são organizados por aparência, e sim por **para que servem na história**:

- Abertura · Capítulos
- Pessoas · Lugares
- **Dados** (grupo "DADOS & PROVAS · 33")
- **Ênfase** (grupo "ÊNFASE DA FALA · 96")
- Atmosfera
- Transição

Exemplos do grupo de dados: *Número Monumental, Percentual em…, Selo de alerta, Contador,
Estatística, Tag de Dado, Valor em Destaque, Doc Radar, Doc Versus*.

> **Por que importa:** nosso `EDIT_LAYOUTS` é uma lista plana de 7 formas. Classificar por função
> narrativa melhora o prompt (o modelo escolhe pelo papel, não pela aparência) e abre espaço para
> crescer o catálogo sem virar uma lista ilegível.

---

## 3. Contrato de campos do template

No painel de preview de cada template:

```
CAMPOS QUE ESTE TEMPLATE PREENCHE
  legenda     — a fala do take
  legenda.1   — a fala do take
```

Cada template **declara quais campos de conteúdo consome**.

> **Por que importa:** é a versão explícita do que hoje é implícito no nosso código. Um contrato
> assim tornaria impossível o tipo de bug que já tivemos, em que um layout existia no catálogo e
> o Remotion não tinha ramo para ele — o plano prometia uma coisa e o vídeo entregava outra, sem
> erro nenhum.

---

## 4. Sistema de legenda (o que já estava pedido)

Três modos: **manter a do projeto** · **usar a atual** · **criar a legenda da predefinição**.

- **Famílias karaokê:** Clássico, Destaque, Pop, Palavra única, Preenchimento
- **Estilos de texto:** Kinetic, Simples, Legenda, Highlight, Impacto, Neon, Outline, Meme,
  Serif doc, Typewriter doc, Typewriter min, Gloss, Gradient Fire, Stamp, Mono min
- **Estilo da faixa:** grade de ~20 tratamentos de fundo/pílula
- **Ajustes:** fonte, negrito/sublinhado/itálico, caixa (TT/tt/Tt), alinhamento, tamanho,
  espaçamento de caractere, altura de linha, opacidade, **cor**, **cor da palavra ativa**,
  fundo, borda
- **Manipulação direta no preview:** *"clique na legenda do preview e arraste; as bordas mudam a
  caixa, os cantos e a roda do mouse mudam a fonte — como no editor"*

Nota deles que vale copiar: *"Karaokê: cada papel (dita · ativa · futura) vem com borda e sombra
próprias — a que você escolher aqui substitui as delas."*

---

## 5. O chat dentro do Studio

**Não é um modelo embutido.** É um despachante para um agente de linha de comando instalado na
máquina do usuário. O seletor mostra:

```
AGENTE
  Claude Code    pronto
  Codex          pronto
  Antigravity    pronto   (selecionado)
  Grok           não instalado   [Configurar]
```

Barra inferior: `DarkPlanner | Antigravity | Gemini 3.0 Flash | Auto | Multi`

Ele diz explicitamente que é preciso ter Codex, Claude Code ou Antigravity **já instalados no
computador**, e que erro de configuração se resolve mandando um print para o próprio agente.

### O prompt que ele digita

> "Quero que você faça uma edição dinâmica no projeto TesteWebdark, quero transições em **70%**
> do projeto, quero **20%** de palavras chave em destaque e também use templates em **25%** do
> projeto. Trabalhe de forma inteligente e traga a melhor experiência ao usuário."

O vocabulário do chat é **o mesmo dos dials**. Isso não é acidente: o agente e a interface falam
a mesma língua, então dá para alternar entre os dois sem reaprender nada.

### A resposta do agente

O agente devolve um **relatório estruturado do que fez** — não um "pronto!":

> **1. Destaques nos Textos:** Foram aplicados **36 destaques inteligentes (zero descartes)**,
> substituindo as frases soltas anteriores por momentos de real peso narrativo:
> - **Abertura:** o gancho central da história
> - **Pontos de Virada & Reflexão:** momentos-chave da trajetória
> - **Valores e Revelações:** os números reais do negócio e do patrimônio
> - **Diálogos:** citações marcantes
>
> **2. Templates & Dinamismo:** Mantivemos a **proporção exata salva na direção 2dbrasil**
> (18 templates, cobrindo 20% das cenas). Eliminamos as **repetições seguidas do mesmo molde**,
> intercalando composições como *Encaixe de Quadros, Trilha Lateral e Luz Orgânica*.
>
> *Um snapshot de segurança foi gravado antes das alterações.*

Três coisas aí merecem cópia direta:

1. **O agente respeita a direção salva** — não inventa proporção própria, usa a do preset.
2. **Regra anti-repetição** — nada de mesmo molde duas vezes seguidas.
3. **Snapshot antes de alterar** — desfazer garantido.

---

## 6. Export

720p é apresentado como suficiente. Qualidade em **rápido / equilibrado / máximo** (com o aviso
de que máximo deixa a máquina lenta durante o render). E **fila de exportação**: dá para
enfileirar vários projetos e exportar enquanto não se está usando a ferramenta.

---

## 7. O que dá para trazer para o Vincere Studio

Ordenado por retorno sobre esforço.

| # | Ideia | Estado nosso | Esforço |
|---|---|---|---|
| 1 | **Eixos com % no perfil de edição** | `EditProfile` existe, sem dials | médio |
| 2 | **Preset de legenda dentro do perfil** | já pedido; não existe | médio |
| 3 | **% das junções para transições** | hoje é regra fixa de hash (~20%) | baixo |
| 4 | **Taxonomia de destaque por função narrativa** | `EDIT_LAYOUTS` é lista plana | baixo |
| 5 | **Contrato de campos por layout** | implícito no código | baixo |
| 6 | **Snapshot antes de aplicar a camada** | não existe | baixo |
| 7 | **Regra anti-repetição no plano** | o plano pode repetir layout seguido | baixo |
| 8 | **Preview por layout na interface** | a folha de contato já gera isso | baixo |
| 9 | **Faixa de intensidade (calmo → muito dinâmico)** | não existe | baixo |
| 10 | **Relatório editorial do que a IA fez** | o log é técnico, não editorial | baixo |
| 11 | **Fila de exportação** | não existe | médio |

### Sobre o chat: nós já somos o outro lado

Eles construíram um despachante para chamar Claude Code. Aqui a conversa **já é direta**. O que
vale copiar não é o painel de chat — é:

- **o vocabulário compartilhado** (porcentagens por eixo) entre interface e conversa;
- **o relatório editorial** no fim, em vez de log técnico;
- **o agente respeitando o preset salvo** em vez de improvisar.

### O que NÃO copiar

- **200 transições e 130 destaques.** É catálogo de produto pago com equipe. Nosso diferencial é
  o oposto: poucos layouts com identidade documental forte e assets próprios. Catálogo grande sem
  curadoria vira "carrossel de efeitos", que é exatamente o que o perfil DVP evita de propósito.
- **Templates de avatar.** Fora do nicho.

---

## Fonte

- Vídeo: https://www.youtube.com/watch?v=Gx6Hn30Nqps (Web Dark, 25:46)
- Momentos-chave: **06:15** abre o Diretor · **07:11** explica o % · **09:42** transições ·
  **11:00** legendas · **18:55** exige agente instalado · **19:19** o prompt · **20:31** o relatório
