# Pisos na mesma cena — rodada 3 (sobre auto/int-noite)

Continua `docs/planos/pisos-na-mesma-cena.md` (dado, quem grava e o que o
jogador recebe NÃO mudam). Esta rodada leva a feature para a base nova e fecha
os três achados do revisor. Passos pequenos, um commit cada.

## Dado novo e onde mora

Nada de novo no arquivo: continua `piso?: number` (`NoPiso`) em cada entidade e
`Stair.levaAoPiso?: number`, os dois opcionais; `deserializeMap` passa por
`pisosDoArquivo` e o mapa antigo abre igual. Fora do arquivo:

- `mapStore.pisoAtivo` (vista do mestre, já existia).
- `FollowTarget.piso?`, `PartyToken.piso?`, `CarriedToken.piso?`: o piso da
  ficha no que o EDITOR lê (seguir, painel Grupo, "Levar para…"). Só o mestre
  lê; nada disso vai pela rede. Ausente = térreo.
- `onGoToScene(sceneId, x, y, piso)` na ponte: o "Ir lá" do aviso de chegada
  leva o piso de chegada (`AppliedTransfer.piso`, já existia).

## Passo 1 — atualizar sobre a base (auto/int-noite)

A base mudou por baixo: o recorte do jogador virou `filterMapForGroup` (o mesmo
recorte da TELA DA MESA), a memória do host ganhou redimensionar, retomar a
mesa gravada e "lugares". O piso entra assim:

- `filterMapForGroup` começa por `mapaDoPiso(map, pisoDoGrupo(...))`: o piso
  do grupo é o do primeiro membro com ficha (a mesma regra de
  `pisoDoJogador`, que agora é o grupo de um). Um piso só por recorte: a TV
  nunca mistura dois.
- Memória: a chave por (cena, piso) vale no `existingMemory`/`memoryFor`/
  memória por ficha novos; o teto de cenas não esquece o outro piso da cena
  onde o jogador tem ficha.
- TV: junta só a memória do piso DELA (o explorado do 1º piso abriria no
  térreo o mesmo lugar do plano).
- Mesa gravada: grava só o térreo de cada cena. O arquivo tem uma memória por
  mapa; a do 1º piso voltaria como a do térreo.
- Ferramentas novas do editor (menu da porta, zona pelo clique) miram só o
  piso em edição; "Trazer" põe a ficha no piso do dono.

## Passo 2 — a câmera leva o editor ao piso da ficha

`adventureStore.goToPointNoPiso(sceneId, ponto, piso)`: o `goToPoint` de
sempre e, depois dele (a troca de cena já pôs o térreo em `loadMap`),
`setPisoAtivo(piso)`. Usado por: "Ir lá" do painel Grupo, "Ir lá" do aviso de
chegada, "Ir lá" do "Levar para…" e o Seguir (que também centra de novo
quando só o piso mudou: a escada não muda o ponto).

## Passo 3 — a ficha que sai do piso em edição sai da seleção

`mapStore.applyPlayerChange` (mudança do JOGADOR) passa a seleção por
`selecaoNoPiso`: o que não está mais no piso em edição sai. O editor fica
onde o mestre está (não segue ninguém sozinho); o Delete não apaga mais a
ficha que subiu a escada.

## O que o jogador recebe / nunca recebe

Igual ao plano base. Novo aqui: a TV também recebe só um piso e só a memória
dele; nada do outro piso sai pela tela da mesa.

## Fica para depois

- "Ir lá" do chamado, do sinal de fundo, da ação no ponto, do pedido de
  passagem e da marca "vamos para cá": ainda só a câmera (o piso do ponto não
  vem na mensagem).
- Mesa gravada: memória do 1º piso em diante não é guardada (volta vazia).
- TV com o grupo espalhado em pisos: mostra o piso do primeiro; escolher o
  piso da tela é do mestre, depois.
- Luz presa na ficha não sobe com ela pela escada do jogador (sobe pelo
  "Levar ao piso" do mestre).
- Caravana que desembarca, "Desfazer" da viagem e ajudante que atravessa
  junto chegam no térreo.
- "Mapa por andares" (cenas-andar): a memória de um andar onde o jogador não
  está mostra o térreo daquela cena.
- O resto da lista do plano base.
