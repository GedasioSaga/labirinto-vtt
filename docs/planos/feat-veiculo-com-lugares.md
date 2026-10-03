# Veículo com N lugares — plano curto

Pedido: uma ficha-veículo (cesto, bote, vagonete) com capacidade de N lugares.
Quem embarca anda junto dentro da cena e atravessa o pino junto com o veículo.
Carregar ou escoltar é uma ficha levando outra; aqui é um recipiente com
limite. Aceite: o cesto leva o Gui e mais 1, recusa o 3º, e os dois chegam
juntos em a07.

## Dado novo e onde mora

- `types/map.ts`: `TokenVehicle { lugares, passageiros? }` e o campo opcional
  `Token.veiculo?`, na ficha que É o veículo. A lista `passageiros` guarda os
  ids das fichas a bordo, na ordem em que embarcaram.
- Mora no `MapData` da CENA (dentro do `tokens` dela), não na aventura: veículo
  e passageiros estão sempre na mesma cena, e a travessia leva o grupo inteiro
  de uma vez. Mapa solto também tem veículo.
- Regras puras em `lib/vehicle.ts` (sem store, sem DOM): ler do disco, lugares
  de 1 a 12, embarcar (recusa `cheio`, a própria ficha, outro veículo, ficha
  que não está na cena), desembarcar, mover o veículo com quem está a bordo e
  a lista de quem vai junto numa travessia.
- Campo opcional. `map.json` antigo abre sem veículo nenhum (`deserializeMap`
  não cria o campo); veículo malformado é descartado, e passageiro repetido,
  a própria ficha ou excesso acima dos lugares sai da lista sem derrubar o mapa.

## Quem grava

- Só o mestre, pela seção **Veículo** do painel da ficha: liga "Esta ficha é
  um veículo", escolhe os lugares e marca quem está a bordo. A lista mostra as
  fichas da cena; com o veículo cheio, quem está fora aparece desabilitado com
  "cheio". Cada clique passa pelo histórico (Ctrl+Z desfaz).
- Mover o veículo (arrasto do mestre, movimento do jogador dono dele, "Reunir")
  leva quem está a bordo pelo mesmo deslocamento, com as tochas presas.
- Mover um passageiro sozinho PELO MESTRE (arrasto, setas) é descer do
  veículo: ele sai da lista. Fica como antes de propósito: o arrasto do mestre
  é a mão dele tirando alguém do cesto, e o painel continua sendo o caminho
  certo para embarcar e desembarcar sem mexer na ficha.

## O jogador sobe, dirige e desce pela tela dele

- **Subir**: com a ficha dele encostada (`isNearVehicle`) num veículo que ele
  VÊ, aparece "Subir no veículo" na coluna das ações do lugar (`.pp-lugar`,
  junto da escada e do "Espiar"; `player/PlayerVeiculo.tsx`). Sobe na hora,
  sem o mestre: `vehicle.board { tokenId, vehicleId }`. O host
  (`handleVehicleBoard`) confere ficha dele, cena dele (fora do mapa-mundi),
  limite de frequência, cena sem pausa, "Volto já", travas do passo
  (cadeado, congelada, vez), o veículo no recorte de AGORA marcado como
  `embarcavel`, e decide no mapa do mestre com `boardVehicle` (perto, lugar).
  `cheio` e `longe` voltam em `vehicle.rejected` e viram "Veículo cheio" /
  "Chegue mais perto do veículo" no rodapé; ficha de outro ou veículo que ele
  não vê morrem em silêncio (responder ensinaria ids).
- **Motorista**: o primeiro a bordo (`driverOf` = `passageiros[0]`). O passo
  aceito da ficha dele vira o passo do VEÍCULO (`driveTarget`, mesmo
  deslocamento): a sessão manda `applyMove` com o id do veículo, e
  `setTokenPosition` leva todos a bordo mantendo o afastamento. O trajeto do
  veículo passa pela regra de parede/chão/borda do passo do mestre
  (`validateTokenMove` com `isHost`, a de `followStep`) — barrado, o passo
  inteiro é recusado com o motivo (ex.: "Parede no caminho"); passageiro que a
  parede barra fica e desce, como no arrasto do veículo. Veículo segurado ou
  congelado pelo mestre (ou ficha congelada a bordo) também segura. Quem vai
  a bordo não ocupa a casa para onde o grupo vai.
- **Passageiro que não dirige não anda**: o passo dele é recusado com
  `a_bordo` ("A bordo: desça para andar") e ele continua a bordo. Escolhido em
  vez de "anda e desce" porque andar sem querer derrubava o jogador do cesto
  sem aviso — a queixa original —, e em vez de "o passageiro também dirige"
  porque dois jogadores puxando o mesmo veículo brigariam pelo volante.
- **Descer**: "Descer do veículo" (`vehicle.leave { tokenId }`). Sai da lista
  e fica onde está; se estava em cima do veículo, vai para a casa livre mais
  perto (`disembarkSpot` em `lib/gatherParty.ts`, a regra de `gatherSpots`),
  contando só as fichas que ele vê. Se era o motorista, o próximo da lista
  assume sem regra extra.
- O integrador aplica `applyVehicle` fora do Ctrl+Z do mestre
  (`net/playerChanges.ts`, que confere `boardVehicle` de novo no mapa da hora)
  e faz o broadcast na hora (`net/hostBridge.ts`).
- Atravessar (pedido de viagem do jogador dono do veículo, "Deixar ir",
  "Levar para…", "Mandar para…") passa por `adventureStore.transferToken`: o
  veículo e cada passageiro saem juntos da cena de origem e chegam juntos na de
  destino, mantendo o afastamento que tinham em volta do veículo. Passageiro
  que atravessa sozinho sai da lista do veículo que ficou.

## O que o jogador recebe e o que nunca recebe

- Recebe a própria ficha andar e trocar de cena pelo snapshot de sempre, e
  duas marcas de FIO na ficha (`types/map.ts`, escritas só pelo recorte,
  descartadas por `deserializeMap`):
  - `aBordo: { motorista }` — só na ficha do DONO. A tela dele diz "No
    veículo · motorista" ou "No veículo" e oferece "Descer". Não diz em qual
    veículo nem quem mais vai; o colega que vê a ficha dele não recebe a marca.
  - `embarcavel: true` — no veículo que ele vê (nunca no vulto). É o que
    acende o "Subir" quando a ficha dele encosta.
- Nunca recebe: o campo `veiculo`, nem os lugares, nem a lista de passageiros
  — o recorte (`lib/fogFilter.ts`) apaga o campo de toda ficha, a dele
  inclusive. A lista poderia entregar o id de uma ficha que a névoa, a zona
  oculta ou o mestre escondem. O que vaza, e foi aceito: o passageiro sabe que
  há alguém antes dele na fila (não é motorista), sem saber quem. Prova em
  `lib/fogFilter.veiculo.test.ts`, `player/PlayerVeiculo.test.tsx` e, de ponta
  a ponta pela sessão, em `stores/veiculo.test.ts` e
  `stores/veiculoJogador.test.ts`.

## O que fica para depois

1. (Feito em 03/10/2026: ver "O jogador sobe, dirige e desce pela tela dele".)
   Sobra dele: o "Subir" não conhece a vez da iniciativa/confronto (o host
   recusa com "Espere sua vez"); o pedido de viagem do MOTORISTA atravessa só a
   ficha dele (desce do veículo), não o veículo inteiro.
2. Desenho do veículo no mapa (lugares ocupados, passageiros empilhados no
   veículo) — hoje o passageiro fica onde estava e anda junto.
3. Mover em grupo pela seleção de área (`lib/areaSelection.ts`) ainda não
   carrega quem está a bordo e não está na seleção.
4. O passageiro que chega pode cair numa parede do destino (o afastamento é
   mantido às cegas); assentar cada um numa casa livre em volta do veículo.
5. Veículo dentro de veículo (a carroça no navio) fica recusado.
