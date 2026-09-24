# Plano — movimento imposto (esteira e corrente)

Pedido: uma zona com direção e passo que move as fichas a cada "Avançar" do
mestre, respeitando `collision.ts`; um pino de cabine contínua que leva ao
próximo par quem ficou parado. A zona de perigo só avisa, não move.
Aceite: a ficha na esteira anda 3 casas por Avançar, não atravessa parede e o
jogador vê só o próprio movimento.

## Dado novo e onde mora

- `MapData.conveyors?: Conveyor[]` (`client/src/types/map.ts`), por CENA — cada
  cena da aventura é um `MapData`, então a esteira viaja com o mapa salvo e com
  a cena da aventura sem campo novo em `Adventure`.
- `Conveyor = { id, roomId, direction, stepCells }`:
  - a unidade é a SALA (`Region` com `room`), igual à zona de perigo: o mestre
    seleciona a sala e diz "isto é esteira para leste, 3 casas";
  - `direction`: `'norte' | 'sul' | 'leste' | 'oeste'` (norte = para cima na tela);
  - `stepCells`: inteiro 1..20, em QUADRADOS da grade (padrão 3).
- Uma sala tem no máximo uma esteira. Sala apagada: a esteira dela deixa de
  valer (mesma regra de `hazardRooms`).
- Opcional e sem migração: mapa salvo antes abre igual (`deserializeMap` não
  inventa o campo); lixo editado à mão sai sozinho (`readConveyors`); a última
  esteira removida tira o campo em vez de gravar `[]`.

## Regra (pura, `client/src/lib/conveyors.ts`)

- `advanceConveyors(map)`: cada ficha cujo centro está numa sala com esteira
  (a mais de dentro, se houver aninhamento) anda casa por casa na direção, até
  `stepCells` casas. Para antes de:
  - cruzar parede que barra movimento (`moveCrossesWall` de `collision.ts`;
    porta aberta e destrancada deixa passar, porta fechada, trancada ou secreta barra);
  - sair do mapa.
  Depois de cada casa, se a ficha saiu da sala da esteira, ela foi "largada" na
  ponta e para ali. Nada muda: devolve o MESMO mapa (sem entrada no desfazer).
- A zona de perigo (`advanceHazard`) continua só avançando o perigo e avisando;
  nunca mexe em ficha.

## Quem grava

- Só o MESTRE, no editor: painel da Sala ganha o bloco "Esteira" (direção,
  passo e o botão "Avançar esteiras", que é o apito — move TODAS as esteiras da
  cena aberta de uma vez). `mapStore.setRoomConveyor` / `mapStore.advanceConveyors`,
  com histórico (Ctrl+Z desfaz o avanço inteiro).
- O jogador não grava nada novo: a ficha dele se move porque o mapa do host mudou.

## O que o jogador recebe e o que nunca recebe

- Recebe: a posição nova da PRÓPRIA ficha (e das que ele já enxergaria pelo
  recorte de sempre), pelo snapshot normal.
- NUNCA recebe: o objeto `conveyors` (id, sala, direção, passo) — o recorte
  (`fogFilter.ts`) tira o campo do mapa do jogador, igual a `hazards`; nem a
  posição de ficha que a névoa, a zona oculta, o teto ou outra cena escondem
  (o recorte de fichas não muda: a esteira não abre exceção).

## Ocupação ("Fichas ocupam espaço")

- Com `movement.tokensOccupy` ligado, a esteira para ANTES da casa de outra
  ficha (`findOccupant`, a mesma régua do host). A fila na mesma esteira anda
  junta: quem vai na frente anda primeiro. Ficha `secret` não segura (parar
  antes dela diria que existe alguém). Ficha só escondida pela névoa SEGURA:
  a regra pura não tem a visão de cada jogador (o host usa o recorte).

## Cabine contínua (paternoster) — `client/src/lib/cabins.ts`

- `Pin.cabine?: string`: o id do PRÓXIMO pino "!"/"?" da MESMA cena. Encadeado
  (A → B → C → A), a cabine gira sem parar. Pino de viagem não tem cabine.
- No mesmo "Avançar esteiras": primeiro as esteiras, depois as cabines. "Ficou
  parado" = a ficha está na casa do pino e a esteira não a moveu neste Avançar.
- A cabine anda no poço: parede e porta fechada não a seguram. Com ocupação
  ligada, a parada tomada por quem NÃO sai segura a ficha; as cabines andam
  juntas (quem sai abre a vaga); duas para a mesma parada, vai a primeira.
- Painel do pino: "Cabine contínua: leva a" (os outros pinos da cena) e o
  botão "Avançar esteiras". `mapStore.setPinCabin`, com histórico.
- O jogador nunca recebe `cabine` (`pinForPlayer` copia por lista do que vai).

## Fica para depois (pendências)

- Cabine entre CENAS (o par em outra cena): hoje a cabine liga pinos da mesma cena.
- Disparo automático pelo "Passar a vez" da iniciativa (hoje é só o botão).
- Desenho da esteira no canvas (setas finas no chão, estilo minimapa) para o
  mestre e, quando visível, para o jogador — com recorte próprio.
- Aviso ao dono ("A esteira te levou 3 casas"), no molde de `hazard.entered`.
- Esteira que despeja em outra esteira (encadear no mesmo Avançar).
- Tipo "corrente" (água) com rótulo próprio; a mecânica é a mesma.
