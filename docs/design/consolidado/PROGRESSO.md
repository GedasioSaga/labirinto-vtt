# Progresso do redesign consolidado

Próxima fatia: 1 (Tokens e primitivos)

| Fatia | Commit | Data | O que entrou | Pendências |
|---|---|---|---|---|
| 0 — Inventário vivo | test(ui): inventory spec (commit desta linha) | 2026-10-15 | `e2e/ui-onde-foi-parar.spec.ts` verde no layout de hoje: 547 controles em 62 blocos, por tela (mestre 1440, mestre com sala aberta, jogador 390), com relevo e objetos novos. Lista em `e2e/helpers/ondeFoiParar.ts`; `docs/ui-onde-foi-parar.md` gerado por `scripts/onde-foi-parar-doc.mjs`; `e2e/helpers/mestreDeMentira.ts` para as próximas fatias | 11 linhas fora do spec (estado de teste não monta; listadas no doc). Campo da Ficha do texto sem nome acessível (fatia 16b). Coluna esquerda sem papel ARIA, achada por `.lb-inspector` (fatia 2 troca o escopo) |
