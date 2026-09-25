# Rotina do NPC por turno: o apito leva cada ficha ao seu posto

Item `rotina-do-npc` de `docs/features-unicas-2026-09-24.json` (10 vozes da
torre: Duda, Fabi, Gui, Ana, Caio, Enzo, Bruno, mestre, ideias 8 — "cada NPC
tem um lugar por turno, até em outra cena, e ao tocar o apito todos vão para o
posto de uma vez").

## Decisão: o turno é um ESTADO DO MUNDO

O app já tem o relógio que falta: o estado do mundo (`docs/planos/estado-do-mundo.md`).
O mestre cria "Apito: Aurora, Meio, Brasa, Sombra" na seção "Estado do mundo" e
TOCAR O APITO é trocar o valor (um toque no rádio). A rotina da ficha se amarra
a esse estado do mesmo jeito que a porta se amarra à Maré. Assim a maré do
andar 0, que a bíblia também amarra aos apitos, e as rotinas andam no MESMO
toque, sem um segundo relógio para manter em acordo.

## Dado novo e onde mora

Na FICHA, no arquivo da cena (`types/map.ts`), campo opcional:

```
Token.rotina?: RotinaDoNpc
RotinaDoNpc   { estadoId: string            // o estado que manda ("Apito")
                postos: PostoDaRotina[] }   // um por valor, no máximo
PostoDaRotina { valor: string               // "Meio"
                sceneId: string             // a cena do posto (pode ser outra)
                x: number; y: number }      // o ponto, em px de mundo
```

- Mora na ficha porque anda com ela: quando o apito a leva a outra cena, a
  rotina vai junto (`transferToken` move a ficha inteira).
- Valor sem posto = "fica onde está" naquele turno.
- **Mapa antigo abre igual:** campo ausente continua ausente. `deserializeMap`
  confere a rotina (`rotinaDoArquivo`, `lib/rotinaDoNpc.ts`): sem `estadoId`,
  posto sem número finito, sem cena ou com valor repetido sai; rotina sem
  posto bom some e a ficha volta a ser a de sempre.

## Quem grava

- **O mestre, no painel da ficha** (`components/RotinaDaFichaControls.tsx`):
  "Rotina por" escolhe o estado; em cada valor, "Gravar aqui" grava a cena
  aberta e o lugar ATUAL da ficha (o mestre arrasta a ficha e grava), "Tirar"
  apaga o posto. É edição do mestre: entra no Ctrl+Z (`useMapStore.setTokenRotina`).
- **O apito** (`useAdventureStore.trocarEstadoDoMundo`): além das portas,
  pinos, zonas e luzes, planeja (`planejarRotina`) e move cada ficha com posto
  no valor novo — na mesma cena como mudança de MESA (`applyPlayerChange`, fora
  do Ctrl+Z, igual à porta que a maré abriu), para outra cena pelo
  `transferToken` de sempre. O aviso do painel conta as fichas que andaram.
- **Ficha que um jogador segura fica fora** (a dele ou a do ajudante
  emprestado): o App passa as fichas dos jogadores da sala e o apito não as
  arranca da mão de ninguém.

## O que o jogador recebe (e o que nunca recebe)

- Recebe só o EFEITO: a ficha do NPC aparece no novo lugar se estiver na visão
  dele, pelo recorte de sempre; some da cena dele quando vai para outra.
- **Nunca** recebe a rotina: nem os postos, nem a cena de cada posto, nem o id
  do estado ou os nomes dos turnos. O recorte (`lib/fogFilter.ts`) tira o campo
  de TODA ficha, inclusive da que ele segura; todo snapshot do host passa por
  esse recorte (`net/hostSession.ts`). O jogador de outra cena não recebe a
  posição do NPC que chegou lá longe dele.
- Testes de que não chega: `lib/fogFilter.rotina.test.ts` e
  `net/hostSession.rotina.test.ts`.

## O que fica para depois (pendências)

- Botão "Tocar apito" (próximo valor) e prévia "quem vai para onde" antes de
  aplicar; lista "quem está onde agora" com "Ir lá".
- Posto "fora de cena" (a ficha some até o próximo turno).
- Faixa do turno atual na tela do jogador (hoje o jogador não recebe o nome do
  turno, como não recebe nenhum estado do mundo).
- "Fixar" (NPC preso ou ferido fora da rotina) e atividade pública por turno
  ("servindo a sopa") no cartão da ficha.
- Cena fora do ar (`indisponivel`): o posto lá é pulado sem aviso.
- Rota andando (ronda por tique), colisão no caminho, silhueta "última vez visto".
