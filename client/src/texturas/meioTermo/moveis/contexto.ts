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
import { MATERIAIS, tomDoMeio, type IdDoMaterial } from '../materiais'
import { rgb } from '../../ruido'
import { contato, type Cena, type ClasseDaPeca, type CriarPeca, type MaterialDaPeca } from './motor'
import type { Forma } from './formas'

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
 * A classe de textura de um material da tabela. Pedra, corda e casca só
 * aparecem na cerca e na fogueira, que ganham textura na fatia MT3; até lá
 * pintam liso.
 */
function classeDaPeca(id: IdDoMaterial): ClasseDaPeca {
  const classe = MATERIAIS[id].classe
  return classe === 'madeira' || classe === 'metal' || classe === 'tecido' || classe === 'palha' ? classe : 'liso'
}

/** O material da tabela como o pintor o lê, no tom do Meio-Termo (`tom`, não o `hex` do arquivo). */
export function materialDaPeca(id: IdDoMaterial): MaterialDaPeca {
  const material = MATERIAIS[id]
  const classe = classeDaPeca(id)
  if (classe !== 'tecido') return { classe, rgb: rgb(material.tom) }
  return { classe, rgb: rgb(material.tom), fio: id === 'linho' ? 'linho' : 'la' }
}
