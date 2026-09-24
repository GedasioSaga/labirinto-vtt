# Cabine de transporte: elevador, paternoster e cesto com posição

Item `cabine-de-transporte` de `docs/features-unicas-2026-09-24.json` (11 vozes da torre:
Gui "Passagem de cabine única: a Espinha tem um lugar só", ideias 8 "Veículo: cabine,
cesto, bote e monta-livros" e "Linha vertical com cabine: Espinha, paternoster e
monta-livros com posição, fila e ponteiro"). Hoje o pino de viagem não tem estado:
a cabine não "está" em andar nenhum, e dois jogadores em andares diferentes passam
ao mesmo tempo.

## O que muda na mesa (núcleo desta entrega)

- O mestre marca um pino de viagem como **parada de uma cabine** ("Espinha") no
  painel do pino, criando a cabine ali ou escolhendo uma que já existe.
- A cabine tem **uma posição só**: a parada onde ela está. O painel do pino diz
  "A cabine está aqui" ou "A cabine está em outra parada", e "Trazer a cabine
  para cá" a move.
- O jogador que toca uma parada lê **"A cabine está aqui"** (e passa como sempre,
  pelo modo do pino: pede, livre) ou **"A cabine não está aqui"** (sem botão de
  passar). O host recusa passagem por parada sem a cabine, inclusive o "Deixar
  ir" de um pedido feito antes de a cabine sair.
- Quem passa de uma parada para outra parada **da mesma cabine** leva a cabine
  junto: ela passa a estar na chegada, e quem ficou na parada de partida passa
  a ler "não está aqui" no próximo envio.
- **Chamar a cabine (fila)**: quem está numa parada sem a cabine toca "Chamar a
  cabine" (mensagem `cabine.call`, só o id do pino). A chamada entra no fim da
  **fila** da cabine, uma por parada (quem chamou primeiro fica com a vez), e o
  mestre lê o aviso "Duda chamou a cabine Espinha em Topo", com "Mandar a
  cabine". Quem chamou lê "A cabine foi chamada para cá". No painel do pino, o
  mestre vê a fila em ordem, "Atender a próxima chamada" (a cabine vai à
  primeira parada da fila) e "Limpar a fila". A cabine que chega a uma parada,
  por viagem ou pelo mestre, atende a chamada dela.
- **Ocupante**: quem pede para passar (modo "pede") com a cabine ali EMBARCA e
  é o ocupante até o mestre responder. Os outros na mesma parada leem "A cabine
  está aqui, mas alguém já embarcou" e não passam (uma cabine, um embarque). O
  aviso do pedido diz "(na cabine Espinha)" e o painel do pino diz "Na cabine:
  Ana, esperando você deixar ir". "Não", recusa ou saída do jogador liberam a
  cabine; "Deixar ir" a leva com ele.

## Dado novo e onde mora

Tudo na **aventura** (`adventure.json`, `Adventure.cabines?`, `lib/adventure.ts`),
porque a cabine cruza cenas e tem uma posição só — pôr a posição no pino, cena a
cena, deixaria duas paradas dizendo "aqui" quando uma cena não abrisse:

```
CabineDeTransporte { id: string                  // estável
                     nome: string                // "Espinha" — só do mestre
                     paradas: PinDestination[]   // { sceneId, pinId }, na ordem, sem repetir
                     atual: PinDestination | null   // uma de paradas, ou em lugar nenhum
                     fila?: ChamadaDeCabine[] }     // { parada, tokenId, nome }, na ordem de chegada
```

- Campo **opcional**: aventura antiga abre e grava sem a chave; arquivo torto
  (parada fora da forma, `atual` que não é parada) é limpo na leitura
  (`cabinesDoArquivo`, `lib/cabine.ts`). O `map.json` de cena **não muda**.
- A fila fica na aventura (sobrevive ao Salvar; o mestre a limpa). Sem chamada,
  a cabine grava sem a chave `fila`.
- O **ocupante NÃO vai ao arquivo**: é o pedido pendente no host
  (`PendingTravel.embarque`, `net/hostSession.ts`). Gravado, um app fechado com
  alguém "dentro" deixaria a cabine presa. O painel o lê por `PlayerInfo.naCabine`.
- Parada cujo pino sumiu fica na lista (o mestre pode desfazer a exclusão) e não
  vale nada: o host só olha paradas que o jogador está tocando.
- `HostWorld.cabines?` (`net/hostSession.ts`) leva as cabines ao host;
  `hostWorldOf` (`stores/adventureStore.ts`) as copia da aventura.

## Quem grava

- **Mestre**, pelo painel do pino (`components/PinCabineControls.tsx`):
  `criarCabine`, `definirParadaDeCabine`, `moverCabine`, `atenderChamada`,
  `limparFilaDaCabine` no `adventureStore`.
  Fora do Ctrl+Z da cena (é dado da aventura, como o Estado do mundo).
- **Host**, na passagem: `transferResult` devolve `applyCabine` quando a viagem é
  de uma parada para outra da mesma cabine e a cabine estava na partida; a ponte
  (`net/hostBridge.ts`) aplica pelo `applyCabine` do App antes do broadcast.
- **Host**, na chamada: `handleCabineCall` devolve `chamadaDeCabine`; a ponte
  grava pelo `applyChamadaDeCabine` do App (`chamarCabine`) e só avisa o mestre
  se entrou na fila.

## O que o jogador recebe e o que nunca recebe

- Recebe, **só no pino de viagem que o recorte da névoa já mandou**, o campo
  `Pin.cabine: 'aqui' | 'ocupada' | 'chamada' | 'longe'` (`comCabineParaJogador`, `lib/fogFilter.ts`,
  chamado em `snapshotFor` do host).
- **Nunca** recebe: o id nem o nome da cabine, a lista de paradas, **onde** a
  cabine está (cena ou pino), quem chamou, quem está dentro, nem o status de parada que a névoa, a zona oculta,
  o "Quem vê" ou o segredo esconderam. `pinForPlayer` continua lista do que vai:
  um `cabine` escrito à mão no `map.json` não passa; `deserializeMap` o apaga.

## Fica para depois (pendências)

- **Cabine que anda sozinha** até a chamada (hoje o mestre manda) e "o outro vê
  o ponteiro passar direto".
- **Veículo**: levar todo mundo da área de embarque, capacidade maior que 1,
  NPC "vai junto"; ocupante no modo livre (hoje a passagem livre é instantânea).
- **Ponteiro relativo** ("↑3 paradas, vindo", subindo/descendo) e o mostrador
  de cada parada; ritmo (um andar por minuto).
- Desenho no mapa do mestre (selo "cabine aqui" na cabeça do pino) e glifo no
  mapa do jogador.
- Lista de cabines na seção da aventura (renomear, apagar, reordenar paradas).
