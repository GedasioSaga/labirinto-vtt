# Fila de puzzles

Ordem saída de [REFERENCIAS.md](REFERENCIAS.md) (28/11/2026). Só a mecânica vem dos jogos; arte, nomes e textos são nossos.

## Feito

- **Painel em relevo** (28/11). Painel de metal com 3 a 6 placas faltando. As placas são itens do acervo (pasta "Peça de puzzle"); o mestre as espalha pelo mapa ou guarda num baú, e o jogador as leva na mochila até o painel. Cada vão só aceita a sua placa. A última placa destrava o desfecho de sempre (texto ou cena, item, moedas, documento) e pode abrir a porta ligada ao lugar. Seis cenas de fábrica (cavaleiro contra fera, dragão, navio na tempestade, leão coroado, serpente marinha, sol e lua) em bronze, ferro ou prata velha, ou uma imagem do mestre cortada nas mesmas placas.

- **Peças giratórias** (28/11). Um medalhão redondo na parede com 3 a 6 anéis, cada um um pedaço do mesmo desenho. O jogador gira os anéis (tocar gira um dente de 45 graus, arrastar gira para qualquer lado, a roda do mouse e as setas também) até o desenho fechar: uma das seis cenas do relevo, uma imagem do mestre ou, no modo Símbolos, o símbolo certo de cada anel sob a marca do aro. No modo difícil, cada anel leva os dois do lado no mesmo sentido. O começo é sorteado por giros de verdade, então sempre tem volta. Bronze, ferro, prata velha ou pedra. O último anel destrava o desfecho de sempre e pode abrir a porta ligada. Girar errado não castiga.

## Pendente nas peças giratórias

- **Castigo depois de N giros.** Estava na ideia da fila; não entrou. Decisão do Claude em 28/11: o pedido do dono não pedia castigo e girar é tentativa e erro por natureza; se quiser, entra como "castigo a cada N giros" usando o castigo que já existe.
- **Grade de peças quadradas (2x2 a 4x4).** A fila falava de grade ou anéis; o pedido de 28/11 falava de anéis, discos e estátuas, e foram feitos os anéis. A grade cabe no mesmo motor (cada peça com 4 posições).
- **O mestre escolher o embaralho à mão.** Hoje o começo é sorteado (botão "Embaralhar de novo"); o quadro do editor mostra o começo e o resolvido.

## Pendente no painel em relevo

- **"Revela um pino" ao completar.** Hoje o painel abre a porta ligada, dá itens, moedas e documentos. Revelar um pino escondido precisa de um campo novo no Desafio (como o `portaLigada`) e de o host tirar o `hidden` do pino quando o puzzle resolve. Decisão do Claude em 28/11: ficou para depois, porque mexe no motor do host e no mapa, fora da tela do puzzle.
- **Placas de mesma cena e metal são as mesmas em todos os painéis.** Dois painéis do Dragão de bronze no mesmo mapa aceitam as placas um do outro. Decisão do Claude em 28/11: é o jeito mais simples para o mestre (uma pasta de placas por cena); se incomodar, o id da placa ganha o id do puzzle.

## Próximos (na ordem)

1. **Interruptores com estado.** Chaves e disjuntores que acendem ou mudam os vizinhos até bater o alvo (`luzes: boolean[]` do PLANO §1.6). O fusível que falta é encaixe comum. É o próximo: segue o mesmo caminho das peças giratórias (um `futuro` novo, a ação de controle sem conferir a rev, o recorte só com o estado de cada luz).
2. **Cooperação em dois lugares.** Placas no mapa que só destravam com tokens em todas ao mesmo tempo. Usa o alcance e o lugar do Desafio; falta ler a posição dos tokens no host.
3. **Mistura de líquidos.** Recipientes com capacidade; passar de um para outro até a medida pedida. Uma tela, sem pressa.
4. **Sobrepor camadas.** Placas transparentes empilhadas até formar o desenho. Combina com o painel em relevo: as camadas também podem ser itens achados no mapa.

Ficam para depois: empurrar estátuas (colisão no mapa), xadrez com regras, revelar com luz (mexe na névoa). Reflexo e tempo real ficam fora (mesa de RPG é por turno).
