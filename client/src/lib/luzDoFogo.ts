import type { Carimbo, Prop, TipoMobilia } from '../types/map'
import type { FachoQueGira } from './fachoDoFarol'
import { CASA_DO_FOGO_PX } from './mobilia/fogo'

/**
 * A LUZ DOS OBJETOS DO MAPA (pedidos do mestre de 09/11/2026: "na gameplay
 * isso não ilumina nada os jogadores" e "coloque o sistema iluminação"). O
 * fogo, a fogueira, a lareira, a fornalha, o forno de pão (11/11/2026), o
 * braseiro (11/11/2026), as tochas de parede e de pé (12/11/2026) e o lampião
 * são fontes de luz de verdade: o MESMO
 * alcance vale para o desenho (`pixi/mapaDeLuz.ts`, o claro quente que treme)
 * e para a visão do jogador no escuro (`lib/fogFilter.ts`, o claro na linha de
 * visão chega como o de um ponto de luz). As velas (11/11/2026: a do
 * criado-mudo, as cinco do candelabro de chão e as sete das velas e oferendas
 * do cemitério) também: só iluminam em volta, com a chama pintada no desenho,
 * sem animação e sem Aceso/Apagado (decisão do mestre).
 *
 * Antes disto a luz desses objetos era só desenho: fora do raio curto da
 * noite nem chegavam ao jogador, e o claro era cortado na borda da visão dele.
 *
 * RASCUNHO: a tabela e o teto abaixo são os números que o mestre ajusta.
 */

/** O que a luz lê do objeto. */
export type FogoQueIlumina = Pick<Prop, 'id' | 'x' | 'y' | 'width' | 'height' | 'mobilia' | 'mobiliaForma' | 'hidden'>

export interface LuzDoObjeto {
  /** Até onde a luz vai além da pegada do objeto, em casas do mapa. */
  alcanceEmCasas: number
  /**
   * O tom do claro. A luz entra multiplicando o mapa, então só tons claros:
   * laranja forte apagaria o verde do chão e o azul das fichas no breu (medido
   * em 09/11/2026: chão verde sob `#ffa24d` virava marrom escuro). O laranja
   * fica por conta do brilho e das chamas do próprio objeto.
   */
  cor: number
  /** Quanto do claro entra no centro (0 a 1). */
  forca: number
  /** Solta a fumaça preta e as brasas da cena (`pixi/particulasDoMapa.ts`). */
  fumacaEBrasas: boolean
  /** Os fachos que giram por cima do claro redondo (só o farol, `lib/fachoDoFarol.ts`); ausente = luz parada. */
  facho?: FachoQueGira
}

/**
 * Os objetos que são fonte de luz, cada um com o seu alcance e o seu tom.
 * Objeto fora desta tabela não ilumina. Os alcances seguem os da ferramenta
 * Luz (`lib/presetsDeLuz.ts`: fogueira 5 casas e lampião 3,5 a partir do
 * centro; aqui a conta parte da borda da pegada).
 *
 * `fumacaEBrasas` também responde "a cena tem fogo?" (`lib/particulasDaCena.ts`):
 * tudo que queima à vista solta, e só o lampião, de chama fechada, as velas,
 * de chama pequena, e a tocha de parede, que vai às dezenas num corredor (a
 * fuligem pintada na parede já conta a fumaça), não. Com a fogueira de fora, a
 * cena só com ela contava como sem fogo e a fumaça nascia espalhada pela tela
 * toda.
 *
 * A luz nasce sempre do MEIO do objeto (`x`, `y`): a tabela não tem como pôr a
 * origem em outro ponto da pegada.
 */
export const LUZ_DOS_OBJETOS: Readonly<Partial<Record<TipoMobilia, LuzDoObjeto>>> = {
  fogo: { alcanceEmCasas: 4, cor: 0xffdca6, forca: 0.95, fumacaEBrasas: true },
  fogueira: { alcanceEmCasas: 4.5, cor: 0xffd9a0, forca: 0.95, fumacaEBrasas: true },
  lareira: { alcanceEmCasas: 3.5, cor: 0xffd8a4, forca: 0.9, fumacaEBrasas: true },
  fornalha: { alcanceEmCasas: 3, cor: 0xffd29c, forca: 0.85, fumacaEBrasas: true },
  // O forno de pão (11/11/2026), com o fogo aceso: a luz da lareira, o outro fogo de lenha de dentro de casa.
  fornoDePao: { alcanceEmCasas: 3.5, cor: 0xffd8a4, forca: 0.9, fumacaEBrasas: true },
  // O braseiro (11/11/2026), com o fogo aceso: a luz da fornalha, o outro fogo de carvão em brasa. O fogo fica
  // no meio da pegada, de onde a luz nasce.
  braseiro: { alcanceEmCasas: 3, cor: 0xffd29c, forca: 0.85, fumacaEBrasas: true },
  // As tochas (12/11/2026), com o fogo aceso, no tom do braseiro. A de pé tem a luz dele. A de parede, presa na
  // parede e feita para ir às dezenas num corredor, alcança menos e não solta fumaça nem brasa; a cabeça dela
  // fica a 0,07 casa do meio da pegada no tamanho de partida, mas a luz sai do meio: a diferença some no alcance.
  tochaDeParede: { alcanceEmCasas: 2.5, cor: 0xffd29c, forca: 0.8, fumacaEBrasas: false },
  tochaDePe: { alcanceEmCasas: 3, cor: 0xffd29c, forca: 0.85, fumacaEBrasas: true },
  lampiao: { alcanceEmCasas: 3, cor: 0xffe8c4, forca: 0.85, fumacaEBrasas: false },
  // As velas (11/11/2026), no tom do lampião e mais curtas que ele. A do criado-mudo é uma vela só: metade do
  // alcance. Ela fica fora do meio do móvel (a 0,15 casa dele no tamanho de partida, `CHAMA_DO_CRIADO_MUDO`
  // em `texturas/meioTermo/moveis/criadoMudo.ts`), mas a luz sai do meio: a diferença some no alcance.
  criadoMudo: { alcanceEmCasas: 1.5, cor: 0xffe8c4, forca: 0.7, fumacaEBrasas: false },
  // O candelabro de chão: cinco velas em anel em volta do mastro, que é o meio da pegada.
  candelabroDeChao: { alcanceEmCasas: 2.5, cor: 0xffe8c4, forca: 0.8, fumacaEBrasas: false },
  // As velas e oferendas do cemitério: sete velas em roda do pano, a luz do candelabro de chão. O centro dos
  // pavios (`LUZ_DAS_VELAS` em `texturas/meioTermo/moveis/velasEOferendas.ts`) fica a 0,01 da largura do meio.
  velasEOferendas: { alcanceEmCasas: 2.5, cor: 0xffe8c4, forca: 0.8, fumacaEBrasas: false },
  // O lustre de velas (14/11/2026): oito velas na roda pendurada, a luz do candelabro de chão com mais alcance. A roda
  // fica em volta do meio da pegada, de onde a luz nasce. A chama é pintada, sem animação, como a das outras velas.
  lustreDeVelas: { alcanceEmCasas: 3.5, cor: 0xffe8c4, forca: 0.85, fumacaEBrasas: false },
  // O holofote (14/11/2026): luz branca fria de lâmpada, sem fumaça. A lente aponta para a frente, mas a luz nasce
  // redonda do meio, como a de toda peça. Acende e apaga como a tocha: o painel dá "Luz" (Aceso | Apagado,
  // `ehMovelQueAcende` em `lib/mobilia/fogoDeCasa.ts`), e apagado ele sai desta conta (`luzDoObjeto`) e o desenho
  // troca para a lente escura (variante 1).
  holofote: { alcanceEmCasas: 5, cor: 0xfff6e6, forca: 0.9, fumacaEBrasas: false },
  // O varal de lanternas de papel (14/11/2026): uma fila de lanternas acesas entre dois mastros, luz quente e fraca de
  // papel, sem fumaça. A fila tem 4 casas no tamanho de partida; a luz nasce do meio dela, e o alcance cobre as pontas.
  // O brilho do papel é pintado, sem chama animada.
  varalDeLanternas: { alcanceEmCasas: 3, cor: 0xffdcb0, forca: 0.7, fumacaEBrasas: false },
  // O farol (14/11/2026, construção): a lanterna acesa no alto, luz quente de longe, sem fumaça, com o alcance que o
  // desenhista propôs. A "luz que gira" da lista são os dois FACHOS opostos que dão a volta em 10 s por cima do claro
  // redondo (correção da auditoria de 14/11/2026, `lib/fachoDoFarol.ts`); o claro redondo ficou mais fraco (0,55) para
  // o facho se ver passando, e os dois somados no centro chegam perto do 1 de antes. A torre fica no meio da pegada,
  // de onde a luz nasce. RASCUNHO, como o resto da tabela: a abertura, a volta e as forças são números para o mestre.
  farol: {
    alcanceEmCasas: 9,
    cor: 0xffe6b0,
    forca: 0.55,
    fumacaEBrasas: false,
    facho: { fachos: 2, abertura: 0.42, voltaEmSegundos: 10, forca: 0.6 },
  },
}

/** A luz de um CARIMBO: a do objeto, sem fumaça nem brasas, e se ela treme como a do fogo. */
export type LuzDoCarimbo = Omit<LuzDoObjeto, 'fumacaEBrasas'> & {
  /** Treme como o fogo (o tremor de `pixi/mapaDeLuz.ts`); senão, fica parada. */
  treme: boolean
}

/**
 * OS CARIMBOS QUE ILUMINAM (lote C6 de 14/11/2026), por id do carimbo da
 * biblioteca. Carimbo fora desta tabela não ilumina, e o do PACOTE nunca (o id
 * dele não pode ser um da biblioteca: o contrato do pacote não muda, como a
 * sombra `deitada`). Os alcances contam do ponto de luz da célula (abaixo).
 */
export const LUZ_DOS_CARIMBOS: Readonly<Record<string, LuzDoCarimbo>> = {
  // Os cogumelos que brilham: claro frio de musgo aceso, curto e parado. A luz multiplica o mapa (o tom claro acima).
  'cogumelos-que-brilham': { alcanceEmCasas: 1.5, cor: 0xdcf2ea, forca: 0.55, treme: false },
  // A rocha vulcânica: o tom do braseiro, curto, tremendo como brasa (a brasa do desenho pulsa no palco).
  'rocha-vulcanica': { alcanceEmCasas: 1.5, cor: 0xffd29c, forca: 0.6, treme: true },
}

/** O carimbo do tipo ilumina? `Object.hasOwn`: o tipo vem do mapa, e `constructor` também tem a forma de um id. */
export function luzDoCarimbo(tipo: string): LuzDoCarimbo | null {
  return Object.hasOwn(LUZ_DOS_CARIMBOS, tipo) ? LUZ_DOS_CARIMBOS[tipo] : null
}

/** O que a luz lê do carimbo. */
export type CarimboQueIlumina = Pick<Carimbo, 'tipo' | 'x' | 'y'>

/** Um ponto de luz dos carimbos: os do mesmo tipo numa célula, somados. */
export interface LuzDosCarimbosNaCelula extends LuzDoCarimbo {
  /** `carimbos:<tipo>:<coluna>,<linha>`: o mesmo enquanto a célula tiver carimbo do tipo (o tremor e a cache leem). */
  id: string
  /** O centro de massa dos pés dos carimbos da célula, em px de mundo. */
  x: number
  y: number
  /** Quantos carimbos a célula juntou. */
  quantos: number
}

/** O lado da célula que junta os carimbos que iluminam, em casas do mapa. */
export const CELULA_DA_LUZ_DOS_CARIMBOS_EM_CASAS = 3
/**
 * Teto de pontos de luz de carimbo por tela. O spray solta centenas, e cada
 * luz custa um polígono de visibilidade (`computeVisibility`); acima do teto,
 * as células com mais carimbos ganham.
 */
export const TETO_DE_LUZES_DE_CARIMBO = 32
/** Cada carimbo a mais na célula reforça a força nisto (até 1). */
const REFORCO_POR_CARIMBO = 0.25
/** Cada vez que a célula dobra de carimbos, o alcance cresce isto, até `ALCANCE_A_MAIS_MAX`. */
const ALCANCE_A_MAIS_POR_DOBRA = 0.5
const ALCANCE_A_MAIS_MAX = 1.5

/**
 * As luzes dos carimbos que iluminam, JUNTAS por célula de 3 x 3 casas e por
 * tipo (o cogumelo e a rocha têm tom e tremor diferentes): um ponto de luz por
 * célula, no centro de massa dos pés, com a força `min(1, força x (1 + 0,25 x
 * (n - 1)))` e o alcance + 0,5 casa a cada vez que n dobra (até + 1,5). No
 * máximo `TETO_DE_LUZES_DE_CARIMBO`, as células mais cheias primeiro (no
 * empate, pela chave, para as duas telas escolherem as mesmas). `grade` = a
 * casa do mapa em px; sem ela (ou torta), a de referência dos móveis.
 */
export function luzesDosCarimbos(carimbos: readonly CarimboQueIlumina[] | undefined, grade?: number): LuzDosCarimbosNaCelula[] {
  if (carimbos === undefined || carimbos.length === 0) return []
  const casa = grade !== undefined && Number.isFinite(grade) && grade > 0 ? grade : CASA_DO_FOGO_PX
  const lado = CELULA_DA_LUZ_DOS_CARIMBOS_EM_CASAS * casa
  const celulas = new Map<string, { luz: LuzDoCarimbo; somaX: number; somaY: number; quantos: number }>()
  for (const c of carimbos) {
    const luz = luzDoCarimbo(c.tipo)
    if (luz === null || !Number.isFinite(c.x) || !Number.isFinite(c.y)) continue
    const chave = `${c.tipo}:${Math.floor(c.x / lado)},${Math.floor(c.y / lado)}`
    const celula = celulas.get(chave)
    if (celula === undefined) celulas.set(chave, { luz, somaX: c.x, somaY: c.y, quantos: 1 })
    else {
      celula.somaX += c.x
      celula.somaY += c.y
      celula.quantos += 1
    }
  }
  const ordem = [...celulas].sort(([chaveA, a], [chaveB, b]) => b.quantos - a.quantos || (chaveA < chaveB ? -1 : chaveA > chaveB ? 1 : 0))
  return ordem.slice(0, TETO_DE_LUZES_DE_CARIMBO).map(([chave, { luz, somaX, somaY, quantos }]) => ({
    id: `carimbos:${chave}`,
    x: somaX / quantos,
    y: somaY / quantos,
    quantos,
    alcanceEmCasas: luz.alcanceEmCasas + Math.min(ALCANCE_A_MAIS_MAX, ALCANCE_A_MAIS_POR_DOBRA * Math.floor(Math.log2(quantos))),
    cor: luz.cor,
    forca: Math.min(1, luz.forca * (1 + REFORCO_POR_CARIMBO * (quantos - 1))),
    treme: luz.treme,
  }))
}

/** O alcance do ponto de luz dos carimbos em px de mundo: as casas dele, a partir do ponto (o carimbo é pequeno). */
export function raioDaLuzDosCarimbos(luz: Pick<LuzDoCarimbo, 'alcanceEmCasas'>, casa?: number): number {
  const grade = casa !== undefined && Number.isFinite(casa) && casa > 0 ? casa : CASA_DO_FOGO_PX
  return luz.alcanceEmCasas * grade
}

/**
 * TETO DA LUZ DOS OBJETOS na visão do jogador, em "visões cheias do dia": o
 * claro de um objeto só revela chão e fichas até esta distância de quem olha.
 * Com 1, de noite (e na cena escura) o jogador nunca recebe mais do que
 * receberia de dia na mesma cena; sem teto, um mapa aberto cheio de fogos
 * entregava o mapa inteiro de noite (medido em 09/11/2026: 44 a 55 fogos e
 * fichas a 80 casas, contra 3 fogos de dia).
 */
export const TETO_DA_LUZ_EM_VISOES_DO_DIA = 1

/** A luz que o objeto acende; `null` = nenhuma (tipo sem luz, `hidden` do mestre, fogo apagado ou medida torta). */
export function luzDoObjeto(f: FogoQueIlumina): LuzDoObjeto | null {
  if (f.mobilia === undefined || f.hidden === true || f.mobiliaForma === 'apagado') return null
  if (!Number.isFinite(f.x) || !Number.isFinite(f.y) || !(f.width > 0) || !(f.height > 0)) return null
  return LUZ_DOS_OBJETOS[f.mobilia] ?? null
}

/** O objeto ilumina? */
export function fogoAcendeLuz(f: FogoQueIlumina): boolean {
  return luzDoObjeto(f) !== null
}

/** O objeto solta a fumaça e as brasas da cena? */
export function soltaFumacaEBrasas(f: FogoQueIlumina): boolean {
  return luzDoObjeto(f)?.fumacaEBrasas === true
}

/**
 * O alcance da luz do objeto em px de mundo: meia diagonal da pegada mais as
 * casas da tabela. `casa` é a grade do mapa; sem ela (ou torta), a grade de
 * referência dos móveis.
 */
export function raioDaLuzDoObjeto(f: Pick<Prop, 'width' | 'height'>, luz: LuzDoObjeto, casa?: number): number {
  const grade = casa !== undefined && Number.isFinite(casa) && casa > 0 ? casa : CASA_DO_FOGO_PX
  return 0.5 * Math.hypot(f.width, f.height) + luz.alcanceEmCasas * grade
}
