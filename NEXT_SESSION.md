# Próxima sessão — plano de execução do Vincere Studio

Este arquivo é o handoff oficial para a próxima sessão, seja ela aberta com Codex ou Claude.

## Regra de identidade

- O único nome oficial do produto é **Vincere Studio**.
- Não reintroduzir nomes anteriores em interface, documentação, prompts ou novos identificadores.
- O escopo dos pacotes já foi migrado para `@vincere-studio/*`.
- O nome da pasta, do repositório remoto e do arquivo SQLite ainda são legados e exigem migração
  controlada, com backup e verificação de todos os caminhos.

## Estado deixado em 20/10/2026 (Claude) — ler primeiro

- Handoff completo (feito, pendente, como retomar): Obsidian
  `SOFTWARE/VINCERE/memoria/sessao-2026-10-20.md`.
- Branch `feat/vincere-2-vistoria`, 6 commits sem push (5236ecf … b5323ec); tudo já publicado na
  VPS com `scripts/deploy-vps.sh`. Push/PR só com o OK do Igor.
- Pendências do Igor: chaves de IA no `.env` da VPS (`scripts/env-vps.sh`), aprovar a prévia da
  Nike (gerar com `scripts/hf.ps1 previa -Projeto nike-história`, render na VPS), LDPlayer, RAM.
- Pendência técnica: reescrever `scripts/auto-pull.ps1` (caminho antigo e branch errado).

## Estado deixado em 20/09/2026

- Branch atual: `feat/igo-7-testes-minimos`.
- O commit `781431f` contém o piso de testes do IGO-7 e ainda não foi incorporado à `main`.
- Há uma renomeação ampla para Vincere Studio no working tree; **não descartar nem sobrescrever**.
- A aplicação respondeu em `http://localhost:3210` e o HTML confirmou “Vincere Studio”.
- Os links do workspace foram regenerados com `pnpm install --offline --frozen-lockfile`.
- O typecheck paralelo inicialmente falhou porque os links ainda tinham o escopo antigo. Depois
  da reinstalação, a repetição não imprimiu novos erros, mas ficou presa e foi interrompida;
  portanto a validação final continua pendente.
- O servidor já estava aberto na porta 3210. Uma segunda instância criada durante a verificação
  foi encerrada para evitar worker duplicado.

## Ordem obrigatória da próxima sessão

### 1. Preservar e consolidar a renomeação

1. Ler este arquivo e `docs/PROGRESSO_SESSAO.md`.
2. Conferir `git status`, `git diff --check` e o diff da renomeação.
3. Procurar nomes antigos fora de arquivos históricos, caminhos e dados:
   `rg -n -i "docupulse|pulse[ ._-]?studio|venciri"`.
4. Não apagar alterações locais e não usar reset destrutivo.
5. Validar antes de criar qualquer commit.

Critério de conclusão: interface, documentação, manifests, prompts e imports usando apenas
**Vincere Studio** / `@vincere-studio/*`.

### 2. Fechar a validação técnica

1. Garantir que não exista render ou publicação pesada em andamento.
2. Evitar múltiplos servidores/workers antes dos comandos de validação.
3. Rodar, nesta ordem:
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm build`
   - em `editor-ia/`: `npx tsc --noEmit`
   - em `editor-ia/`: `npm run verificar-layouts`
4. Corrigir falhas reais encontradas; não mascarar ou desabilitar testes.

Critério de conclusão: todos os comandos verdes e layouts verificados nos formatos 16:9 e 9:16.

### 3. Consolidar Git e IGO-7

1. Separar arquivos locais/operacionais (`*.log`, scripts pessoais) do código versionável.
2. Criar um commit coeso da migração de marca após a validação.
3. Incorporar `feat/igo-7-testes-minimos` à `main` sem perder a renomeação.
4. Enviar a `main` ao GitHub somente após conferir o histórico e o diff final.
5. Adicionar CI do GitHub para typecheck, testes e build.

Critério de conclusão: `main` contém IGO-7, migração de marca validada e CI obrigatório.

### 4. Corrigir operação local

1. Criar comandos seguros `dev:start`, `dev:stop`, `dev:status` e `dev:restart`.
2. O launcher deve detectar a porta 3210 ocupada e impedir worker duplicado.
3. Resolver o aviso de resolução do `@prisma/client` no Next.js e confirmar em build.
4. Corrigir ou substituir o auto-pull: hoje ele não está registrado e pode bloquear a si próprio
   ao encontrar arquivos não versionados.
5. Remover `tsconfig.tsbuildinfo` do versionamento e organizar logs locais no `.gitignore`.

Critério de conclusão: uma única instância web/worker, comandos previsíveis e build sem aviso do
Prisma.

### 5. Finalizar a migração física da marca

Executar somente depois de os itens anteriores estarem verdes:

1. Fazer backup verificável do banco SQLite e dos arquivos de configuração.
2. Migrar o arquivo legado do banco para um nome relacionado ao Vincere Studio e atualizar todas
   as URLs de conexão, scripts e documentação.
3. Renomear a pasta local e o repositório GitHub para Vincere Studio, atualizando `origin`,
   launchers, tarefas agendadas e caminhos absolutos.
4. Revisar OAuth do Google/YouTube, título, favicon, logotipo e metadados sociais.
5. Preservar referências visuais históricas somente quando forem necessárias como fonte; elas
   não podem reaparecer como marca ativa.

Critério de conclusão: não restar nome antigo, exceto em histórico Git ou referência arquivada
explicitamente identificada.

### 6. Melhorias de produto — executar nesta prioridade

1. Fechar o ciclo de retenção: comparar retenção prevista com dados reais do YouTube.
2. Criar inbox automática para pacotes gerados no Google Flow.
3. Permitir inserir legendas retroativamente em vídeos já publicados.
4. Ativar o modo teleprompter.
5. Corrigir e validar os layouts verticais `cronologia` e `mesa-arquivo`.
6. Evoluir `MesaArquivo` com papel sobre fundo escuro, fotos sobrepostas e cartão rasgado.
7. Planejar motores visuais adicionais ao documentário dark como features independentes.

## Conduta para o agente

- Começar pelo item 1 e avançar enquanto houver ação segura e verificável.
- Atualizar `docs/PROGRESSO_SESSAO.md` ao concluir cada bloco.
- Não reiniciar processos durante render/publicação ativa.
- Não apagar ou recriar o banco sem backup validado.
- Não declarar conclusão com validações pendentes ou interrompidas.

