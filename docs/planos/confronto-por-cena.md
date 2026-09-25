# Confronto por cena: vez e passo limitado

Item `confronto-por-cena` de `docs/features-unicas-2026-09-24.json` (9 vozes da torre:
Caio, Bruno, Enzo, Duda, Gui, Ana e o defeito "iniciativa em duas camadas").

## O que o mestre ganha

Na aba Jogo, "Confronto nesta cena": o mestre marca as fichas da cena aberta
(jogadores e NPCs), acerta a ordem com Subir/Descer, escolhe o passo em casas
(padrão 6) e começa. Enquanto dura: "Próxima vez" e "Encerrar". Cada cena tem o
próprio confronto; ligar numa cena não mexe nas outras.

## Dado novo e onde mora

`MapData.confronto?: Confronto` (types/map.ts), no ARQUIVO DA CENA:

```
Confronto { fila: string[]  // ids de ficha, na ordem da vez
            vez: number     // índice em fila de quem tem a vez
            passo: number   // casas por vez (inteiro >= 1)
            turno: number } // conta as vezes passadas; muda a cada "Próxima vez"
```

- Por cena de graça: cada cena é um `MapData`, e o host já serve cada jogador
  pela cena onde está a ficha dele (`sceneFor`). Não há estado global de vez.
- Ausente = sem confronto. `deserializeMap` lê o arquivo velho igual a antes
  (o campo nem é escrito) e descarta confronto torto (fila que não é lista de
  texto, vez fora da fila, passo não positivo) em vez de derrubar o mapa.
- Quem grava: só o mestre, pelo painel. A mudança entra como mudança de MESA
  (`applyPlayerChange`), fora do Ctrl+Z do editor: desfazer um traço de parede
  não pode ressuscitar a vez de ninguém.
- O GASTO da vez (quantas casas a ficha da vez já andou) fica na sessão do host,
  por cena, preso ao `turno`: "Próxima vez" muda o turno e o gasto zera sozinho.
  Não vai ao arquivo (fechar e reabrir a sala devolve o passo inteiro: aceitável).

## Quem valida

`validateTokenMove` (lib/moveValidation.ts), só para pedido de JOGADOR e só
para ficha que está na fila:

- ficha da fila fora da vez: `not_your_turn` ("Espere sua vez");
- trajeto (o mesmo `findTokenPath`, medido na régua do mapa, `measureCells`)
  que passa do que resta do passo: `too_far` ("Além do seu passo").
- ficha fora da fila anda livre; o mestre (`isHost`) anda livre.

## O que o jogador recebe (e o que nunca recebe)

O recorte tira `confronto` do mapa (`lib/fogFilter.ts`); o host manda, no
snapshot, `confronto: PlayerConfronto | undefined` montado por
`confrontoParaJogador` (lib/confronto.ts) a partir das fichas QUE JÁ SAÍRAM no
recorte dele:

```
PlayerConfronto { fila: string[]         // só fichas que ele recebeu, na ordem
                  vez: string | null     // id da ficha da vez, se ele a recebeu
                  suaVez: boolean
                  passo: number
                  restam: number | null } // só na vez de ficha DELE
```

Nunca recebe: o confronto de outra cena (o snapshot é da cena dele, e cada
cena tem o seu); ficha que a névoa, a zona oculta, o segredo ou a camada
escondem (sai da fila; se a vez é dela, `vez: null`, "vez de outro"); nome de
trabalho do mestre (a faixa usa o nome que já veio na ficha do recorte); o
gasto de outra ficha; `turno`.

## Núcleo desta entrega

1. `types/map.ts`, `lib/confronto.ts` (lógica pura), `lib/mapFile.ts` (leitura).
2. `lib/moveValidation.ts` + `net/hostSession.ts` (vez, passo, gasto por cena).
3. `lib/fogFilter.ts` + snapshot (`net/protocol.ts`) + `player/playerConnection.ts`.
4. Faixa do jogador (`player/ConfrontoFaixa.tsx`) e recusa em uma linha.
5. Painel do mestre (`components/ConfrontoControls.tsx`) na aba Jogo.

## Fica para depois

- Ficha que ocupa a casa (não atravessar inimigo) e anel de alcance no mapa.
- Régua do arrasto mostrando "faltam N" antes de soltar.
- Reordenar a fila por arrasto (o núcleo tem Subir/Descer pelo teclado).
- Roda da mesa ("Próxima mesa" entre cenas em combate) e confronto em cena de
  fundo pelo painel (hoje o painel age na cena aberta; a de fundo guarda o seu).
- Passar a vez pelo próprio jogador; condições que reduzem o passo.
- Gasto sobrevivendo a reabrir a sala.
