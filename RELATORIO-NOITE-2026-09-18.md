# Relatorio da noite — 18/09/2026

Para ler com café. Resultado desta passada: **BLOQUEADO** — nenhuma peça foi liberada. Abaixo, por tema.

---

## Tema: o portão que julga as outras mudanças (portao)

**Status: BLOQUEADO**

- O que mudou: a pessoa tentou consertar o "fiscal" que decide se uma mudança pode ser aceita, mas o próprio fiscal continua com um jeito de passar batido quando a mudança já foi salva no histórico do programa (commit).
- Por que: esperava que o fiscal reprovasse qualquer arquivo mexido fora do combinado para essa tarefa; obteve fiscal aprovando 0 arquivos "mudados" porque ele olha só o que ainda não foi salvo — depois de salvo, ele enxerga a árvore como limpa e libera. Foi provado de propósito: um arquivo plantado fora da área permitida foi barrado enquanto estava solto, e liberado assim que foi salvo no histórico.
- Prova: não há fotos antes/depois nesta peça (é lógica interna do fiscal, não tela). Evidência é texto de comando: rodar o fiscal com o arquivo `scripts/__probe_fora.cjs` fora do combinado, ainda não salvo → reprova (saída de erro); depois de salvar no histórico → aprova (saída de sucesso), mesmo sendo a mesma invasão. Também rodou um autoteste interno (`node scripts/portao.cjs --autoteste`) que passou em tudo que ele mesmo cobre — mas não cobre esse caso do "já salvo".
- Onde: branch `auto/portao`; arquivos `scripts/portao.cjs`, `scripts/portao-particao.json`.

Pendências que ficaram para trás nesta mesma peça (não bloqueiam sozinhas, mas somam ao motivo de não liberar):
- O teste automático da jornada do jogador (Playwright) ainda não tem proteção contra "verde falso": se um teste for pulado ou não rodar nada, o fiscal pode achar que passou. Existe um jeito melhor pronto para usar, mas ainda não foi ligado no lugar certo.
- A checagem de "nenhum servidor sujo rodando" hoje sempre dá verde nessa configuração, porque nunca há servidor ligado quando ela roda — não é uma checagem real ainda, é um verde de brinde.
- O que passou de verdade e pode ficar tranquilo: os testes de unidade (2290 testes), os testes do lado Rust (11 testes), os testes de fluidez e de jornadas do editor — 20 jornadas passaram normalmente nesta rodada.

---

## Tema: arrastar e desenhar no mapa (interação)

**Status: BLOQUEADO**

### Cadeado da camada não protege a sala

- O que mudou: tentativa de corrigir o cadeado do painel de camadas, que deveria impedir de mexer sem querer na camada travada.
- Por que: esperava que, com a camada de peças (tokens) travada, arrastar em cima de uma peça não mexesse em mais nada; obteve a peça realmente parada, mas a sala inteira embaixo dela sendo arrastada junto — 84 pixels para o lado e 70 para baixo, sem nenhum aviso na tela.
- Prova: não existem fotos antes/depois publicadas para esta peça ainda; falta gerar. O critério combinado é a jornada automática que mede a posição da sala na tela em pixels antes e depois do arrasto — essa jornada ainda está vermelha (reprovando), não foi consertada.
- Onde: branch `auto/interacao-do-mapa`; arquivo `client/src/pixi/PixiCanvas.tsx` (mais `client/src/lib/selectionHitTest.ts`, `client/src/lib/layers.ts`).

### Polígono não termina o desenho

- O que mudou: tentativa de corrigir a ferramenta de desenho, forma Polígono, que deveria fechar o traçado ao terminar.
- Por que: esperava que apertar Enter (ou dar duplo clique) fechasse a forma, do jeito que o próprio app promete no texto de ajuda ("duplo clique ou Enter termina"); obteve Enter sem efeito nenhum, duplo clique só acrescentando mais um ponto, e o desenho inteiro sumindo sem aviso se a pessoa trocar de ferramenta no meio — perde o trabalho.
- Prova: não existem fotos antes/depois publicadas ainda; falta gerar. O critério é a jornada automática que testa fechar o polígono e checa se ele fica salvo no mapa — essa jornada continua vermelha.
- Onde: branch `auto/interacao-do-mapa`; arquivo `client/src/pixi/PixiCanvas.tsx`.

Observação: as duas jornadas de controle (que provam que o comportamento correto de hoje continua funcionando) já passavam antes e não podem quebrar com a correção — isso ainda não foi confirmado porque a correção não fechou.

---

## Tema: menu de opções de chão não cabe na tela (menu-chao-cabe)

**Status: BLOQUEADO**

- O que mudou: tentativa de corrigir o menu "Opções de Chão" (a setinha embaixo do ícone de Chão), que deveria caber na janela do programa.
- Por que: esperava que o menu abrisse dentro da tela de 1280x800 e todo item ficasse alcançável com o mouse; obteve a página inteira subindo quando o menu abre (o cabeçalho "Labirinto" e a barra de ferramentas saem da tela), e mesmo assim o menu termina cortado — da lista de formas de polígono só aparecem "Triângulo" e o começo, faltando Quadrado, Pentágono, Hexágono, Octógono, Decágono e Dodecágono. Rolar a roda do mouse sobre o mapa com o menu aberto afasta o zoom do mapa (de 100% para 74%) em vez de rolar a lista do menu; só o Tab do teclado alcança os itens escondidos.
- Prova: não existem fotos antes/depois publicadas ainda; falta gerar. O critério é a jornada automática que mede a caixa de cada item do menu contra o tamanho da janela e clica de verdade no Dodecágono — essa jornada continua vermelha.
- Onde: branch `auto/menu-chao-cabe`; arquivos `client/src/main.css`, `client/src/components/ToolVariantMenu.tsx`, `client/src/components/MenuCard.tsx`, `client/src/lib/toolVariants.ts`.

---

## Resumo da noite

Três frentes abertas, nenhuma liberada:

| Peça | Status | Branch |
|---|---|---|
| portao (o fiscal das mudanças) | BLOQUEADO | auto/portao |
| interação do mapa (cadeado + polígono) | BLOQUEADO | auto/interacao-do-mapa |
| menu de opções de chão | BLOQUEADO | auto/menu-chao-cabe |

Nada foi perdido: cada branch guarda o trabalho da respectiva peça, e nenhuma foi misturada com as outras.

---

## Correção deste relatório (orquestrador, depois do run)

Dois pontos do texto acima ficaram **vencidos** — foram escritos com o estado da primeira volta, antes
do conserto da segunda. Conferi os dois à mão depois que o run terminou:

1. **"o próprio fiscal continua com um jeito de passar batido quando a mudança já foi salva"** — isso
   **foi consertado**, no commit `a5c4960`. A função que lista o que mudou agora soma duas fontes: o
   que está solto na árvore (`git status --porcelain`) **e** o que já foi salvo no histórico
   (`git diff --name-only <base> HEAD`). Antes ela olhava só a primeira, e por isso salvar escondia a
   invasão. Provado pelo autoteste do próprio fiscal: `g14` reprova peça que escreve fora da área,
   reprova arquivo sem dono, reprova arquivo que duas peças declaram, e aprova o caso legítimo — dez
   casos, todos com entrada real.

2. **"não tem proteção contra verde falso [no Playwright]"** — a proteção **existe e morde**; o que
   faltava era eu ligá-la no lugar certo, e isso era tarefa minha, não da peça. O modo novo
   (`--jornada=`) recusa sair verde quando o relatório traz `N skipped`, `N flaky`, `did not run`, ou
   quando não traz nenhum `N passed`. Testado: com 5 jornadas reais deu `16 passed`, VERDE, exit 0.

O que **continua valendo** do texto acima: a checagem de "nenhum servidor sujo rodando" ainda é um
verde de brinde nesta configuração, e as três peças saíram mesmo BLOQUEADAS nesta passada.
