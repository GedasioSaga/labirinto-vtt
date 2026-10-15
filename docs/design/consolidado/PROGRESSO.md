# Progresso do redesign consolidado

Próxima fatia: 2 (Livro do mestre: casca)

| Fatia | Commit | Data | O que entrou | Pendências |
|---|---|---|---|---|
| 0 — Inventário vivo | test(ui): inventory spec (commit desta linha) | 2026-10-15 | `e2e/ui-onde-foi-parar.spec.ts` verde no layout de hoje: 547 controles em 62 blocos, por tela (mestre 1440, mestre com sala aberta, jogador 390), com relevo e objetos novos. Lista em `e2e/helpers/ondeFoiParar.ts`; `docs/ui-onde-foi-parar.md` gerado por `scripts/onde-foi-parar-doc.mjs`; `e2e/helpers/mestreDeMentira.ts` para as próximas fatias | 11 linhas fora do spec (estado de teste não monta; listadas no doc). Campo da Ficha do texto sem nome acessível (fatia 16b). Coluna esquerda sem papel ARIA, achada por `.lb-inspector` (fatia 2 troca o escopo) |
| 1 — Tokens e primitivos | feat(ui): grimorio tokens and primitives (commit desta linha) | 2026-10-15 | 27 tokens `--lb-gr-*` em `theme.ts` (movimento, materiais, larguras); `components/grimorio/grimorio.css` copiado do protótipo (classes `gr-`); primitivos Botao, CampoSeg/Liga/Num/Faixa/Cor/Chips/Texto/Sel, Nota, GrupoAvancado, Ficha, Cabeca, Marcadores, Balao, Torrada, Pop/MenuItem, Dialogo, com teclado e ARIA (39 testes). Nada visível mudou: prints 1440 e 390 idênticos byte a byte; inventário da fatia 0 verde sem mudança | Casca, chip da cena, barra/placa, cartões/lista/vazio ficam nas fatias 2-8. F8 para as torradas entra no keymap quando elas forem para a tela. `review-animations` e folha de contato na fatia 2 (fita e ficha aparecem no app) |
