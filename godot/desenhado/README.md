# Estilo Desenhado: protótipo no Godot

Protótipo do estilo de textura **Desenhado** do Labirinto, feito no Godot 4.7.2 como
ferramenta de autoria. O Godot pinta tudo por shader e exporta PNG; o app só leria as
imagens. Este projeto não toca no app (`client/`).

Ele tem duas partes:

1. **A cena**: um pedaço de mapa visto de cima, na composição do protótipo do Fogo
   (`docs/design/objeto-fogo/prototipo.html`) e na paleta do Meio-Termo
   (`docs/design/vila-meio-termo/`). Casa aberta com assoalho e móveis (cama, cômoda,
   mesa com cadeiras, pratos, pão e caneca, tapete, barril, vaso), casa com telhado de
   telha e chaminé, grama com tufos e flores, caminho de terra, praça de lajes com
   barraca de toldo listrado, balcão com cestos de frutas, caixotes, barril, árvores
   (uma com frutas) e arbustos. Grade de 64 px por casa, igual à do app.
2. **O exportador**: grava as 5 texturas de chão (grama, terra, pedra, madeira, telha) em
   PNG que repete sem emenda, mais uma folha de contato para conferir as emendas.

Tudo usa semente fixa: abrir duas vezes dá a mesma imagem, byte a byte.

## O pacote Desenhado (fundação de 28/10/2026)

Por cima do protótipo, a fundação do pacote de verdade: uma pasta por textura, uma
biblioteca comum congelada, um comando que exporta UMA textura e monta a folha de
aprovação, e uma fila para vários designers rodarem o Godot ao mesmo tempo.

| Leia | Para quê |
|---|---|
| `INVENTARIO.md` | as 73 coisas que o Desenhado cobre, por onda, em lotes de 5 (na onda 4, os 31 móveis desenhados que pegam cor) |
| `ESTILO.md` | as regras de desenho (a crítica de 28/10), paleta, contorno, zooms |
| `CONTRATO.md` | arquivos de saída, a montagem contra repetição, teto de memória, critério de pronto |
| `PARA-OS-DESIGNERS.md` | o prompt de cada designer de textura |

```
godot/desenhado/
  comum/          CONGELADA: cabecalho/rodape.gdshaderinc (o molde do shader da textura),
                  mundo.gdshaderinc (hash e ruidoDoMundo do app), compor.gdshader (a mesa
                  de prova), contrato.gd, pintor.gd, mesa.gd
                  onda 2 (telhado, faixa, objeto; CONTRATO.md seção 8): telhado.gdshaderinc,
                  rodape_telhado/rodape_objeto.gdshaderinc, contrato_telhado.gd,
                  pintor_telhado.gd, mesa_telhado.gd
                  onda 3 (carimbo, trecho; CONTRATO.md seção 9): carimbo.gdshaderinc,
                  rodape_carimbo.gdshaderinc, contrato_carimbo.gd, pintor_carimbo.gd,
                  mesa_carimbo.gd
                  onda 4 (móvel desenhado que pega cor; CONTRATO.md seção 10):
                  movel.gdshaderinc, rodape_movel.gdshaderinc, contrato_movel.gd,
                  pintor_movel.gd, mesa_movel.gd; o caminho "só materiais", reprovado
                  em 29/10 e sem uso: material.gdshaderinc, rodape_material.gdshaderinc,
                  contrato_material.gd, pintor_material.gd, mesa_material.gd
  texturas/<id>/  do designer: textura.gdshader + config.json (_modelo/ é o ponto de partida,
                  grama/ é o piloto; na onda 2, telhado-telhas/ é o piloto e _modelo-objeto/
                  e _modelo-faixa/ os modelos; na onda 3, arvore/ é o piloto e
                  _modelo-carimbo/ e _modelo-trecho/ os modelos; na onda 4,
                  movel-mesa/, movel-cadeira/ e movel-barril/ são o piloto e
                  _modelo-movel/ o modelo; material-madeira/ é o caminho reprovado)
  exportado/<id>/ gerada: base-1..3.png, detalhes.png, textura.json (vai para o git; o
                  .gdignore de exportado/ esconde a pasta do editor do Godot)
  prova/<id>/     gerada: folha.png e peças (fora do git; o padrão quando não se passa --prova)
  scripts/exportar_uma.gd, scripts/folha_do_lote.gd, scripts/folha_do_lote_telhados.gd,
  scripts/folha_do_lote_carimbos.gd, scripts/folha_do_lote_moveis.gd,
  scripts/folha_do_lote_materiais.gd (do caminho reprovado)
  ferramentas/atual.ts   pinta o Atual (a textura de hoje do app) com o código de client/src
  ferramentas/telhado.ts monta o telhado Desenhado com as águas do app (a referência da
                         seção 8 do CONTRATO.md) e o Atual com o pintarTelhado de hoje
  ferramentas/carimbo.ts + carimbo_pagina.ts  a mesa dos carimbos e trechos no Chromium do
                         Playwright: o Desenhado pela conta da seção 9 (a referência para o
                         app) e o Atual com o assarDesenho e o criarSpray de hoje
  ferramentas/material.ts + moveis.ts + png.ts + construir.mjs  a mesa dos móveis: o
                         esbuild empacota o motor dos móveis do client da main (só leitura) e
                         troca a superfície da classe pela do Desenhado (material.ts, a
                         referência da seção 10 para o app); o Atual é o mesmo motor sem troca
  ferramentas/movel.ts + mesa_movel.ts  a mesa dos móveis desenhados: movel.ts é a conta
                         de referência da seção 10 para o app (tingir por parte, virada,
                         esticar, sombra); mesa_movel.ts pinta o Desenhado com ela e o Atual
                         com o motor dos móveis da main, e a cena de família da onda 3
```

### Fila do Godot (obrigatória)

Vários agentes rodando o Godot juntos no mesmo projeto podem estragar o cache `.godot/`.
**Toda** chamada ao Godot deste projeto passa pela fila (a mesma `suite-lock.cjs` das
suítes, com uma pasta de trinco só do Godot):

```
GODOT="C:/Users/gedasio.filho/AppData/Local/Microsoft/WinGet/Packages/GodotEngine.GodotEngine_Microsoft.Winget.Source_8wekyb3d8bbwe/Godot_v4.7.2-stable_win64_console.exe"
export SUITE_LOCK_DIR=C:/Users/gedasio.filho/.claude/state/godot-lock
node C:/Users/gedasio.filho/.claude/scripts/suite-lock.cjs --nome <id> -- "$GODOT" --path C:/dev/labirinto-desenhado/godot/desenhado --script res://scripts/exportar_uma.gd -- --textura=<id> [--folha] [--prova=<pasta>] [--mapa=<map.json>]
node C:/Users/gedasio.filho/.claude/scripts/suite-lock.cjs --status    # quem está rodando e quem espera
```

Conferido em 28/10: duas exportações lançadas juntas, a segunda esperou 11 s ("fila 2 de 2")
e as duas saíram com 0.

### O editor e o MCP do Godot

As ferramentas `mcp__godot__*` falam com **um** editor aberto neste projeto (porta 6505),
compartilhado por todos. As regras de uso entre vários designers (o que é livre, o que
precisa da "vez do editor", o que nunca) estão em `PARA-OS-DESIGNERS.md`. Para o editor não
brigar com a fila nem sujar o git:

- o exportador grava `.gdignore` em `exportado/` e em `prova/`: o editor não importa esses
  PNGs (sem `.import` ao lado deles e sem reimportar enquanto a fila regrava);
- os `.uid` que o editor cria ao lado de cada script e shader estão no `.gitignore` (o
  projeto referencia tudo pelo caminho);
- o `project.godot` está no formato que o editor grava (na primeira abertura, em 28/10, ele
  tirou o comentário do topo e a linha `window/stretch/mode`, que era o valor padrão; essa é
  a versão do git), então abrir o editor de novo não o altera.

Conferido em 28/10 com o editor aberto: a exportação da grama pela fila saiu com 0 e os
mesmos números de antes, nenhum `.import` apareceu, e o `git status` só ganhou os `.uid`
(agora ignorados) e aquela reescrita do `project.godot`.

### Exportar UMA textura e montar a folha

`scripts/exportar_uma.gd` (opções no topo do arquivo):

- `--textura=<id>` lê `texturas/<id>/`, confere o `config.json`, pinta as bases e o atlas e
  grava em `exportado/<id>/` (ou `--saida=<pasta>`), com o `textura.json`. Recusa a textura
  que passa do teto de memória.
- `--folha` monta a folha de aprovação a partir dos arquivos gravados, do jeito que o app
  vai montar (`comum/compor.gdshader`): a área de 40 x 40 casas a 50% e a 100%, um close a
  300%, os arquivos, o Atual ao lado e a medida de repetição. Grava em `prova/<id>/` (ou
  `--prova=<pasta>`).
- `--mapa=<map.json>` usa o chão de um mapa real (só leitura): acha a janela de 40 x 40
  casas em que a textura mais aparece e pinta o resto de cinza. Exige `--prova` fora do repo.

**Não é `--headless`:** no modo headless o Godot não desenha quadro nenhum; a espera pelos
SubViewports não acaba (conferido em 28/10: parado à força depois de 90 s). Sem ele, uma
janela pisca uns segundos e fecha. Se o script travar (erro no meio de uma espera), ele sai
sozinho em 180 s com o código 3, para não prender a fila.

`scripts/folha_do_lote.gd --texturas=a,b,c,d,e --prova=<raiz> --saida=<arquivo.png>` junta
as folhas de até 5 texturas numa folha só, para a aprovação do lote.

O Atual sai de `ferramentas/atual.ts`: o exportador empacota com o esbuild do repositório
(`node_modules/esbuild`) e roda com o Node; é o chão do Meio-Termo sem manchas, pintado pelo
mesmo `pintarPedaco` que o app usa.

## Abrir a cena

```
"C:/Users/gedasio.filho/AppData/Local/Microsoft/WinGet/Packages/GodotEngine.GodotEngine_Microsoft.Winget.Source_8wekyb3d8bbwe/Godot_v4.7.2-stable_win64.exe" --path "C:/dev/labirinto-desenhado/godot/desenhado"
```

O projeto abre direto na cena (`res://cenas/main.tscn`). Para abrir no editor do Godot,
acrescente `-e` ao comando.

| Ação | Como |
|---|---|
| Mover o mapa | arrastar com o botão esquerdo ou o do meio |
| Zoom no ponto do mouse | roda do mouse (35% a 300%) |
| Zoom no meio da tela | `+` e `-` |
| Voltar ao enquadramento inicial | `0` ou `Home` |
| Mostrar a grade | `G` ou o botão **Grade** do painel |
| Exportar as texturas | botão **Exportar texturas** do painel; depois **Abrir a pasta** |

O painel fica no canto de baixo à direita, em cima das lajes da praça, e mostra o zoom
atual.

### Print pela linha de comando

Use o executável `_console` (ele escreve no terminal) e passe as opções depois do `--`:

```
".../Godot_v4.7.2-stable_win64_console.exe" --path "C:/dev/labirinto-desenhado/godot/desenhado" res://cenas/main.tscn -- --print=C:/caminho/cena.png
```

| Opção | O que faz |
|---|---|
| `--print=<arquivo.png>` | tira o print da janela (1280 x 800) e fecha |
| `--zoom=0.8` | zoom do print |
| `--centro=12.4,7.45` | centro do print, em casas |
| `--grade` | liga a grade |
| `--sem-painel` | esconde o painel |
| `--clicar-exportar` | antes do print, clica de verdade no botão **Exportar texturas** (evento de mouse) e espera o resultado aparecer no painel; sai com código 1 se a exportação falhar |

## Exportar as texturas

Pelo botão da cena ou pela linha de comando:

```
".../Godot_v4.7.2-stable_win64_console.exe" --path "C:/dev/labirinto-desenhado/godot/desenhado" res://cenas/exportar.tscn -- [opções]
```

| Opção | Padrão | O que faz |
|---|---|---|
| `--saida=<pasta>` | `exportado/` do projeto | onde gravar os PNGs |
| `--folha=<arquivo.png>` | nenhum | grava também uma cópia da folha de contato |
| `--periodo=512` | 512 | período em px do mundo, múltiplo de 512 (512 = 8 casas; pedra e telha só fecham a cada 8 casas) |
| `--escala=1` | 1 | 1 = 64 px por casa; 2 = 128 px por casa (imagem 2x maior), até 4 |
| `--semente=7` | 7 | outra semente, outro desenho (sempre o mesmo para a mesma semente) |

Ele grava em `exportado/`:

- `grama.png`, `terra.png`, `pedra.png`, `madeira.png`, `telha.png`: 512 x 512 px cada
  (8 x 8 casas), RGB, repetem sem emenda nos dois sentidos.
- `folha-de-contato.png`: em cima, cada textura repetida 2 x 2 a 50%; embaixo, a 100%, o
  encontro das quatro cópias, que é onde uma emenda apareceria.

No terminal sai também a medida da emenda de cada textura: a diferença entre a última e a
primeira coluna (e linha) dividida pela diferença média entre colunas vizinhas do miolo.
Perto de 1 quer dizer que a borda não se destaca. A pedra dá cerca de 1,7 porque a borda
do ladrilho cai de propósito numa junta entre lajes (a junta é mais escura que a laje);
o recorte a 100% na folha mostra que não há degrau.

## O que é cada arquivo

| Arquivo | O que é |
|---|---|
| `project.godot` | projeto (renderizador Compatibility/OpenGL 3.3, janela 1280 x 800, cena inicial) |
| `cenas/main.tscn` + `scripts/main.gd` | a cena: monta o mapa em código, em casas (posições, camadas, paleta), a câmera, o painel e o print pela linha de comando |
| `scripts/camera_mapa.gd` | câmera: arrastar, zoom no mouse com assentamento de ~150 ms, teclas, limites |
| `scripts/painel.gd` | painel: grade, exportar, resultado, abrir a pasta, zoom; tema escuro da bancada dos protótipos |
| `cenas/exportar.tscn` + `scripts/exportar.gd` | exportador de linha de comando (lê as opções e chama o exportador) |
| `scripts/exportador.gd` | pinta as 5 texturas, mede a emenda e monta a folha de contato |
| `shaders/base.gdshaderinc` | paleta, sorteio por casa (hash), ruído periódico, antisserrilhado, contorno, grão de papel, pincelada |
| `shaders/materiais.gdshaderinc` | os 5 materiais: grama (tufos e flores), terra (manchas, areia, seixos), pedra (lajes com junta, musgo e trinca), madeira (tábuas, veio, nó, prego), telha (escama) |
| `shaders/textura.gdshader` | um material num retângulo: no exportador, coordenada = UV x período; na cena, posição no mundo |
| `shaders/chao.gdshader` | o chão da cena: grama, caminho de terra que ondula e praça, com borda, sombra e tufos por cima da borda |
| `shaders/peca.gdshader` | móveis e objetos retangulares ou redondos (tábuas, linho, tapete, caixote, colcha, reboco, almofada, pedra lavrada, prato, caneca, pão, cesto de frutas) com chanfro, contorno e sombra |
| `shaders/arvore.gdshader` | árvore e arbusto vistos de cima: copa em lobos com luz, cachos de folha, sombra entre lobos e no chão, frutas |
| `shaders/barril.gdshader`, `barraca.gdshader`, `telhado.gdshader` | barril, toldo listrado da barraca, telhado de duas águas com cumeeira e chaminé |
| `shaders/grade.gdshader` | grade de 1 px de tela a cada casa |
| `exportado/` | as texturas exportadas (o exportador regrava) |

Regras do desenho que todos os shaders seguem: luz de cima à esquerda, sombra para baixo
à direita, contorno na própria cor escurecida (x 0,6), grão de papel leve, nada de preto
puro. A paleta está no topo de `base.gdshaderinc` e repete os tokens do Meio-Termo.

## Como o exportador funciona

1. Para cada material, cria um `SubViewport` do tamanho exato da imagem
   (`período x escala`) com um retângulo que usa `shaders/textura.gdshader`.
2. O shader recebe a coordenada `UV x período`. Todo ruído e todo sorteio usam células
   "embrulhadas" no período (`ruido_p`, `hash_cel` com módulo), então a coluna 512 é a
   coluna 0: a imagem repete sem emenda por construção, não por borrão na borda.
3. Espera dois quadros desenhados, lê a imagem da placa de vídeo, converte para RGB e
   salva o PNG.
4. Mede a emenda e monta a folha de contato.

A cena usa os mesmos materiais, mas na posição do mundo, e a grama da cena ainda varia
devagar ao longo do mapa (um ruído de período bem maior), para não se ver a repetição de 8
em 8 casas. O PNG exportado não tem essa variação: repete a cada 8 casas.

## Como as imagens entrariam no Labirinto depois (não implementado)

Nada disto foi feito; é o caminho provável, a partir de uma leitura rápida de
`client/src/pixi/drawTexturas.ts`:

- O app já pinta o chão com `TilingSprite` (ladrilho em potência de 2 com mipmap). Os PNGs
  daqui têm 512 x 512, potência de 2, então entram no mesmo mecanismo.
- O estilo já é escolhido por mapa (`lib/estiloDoMapa`, hoje com o Meio-Termo). O
  Desenhado seria mais uma opção; com ele ligado, o catálogo de texturas
  (`texturas/catalogo`) devolveria o PNG do material em vez do ladrilho gerado em código.
- A escala tem de casar: 1 px da imagem = 1 px do mundo a 64 px por casa, ou seja, um
  ladrilho cobre 8 x 8 casas. Para zoom alto, exportar com `--escala=2` (1024 x 1024).
- Os PNGs iriam como arquivos do app ou num pacote baixado à parte, como o pacote de
  animações. Isso é decisão a tomar antes de integrar.
- Objetos (árvore, barril, barraca, móveis) aqui são shader. Para o app seriam imagens
  exportadas uma a uma, o que este exportador ainda não faz.

## Verificado e não verificado

Verificado nesta máquina (Windows 11, NVIDIA RTX 3050 Laptop, OpenGL 3.3):

- A cena abre e desenha sem erro no console; prints a 80% e a 150% conferidos a olho.
- O exportador grava os 5 PNGs e a folha de contato (cerca de 1 s) e a folha não mostra
  emenda no encontro das quatro cópias.
- O botão **Exportar texturas**, com um clique simulado por evento de mouse
  (`--clicar-exportar`): exportou os 6 arquivos e o painel mostrou o resultado e
  **Abrir a pasta**.
- Dois prints seguidos da cena saem idênticos byte a byte (semente fixa).

Não verificado:

- Arrastar, zoom com a roda, teclas e gestos do touchpad com a mão de uma pessoa: só
  vi a cena por prints da linha de comando.
- O botão **Abrir a pasta** (abre o Explorador) e a grade ligada pelo painel.
- Outras placas de vídeo e drivers, e o renderizador Forward+ ou Mobile.
- Exportação com `--escala` 2 a 4 conferida a olho, e sementes diferentes de 7.
- O protótipo não tem a chave "Atual x Desenhado": um "Atual" honesto exigiria as
  texturas reais do app (Meio-Termo, geradas em TypeScript), e uma imitação daria uma
  comparação enganosa.
- Nada foi integrado ao app nem testado dentro dele.
