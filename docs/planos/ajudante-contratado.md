# Ajudante contratado — plano curto

Pedido da torre (8 vozes: Duda, Fabi, Gui, Caio, Enzo, Bruno, Ana e o mestre):
o mestre empresta um NPC a um jogador com tarefa e prazo; a ficha segue o
jogador e volta sozinha ao mestre quando o acordo acaba.

Hoje só existe `assignToken` (`net/hostSession.ts`): a ficha vira do jogador
em tudo. Três defeitos saem disso e o núcleo fecha os três:

1. toda ficha possuída gera visão (`lib/fogFilter.ts`), então o ajudante vira
   um olho remoto do jogador;
2. o jogador lê o nome de TRABALHO do NPC ("Capataz traidor"), porque o dono
   sempre recebe `name`;
3. o jogador renomeia e troca a foto do NPC (`handleTokenEdit` só confere a posse).

## Dado novo e onde mora

- **O acordo mora na sessão do host, junto da posse** (`loans` em
  `createHostSession`, por id da ficha: jogador, tarefa, fim, visão). A posse
  (`ownership`) já é memória de sessão, sem arquivo; o acordo não pode durar
  mais que a posse que ele descreve. Id de jogador só existe com a sala aberta.
- **`MapData` ganha só o campo de fio `Token.contrato?`** (`types/map.ts`):
  `{ tarefa, ate, visao }`. É como o jogador que segura a ficha lê o acordo.
  O mapa do mestre nunca o grava: `deserializeMap` descarta o campo se um
  arquivo trouxer (editado à mão), e o recorte apaga qualquer `contrato` que
  venha do mapa do mestre antes de pôr o da sessão.
- Mapa salvo antigo abre igual: o campo é opcional e ninguém o escreve.

## Quem grava

- **O mestre**, no painel Sala, card do jogador: "Emprestar como ajudante",
  com ficha, tarefa (texto curto), prazo ("até eu tirar" ou N minutos) e
  "vê com os olhos dele" (desligado por padrão). Vira `hostBridge.lendToken`
  → `session.lendToken`.
- **O host devolve sozinho**: `expireDue` roda em todo `broadcast` e em toda
  mensagem de jogador; a ponte arma um `setTimeout` no prazo mais próximo
  (`nextLoanDeadline`) para o broadcast sair na hora mesmo sem ninguém mexer.
- "Remover" e "Atribuir" (posse permanente) desfazem o acordo; o kick também.

## O que o jogador recebe

- A ficha do ajudante em "Meus personagens", com a marca
  "Ajudante · tarefa · até 21:30" (ou "até o mestre retomar").
- O nome PÚBLICO do NPC (o mesmo que a mesa lê), nunca o de trabalho.
- Visão pelos olhos do ajudante **só** se o mestre marcou.
- Quando o prazo vence: um recado no caderno, "Tiziu voltou ao mestre: o
  acordo acabou." — só para quem segurava a ficha.

## O que o jogador NUNCA recebe

- O acordo de ficha que não está com ele (o colega que vê o Tiziu não lê
  tarefa nem prazo).
- Visão, cartão de texto de Sala ou teto aberto por um ajudante sem olhos.
- O nome de trabalho do NPC emprestado.
- Qualquer `contrato` gravado no mapa do mestre.

## Fica para depois (pendências)

- Ajudante atravessa o pino junto com o dono (hoje só a ficha mais perto do
  pino viaja).
- Ajudante em OUTRA cena na lista do jogador (hoje o painel só lista as fichas
  do mapa aberto) e a cena do jogador quando só o ajudante está nela.
- Prazo ligado ao relógio do jogo ("até o apito", "até a Sombra") e ao turno
  do confronto; hoje o prazo é em minutos do relógio do mestre.
- Coleira de distância, modo "só recebe ordem", "conta ao voltar" (relato),
  pedido "chamar de volta / nova ordem" pela Caixa de Pedidos, preço.
- Acordo sobreviver a fechar e reabrir a sala (depende do `characterId` da
  feature "continuar a campanha").
