import type { Prop, TipoMobilia } from '../types/map'
import { CASA_DO_FOGO_PX } from './mobilia/fogo'

/**
 * A LUZ DOS OBJETOS DO MAPA (pedidos do mestre de 09/11/2026: "na gameplay
 * isso não ilumina nada os jogadores" e "coloque o sistema iluminação"). O
 * fogo, a fogueira, a lareira, a fornalha, o forno de pão (11/11/2026) e o
 * lampião são fontes de luz de verdade: o MESMO alcance vale para o desenho
 * (`pixi/mapaDeLuz.ts`, o claro quente que treme) e para a visão do jogador
 * no escuro (`lib/fogFilter.ts`, o claro na linha de visão chega como o de um
 * ponto de luz).
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
}

/**
 * Os objetos que são fonte de luz, cada um com o seu alcance e o seu tom.
 * Objeto fora desta tabela não ilumina. Os alcances seguem os da ferramenta
 * Luz (`lib/presetsDeLuz.ts`: fogueira 5 casas e lampião 3,5 a partir do
 * centro; aqui a conta parte da borda da pegada).
 *
 * `fumacaEBrasas` também responde "a cena tem fogo?" (`lib/particulasDaCena.ts`):
 * tudo que queima à vista solta, e só o lampião, de chama fechada, não. Com a
 * fogueira de fora, a cena só com ela contava como sem fogo e a fumaça nascia
 * espalhada pela tela toda.
 */
export const LUZ_DOS_OBJETOS: Readonly<Partial<Record<TipoMobilia, LuzDoObjeto>>> = {
  fogo: { alcanceEmCasas: 4, cor: 0xffdca6, forca: 0.95, fumacaEBrasas: true },
  fogueira: { alcanceEmCasas: 4.5, cor: 0xffd9a0, forca: 0.95, fumacaEBrasas: true },
  lareira: { alcanceEmCasas: 3.5, cor: 0xffd8a4, forca: 0.9, fumacaEBrasas: true },
  fornalha: { alcanceEmCasas: 3, cor: 0xffd29c, forca: 0.85, fumacaEBrasas: true },
  // O forno de pão (11/11/2026), com o fogo aceso: a luz da lareira, o outro fogo de lenha de dentro de casa.
  fornoDePao: { alcanceEmCasas: 3.5, cor: 0xffd8a4, forca: 0.9, fumacaEBrasas: true },
  lampiao: { alcanceEmCasas: 3, cor: 0xffe8c4, forca: 0.85, fumacaEBrasas: false },
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
