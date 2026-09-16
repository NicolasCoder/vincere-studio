# Modelos de legendas

Implementado em 16/09/2026. A escolha fica no Passo 4 (Render) e a mesma configuração é usada no render de prova e no render final.

## Modelos disponíveis

1. Automático do formato
2. Documentário clean
3. Impacto amarelo
4. Neon magenta
5. Luxo minimalista
6. Educação clean
7. Gaming energético
8. Bem-estar suave
9. Notícias e negócios
10. Personalizado do projeto

Há oito identidades prontas, além do modo automático e do modelo personalizado.

## Editor visual

O editor permite alterar e visualizar antes do render:

- fonte;
- animação discreta ou karaokê palavra a palavra;
- cor principal, palavra ativa e contorno;
- posição superior, central ou inferior;
- tamanho por orientação;
- quantidade de palavras por bloco;
- espessura do contorno e sombra;
- uso de letras maiúsculas.

O painel calcula o contraste entre texto e contorno e avisa quando uma legenda inferior em vídeo vertical pode disputar espaço com os controles de TikTok/Reels.

## Persistência e compatibilidade

- **Salvar como padrão deste projeto** grava `Project.captionPreset` e `Project.captionStyle`.
- Render de prova, revisão e versão final usam a configuração salva.
- Projetos antigos continuam em `auto`, preservando a posição e o comportamento históricos.
- Os valores recebidos pelo servidor são validados antes de chegar ao FFmpeg/ASS.
- A migração correspondente é `20260916101500_add_project_caption_style`.
