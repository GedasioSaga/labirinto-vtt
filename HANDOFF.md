## Objetivo
Menu inicial hierárquico do Labirinto: Menu principal → Criar Mapas (3 tipos, só Dungeon
funcional) → formulário; mais Carregar Mapa existente e Opções (roadmap navegável de
conectividade com jogadores).

## Estado atual
Implementado e verificado. Arquivos novos: `client/src/lib/navigation.ts`, `lib/mapTypes.ts`,
`screens/MenuShell.tsx`, `screens/MainMenu.tsx`, `screens/MapTypePicker.tsx`,
`screens/NewDungeonMap.tsx` (era `StartScreen.tsx`), `screens/LoadMapScreen.tsx`,
`screens/OptionsScreen.tsx`, `components/MenuCard.tsx`, `e2e/helpers/enterEditor.ts`. Editados:
`App.tsx` (máquina de telas + `currentMapPath` salvando de volta na origem + auto-save no
"Início"), `lib/mapFileIO.ts` (+`listSavedMaps`/`saveMapToPath`), `components/icons.tsx` (+5
ícones), `main.css` (+bloco do menu, +`.lb-appbar` fixo com breadcrumb), os 19 specs e2e
(`beforeEach` → `enterEditor(page)`).

Plano completo: `C:\Users\gedasio.filho\.claude\plans\dazzling-orbiting-dragon.md`.

## Próximos passos
- Rodar o roteiro manual com `npm run tauri:dev` (porta 1420 livre): abrir
  `C:\Dev\labirinto\maps\L1.json` pela lista/"Procurar no disco...", editar, salvar, reabrir e
  confirmar que grava no próprio arquivo (não automatizável — precisa do diálogo nativo Tauri).
- Isometric Tactical Map e World Map continuam só cards desabilitados — nenhum trabalho de
  implementação começou.
- Tela de Opções é 100% placeholder (`<fieldset disabled>`), sem persistência — fica assim até
  a Fase 1 do spec real (`docs/superpowers/specs/2026-08-24-vtt-fase1-design.md`) começar.

## Critério de pronto
`npm run typecheck` exit 0, `npm run test` PASS 373/0, `npx playwright test` (em `client/`) PASS
87/0 — mesma contagem de antes da mudança. Critic cego (gauntlet-loop) julgou o conjunto de 5
telas superior à bar (Owlbear Rodeo), confirmado por swap com ordem invertida.

## Evidência
- `npx tsc --noEmit` (via `rtk proxy`, sem filtro): exit 0.
- `npx vitest run`: `PASS (373) FAIL (0)` — baseline era 357/0, +16 testes novos
  (`navigation.test.ts`, `mapTypes.test.ts`, `mapFileIO.test.ts`).
- `npx playwright test`: `PASS (87) FAIL (0)`, igual à contagem de referência rodada antes da
  mudança (19 specs migrados para `enterEditor(page)`, mais o novo).
- 3 bugs achados e corrigidos em QA manual antes do critic: anel de foco dourado indevido no
  `<h1>` a cada troca de tela (`:focus-visible` em foco programático — `main.css`); rótulo
  duplicado nas 3 linhas com `Toggle` em Opções (`OptionsScreen.tsx`); `LoadMapScreen` travava
  para sempre em "Carregando..." se `listSavedMaps()` rejeitasse, sem `.catch` (`LoadMapScreen.tsx`).
- gauntlet vs Owlbear Rodeo (docs.owlbear.rodeo — Create a Room / Rooms list): 2 rodadas +
  swap de confirmação, saída **VENCE**. Rodada 1: bar venceu, gap nomeado = ausência de chrome
  persistente amarrando as 5 telas. Atacado com `.lb-appbar` fixo (marca + breadcrumb) em
  `MenuShell`. Rodada 2: nosso venceu; swap com ordem invertida: nosso venceu de novo — os dois
  critics concordam. Ledger completo (efêmero, morre com a sessão):
  `gauntlet-menu-inicial.jsonl` no scratchpad da sessão que fez o trabalho.
