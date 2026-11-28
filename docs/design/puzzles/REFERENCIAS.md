# Referências de puzzles: a série Resident Evil, por mecânica

Fonte: pesquisa na internet de 28/11/2026 (guias e wikis de fãs, lista no fim). Daqui usamos só a **mecânica** (o gênero do puzzle). Arte, nomes, textos e soluções no app são nossos e originais: nenhum nome de item, texto, desenho ou resposta dos jogos entra no Labirinto.

Siglas: RE1 (1996) · REmake (2002) · RE0 · RE2 (1998) · RE2R (2019) · RE3 (1999) · RE3R (2020) · CV (Code Veronica) · RE4 (2005) · RE4R (2023) · RE5 · RE6 · RE7 · Village · Rev1 · Rev2.

## Tabela

| Mecânica | Como funciona | Onde aparece | Cabe no app? | Esforço | Já existe? |
|---|---|---|---|---|---|
| Encaixe de item em lacuna/pedestal | Achar o objeto pelo mapa e pô-lo no lugar dele | RE1/REmake, RE2R, RE3R, CV, RE4R, Rev2 | sim, usa a mochila | P | sim |
| Itens em ordem certa | A ordem conta uma história (retratos de família, rolos de filme) | CV, Village, RE4R | sim | P | sim (regra "ordem certa") |
| Juntar partes num objeto | Duas ou três partes viram uma peça só | RE2R, RE3, RE7, Village | sim | P | sim |
| Balança / peso | Pôr ou tirar peso até equilibrar | RE0 | sim | P | sim (troca de peso) |
| Rodas de símbolos ou números | Girar rodas até a combinação lida numa pista | RE2R, RE4R, Village | sim | P | sim |
| Relógio | Pôr os ponteiros na hora indicada por uma pista | RE7, RE4R, RE0 | sim | P | sim |
| Código achado no mundo | A senha está num papel, numa janela, num anel | RE2R, RE3R, CV, RE7, Village | sim, com o Documento como dica | P | sim |
| Sequência musical (piano) | Tocar as notas de uma partitura na ordem | RE1/REmake, RE0, Village | sim; o som é ajuste | P | sim (sequência de botões, sem som) |
| Acender em ordem | Velas ou tochas acesas na ordem que um enigma dá | RE0 | sim | P | sim (sequência de botões) |
| Peças giratórias | Girar estátuas, discos, anéis ou quadros até a orientação certa | Village, RE7, RE4R, CV | sim; vários jogadores giram juntos | M | não (previsto no PLANO §1.6) |
| Interruptores com estado | Chaves e disjuntores que acendem ou mudam outros até bater o alvo | RE2R, RE3R, RE4R, Village | sim; fusível é encaixe comum | M | não (previsto no PLANO §1.6) |
| Fios e conexões | Ligar pontos numa placa sem cruzar ou na ordem certa | RE4R, RE2R | sim, vira variante das giratórias (peça de caminho) | M | não |
| Peças deslizantes | Deslizar blocos numa grade até formar a figura | RE2R | sim | P | não |
| Mistura de líquidos | Passar líquido entre recipientes até a medida pedida | REmake, RE2R, RE3, RE3R | sim; é por turno, sem pressa | M | não |
| Sobrepor camadas | Escolher e empilhar placas transparentes até formar o desenho | RE3, RE4R | sim | M | não |
| Sombra projetada | Girar um objeto diante da luz até a sombra virar a figura | RE7 | com ajuste: em 2D vira girar um recorte e ver a sombra na parede | M | não |
| Caixa de música / cilindro | Reordenar pinos ou cilindros até a melodia bater com o padrão | Village, RE3 | com ajuste: grade de pinos, o som é extra | M | não |
| Espelhos e feixe de luz | Girar espelhos até o raio chegar ao alvo | RE5, RE6 | com ajuste: sem tiro, espelhos numa grade (variante das giratórias) | M | não |
| Empurrar estátuas sobre placas | Empurrar objetos pelo chão até cobrir as marcas | RE1, REmake, RE0 | com ajuste: é no mapa, com colisão | G | não (previsto no PLANO §1.6) |
| Cooperação em dois lugares | Cada personagem fica num ponto ao mesmo tempo (placa, cadeira) | RE0, RE4R, RE6, Rev2 | sim: é o forte de um jogo com vários jogadores | M | não |
| Xadrez | Mover peças até o mate ou copiar um tabuleiro | RE0, RE2R | com ajuste: "copiar o tabuleiro" já é encaixe; regras de xadrez = G | G | em parte (encaixe) |
| Revelar com luz | Uma lanterna ou scanner mostra marcas escondidas | Rev2, Rev1 | com ajuste: conversa com a névoa e o "Quem vê" | G | não |
| Reflexo / tempo real | Atirar em sinos, inclinar labirinto, agir antes do veneno | Village, RE3R, RE1 (DS) | não: mesa de RPG é por turno | — | não |
| Painel em relevo | Peças de metal achadas completam a imagem do quadro | (pedido do dono; parente do encaixe) | sim | M | em construção |

## Recomendação

1. **Peças giratórias** (o 2º puzzle). É a mecânica que mais aparece nos jogos recentes, já está prevista no PLANO §1.6 (`rotacoes: number[]`) e reaproveita a ação `girar` que as rodas da Combinação já usam, a tela por cima do mapa e o estado compartilhado.
   - **O mestre configura:** a forma (grade de 2x2 a 4x4, ou 3 anéis em volta de um centro), a imagem (um modelo ou uma figura sua, cortada em peças), a orientação certa de cada peça (guardada só no host, fora do recorte) e o embaralho inicial (sorteado ou à mão). Opções: "girar uma mexe as vizinhas" (fica mais difícil) e um castigo por giro acima de N.
   - **O jogador faz:** abre o puzzle encostando nele no mapa e clica numa peça para girar 90 graus (ou o anel um passo). Todos os que estão dentro veem a mesma figura mudar na hora.
   - **Destrava quando** todas as peças estão na orientação certa; o host confere a cada giro e entrega o desfecho de sempre (item, moedas, documento, porta).
   - Depois, o mesmo motor ganha "peça de caminho" e "espelho" e cobre fios e feixe de luz sem tela nova.
2. **Interruptores com estado.** Também previsto no §1.6 (`luzes: boolean[]`), usa encaixe comum para os fusíveis e é ótimo em grupo (cada um aperta uma chave e todos discutem). Cobre chaves de rota, disjuntores e o clássico "aperta um, muda os vizinhos".
3. **Cooperação em dois lugares.** É o que um app com vários jogadores faz melhor que o jogo de um só: placas no mapa que só destravam com tokens em todas ao mesmo tempo. O alcance e o lugar do Desafio já existem; falta ler a posição dos tokens. É também o primeiro passo para empurrar estátuas.
4. **Mistura de líquidos.** Tela por cima do mapa, sem reflexo, conta de cabeça em grupo ("enche a de 5, passa para a de 3"). Pede só um controle novo (recipientes com capacidade) e cabe numa tela.
5. **Sobrepor camadas.** Combina com o Painel em relevo (mesma tela de figura) e as placas podem ser itens achados no mapa e levados na mochila, o que liga a exploração ao puzzle.

Ficam para depois: empurrar estátuas (G, colisão no mapa), xadrez com regras, revelar com luz (mexe na névoa). Reflexo e tempo real ficam fora.

## Não conferido

- Os sites de wiki (Fandom), StrategyWiki, Destructoid e PC Games recusaram a leitura direta; essas linhas saíram dos resumos das buscas.
- RE4 (2005), RE6 e Rev1 tiveram pouco detalhe por puzzle; a lista desses jogos pode estar incompleta.
- A mesa giratória de CV e a balança do RE0 só têm o nome do puzzle nas fontes, sem o passo a passo.

## Fontes

- https://www.powerpyx.com/resident-evil-2-remake-all-puzzle-solutions-guide/
- https://vandal.elespanol.com/en/resident-evil-2-remake/resident-evil-2-remake-all-puzzles-and-their-solutions.html
- https://vandal.elespanol.com/en/resident-evil-3-remake/all-resident-evil-3-remake-puzzles-and-solutions.html
- https://www.gamepressure.com/resident-evil-4-1/list-of-puzzles/zb10a18
- https://www.videogameschronicle.com/guide/re4-remake-lithographic-stone-puzzle-guide/
- https://www.powerpyx.com/resident-evil-8-village-all-puzzle-solutions-guide/
- https://www.gamepressure.com/resident-evil-village/list-of-all-puzzles/zee6a2
- https://gameranx.com/features/id/89663/article/resident-evil-7-biohazard-how-to-solve-every-puzzle-solutions-guide/
- https://twinfinite.net/?p=254124
- https://gamerant.com/resident-evil-franchise-series-hardest-puzzles-all-time/
- https://www.destructoid.com/10-best-puzzles-in-the-resident-evil-series-ranked/
- https://www.gamepressure.com/residentevilzerohd/the-animal-statues-puzzle/z583e5
- https://www.gamepressure.com/residentevilzerohd/the-chessboard-puzzle/z083e0
- https://www.pcgames.de/Resident-Evil-Zero-HD-Remaster-Spiel-55593/Tipps/Komplettloesung-Switch-PS4-Xbox-1183558/3/
- https://evilresource.com/resident-evil/guides/puzzles/solving-armor-room
- https://strategywiki.org/wiki/Resident_Evil/Escaping_the_Mansion
- https://strategywiki.org/wiki/Resident_Evil_3%3A_Nemesis/Clock_Tower
- https://strategywiki.org/wiki/Resident_Evil_5/Chapter_4-2
- https://www.ludo.guide/guide/resident-evil-code-veronica-x/walkthrough
- https://www.ludo.guide/guide/resident-evil-code-veronica-x/turn-table-room
- https://www.ludo.guide/guide/resident-evil-6/walkthrough/leons-campaign/chapter-2-cemetery-cathedral
- https://residentevil.fandom.com/wiki/Puzzles_in_Resident_Evil_Village
- https://gamerguides.com/resident-evil-revelations-2/guide/campaign-guide/walkthrough/episode-3-claire-moira-pt2
- https://www.gameswelt.de/resident-evil-revelations/komplettloesung/hilfe-fuer-jill-und-chris-198136/20
