# Estado do mundo: um toque do mestre muda várias cenas

Item `estado-do-mundo` de `docs/features-unicas-2026-09-24.json` (7 vozes da torre:
Enzo "Giro troca portas e pinos", Ana "interruptores Maré/Registro/Freio/Giro",
Gui "chave de mundo", ideias 8 "Maré, Eixo e Energia", "estados da cena",
"mecanismo ligado entre cenas" e "mecanismo de N posições").

## O que o mestre ganha

Na lista de Cenas da aventura, a seção "Estado do mundo": o mestre cria um
estado com nome e valores ("Maré": alta, baixa) e troca o valor com um toque.
Portas, pinos de viagem, zonas ocultas e luzes AMARRADOS àquele estado, em
todas as cenas abertas da aventura, mudam juntos. O painel diz quantos elementos
mudaram e em quantas cenas.

**Amarrar é pelo painel de propriedades** (`components/DependeDoEstadoControls.tsx`):
com a porta, o pino de viagem, a zona ou a luz selecionados, "Depende do estado"
escolhe o estado e, para cada valor, o efeito ("Não muda" deixa o elemento como
está naquele valor). Ao escolher o estado, todo valor nasce com o efeito em que
o elemento está AGORA — amarrar não muda nada até o mestre dizer. O efeito do
valor atual vale na hora. Amarrar é edição do mestre: entra no Ctrl+Z
(`useAdventureStore.amarrarAoEstado` → `useMapStore.amarrarAoEstado`).

## Dado novo e onde mora

Duas metades, porque o estado cruza cenas e o efeito é de cada cena:

1. **A definição e o valor atual moram na AVENTURA** (`adventure.json`,
   `Adventure.estados?`, `lib/adventure.ts`):

   ```
   EstadoDoMundo { id: string      // estável; é o que o elemento cita
                   nome: string    // "Maré" — só do mestre
                   valores: string[] // ["alta", "baixa"], sem repetição, >= 1
                   atual: string }   // um de valores
   ```

2. **A regra "depende de" mora no ELEMENTO, no arquivo da cena** (`types/map.ts`):

   ```
   RegraDeEstado<E> { estadoId: string
                      efeitos: { valor: string; efeito: E }[] }
   DoorState.porEstado?  E = 'aberta' | 'fechada' | 'trancada'
   Pin.porEstado?        E = PinPassage ('pede' | 'livre' | 'trancada')
   ConcealZone.porEstado? E = 'oculta' | 'revelada'
   Light.porEstado?      E = 'acesa' | 'apagada'   (grava em Light.apagada?)
   ```

   Lista e não objeto: o valor é texto do mestre, e `efeitos["constructor"]`
   num objeto leria o protótipo.

- **Mapa e aventura antigos abrem iguais.** Os campos são opcionais; ausente
  continua ausente. `deserializeMap` e `parseAdventure` descartam a regra ou o
  estado tortos (arquivo editado à mão) em vez de derrubar o arquivo: regra sem
  `estadoId`, efeito desconhecido, valor repetido, `atual` fora da lista (volta
  ao primeiro valor).
- **Aplicar é GRAVAR o efeito.** Trocar o valor roda `aplicarEstadoNoMapa`
  (`lib/estadoDoMundo.ts`) em cada cena carregada e escreve `open/locked`,
  `passagem`, `revealed` e `apagada` de verdade. Luz apagada: o mestre vê só o
  marcador vazado, sem halo (`pixi/drawLights.ts`); o jogador não a recebe. Por isso colisão, névoa, validação de
  movimento e o host continuam lendo o campo de sempre — nenhum deles precisa
  conhecer o estado. Valor sem efeito para o elemento = o elemento não muda.
- **Quem grava:** só o mestre, pelo painel (`useAdventureStore.trocarEstadoDoMundo`).
  Na cena aberta entra como mudança de MESA (`applyPlayerChange`), nas de fundo
  por `applyPlayerChangeToBackgroundScene`: fora do Ctrl+Z, porque desfazer um
  traço de parede não pode destrancar a comporta que a maré fechou. A lista de
  estados marca a aventura como pendente de Salvar (`structureDirty`).
- O jogador abrir uma porta amarrada continua valendo até a próxima troca do
  estado, que a põe de volta no efeito do valor novo.

## O que o jogador recebe (e o que nunca recebe)

- Recebe **só o efeito**: a porta abriu, o pino passou a "livre", o preto da
  zona sumiu — pelos caminhos de sempre, com a névoa de sempre. Porta longe da
  visão continua com o estado lembrado (`seenDoors`): o jogador não vê a maré
  fechar uma comporta que ele não está olhando.
- **Nunca** recebe o nome do estado, os valores, o id do estado nem a regra:
  - porta: o recorte monta a porta por LISTA DO QUE VAI (`open`, `locked`,
    `kind`, `secret`), como já fazia com o pino (`lib/fogFilter.ts`);
  - pino: `pinForPlayer` já é lista do que vai — `porEstado` fica de fora;
  - zona: não sai no recorte (só a geometria do preto, `concealed`);
  - luz: apagada não sai; acesa sai por LISTA DO QUE VAI (`lightForPlayer`);
  - a aventura (e `estados`) nunca vai pela rede.
- Teste de que não chega: `lib/fogFilter.estadoDoMundo.test.ts` e
  `net/hostSession.estadoDoMundo.test.ts` (JSON do snapshot sem `porEstado`,
  sem o id, o nome e os valores do estado).

## O que fica para depois (pendências)

- Parede e peça de chão amarradas ("o chão virou água"); cor e raio da luz por valor.
- Texto do pino por valor ("quando Maré = baixa: descrição").
- Apagar e renomear estado; mapa solto (sem aventura) com estado.
- Cena que não abriu (`indisponivel`) não recebe a troca; ao consertar e abrir,
  ela fica no efeito gravado da última vez. Reaplicar o estado atual ao carregar.
- Mecanismo acionado pelo jogador (alavanca no cartão do pino, "Girar +1"),
  passo automático a cada N minutos, relógio da torre, eco sensorial por cena.
- Lista "o que mudou" com "Ir lá" por elemento.
