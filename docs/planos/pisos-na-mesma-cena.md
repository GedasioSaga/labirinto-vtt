# Pisos dentro da mesma cena — plano curto

Pedido da torre (4 vozes; lote 1, itens 13, 42 e 50): hoje um prédio de vários
pisos é desenhado com os pisos LADO A LADO na mesma folha, e a escada é só
desenho (`types/map.ts`, `Stair` sem efeito; `PlayerView` só a pinta). O
jogador vê os outros pisos pela visão comum, a parede do piso de cima segura a
visão do piso de baixo quando empilhados, e a ficha não tem como subir.

## Dado novo e onde mora

- **`piso?: number`** (inteiro) em toda entidade do `MapData` que ocupa lugar:
  `Wall`, `Region`, `Token`, `Pin`, `Stair`, `Light`, `Prop`, `Drawing`,
  `FloorPiece`, `ConcealZone`, `MapLine`, `MapMarker` (interface `NoPiso`).
  **Ausente = piso 0 (térreo)**: mapa salvo antes abre idêntico, sem linha de
  migração, e continua tendo um piso só.
- **`Stair.levaAoPiso?: number`**: a escada liga o piso dela (`piso`) a este.
  Ausente = escada de enfeite, como hoje. A escada aparece nos DOIS pisos.
- `deserializeMap` passa tudo por `pisosDoArquivo` (`lib/pisos.ts`): só
  inteiro finito em [-99, 999] fica; o resto (texto, `NaN`, 1.5) SAI e a
  entidade volta ao térreo. O piso vai ao jogador, então lixo não atravessa.
- Lógica pura em `lib/pisos.ts`: `pisoDe`, `mapaDoPiso` (recorte de um piso,
  com cache por objeto de mapa), `pisoDoJogador`, `escadaDaFicha`.

## Quem grava

- **O mestre**: no painel da escada, "Leva ao piso"; no painel da ficha e da
  escada, "Piso". Gerador da torre escreve os campos direto no `map.json`.
- **O editor constrói no piso em edição** (`mapStore.pisoAtivo`, vista do
  mestre, fora do arquivo e do desfazer): tudo que um passo com histórico
  cria nasce nele (`nascemNoPiso`, dentro de `withHistory`), e o canvas
  desenha e mira só ele (`mapaDoPiso` em `sceneState`, `hitTestMap`, ímã,
  encaixe, sala-mãe, pino, zona, exportar imagem). Caminhos na tela: o
  seletor no canto do canvas (`PisoHud`, aparece quando a cena tem pisos),
  "Editar o 1º piso" na escada que liga pisos, e "Levar ao piso de cima/de
  baixo" para qualquer seleção (`comSelecaoNoPiso`: sala com paredes e
  sub-salas, ficha com a luz presa). "Ir até lá" dos Objetos do mapa troca
  para o piso do objeto.
- **O host**, quando o jogador toca "Subir/Descer" (`token.piso`): valida e
  devolve `applyPiso`; o integrador troca `token.piso` no mapa do mestre por
  `playerChanges` (fora do desfazer do mestre, como o movimento).
- **A travessia entre cenas** (`applyTransfer`): a ficha chega no piso do pino
  par (`AppliedTransfer.piso`); sem piso no pino, térreo.

## O que o jogador recebe

- O recorte (`filterMapForPlayer`) começa por `mapaDoPiso(map, pisoDoJogador)`:
  só entra o que é do piso da ficha dele (e a escada que chega nele). Visão,
  raycast, teto, zona e sala secreta já rodam sobre esse recorte.
- Piso do jogador = piso da primeira ficha que é olho dele (na ordem da
  posse); sem olho, da primeira ficha dele; sem ficha, térreo.
- **Memória separada por piso** (`hostSession`): explorado e portas lembradas
  têm uma chave por (cena, piso); a da ficha também. Piso 0 usa a chave de
  sempre, então a memória de hoje continua valendo.
- O movimento é validado só com as paredes do piso da ficha (no host e no
  arrasto do mestre no editor).
- Sinal e laser só chegam a quem está na mesma cena E no mesmo piso.
- Na tela: botão "Subir ao 1º piso" / "Descer ao térreo" quando a ficha dele
  está em cima de uma escada que liga pisos.

## O que ele NUNCA recebe

- Parede, sala, ficha, pino, luz, prop, desenho, chão, zona de outro piso —
  nem pela memória: explorado do térreo não abre o 1º piso.
- Posição de quem está em outro piso (ficha, sinal, laser).
- A lista de pisos da cena: só sabe do piso dele e do número que a escada
  visível mostra.

## Fica para depois

- Editor: ver o piso de baixo esmaecido sob o que se edita, "duplicar piso",
  piso secreto.
- Jogador com fichas em pisos diferentes: escolher qual piso ver (hoje: a
  primeira ficha que é olho).
- Corte rápido/animação e aviso "1º piso" ao trocar; faixa "onde estou".
- Escada que leva a um ponto diferente no outro piso (hoje: mesmo x,y).
- Reunir o grupo / Mandar para… escolhendo o piso de chegada (hoje: térreo
  ou o piso do pino).
- Espelho do jogador e exportar imagem por piso.
- Ajudante emprestado que segue o dono não sobe junto pela escada.
- O teto de 8 memórias por jogador (`MAX_SCENE_MEMORIES_PER_PLAYER`) conta
  cada piso como uma cena: prédio de 40 pisos esquece os mais antigos.
- Confronto: trocar de piso não gasta o passo da vez.
