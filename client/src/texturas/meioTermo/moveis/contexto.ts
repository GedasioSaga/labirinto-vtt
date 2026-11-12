/**
 * O que cada `moveis/<tipo>.ts` recebe para montar as peças: a pegada em px
 * do protótipo, a vista do móvel (Frente/Lado), os materiais já escolhidos e
 * a fábrica de peças com a semente do móvel.
 *
 * As medidas seguem o protótipo aprovado (`docs/design/objetos/prototipo/
 * objetos.js`), em que uma casa tem `G` = 56 px: o chanfro de 1,2 px, a tábua
 * de 8 px e a altura de 0,62 casa do barril valem como lá. A tela escala a
 * imagem pronta para o tamanho do objeto no mapa (`pixi/rasterDosMoveis.ts`).
 */
import type { FormaDoTapete } from '../../../types/map'
import { MATERIAIS, oklabDoRgb, tomDoMeio, type IdDoMaterial } from '../materiais'
import { rgb, type Rgb } from '../../ruido'
import { contato, TOM_DA_CORDA, type Cena, type ClasseDaPeca, type CriarPeca, type MaterialDaPeca } from './motor'
import type { Forma } from './formas'

/** Luz (OKLab L) do chão padrão do mapa, `#a8776a`, e a faixa em volta dela que a peça pequena evita. */
const L_DO_CHAO_PADRAO = 0.615

/**
 * Tom que AFASTA a madeira de uma peça pequena do chão padrão (MT5): a madeira
 * mais clara que o chão clareia, a mais escura escurece. Numa peça de meia casa
 * a madeira média (pinho, madeira velha, cerejeira) ficava na luz do chão e a
 * peça virava mancha a 1x; o veio, o chanfro e o contorno não mudam.
 */
export function tomLongeDoChao(m: MaterialDaPeca, forca: number): number {
  const [L] = oklabDoRgb(m.rgb[0], m.rgb[1], m.rgb[2])
  return L >= L_DO_CHAO_PADRAO ? 1 + forca : 1 - forca
}

/** Px do protótipo por casa. */
export const G = 56

export type LadoDoMovel = 'frente' | 'lado'

/** Material de cada lugar do móvel, pelo id do lugar (`madeira`, `aros`, `cobertor`...). */
export type MateriaisDoMovel = Readonly<Record<string, MaterialDaPeca>>

export interface ContextoDoMovel {
  /** Pegada em px do protótipo. */
  readonly w: number
  readonly h: number
  readonly hw: number
  readonly hh: number
  /** Px do protótipo por casa (as alturas dos móveis são frações dela). */
  readonly g: number
  readonly lado: LadoDoMovel
  readonly m: MateriaisDoMovel
  readonly peca: CriarPeca
  /** Só o tapete lê: retangular ou redondo. */
  readonly forma: FormaDoTapete
  /** Só a cerca lê: a volta em graus (0 = reta), já arredondada pela chave da imagem. */
  readonly curva: number
  /** Só a lápide lê: o desenho (0, 1 ou 2). */
  readonly variante: number
  /**
   * O giro do objeto em quartos de volta (0, 90, 180, 270). A placa de seta lê
   * para pintar a seta já girada. O pilar e o altar leem na 3/4, em que o
   * quarto de volta é pintado na cena (`girarCena`), para deixar no lugar NA
   * TELA o que depende dela: o corte do plinto e do toro em metade do norte e
   * metade do sul, o lado claro do fuste e a sombra pintada no plinto e no
   * degrau. Do lote 2 dos objetos novos (11/11/2026) leem também o caldeirão
   * (a sombra pintada no leito), o forno de pão (o que é desenhado de frente
   * não entra girado, e a luz da cúpula fica onde está na tela), a estátua (o
   * corte do pedestal e a sombra pintada no tampo) e o mausoléu (a sombra da
   * casa na laje e nos degraus). Do lote 3 (11/11/2026) leem o toldo listrado
   * (com um quarto de volta as listras acabam nos lados e não há sanefa de
   * frente), a pedra de amolar (entrega a cena girada ao contrário: a roda
   * aparece de frente em qualquer giro), o suporte de armas (girado, monta só
   * o quadro e põe as armas inteiras, em pé, onde o giro as deixou), os ossos
   * (a sombra pintada de cada osso continua caindo para baixo à direita na
   * tela) e a antena parabólica (a luz de dentro do prato e as sombras
   * pintadas na base). Do lote 4 (11/11/2026) leem a cama de casal (girada,
   * não guarda as faces da cabeceira, da peseira e dos postes: a 3/4 varre a
   * madeira lisa do lado ou das costas, que é o que se veria), a banqueta (a
   * sombra do assento no chão e a luz da cova dele caem no lugar na tela), o
   * biombo (a sombra pintada de cada folha, as raias cortadas a prumo da
   * tela, e a almofada e a travessa do meio só do lado virado para quem
   * olha) e o candelabro de chão (as chamas apontam para cima na tela). Do
   * lote 5 (11/11/2026) leem a tina de madeira (os dois aros da frente e os
   * rebites deles ficam do lado que cai embaixo na tela; sem isso, girada, os
   * aros sairiam por cima da água), a prateleira de potes e o gancho com carne
   * (girados, não põem as peças da vista de cima e desenham a frente já
   * desgirada: a prateleira de costas mostra as ripas do fundo na frente dos
   * potes, e o gancho de lado põe as peças de perfil ao longo da trave) e a
   * mesa de corte (só o cutelo: de pé na direção girada). Do lote 6
   * (11/11/2026) leem os barris deitados e o tonel de adega (girados, montam a
   * cena já na tela e a devolvem ao referencial do objeto, `desgirarCena` de
   * `pipaDeitada.ts`: de costas sai o tampo de trás, sem torneira; de lado, o
   * bojo de lado com a torneira na ponta), as ânforas de barro (para onde desce
   * o corpo guardado de cada ânfora em pé, a sombra pintada no chão, a ordem
   * dos pinos e a luz do lombo da tombada) e o cofre (só a sombra pintada da
   * roda e da alavanca no chão). Do lote 7 (11/11/2026) leem o varal de roupa
   * (com um quarto de volta é visto de ponta, cada roupa uma fita de pano ao
   * longo da corda; com meia volta a roupa é montada de frente para o outro
   * lado), a horta (a encosta clara das leiras, as sombras pintadas, o ombro da
   * cenoura à frente da rama e os pinos do tomateiro à frente da estaca), o
   * canteiro de flores (o lado claro das copas, o pé das moitas e a sombra das
   * borboletas), o muro baixo de pedra (as pedras da face são montadas do lado
   * que cai embaixo na tela: a face comprida, de frente ou de trás, ou a ponta,
   * com o muro de topo) e a placa de loja (entrega a cena girada ao contrário,
   * como a pedra de amolar: a tabuleta fica de frente em qualquer giro). Do
   * lote 8 (11/11/2026) leem a cerca de ferro (a ponta de cada lança aponta
   * para cima na tela, e as quatro faces da pirâmide do pilarete pegam a luz
   * pela direção na tela, a conta do candelabro) e as velas e oferendas (a
   * chama de cada vela aponta para cima na tela). Do lote 9 (11/11/2026) leem
   * a balança de mercador (a balança, os pesos e as moedas ficam em pé na tela
   * onde o giro os leva, e o pano só cai pela frente do caixote quando corre
   * de trás para a frente na tela: sem giro e de costas), a tenda de adivinha
   * (a porta vai para onde o giro a leva: de costas não aparece, de lado sai
   * só a ponta do tapete; os gomos do cone e a parede pegam a luz pela direção
   * na tela) e a gaiola com aves (as galinhas, o cocho, as penas e a gaiolinha
   * dos pombos vão para onde o giro os leva, montados de perfil e em pé na
   * tela; a face de ripas da frente é sempre a de baixo na tela). Do lote 10
   * (11/11/2026) leem o galinheiro (a parede desenhada de frente é a do lado
   * que cai embaixo na tela: a da portinhola sem giro, a de trás com a
   * janelinha de costas, um oitão com o respiro de lado; a luz das águas do
   * telhado e as sombras pintadas ficam no lugar na tela), a colmeia (girada,
   * a boca desenhada de frente não entra; a luz da cúpula e as sombras
   * pintadas ficam no lugar na tela, e a caixa das voltas, do favo e dos pinos
   * vai até a frente na tela, para o banco não sair por cima da palha) e a
   * plantação em fileiras (a encosta clara das leiras e a sombra dos pés
   * ficam no lugar na tela). Do lote 11 (11/11/2026) leem a armadura
   * enferrujada (o brilho do aço, o reflexo e os amassados, pela luz na tela,
   * e as sombras pintadas), a mesa de jogo (a sombra do assento de cada
   * banquinho, desgirada, cai para baixo à direita na tela), o balanço (as
   * sombras pintadas da trave, dos troncos e das cordas, desgiradas; no giro
   * ímpar os troncos e as cordas são desenhados na tela, senão as fatias
   * saíam em degraus), o ringue de luta e a mesa de sinuca (montados na tela
   * para o quarto de volta e devolvidos ao referencial do objeto: no ringue, as
   * faixas do tablado, a vez das coisas altas e as sombras pintadas são da
   * tela, e o canto vermelho e o azul vão para onde o giro os leva; na sinuca,
   * os pés, as redes e o friso que só a 3/4 mostra, e as sombras das tabelas e
   * das bolas caem para baixo à direita na tela). Do lote 12 (11/11/2026) leem
   * o bote (a borda vira na 3/4 duas estruturas em anel, cortadas ao comprido
   * ou de través conforme o giro, e o lado que fica de frente na tela mostra o
   * costado ou o painel de popa; esticado de pé, ele se monta deitado com o
   * giro mais um quarto de volta), a rede de pesca (de frente sem giro, de
   * costas com meia volta, com o pano na frente da vara e das estacas, e de
   * ponta com um quarto de volta, a faixa estreita do pano) e o píer (a sombra
   * do tabuado na água e a das estacas, desgiradas, caem para baixo à direita
   * na tela). Do lote 15 (11/11/2026), a armadura despedaçada, como os ossos
   * (a luz do aço, os amassados, os riscos e o brilho, pela luz na tela, e as
   * sombras pintadas de cada peça, desgiradas). Dos lotes 13 e 16 (11/11/2026)
   * leem o braseiro (as pernas que ficam na frente na tela têm a caixa esticada
   * até a frente da pegada e passam na frente do bojo, e a sombra da bacia cai
   * para baixo à direita na tela), a cela com grade (as cantoneiras sobem com a
   * caixa esticada até a frente na tela, e a sombra da grade pintada nas lajes
   * de dentro cai para baixo à direita na tela), a armadilha de espinhos (os
   * espinhos ficam em pé na tela, e a luz das faces, o reflexo da ponta e a
   * sombra pintada ficam no lugar na tela) e os três blocos de inscrições (como
   * o tonel: a coluna, a face da frente com o texto dela, a lasca que o giro
   * leva para a frente e o capim de pé são montados na tela e devolvidos ao
   * objeto com `desgirarCena`; a face de cima, a terra e o capim do chão giram
   * com o objeto). Do lote 14 (11/11/2026) leem o potro de tortura (girado, não
   * põe as peças da tela: a 3/4 varre a face lisa da viga, e a roda e a cruz da
   * catraca vistas do alto sobem até o eixo), a dama de ferro (girada, gira a
   * planta e põe na tela, desgirado, o que fica à vista daquele lado: as costas
   * rebitadas ou o lado do vão com a porta aberta; a máscara e o ferrolho só de
   * frente), o tronco de prisioneiro (de costas, o desenho espelhado sem o ferro
   * da frente; de lado, cada prisma vira a faixa da beira de cima), a gaiola
   * suspensa (a 3/4 sai da pegada girada: o braço aponta para o lado, para a
   * frente ou para trás, a ordem de pintura troca quando a gaiola fica na
   * frente ou atrás do poste, e as sombras pintadas são desgiradas) e a cadeira
   * de interrogatório (a cinta, a fivela, os rebites e a argola da gaveta só
   * entram no giro 0). Dos três últimos do lote 13 (11/11/2026) leem a bola de
   * cristal (o lado claro da bola, a janela de luz e a sombra dela no pano
   * ficam no lugar na tela, `desgirado`, a conta do altar) e o pedestal com
   * livro aberto (a sombra da tábua nos degraus cai para o mesmo lado na tela).
   * Do lote 17 (12/11/2026) leem o tesouro: o monte de ouro e o de moedas (a
   * luz das rampas das barras e da meia-lua de cada moeda, `paraALuz`, e o rumo
   * das quinas riscadas do flanco, `desgirado`), a moeda (a meia-lua de luz e a
   * de sombra ficam do lado da luz na tela; a coroa gira junto, como numa moeda
   * de verdade), o diamante, o monte de diamantes, a joia e o monte de joias (a
   * luz das facetas e as sombras pintadas, `desgirado`; a barra de ouro também
   * lê, mas, em pé, chega com 0); a teia de aranha (a sombra fina dos fios e a
   * dos casulos caem para baixo à direita na tela); a tocha de pé (as barras do
   * cesto na frente e no fundo NA TELA); a tenda (a porta vai para onde o giro a
   * leva: de costas fica a empena fechada, de lado as trouxas e a esteira saem
   * na ponta; as águas e a empena pegam a luz pela direção na tela) e as duas
   * torres (a porta, as seteiras e a escada andam com o objeto; na de vigia, os
   * X de travamento ficam sempre nas faces da frente e de trás da tela).
   * Os outros desenhos não leem.
   */
  readonly giro: number
}

/** O que monta as peças de um tipo na cena. */
export type MontarMovel = (c: ContextoDoMovel, cena: Cena) => void

/** Veio de través (as tábuas de pé, os postes). */
export const QUARTO = Math.PI / 2

/** Móvel de lado visto de cima: a sombra do perfil, arrastada até `altura`, e o contato no pé. */
export function sombraDeLado(cena: Cena, forma: Forma, altura: number): void {
  cena.sombras.push({ forma, z: altura }, contato(forma, 0.24))
}

/**
 * Materiais fixos, que o mestre não escolhe, nos tons do Meio-Termo (tabela
 * TROCA_INTERNA de `docs/design/vila-meio-termo/prototipo/meio.js:159`): o
 * lençol é o linho x 1,03, o prego o ferro x 0,85 e o buraco a nogueira x 0,6.
 * Os tons crus do protótipo de objetos (#3a3b3d, #1e1814) eram quase pretos.
 */
export const LENCOL: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: rgb(tomDoMeio('linho', 1.03)) }
export const PREGO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.85)) }
export const BURACO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('nogueira', 0.6)) }

/**
 * A cinza do leito da fogueira, fixa: o granito do Meio-Termo x 0,68 (o tom
 * cru do protótipo, #625c55, era frio e quase igual ao chão escuro).
 */
export const CINZA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('granito', 0.68)) }

/**
 * O arenito das pedras da fogueira, areia acinzentada (saturação HSL ~0,28,
 * luz ~0,58). O tom da tabela (o pinho do Meio-Termo x 0,95) saía mostarda: uma
 * pedra de arenito sozinha dava saturação p95 de 0,66, acima do teto de 0,62,
 * e só a fogueira inteira, com a cinza e a lenha, passava (0,60).
 */
export const TOM_DO_ARENITO: Rgb = [0xb3, 0x9a, 0x76]

/** A classe de textura de um material da tabela: cada classe da tabela tem a sua. */
function classeDaPeca(id: IdDoMaterial): ClasseDaPeca {
  return MATERIAIS[id].classe
}

/** O material da tabela como o pintor o lê, no tom do Meio-Termo (`tom`, não o `hex` do arquivo). */
export function materialDaPeca(id: IdDoMaterial): MaterialDaPeca {
  const material = MATERIAIS[id]
  const classe = classeDaPeca(id)
  if (classe === 'tecido') return { classe, rgb: rgb(material.tom), fio: id === 'linho' ? 'linho' : 'la' }
  if (id === 'arenito') return { classe, rgb: TOM_DO_ARENITO, pedra: id }
  if (id === 'granito' || id === 'ardosia') return { classe, rgb: rgb(material.tom), pedra: id }
  if (classe === 'casca') return { classe, rgb: rgb(material.tom), casca: id === 'lenhaBetula' ? 'betula' : 'fendida' }
  // A corda é o único material da classe e só a cerca a usa: palha clara, para não se confundir com o pinho.
  if (classe === 'corda') return { classe, rgb: TOM_DA_CORDA }
  return { classe, rgb: rgb(material.tom) }
}
