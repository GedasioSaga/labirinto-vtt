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

## Dado novo e onde mora

Tudo na **aventura** (`adventure.json`, `Adventure.cabines?`, `lib/adventure.ts`),
porque a cabine cruza cenas e tem uma posição só — pôr a posição no pino, cena a
cena, deixaria duas paradas dizendo "aqui" quando uma cena não abrisse:

```
CabineDeTransporte { id: string                  // estável
                     nome: string                // "Espinha" — só do mestre
                     paradas: PinDestination[]   // { sceneId, pinId }, na ordem, sem repetir
                     atual: PinDestination | null } // uma de paradas, ou em lugar nenhum
```

- Campo **opcional**: aventura antiga abre e grava sem a chave; arquivo torto
  (parada fora da forma, `atual` que não é parada) é limpo na leitura
  (`cabinesDoArquivo`, `lib/cabine.ts`). O `map.json` de cena **não muda**.
- Parada cujo pino sumiu fica na lista (o mestre pode desfazer a exclusão) e não
  vale nada: o host só olha paradas que o jogador está tocando.
- `HostWorld.cabines?` (`net/hostSession.ts`) leva as cabines ao host;
  `hostWorldOf` (`stores/adventureStore.ts`) as copia da aventura.

## Quem grava

- **Mestre**, pelo painel do pino (`components/PinCabineControls.tsx`):
  `criarCabine`, `definirParadaDeCabine`, `moverCabine` no `adventureStore`.
  Fora do Ctrl+Z da cena (é dado da aventura, como o Estado do mundo).
- **Host**, na passagem: `transferResult` devolve `applyCabine` quando a viagem é
  de uma parada para outra da mesma cabine e a cabine estava na partida; a ponte
  (`net/hostBridge.ts`) aplica pelo `applyCabine` do App antes do broadcast.

## O que o jogador recebe e o que nunca recebe

- Recebe, **só no pino de viagem que o recorte da névoa já mandou**, o campo
  `Pin.cabine: 'aqui' | 'longe'` (`comCabineParaJogador`, `lib/fogFilter.ts`,
  chamado em `snapshotFor` do host).
- **Nunca** recebe: o id nem o nome da cabine, a lista de paradas, **onde** a
  cabine está (cena ou pino), nem o status de parada que a névoa, a zona oculta,
  o "Quem vê" ou o segredo esconderam. `pinForPlayer` continua lista do que vai:
  um `cabine` escrito à mão no `map.json` não passa; `deserializeMap` o apaga.

## Fica para depois (pendências)

- **Chamar a cabine**: botão do jogador "Chamar a cabine" (mensagem nova no
  protocolo, pedido ao mestre ou cabine que anda sozinha).
- **Fila**: quem chama primeiro leva; o outro vê o ponteiro passar direto.
- **Ocupante / "na cabine"**: estado de estar dentro, levar todo mundo da área
  de embarque (veículo), NPC "vai junto".
- **Ponteiro relativo** ("↑3 paradas, vindo", subindo/descendo) e o mostrador
  de cada parada; ritmo (um andar por minuto).
- Desenho no mapa do mestre (selo "cabine aqui" na cabeça do pino) e glifo no
  mapa do jogador.
- Lista de cabines na seção da aventura (renomear, apagar, reordenar paradas).
