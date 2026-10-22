# Contraste AA medido (fatia 21)

Medido em 22/10/2026 pelo e2e `client/e2e/task-contraste-aa.spec.ts`, no app de verdade (Chromium 1243, vite dev). O dado bruto está em `contraste-aa.json`, ao lado deste arquivo.

## Telas medidas

| Tela | Estado |
|---|---|
| Mestre, 1440x900 | editor com a aventura aberta, sala fechada |
| Mestre, 1440x900 | ficha do token (Goblin) aberta no livro do mestre |
| Mestre, 1440x900 | livro da mesa na página Cenas |
| Mestre, 1440x900 | diálogo Configurar cena |
| Jogador, 390x844 | mapa com a ficha atribuída |
| Jogador, 390x844 | folha Painel aberta |

## Régua

- Texto normal: 4,5:1. Texto grande (24 px ou mais, ou 18,66 px em negrito): 3:1 (WCAG 2.2, 1.4.3).
- Campo de digitar e de escolher (input, select, textarea): a borda ou o fundo contra o que está atrás, 3:1 (1.4.11).
- A cor do texto leva a opacidade dele e a dos ancestrais. O fundo é a pilha de fundos dos ancestrais, composta de baixo para cima, mais o que está posto em posição absoluta por baixo do texto (a fita de latão do marcador escolhido, a placa da ferramenta armada). Num degradê conta a parada de cor pior.
- A medida espera toda entrada animada terminar: uma folha no meio do fade mede a opacidade do meio (foi o que deu 2,5:1 falso na lista de Cenas na primeira corrida).
- Fora da régua, como a WCAG manda: controle desabilitado e texto só para o leitor de tela.

## Resultado

- **275 medidas, 0 reprovações, 4 exceções justificadas, 0 sem medida** (nenhum fundo de imagem atrás de texto).
- Os piores textos passam por pouco: 4,52:1 (`--lb-color-parchment-faint` sobre o cartão da ficha), nas notas e nos resumos dos cartões (`gr-nota`, `gr-cartao__resumo`, `gr-ficha__resumo`).

## O que reprovou e foi corrigido

| Onde | Antes | Depois | Conserto |
|---|---|---|---|
| Diálogo Configurar cena: botões "Tipo de mapa" e "Mapa vivo" da navegação lateral | 2,29:1, fundo cinza `#f0f0f0` e borda do navegador | passa (fundo do papel) | `.gr-nav-vertical button` ganhou o reset de botão: os que não são o da vez não têm classe `gr-` e escapavam do reset do topo do `grimorio.css` |
| Jogador: tecla "I" da mochila na faixa | 4,37:1 | passa | `.pp-bag__key` de opacidade 0,7 para 0,8 |

## Exceções justificadas

| Onde | Razão | Por que fica |
|---|---|---|
| `input.lb-input` (nome do token, filtro de Cenas, campos do Configurar cena) | 1,27:1 | O filete de 1 px é o do protótipo aprovado (`--lb-gr-filete-forte`). O campo continua identificável: mora sempre sob o rótulo, mostra o valor ou o exemplo em texto acima de 4,5:1 e, com foco, acende o anel de latão de 8,4:1. |
| `input.pp-input` (Painel do jogador) | 1,57:1 | Mesmo motivo. |

Subir o filete dos campos a 3:1 pede uma cor perto de `rgb(105, 103, 98)` sobre o cartão `#211c15`. Isso muda a cara de todo campo do app e do protótipo, por isso fica como decisão do usuário (pendência da fatia 21), sem mexer agora.

## Como repetir

```
cd client
$env:LAB_NAVEGADOR = '<chrome.exe do Playwright>'
npx playwright test e2e/task-contraste-aa.spec.ts --reporter=line,json
```

O anexo `contraste` do relatório JSON é o `contraste-aa.json`.
