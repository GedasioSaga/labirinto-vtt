# Fila de puzzles

Ordem saída de [REFERENCIAS.md](REFERENCIAS.md) (28/11/2026). Só a mecânica vem dos jogos; arte, nomes e textos são nossos.

## Feito

- **Painel em relevo** (28/11). Painel de metal com 3 a 6 placas faltando. As placas são itens do acervo (pasta "Peça de puzzle"); o mestre as espalha pelo mapa ou guarda num baú, e o jogador as leva na mochila até o painel. Cada vão só aceita a sua placa. A última placa destrava o desfecho de sempre (texto ou cena, item, moedas, documento) e pode abrir a porta ligada ao lugar. Seis cenas de fábrica (cavaleiro contra fera, dragão, navio na tempestade, leão coroado, serpente marinha, sol e lua) em bronze, ferro ou prata velha, ou uma imagem do mestre cortada nas mesmas placas.

## Pendente no painel em relevo

- **"Revela um pino" ao completar.** Hoje o painel abre a porta ligada, dá itens, moedas e documentos. Revelar um pino escondido precisa de um campo novo no Desafio (como o `portaLigada`) e de o host tirar o `hidden` do pino quando o puzzle resolve. Decisão do Claude em 28/11: ficou para depois, porque mexe no motor do host e no mapa, fora da tela do puzzle.
- **Placas de mesma cena e metal são as mesmas em todos os painéis.** Dois painéis do Dragão de bronze no mesmo mapa aceitam as placas um do outro. Decisão do Claude em 28/11: é o jeito mais simples para o mestre (uma pasta de placas por cena); se incomodar, o id da placa ganha o id do puzzle.

## Próximos (na ordem)

1. **Peças giratórias.** Grade de 2x2 a 4x4 (ou 3 anéis) com a imagem cortada; clicar gira a peça 90 graus; destrava com todas na orientação certa. Reaproveita a ação `girar` das rodas da Combinação, o recorte do jogador e o estado compartilhado. A orientação certa fica só no host. Opções: "girar uma mexe as vizinhas" e castigo depois de N giros. Pode usar as mesmas cenas do relevo como imagem.
2. **Interruptores com estado.** Chaves e disjuntores que acendem ou mudam os vizinhos até bater o alvo (`luzes: boolean[]` do PLANO §1.6). O fusível que falta é encaixe comum.
3. **Cooperação em dois lugares.** Placas no mapa que só destravam com tokens em todas ao mesmo tempo. Usa o alcance e o lugar do Desafio; falta ler a posição dos tokens no host.
4. **Mistura de líquidos.** Recipientes com capacidade; passar de um para outro até a medida pedida. Uma tela, sem pressa.
5. **Sobrepor camadas.** Placas transparentes empilhadas até formar o desenho. Combina com o painel em relevo: as camadas também podem ser itens achados no mapa.

Ficam para depois: empurrar estátuas (colisão no mapa), xadrez com regras, revelar com luz (mexe na névoa). Reflexo e tempo real ficam fora (mesa de RPG é por turno).
