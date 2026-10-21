# 🎬 Vincere Studio

> **Estação de Trabalho Audiovisual Cinematográfica com Inteligência Artificial.**  
> Automação completa de vídeos curtos (9:16) e documentários horizontais (16:9): ideação orientada a dados → roteiro estruturado em beats → síntese de voz neural → curadoria de B-rolls & Google Flow → montagem aberta em HyperFrames → legendas dinâmicas → render 60fps.

---

## ✨ Principais Funcionalidades

* **🧠 Copiloto Criativo Multi-Nicho (`/copilot`):** Estruturação de narrativas em "beats" de 5 a 15 segundos para Dossiê Investigativo, Cinema, Character Sheets, Comercial UGC e Curiosidades.
* **🎙️ Central de Vozes (`/voice-studio`):** Síntese de locução com clonagem vocal do Igor, rascunho rápido grátis e alinhamento métrico palavra por palavra com Whisper (`words.json + SRT`).
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
