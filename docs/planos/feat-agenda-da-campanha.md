# Agenda da campanha — plano curto

Pedido: eventos datados (dia e apito) que, quando a hora da mesa chega, avisam
o mestre na Caixa (e, depois, aplicam um estado do mundo ou soam o alarme).
Aceite: "Disparo dos Gêmeos, dia 7, Meio" aparece na Caixa na hora certa e
nenhum texto vai ao jogador antes.

## Dado novo e onde mora

- `lib/agendaDaCampanha.ts`: `Apito` (`aurora | meio | brasa | sombra`, nessa
  ordem dentro do dia), `MomentoDaMesa { dia, apito }`,
  `EventoDaAgenda { id, titulo, quando, disparado? }` e
  `AgendaDaCampanha { agora, eventos }`.
- Mora na AVENTURA: `Adventure.agenda?` (`lib/adventure.ts`), gravado no
  `adventure.json`. Não mora no `MapData`: a agenda é da campanha, atravessa
  as cenas, e o `MapData` de cada cena é o que o host recorta para o jogador.
- Campo opcional. `adventure.json` antigo abre sem agenda (`parseAdventure`
  não cria o campo); agenda malformada é descartada e evento malformado sai da
  lista sem derrubar a aventura. O `map.json` não muda — mapa salvo antigo
  abre igual.

## Quem grava

- Só o mestre, pela seção **Agenda** do painel (aparece quando há aventura):
  marca evento (título, dia, apito), remove evento, e avança a hora da mesa
  ("Próximo apito", "Próximo dia").
- `useAdventureStore.setAgenda` troca a agenda e marca a lista de cenas como
  pendente de Salvar (`structureDirty`), como renomear cena. Fora do desfazer
  da cena aberta.
- Avançar a hora dispara, em ordem, todo evento ainda não disparado cujo
  momento já chegou (pular um dia inteiro dispara os do meio). Cada disparo vira
  um aviso no grupo "Agenda" da Caixa (`sempreEmCaixa`, sem prazo): o mestre
  dispensa quando leu. O evento fica marcado `disparado` e não dispara de novo.

## O que o jogador recebe e o que nunca recebe

- Recebe: nada, neste núcleo.
- Nunca recebe: título de evento, momento marcado, a hora da mesa nem que a
  agenda existe. A agenda vive no `Adventure`, e o host (`hostWorldOf`) só
  serve mapas de cena — prova em `agendaDaCampanha.test.ts`.

## O que fica para depois

1. **Relógio da mesa unificado.** Não há relógio de dia+apito na base
   (`auto/int-t-ideias`). O relógio que existe em outra linha
   (`auto/f2-relogio-dia-e-noite` / `auto/int-mundo`, `lib/campaignClock.ts`)
   conta HORA 0–23 com períodos manhã/tarde/noite, sem dia, e é estado de
   sessão (não vai ao arquivo). Aqui a hora da mesa é `agenda.agora`. Quando os
   dois se encontrarem, é decisão de produto qual é o relógio da mesa; a
   agenda só precisa de um `MomentoDaMesa` comparável e de "levar a hora a".
2. **Efeito "estado do mundo".** Depende de `auto/f2-estado-do-mundo`
   (`Adventure.estados`, `aplicarEstadoNoMapa`), fora desta base. Entra como
   `efeito?: { tipo: 'estado', estadoId, valor }` no evento.
3. **Efeito "alarme".** O alarme já existe (`hostBridge.sceneAlarm`); falta o
   evento carregar cenas + texto ao jogador e o App soar no disparo (texto ao
   jogador só no disparo, nunca antes).
4. Mapa solto (sem aventura) não tem agenda.
5. Editar evento já marcado (hoje: remover e marcar de novo) e voltar a hora.
