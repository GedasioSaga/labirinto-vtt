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
- Mover um passageiro sozinho é descer do veículo: ele sai da lista.
- Atravessar (pedido de viagem do jogador dono do veículo, "Deixar ir",
  "Levar para…", "Mandar para…") passa por `adventureStore.transferToken`: o
  veículo e cada passageiro saem juntos da cena de origem e chegam juntos na de
  destino, mantendo o afastamento que tinham em volta do veículo. Passageiro
  que atravessa sozinho sai da lista do veículo que ficou.

## O que o jogador recebe e o que nunca recebe

- Recebe: nada novo. Ele vê a própria ficha andar e trocar de cena pelo
  snapshot de sempre (a sessão acha a cena dele pela ficha que ele tem).
- Nunca recebe: o campo `veiculo`, nem os lugares, nem a lista de passageiros
  — o recorte (`lib/fogFilter.ts`) apaga o campo de toda ficha, a dele
  inclusive. A lista poderia entregar o id de uma ficha que a névoa, a zona
  oculta ou o mestre escondem. Prova em `lib/fogFilter.veiculo.test.ts` e, de
  ponta a ponta pela sessão, em `stores/veiculo.test.ts`.

## O que fica para depois

1. Mostrar ao jogador que ele está a bordo ("no cesto") e deixá-lo pedir para
   embarcar e descer pela tela dele — exige mensagem nova na rede e decidir
   se o pedido vai ao mestre.
2. Desenho do veículo no mapa (lugares ocupados, passageiros empilhados no
   veículo) — hoje o passageiro fica onde estava e anda junto.
3. Mover em grupo pela seleção de área (`lib/areaSelection.ts`) ainda não
   carrega quem está a bordo e não está na seleção.
4. O passageiro que chega pode cair numa parede do destino (o afastamento é
   mantido às cegas); assentar cada um numa casa livre em volta do veículo.
5. Veículo dentro de veículo (a carroça no navio) fica recusado.
