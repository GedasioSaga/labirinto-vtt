# Fila de puzzles

Ordem saída de [REFERENCIAS.md](REFERENCIAS.md) (28/11/2026). Só a mecânica vem dos jogos; arte, nomes e textos são nossos.

## Feito

- **Painel em relevo** (28/11). Painel de metal com 3 a 6 placas faltando. As placas são itens do acervo (pasta "Peça de puzzle"); o mestre as espalha pelo mapa ou guarda num baú, e o jogador as leva na mochila até o painel. Cada vão só aceita a sua placa. A última placa destrava o desfecho de sempre (texto ou cena, item, moedas, documento) e pode abrir a porta ligada ao lugar. Seis cenas de fábrica (cavaleiro contra fera, dragão, navio na tempestade, leão coroado, serpente marinha, sol e lua) em bronze, ferro ou prata velha, ou uma imagem do mestre cortada nas mesmas placas.

- **Peças giratórias** (28/11). Um medalhão redondo na parede com 3 a 6 anéis, cada um um pedaço do mesmo desenho. O jogador gira os anéis (tocar gira um dente de 45 graus, arrastar gira para qualquer lado, a roda do mouse e as setas também) até o desenho fechar: uma das seis cenas do relevo, uma imagem do mestre ou, no modo Símbolos, o símbolo certo de cada anel sob a marca do aro. No modo difícil, cada anel leva os dois do lado no mesmo sentido. O começo é sorteado por giros de verdade, então sempre tem volta. Bronze, ferro, prata velha ou pedra. O último anel destrava o desfecho de sempre e pode abrir a porta ligada. Girar errado não castiga.

- **Interruptores com estado** (28/11). Um painel de latão ou ferro com 3 a 9 lampiões, cada um com a sua alavanca. Puxar uma alavanca vira o lampião dela e os ligados a ele. O mestre escolhe a ligação: os do lado, a linha e a coluna, ou a regra dele, clicando quem vira quem. O objetivo é todos acesos ou igual a um desenho, que pode ficar numa plaqueta do painel ou com o mestre, como pista. A alavanca desce e volta na mola; o lampião pisca, a chama pega e o clarão soma na chapa. O começo sai do alvo desfeito por puxadas de verdade, então sempre tem volta. O painel certo destrava o desfecho de sempre e pode abrir a porta ligada. Puxar não castiga. O fio leva só o estado dos lampiões (a regra e o começo ficam no mestre).

- **Cooperação em dois lugares** (28/11). Dois ou três pontos do mapa ligados ao mesmo puzzle. Em cada um há uma alavanca, uma placa de pressão ou o botão de um painel, de latão ou ferro, e um lampião. Acionar acende o lampião daquele ponto por uma janela que o mestre escolhe (2 a 30 s, padrão 5). Um anel em volta do mostrador esvazia com o tempo, e o puzzle cede quando todos os lampiões ficam acesos juntos. O ponto 1 é o lugar do desafio; os pontos 2 e 3 se marcam na ficha do desafio em Jogos (um ponto do mapa ou um objeto que já está lá) e viram selos próprios no mapa. O jogador entra pelo selo do ponto dele, e o host confere que a ficha alcança aquele selo, com a mesma régua do selo de sempre. O motor recusa outro ponto, e uma pessoa vale por um ponto só (acionar outro solta o de antes). Todos os que estão dentro veem os lampiões de todos os pontos e o nome de quem acionou, pela vista que o host já manda. No teste do editor, o mestre aciona todos. Acionar não castiga, e o desfecho é o de sempre, inclusive a porta ligada. Sem mexer no `net/protocol.ts`: o ponto viaja no id do selo (`<desafio>~p<n>`).

- **Mistura de líquidos** (28/11). Uma bancada com 2 a 5 jarras ou frascos de vidro numa prateleira, a torneira e a pia à esquerda e o receptáculo (funil, gargalo e visor) à direita, em latão ou ferro. Três modos: medir volumes (as jarras de 3 e 5 até 4 L), misturar cores (a tinta se mistura na proporção do que passou) e seguir a receita (itens do acervo que o grupo achou no mapa, num frasco de água). O jogador pega um recipiente (toque, arrasto ou Enter) e despeja noutro, na pia ou no receptáculo; Esc devolve. O alvo só se escolhe entre os que a busca do caminho mais curto alcança, então sempre tem solução, e o mestre vê o mínimo de passos e a solução passo a passo. Errar no receptáculo castiga e, pelo que o mestre escolher, derrama o que pôs ou faz a bancada recomeçar. Som de líquido sintetizado e uma inclinação curta ao verter, parada no movimento reduzido.

- **Sobrepor camadas** (28/11). Uma mesa de luz na parede: a figura se divide em 2 a 5 lâminas de vidro pintado, papel vegetal ou grade de ferro, e cada lâmina vira um item do acervo (pasta "Peça de puzzle", com o PNG dela) que o mestre espalha pelo mapa. O jogador leva as lâminas até a mesa (arrastar da mochila, com a mesa acesa na pausa, ou tocar na lâmina e depois na mesa), e a nova vai para o alto da pilha. Tocar num pedaço da figura escolhe a lâmina dele, e tocar de novo a gira; ao lado, a pilha lista as lâminas com Girar, Subir, Descer e Tirar (que devolve a quem pôs), e o teclado faz o mesmo (setas escolhem e giram, Alt com as setas muda a altura, Delete tira). O mestre escolhe a figura (farol, rosa dos ventos, chave, mariposa, um código de até 6 letras ou uma imagem dele), em quantas lâminas, e se a ordem e o giro importam. Quando a ordem importa, cada lâmina de baixo tem uma mancha que só a de cima certa cobre, então qualquer par trocado aparece. As lâminas pousam tortas (de 90 em 90 graus) e as marcas gravadas ficam em cantos sorteados, então nada entrega o giro. Tudo na mesa, de pé e na ordem sempre resolve; mexer não castiga. A figura fecha com um brilho e uma varredura de luz (só o brilho no movimento reduzido), e o desfecho é o de sempre, com a porta ligada. O fio leva a pilha e a forma do corte, nunca a semente nem os ids dos itens.

## Pendente nas camadas

- **Lâminas falsas** (uma a mais que não pertence à figura, para escolher). O pedido falava em "escolher e empilhar"; decisão do Claude em 28/11: ficou de fora para não haver lâmina que nunca serve no acervo; cabe como "lâminas a mais" no mesmo motor (a mesa recusaria a sobra).
- **Deslocar a lâmina** (transladar, além de girar). Hoje todas assentam no mesmo esquadro da mesa; só o giro e a ordem contam.
- **Reordenar arrastando na lista.** Hoje a ordem muda pelos botões Subir e Descer e por Alt com as setas.
- **O código e a imagem vão ao jogador.** A tela desenha a figura, então quem abrir as ferramentas do navegador consegue vê-la. Decisão do Claude em 28/11: é o mesmo caso da imagem do relevo; esconder pediria desenhar no host.
- **Itens novos a cada mudança.** Mudar a figura, o material, o corte ou as regras faz lâminas novas no acervo (as antigas ficam). Mesmo jeito do relevo.

## Pendente na mistura

- **Arrastar o item da mochila até o frasco.** Na receita, o item vai por toque (o item e depois o frasco) ou pelo teclado; o arrasto da mochila ainda só conhece encaixes e a bandeja.
- **A miniatura em Meus puzzles** ainda mostra o visual de base, não a bancada.
- **Despejar só um tanto** (meio a meio): hoje despejar vai até a origem esvaziar ou o destino encher, como no enigma clássico.

## Pendente na cooperação

- **A placa de pressão como presença contínua** (segura a porta enquanto a ficha está em cima). Hoje a placa é um gesto, como a alavanca: pisar acende o lampião pela janela. Decisão do Claude em 28/11: a presença contínua pede o host olhando a posição dos tokens a cada movimento, um caminho novo fora da tela do puzzle.
- **Arrastar os selos dos pontos 2 e 3 no mapa.** Hoje eles se marcam pela ficha ("Marcar no mapa" ou "Escolher objeto"). O selo do ponto 1 continua arrastável.
- **"Um lê o código num lugar, o outro digita noutro"** já dá para montar sem nada novo: um Documento no chão num lugar e uma Combinação no outro.

## Pendente nos interruptores

- **O fusível que falta como encaixe.** A ideia da fila juntava um encaixe ao painel. Decisão do Claude em 28/11: ficou de fora, porque o painel não usa a mochila. Hoje dá para encadear: um painel em relevo abre a porta e o painel de lampiões fica atrás dela.
- **Botões de apertar e disjuntores** no lugar das alavancas. O pedido dava os dois como exemplo; foram feitos alavanca e lampião. Cabem no mesmo motor, porque só a arte muda.
- **Castigo depois de N puxadas** e **o mestre montar o embaralho à mão.** Ficaram de fora pelo mesmo motivo das peças giratórias.

## Pendente nas peças giratórias

- **Alvo de toque com 5 e 6 anéis: resolvido em 28/11** sem mexer no desenho. Quando a faixa do anel medida na tela fica abaixo de 44 px, aparece ao lado do medalhão uma régua com dois botões de 44 px por anel. Apontar uma linha acende o anel dela.

- **Castigo depois de N giros.** Estava na ideia da fila; não entrou. Decisão do Claude em 28/11: o pedido do dono não pedia castigo e girar é tentativa e erro por natureza; se quiser, entra como "castigo a cada N giros" usando o castigo que já existe.
- **Grade de peças quadradas (2x2 a 4x4).** A fila falava de grade ou anéis; o pedido de 28/11 falava de anéis, discos e estátuas, e foram feitos os anéis. A grade cabe no mesmo motor (cada peça com 4 posições).
- **O mestre escolher o embaralho à mão.** Hoje o começo é sorteado (botão "Embaralhar de novo"); o quadro do editor mostra o começo e o resolvido.

## Pendente no painel em relevo

- **"Revela um pino" ao completar.** Hoje o painel abre a porta ligada, dá itens, moedas e documentos. Revelar um pino escondido precisa de um campo novo no Desafio (como o `portaLigada`) e de o host tirar o `hidden` do pino quando o puzzle resolve. Decisão do Claude em 28/11: ficou para depois, porque mexe no motor do host e no mapa, fora da tela do puzzle.
- **Placas de mesma cena e metal são as mesmas em todos os painéis.** Dois painéis do Dragão de bronze no mesmo mapa aceitam as placas um do outro. Decisão do Claude em 28/11: é o jeito mais simples para o mestre (uma pasta de placas por cena); se incomodar, o id da placa ganha o id do puzzle.

## Próximos (na ordem)

1. ~~Mistura de líquidos~~ ficou pronta em 28/11 (ver Feito).
2. ~~Sobrepor camadas~~ ficou pronta em 28/11 (ver Feito).
3. **Peças deslizantes.** É o próximo. A figura cortada numa grade de 3x3 a 5x5 com uma casa vazia; o jogador desliza as peças até ela fechar (RE2R). Esforço pequeno: reaproveita as figuras das camadas e as cenas do relevo, e o começo sai de deslizadas de verdade a partir da figura pronta, então sempre tem volta. Vários jogadores deslizam juntos, com a peça de cada um acesa.
4. **Sombra projetada.** Girar um recorte diante da lanterna até a sombra na parede virar a figura (RE7). Reaproveita o giro das peças giratórias.

Ficam para depois: empurrar estátuas (colisão no mapa), xadrez com regras, revelar com luz (mexe na névoa). Reflexo e tempo real ficam fora (mesa de RPG é por turno).
