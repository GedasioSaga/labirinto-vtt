# Mobília desenhada nos cômodos (mobilia-desenhada-p)

Pedido: catre, mesa e baú desenhados no estilo do minimapa (chapado, linha
fina), escolhidos no editor; o jogador vê a silhueta. Origem: relatos 472
(Fabi) e 498 (Duda) do lote 5 da torre.

## Dado novo e onde mora

- `Prop.mobilia?: TipoMobilia` (`'catre' | 'mesa' | 'bau'`), em `types/map.ts`.
  O móvel é um **objeto comum** (`MapData.props`) com `src: ''` e o tipo dito:
  herda mover, girar, travar, "Oculto para jogadores", camada e seleção que o
  objeto já tem. Nada novo no nível da aventura.
- Campo **opcional**: mapa salvo antes abre igual (sem a chave). Na leitura
  (`deserializeMap`), valor fora do catálogo some e o objeto volta a ser
  objeto comum (sem derrubar o mapa).
- Catálogo, tamanho padrão em casas da grade e o glifo de cada tipo vivem em
  `lib/mobilia.ts` (função pura, testada sem Pixi).

## Quem grava

- O mestre, no painel da **sala selecionada**: seção "Mobília" com três
  botões (Catre, Mesa, Baú). O clique põe o móvel no centro da sala, com o
  tamanho padrão em casas da grade, e deixa o objeto selecionado para mover
  e girar pelos controles de sempre. Entra no desfazer como qualquer objeto.

## O que o jogador recebe

- Pelo recorte de sempre (`lib/fogFilter.ts`, `propForPlayer`, usado por
  `net/hostSession.ts`): geometria (posição, tamanho, rotação, camada) **e o
  tipo** do móvel, porque o tipo É o desenho que ele vê. Só o móvel que ele
  enxerga agora, fora de sala secreta, teto fechado, zona oculta, "Oculto para
  jogadores" e "Oculto no editor".
- A tela do jogador (`pixi/drawPropSilhouettes.ts`) pinta a silhueta chapada
  de sempre e, por cima, os traços finos do glifo (travesseiro do catre,
  tampo da mesa, tampa e fecho do baú), na cor do fio da parede, 1 px de tela.

## O que o jogador nunca recebe

- Móvel escondido (qualquer das regras acima): nem o id, nem o tipo.
- Imagem, mapa ligado, trava de edição e campo desconhecido do arquivo
  (continua a lista do que vai de `propForPlayer`).

## Núcleo desta entrega

1. Tipo + leitura de arquivo tolerante.
2. `lib/mobilia.ts`: catálogo, criação do móvel e glifo.
3. Recorte do jogador leva `mobilia` só no móvel visível (com teste de que o
   escondido não chega).
4. Tela do jogador e editor desenham o glifo (editor sem pedir imagem nem
   avisar "imagem não carregou").
5. Painel da sala: botões Catre / Mesa / Baú.

## Fica para depois

- Mais tipos (armário, estante, fogão, altar, tina, poço, cama, banco).
- Mobília "fixa" que entra na memória do jogador como planta estática (hoje
  some quando sai da visão atual, como todo objeto).
- Tocar no móvel abre o cartão/pino dele (texto do objeto).
- Gerador da torre pôr móveis por tipo de cômodo (fora de `client/src`).
- Trocar o tipo de um móvel já posto pelo painel do objeto.
- Espessura do glifo no editor acompanhando o zoom (hoje 1 px de mundo).
