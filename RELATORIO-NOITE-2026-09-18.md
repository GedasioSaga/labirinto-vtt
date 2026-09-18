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

---

## Atualização — passada seguinte da mesma noite (fechamento: BLOQUEADO de novo)

O fiscal (portão) voltou a ser mexido depois da correção acima, e a interação do mapa e o menu de
chão ganharam medição mais precisa. Resultado da noite inteira continua **BLOQUEADO** nas três frentes.
Atualizações por tema abaixo.

### Tema: o portão que julga as outras mudanças (portao) — nova rodada

**Status: BLOQUEADO** (o consertado da rodada anterior segue de pé; apareceu um problema novo, mais sério)

- O que mudou: mais uma rodada de conserto no fiscal — agora ele também percebe quando uma peça
  escreve em cima de um arquivo que já é "dono" de outra peça, e passou a proteger o histórico de
  mais telas testadas (foram de 9 para 23 telas protegidas contra apagão sem querer).
- Por que: esperava que o fiscal reprovasse (1) peça escrevendo no arquivo de outra peça, (2) peça
  mexendo em tela testada que não tem selo, (3) peça adicionando campo novo no formato do mapa sem
  avisar como migrar dados antigos; obteve os três casos realmente reprovando quando testados de
  propósito (plantando a invasão e conferindo que virou vermelho). Também obteve a checagem de
  "nenhum servidor sujo" agora escrevendo no relatório *como* ela mediu (duas provas: mesma porta da
  sondagem e a opção de reaproveitar servidor desligada), em vez de ficar muda — mas ela continua sem
  testar de verdade o caso de módulo duplicado, só ficou mais honesta sobre o que não testa.
- Prova: os 15 comandos de checagem rodaram num retrato congelado e isolado do código (cópia
  temporária, nada foi mudado no trabalho de verdade) — 14 ficaram verdes com números reais (exemplos:
  testes de unidade `2290 passed`, testes Rust `25 passed` + `11 passed`, jornadas do editor
  `34 passed`, fluidez com atraso máximo de 60ms contra um teto de 200ms) e 1 ficou vermelho do jeito
  esperado (falta terminar as três peças de interação/menu abaixo — não é culpa desta peça do fiscal).
  Cada um dos 3 consertos foi plantado de propósito num arquivo de teste e confirmado que vira
  vermelho; sem o plantio, fica verde. Não há fotos de tela nesta peça — é lógica interna, não UI.
- Onde: branch `auto/portao`; arquivo `scripts/portao.cjs` (a mesma tarefa mexeu nele quatro vezes na
  noite) e `scripts/portao-particao.json`.

**O problema novo que segura a aprovação desta peça:** o fiscal, ao consertar os itens acima, trocou
sozinho qual é o "ponto de partida" contra o qual ele mede as outras três peças (cadeado, polígono,
menu) — sem avisar que fez essa troca, e o próprio arquivo dele diz que essa decisão não é dele, é de
quem organiza a noite. O efeito prático: se as três peças de interação/menu forem cortadas do ponto de
partida que a *organização da noite* declarou, o fiscal as acusa (errado) de mexer no próprio fiscal.
Se forem cortadas do ponto que essa peça escolheu por conta própria, passam. Só um ponto específico
funciona nos dois lados ao mesmo tempo, e esse ponto é justamente de **antes** dos consertos de
segurança acima — ou seja, aceitar essa peça do jeito que está reabriria a brecha que ela mesma
fechou, para qualquer peça futura cortada do jeito "errado". Ninguém plantou isso de má-fé (os dois
arquivos que essa peça mudou não tocam segredo, senha ou certificado), mas o mecanismo de "escolher
sozinho contra o que sou medido" precisa ser fechado antes de liberar.

### Tema: arrastar e desenhar no mapa (interação) — medição mais precisa

**Status: BLOQUEADO** (mesmo problema já relatado; agora com o ponto exato do código já achado)

- Cadeado da camada: confirmado o motivo exato — quando a peça está travada, o programa a tira da
  lista de "coisas que podem ser clicadas" **antes** de checar o que tem embaixo do clique, então ele
  acerta a sala por engano e arrasta ela inteira. Isso já estava descrito acima; a novidade é que o
  ponto exato no código foi encontrado e a correção ainda não foi escrita.
- Polígono: confirmado o motivo exato — a tecla Enter só olha se existe um desenho de "corredor" ou de
  "sala" em andamento; um desenho de "polígono" em andamento não entra nessa checagem, por isso Enter
  não faz nada nele e trocar de ferramenta descarta o rascunho. A novidade útil: o próprio desenho de
  polígono, enquanto ainda está sendo feito, não mostra a linha que fecharia a forma — o teste
  automático precisa medir essa linha à parte, exatamente para provar que a forma foi de fato fechada
  (e não só desenhada até a metade).
- Prova: continuam sem fotos antes/depois publicadas. As duas jornadas automáticas (uma para cada
  problema) continuam vermelhas — não foram corrigidas nesta passada, só diagnosticadas com mais
  precisão. Os testes de controle (que provam que o comportamento correto de hoje não quebrou)
  continuam verdes.
- Onde: branch `auto/camada-travada` (cadeado) e `auto/poligono-termina` (polígono), separadas nesta
  passada; arquivos `client/src/pixi/PixiCanvas.tsx`, `client/src/lib/selectionHitTest.ts`,
  `client/src/lib/layers.ts` (cadeado) e `client/src/pixi/PixiCanvas.tsx`,
  `client/src/lib/drawingFactory.ts`, `client/src/lib/polygonSdf.ts` (polígono).

### Tema: menu de opções de chão não cabe na tela — medição mais precisa

**Status: BLOQUEADO** (mesmo problema já relatado; agora com o ponto exato do código já achado)

- O que mudou: nada foi corrigido ainda nesta passada; o motivo exato foi confirmado no código — a
  lista de formas de chão é a mais comprida do programa (18 opções em 4 grupos) e o quadro do menu não
  tem limite de altura nem barra de rolagem própria, então, quando ele abre e o navegador tenta
  mostrá-lo inteiro, a página inteira rola para tentar caber — e mesmo assim sobra conteúdo cortado.
- Por que: esperava que abrir o menu não empurrasse o cabeçalho e a barra de ferramentas para fora da
  tela; confirmado que o culpado é o foco automático que o menu recebe ao abrir, que faz o navegador
  rolar a área de edição inteira para tentar mostrá-lo.
- Prova: continuam sem fotos antes/depois publicadas. A jornada automática (que mede a caixa de cada
  item do menu contra o tamanho real da janela, não só "existe na tela") continua vermelha. O controle
  positivo (clicar num item alcançável) continua verde.
- Onde: branch `auto/menu-cabe-na-janela`; arquivos `client/src/main.css`,
  `client/src/components/ToolVariantMenu.tsx`, `client/src/components/MenuCard.tsx`,
  `client/src/lib/toolVariants.ts`.

### Resumo atualizado da noite

| Peça | Status | Branch |
|---|---|---|
| portao (o fiscal das mudanças) | BLOQUEADO — brecha nova no "ponto de partida" que ele escolhe sozinho | auto/portao |
| cadeado da camada trava mas arrasta a sala | BLOQUEADO — motivo achado, correção não escrita | auto/camada-travada |
| polígono não termina o desenho | BLOQUEADO — motivo achado, correção não escrita | auto/poligono-termina |
| menu de opções de chão não cabe na tela | BLOQUEADO — motivo achado, correção não escrita | auto/menu-cabe-na-janela |

Nenhuma foto de tela (antes/depois) existe ainda para nenhuma das três peças de interação/menu — falta
gerar quando as correções forem escritas. Nada foi perdido: cada branch guarda o trabalho da
respectiva peça.

---
---

# FECHAMENTO DA NOITE — vale este, o resto acima é histórico

Tudo que está escrito acima descreve rodadas que **bloquearam**. Elas foram superadas. O estado
final é este.

## Os três defeitos foram consertados, e eu conferi cada um rodando

| O que estava quebrado | Onde está o conserto |
|---|---|
| Ferramenta **Polígono** não terminava: Enter não fazia nada, e ao trocar de ferramenta o desenho sumia | `134064d` em `auto/poligono-termina` |
| **Cadeado da camada** não protegia: com Tokens travada, arrastar no token arrastava a sala inteira | `8f5b82b` em `auto/camada-travada` |
| **Menu "Opções de Chão"** empurrava a página para fora da janela e escondia 6 opções | `2753d47` em `auto/menu-cabe-na-janela` |

As três branches formam uma corrente: cada uma parte da anterior, então dá para juntar na ordem sem
conflito. A branch **`auto/noite-18set`** já é o topo dessa corrente e tem as três.

## O que você vai perceber usando o app

- **Desenhar polígono agora termina.** Clique os cantos e aperte Enter (ou duplo clique). A figura
  fica no mapa, e continua lá quando você troca de ferramenta. Detalhe pensado: Enter cedo demais
  **não apaga** o que você já clicou — o rascunho fica de pé para você continuar.
- **O cadeado passou a proteger de verdade.** Com uma camada travada, o gesto não passa por ela —
  nem para ela, nem para o que está embaixo. E aparece um aviso no canto: *"A camada Tokens está
  travada"*. Antes não aparecia nada, e você só descobria o estrago depois. Vale para as 9 camadas.
- **O menu de Chão cabe na janela.** Ele se reparte em duas colunas quando não cabe, em vez de virar
  uma parede de texto rolável. O cabeçalho e a barra de ferramentas param de sair da tela. Os outros
  9 menus não mudaram.

## Como conferir você mesmo

```
cd C:\dev\labirinto
git checkout auto/noite-18set
cd client
LAB_PORTA=1466 npx playwright test e2e/task-jornada-poligono-termina.spec.ts e2e/task-jornada-camada-travada.spec.ts e2e/task-jornada-menu-cabe-na-janela.spec.ts --reporter=list
```

Tem de dar **6 passed**. Três desses seis são os defeitos; os outros três são controles positivos,
que já passavam antes e provam que o conserto não afrouxou a régua.

`LAB_PORTA=1466` está aí porque sobrou um servidor Vite na porta 1420 (ver pendências).

## Prova que eu mesmo rodei, não só os agentes

- as 6 jornadas acima: **6 passed**;
- `unidade` (vitest inteiro): verde, **140 arquivos / 2297 testes** — cresceu, não encolheu;
- `jornadas-e2e` (regressão ampla): verde, **59 testes**;
- `estilo-minimapa` (estilo medido em pixel): verde;
- `jornada-fluidez` (travamento): verde;
- `particao` (quem escreveu onde): verde;
- `jornadas-intactas`: **29 jornadas seladas**, nenhuma editada por builder;
- `rust-intocado`: lado Rust não foi tocado.

## Sua branch está intocada

`feat/consolidado-17set` **não recebeu um commit sequer**. Tudo vive em branches `auto/*`. O merge é
decisão sua, com o diff na mão.

## O que NÃO foi entregue, e por quê

**Feature nova: nenhuma.** Você autorizou features autônomas sem teto, e eu não entreguei nenhuma.
Quando o orçamento apertou, preferi três consertos provados a features inventadas. É uma escolha
minha, e você pode discordar dela.

**Três rodadas foram perdidas num erro meu.** Coloquei as jornadas-critério dentro do portão que
toda peça precisa passar. Como elas só ficam verdes **depois** do conserto, nenhuma peça conseguia
passar — nem a do próprio portão. Levei três rodadas insistindo antes de virar a chave.

**A última etapa não usou o gauntlet completo.** Usei as partes dele que funcionam — jornada vermelha
selada com controle positivo, portão de regressão de 15 passos, partição com base congelada — mas
sem o loop de Fase 0, que estava consumindo a noite auditando a si mesmo. Não houve comparação cega
A/B. Para conserto de defeito isso é defensável (o protocolo chama de `SEM_COMPARACAO`: o critério é
a jornada virar verde), mas é menos do que o gauntlet inteiro, e não vou chamar de outra coisa.

## O portão ficou muito melhor — e foi ele que impôs o rigor

As rodadas que "falharam" endureceram o fiscal, e cada conserto dele foi provado por mutação:

| | Antes | Depois |
|---|---|---|
| Jornadas e2e no portão | 20 | **59** |
| Jornadas protegidas contra edição | 9 | **29** |
| `servidor-limpo` | verde de brinde | mede de verdade |
| `particao` | invasão sumia ao commitar | enxerga o que foi commitado |
| Suíte de unidade | podia encolher calada | piso de 139 arquivos / 2290 testes |
| Grupo de jornadas | dava para rodar só uma | exige o grupo completo |

Foi esse portão endurecido que segurou os builders desta noite: ele **recusou** um deles rodar só a
jornada dele.

## Pendências — coisas que precisam de você

1. **Vite órfão na porta 1420** (PID 45804): sobra de um passeio que interrompi. Enquanto viver, todo
   Playwright precisa de `LAB_PORTA=<porta>`. `Stop-Process -Id 45804 -Force` resolve. Tentei
   encerrar e o classificador de segurança negou.
2. **2,2 GB recuperáveis** em `.claude/worktrees/wf_4774aa00-f19-{2,3,4,5}` — pastas órfãs de branches
   já mergeadas. A remoção também foi negada.
3. **`transporte-vivo` do portão nunca passa sem você**: `scripts/portao.cjs` fixa `192.168.0.6:7777`
   e o IP da máquina é `192.168.0.8`; e o servidor 7777 só nasce quando alguém abre a sala pela
   interface. A parte do IP é conserto de uma linha.
4. **`task-jornada-ferramentas-mudas.spec.ts` está vencida e é decisão sua**: duas das três asserções
   dela cobram o contrário de `NEW_MAP_SHOW_GRID = false` ("mapa novo nasce sem grade", estilo
   minimapa — decisão sua). Ou a jornada muda, ou a decisão muda.
5. **Trava por ITEM tem o mesmo buraco do cadeado de camada**, e não foi consertada: item com
   `locked: true` é filtrado antes do hit-test e o clique cai no que está embaixo.
   Endereço: `client/src/pixi/PixiCanvas.tsx`, função `hitTestMap`.
6. **A interface mostra texto cru de exceção** quando salvar falha. No app Tauri real salvar funciona,
   mas disco cheio ou permissão negada mostraria a mesma coisa ao usuário.
7. **Vale uma varredura de falso-VERMELHO nas outras jornadas.** Das duas que examinei esta noite,
   **as duas** estavam vencidas — descreviam defeito que não existe mais.

## Sugestões que o passeio e os builders levantaram, para você decidir

Não implementei nenhuma: são decisão de produto, e o combinado é uma feature por vez.

- Setas do teclado não navegam nos menus de variante (18 Tabs para chegar ao fim do menu de Chão).
  Defeito pré-existente nos 11 menus.
- Descrições redundantes em "Lados do polígono" ("3 lados." sob "Triângulo") — ~150px de altura sem
  informação.
- Ferramenta Token ainda **cria** token com a camada Tokens travada.
- Sem feedback de cursor ao pairar sobre camada travada.
- Os outros 12 achados do passeio de usuário estão em
  `scratchpad/gauntlet-noite/passeio-mestre/relatorio.md`, com passos e 25 fotos.
