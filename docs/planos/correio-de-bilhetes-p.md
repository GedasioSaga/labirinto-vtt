# Correio de bilhetes — plano curto

Pedido da torre (11 vozes, `correio-de-bilhetes` em
`docs/features-unicas-2026-09-24.json`): o jogador escreve um bilhete a um
colega por tubo, pombo ou cápsula, e o mestre, que faz o papel de carteiro,
entrega, atrasa, lê ou intercepta. Hoje o jogador não tem mensagem nenhuma
para escrever (`PlayerMessage` em `net/protocol.ts`): nas rodadas 2 e 10 as
cápsulas e os bilhetes passaram por voz ou por WhatsApp, e quem estava fora do
ar perdeu o recado.

## Dado novo e onde mora

- **O bilhete em trânsito fica na sessão do host** (`pendingLetters` em
  `createHostSession`, uma entrada por bilhete com remetente, destinatário,
  meio, texto e hora). É memória de sessão, igual ao pedido de passagem e ao
  caderno de recados, e não fica gravada em arquivo. O id de jogador só existe
  enquanto a sala está aberta.
- **O bilhete entregue entra no caderno de recados de quem recebe**
  (`notebooks`, o mesmo caderno do recado por cena). `NoteEntry` e
  `scene.note` ganham dois campos opcionais: `from` (nome na sala de quem
  escreveu) e `via` (`tubo` | `pombo` | `capsula`). Um recado sem os dois
  campos continua sendo recado do mestre.
- **`MapData` e a aventura não mudam.** Nenhum campo novo no arquivo, e
  `deserializeMap` segue igual, então mapa salvo antigo abre como sempre.
- Tetos (`lib/correio.ts`): texto de até 280 letras, no máximo 3 bilhetes do
  mesmo jogador esperando o mestre, e um intervalo mínimo de 3 s entre dois
  envios.

## Quem grava

- **O jogador** escreve no Painel > Jogo > "Bilhete": escolhe o colega pelo
  nome na sala (`letter.peers`), o meio (tubo, pombo ou cápsula) e o texto
  (`letter.send`). O host confere se ele joga, se o colega existe, se o texto
  cabe e se ele não passou do teto. A resposta é `letter.send.result`.
- **O mestre** recebe um aviso que só some quando ele responde, no grupo
  "Bilhetes": `Caio → Ana, pelo pombo: "texto"`. O aviso tem dois botões:
  - **Entregar**: `session.deliverLetter` põe o bilhete no caderno de quem
    recebe. Se essa pessoa estiver jogando, ela recebe o cartão na hora.
  - **Interceptar**: `session.interceptLetter` faz o bilhete nunca chegar. O
    × do aviso vale o mesmo.
  - **Ler**: o texto inteiro já aparece no próprio aviso.
  - **Atrasar**: basta não responder. O aviso fica na tela até o mestre
    decidir.
- Se o destinatário for expulso, os bilhetes para ele morrem e o aviso some.

## O que o jogador recebe

- **Quem escreve**: a lista dos nomes na sala, sem si mesmo e sem nada mais.
  Depois do envio, a confirmação "Saiu pelo pombo. Quem entrega é o mestre."
  Nunca fica sabendo se o bilhete foi entregue ou interceptado: isso é do
  mestre contar.
- **Quem recebe**: o cartão "Bilhete de Caio, pelo pombo" com o texto, que
  fica guardado no Caderno. Se não estiver jogando na hora, o bilhete chega
  pelo caderno (`notes.book`) quando essa pessoa entrar ou voltar.

## O que o jogador NUNCA recebe

- A cena, o nome da cena ou a posição de quem escreveu ou de quem vai receber.
  A lista de colegas traz só nomes, e o bilhete traz só nome, meio, texto e
  hora.
- Bilhete que ainda espera o mestre, ou que foi interceptado. Nada disso sai
  do host.
- Bilhete endereçado a outra pessoa. Só o destinatário recebe, e nenhum
  snapshot carrega bilhete.
- Nada disso passa pelo mapa (`lib/fogFilter.ts`). O recorte do bilhete fica
  todo em `net/hostSession.ts`, e o teste
  `hostSession.correio.test.ts` prova que o que fica escondido não chega a
  ninguém.

## Fica para depois (pendências)

- **Canal por pino** ("posta": o pino de viagem marcado como tubo ou pombal).
  O jogador só poderia mandar dali, o bilhete apareceria no pino par e quem
  passasse por lá poderia interceptá-lo. Hoje o meio é escolhido pelo jogador,
  vale de qualquer lugar e serve só de sabor.
- "Entregar depois do próximo toque ou apito", que depende do relógio do jogo,
  e "Reescrever antes de entregar", que pede um editor de texto no aviso.
- Aviso ao remetente quando o bilhete se perde ("O pombo não voltou"), como
  opção do mestre.
- Mandar objeto junto (depende do item pegável).
- Bilhete deixado no lugar, lido por quem passar, que é outra feature.
- Bilhetes em trânsito sobreviverem a fechar e reabrir a sala.
- Nomes dos colegas pelo nome público do personagem em vez do nome na sala
  (depende do `characterId` da feature "continuar a campanha").
