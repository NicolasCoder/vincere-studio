# 🎬 Vincere Studio

> **Estação de Trabalho Audiovisual Cinematográfica com Inteligência Artificial.**  
> Automação completa de vídeos curtos (9:16) e documentários horizontais (16:9): ideação orientada a dados → roteiro estruturado em beats → síntese de voz neural → curadoria de B-rolls & Google Flow → montagem aberta em HyperFrames → legendas dinâmicas → render 60fps.

---

## ✨ Principais Funcionalidades

* **🤖 Modo Agente-Primeiro & Servidor MCP:** Controle total da estação via agentes de IA (`Antigravity agy`, `Claude Code`, `Codex`, `Hermes`) via API REST `/api/v1/*` com 6 Runbooks executáveis ou pelo servidor MCP nativo (`pnpm mcp:server`).
* **🚀 Loop Autônomo de Produção (`AUTO_PRODUCE`):** Encadeamento automático do início ao render de prova (roteiro → voz → legendas → cenas IA/B-roll → plano DVP → render) com parada inviolável no portão de aprovação humana antes de publicar (`403 GATE_APROVACAO_OBRIGATORIO`).
* **🛡️ Auditoria Visual de Safe-Zones:** Validação automática de zonas seguras para vídeos verticais (`9:16` - Shorts, Reels, TikTok) impedindo que legendas e lower-thirds sofram sobreposição por botões e interfaces sociais.
* **🔊 Sonorização Dinâmica (SFX Procedurais):** Efeitos sonoros (`whoosh`, `impact`, `riser`, `click`) gerados por síntese de áudio procedural em FFmpeg (100% offline, sem custos ou direitos autorais).
* **🔄 Sincronizador de Skills Locais:** Job e painel interativo no `/skills` que varre diretórios de agentes no PC (`~/.gemini`, `~/.claude`, `~/.agents`) e atualiza as skills automaticamente.
* **🧠 Copiloto Criativo Multi-Nicho (`/copilot`):** Estruturação de narrativas em "beats" de 5 a 15 segundos para Dossiê Investigativo, Cinema, Character Sheets, Comercial UGC e Curiosidades.
* **👁️ Video-Sharingan com IA Local (`/sharingan`):** Engenharia reversa óptica e clonagem de ritmo/técnica de vídeos (`sharingan.py` + `Qwen2.5-VL-7B` via Ollama na GPU Local RTX 3060 a custo US$ 0.00), com extração multi-pass (`Keyframes`, `Step=5`, `Adaptive High-Motion Burst` e `Forense Step=1 1:1`), grade `10%×10%`, palco HTML5/GSAP interativo, comparativo 3-vias e 12 Portões de Qualidade (QC Gates).
* **🎬 Estúdio Talking Head & Reels (`/talking-head`):** Pipeline dual-mode (GPU Local ↔ Cloud) para remoção de silêncios por palavras (`CrisperWhisper`), reenquadramento dinâmico (`MediaPipe`), legendas Lockup e sincronização na batida.
* **🎙️ Central de Vozes & Offload GPU (`/voice-studio`):** Síntese de locução com clonagem vocal neural (**RVC V2 `rmvpe` na GPU do PC** + VoiceStudio VPS), análise acústica automática para clonagem ($F_0$ Hz, SNR dB, % voz ativa, normalização 44.1kHz) e alinhamento métrico palavra por palavra com **Faster-Whisper CUDA (`float16`)**.
* **⚡ Workflow Studio Nodal (`/workflow`):** Canvas visual estilo Magnific AI e ElevenLabs. Conecte nós de Avatar, Produto, Cenário, Prompt com multi-engine (Gemini, Flow Daemon, MiniMax e Pollinations grátis) e Renderizador.
* **🎞️ HyperFrames Studio (`/studio`):** Editor de vídeo em código aberto (HTML5, CSS3, GSAP e JS limpos) com preview interativo a 60fps e Hot-Reload em menos de 100ms.
* **📝 Legendas Dinâmicas (`subtitles_studio`):** Tipografia cinética no formato **Lockup** (palavra principal em destaque geométrico + palavras de apoio encaixadas nos vãos + brilho dinâmico + anti-pisca) com templates reutilizáveis.
* **📈 Inteligência de Tendências (`/tendencias`):** Pesquisa automatizada de oportunidades no YouTube com dados reais do vidIQ em português, espanhol e inglês.
* **🤖 Assistente Vince:** Guia inteligente integrado no painel com memória de preferências e suporte a comandos de voz.

---

## 🚀 Como Começar (Para Colaboradores)

### Pré-requisitos
* **Node.js:** versão 20+ (recomendado 24.x)
* **Gerenciador de Pacotes:** `pnpm` (versão 9+)
* **FFmpeg:** instalado e acessível no PATH do sistema

### 1. Clonar o Repositório
```bash
git clone https://github.com/Igorferreirax/vincere-studio.git
cd vincere-studio
```

### 2. Configurar Variáveis de Ambiente
Copie o arquivo de exemplo:
```bash
cp .env.example .env
```
> O sistema funciona com **motores gratuitos por padrão** (Pollinations.ai para imagens e Edge TTS para narração). Chaves pagas (Gemini, ElevenLabs, Pexels, Pixabay) são opcionais e podem ser adicionadas conforme a necessidade.

### 3. Instalar Dependências
```bash
pnpm install
```

### 4. Inicializar o Banco de Dados (SQLite Local)
```bash
pnpm --filter @vincere-studio/db prisma migrate dev
```

### 5. Iniciar o Ambiente de Desenvolvimento
```bash
pnpm dev
```
O painel web estará acessível em: **`http://localhost:3210`**.

---

## 📂 Estrutura do Monorepo

```text
vincere-studio/
├── apps/
│   ├── web/                 # Aplicação Next.js 15 (Tailwind, React 19, Turbopack)
│   └── worker/              # Worker assíncrono para render, transcrição e B-rolls
├── packages/
│   ├── core/                # Tipos, esquemas Zod e lógica compartilhada
│   ├── db/                  # Prisma ORM e migrações SQLite
│   ├── providers/           # Integrações de IA (Gemini, Pollinations, EdgeTTS, ElevenLabs)
│   ├── render/              # Pipelines do FFmpeg e composição
│   └── ui/                  # Componentes reutilizáveis do design system
├── scripts/                 # Automações de deploy, túnel SSH e tarefas agendadas
└── GUIA_COLABORADOR.md      # Guia rápido de onboarding para co-autores
```

---

## 🔒 Segurança e Privacidade

* Nenhuma chave de API ou credencial privada é versionada no repositório.
* Arquivos `.env`, bancos de dados locais (`.db`), locuções e renders temporários são estritamente excluídos via `.gitignore`.
* Acesso remoto seguro protegido por middleware e autenticação por PIN.

---

## 📖 Documentação & Guias

* [Guia do Colaborador (Como trabalhar em equipe)](GUIA_COLABORADOR.md)
* [Manual de Produção Cinematográfica](docs/MANUAL_PRODUCAO.md)

---
*Desenvolvido exclusivamente para o ecossistema **Vincere Studio**.*
