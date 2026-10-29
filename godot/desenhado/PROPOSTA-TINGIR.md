# Proposta: textura tingível (`tingir`), seção 4b do CONTRATO.md

Escrita em 28/10/2026 pelo designer do `piso` (commit `81c58018`). Decisão do usuário: o chão de sala do Desenhado é uma "textura que pega a sua cor". Ainda é proposta e entra no CONTRATO.md na integração com o app.

**Resolvido em 29/10/2026 (integração F1b):** `comum/contrato.gd` passa o bloco `tingir` do `config.json` adiante (`ler_config` e `parametros`), e o `exportado/piso/textura.json` leva a conta no formato do telhado: `{ conta, neutro, ganhoL, escuroAte, claroDesde }`. Reexportado só o piso: dos 621 arquivos de `exportado/`, só esse `textura.json` mudou (sha256 antes e depois; as 3 bases saíram byte a byte iguais). Textura sem o bloco sai como antes. O app lê em `client/src/texturas/desenhado/chao.ts` e tinge em `tingir.ts`.

## A conta

1. **Base:** um mapa de valor em cinza (R = G = B; g = R/255), sem atlas. g = 0,5 é exatamente a cor do mestre.
2. **Montagem:** o app monta o chão em cinza, igual à seção 4 (mistura de variantes e tom do mundo). Só no fim troca cada g pela cor de uma rampa de 256 cores. A rampa é calculada uma vez por cor de sala (`FloorPiece.fillColor`, `Region.fillColor`):
   - (L, a, b) = OKLab da cor. `oklabDoRgb` já existe em `client/src/texturas/meioTermo/materiais.ts`; falta a volta, cerca de 10 linhas.
   - j = suave(0; 0,10; L) · suave(1; 0,94; L), onde suave é o smoothstep.
   - L′ = L + 0,48 · j · (g − 0,5).
   - a e b não mudam. Se a cor sair do sRGB, a e b encolhem juntos, com o mesmo matiz, até caber (busca binária nas 256 entradas).
   - rampa[g] = sRGB(L′, a, b).
3. **Faixa:** a textura usa g de 0,43 a 0,59. Isso dá ΔL de até ±0,041 e desvio de 0,010, e a cor média fica a menos de 0,001 da escolhida (em OKLab o limiar de percepção é cerca de 0,02).
4. **Extremos:** com L < 0,10 o relevo encolhe até 0 no preto puro, e com L > 0,94 encolhe até 0 no branco puro. Assim nada estoura e a média não se desloca. Quem escolhe preto ou branco absoluto recebe o absoluto.
5. **Por que não o `tint` do Pixi (multiplicar):** ele só escurece. O chão ficaria mais escuro que a cor escolhida e sumiria nas salas escuras, que são as mais usadas nos mapas do usuário (`#612e05`, `#290e00`, `#050467`).
6. **Custo:** uma tabela de 256 cores por cor de sala e uma consulta por pixel ao assar os pedaços do chão.

## Provas (fora do repo)

- Folha tingida (6 cores ao lado da cor chapada de hoje): `C:/Users/gedasio.filho/AppData/Local/Temp/claude/C--dev-labirinto/64bbd926-7eb9-4120-904b-108161a322fd/scratchpad/desenhado/lote-4/piso/folha-tingida.png`
- Folha dos extremos: `.../lote-4/piso/folha-extremos.png`
- Números: `.../lote-4/piso/tingido.json`
- Ferramenta de tingir e montar as folhas: `.../lote-4/_ferr-piso/tingir.py`
