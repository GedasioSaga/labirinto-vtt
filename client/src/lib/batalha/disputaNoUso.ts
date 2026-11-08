import type { SistemaDeRpg } from '../sistemaDeRpg'
import type { AlvoDoGolpe, CombateDoPersonagem } from './combate'
import { quemUsaVence, rolarDisputa, textoDaDisputa, type FichaNaDisputa } from './disputa'
import type { GolpeLancado } from './golpe'
import type { DisputaAMao } from './mecanicasAMao'

/**
 * A DISPUTA ROLADA LOGO AO USAR (conserto das fichas F2, fatia D; resposta
 * do Guilherme sobre a Explosão): antes do dano, o app rola a disputa da
 * mecânica à mão em cada alvo. Quem passou não toma nada (fica resolvido com
 * 0); se NINGUÉM falhou e a mecânica devolve o custo, a técnica não gasta: o
 * SP e o uso voltam (a ação da vez, não).
 *
 * Puro: o d20 entra por parâmetro, sem store, sem rede.
 */

export interface ContextoDaDisputaNoUso {
  /** Quem usa a técnica (a CD por fórmula e a concentração são dele). */
  usa: FichaNaDisputa
  /** A ficha de cada alvo; `null` = alvo sem ficha (não testa: a técnica pega e o mestre resolve). */
  fichaDoAlvo: (alvo: AlvoDoGolpe) => FichaNaDisputa | null
  /** O combate de quem usa ANTES do golpe (para devolver o uso). */
  combateAntes: CombateDoPersonagem | undefined
  sistema: SistemaDeRpg
  carga: number
  rolarD20: () => number
}

export interface UsoComADisputa {
  lancado: GolpeLancado
  /** Os tokens em que quem usa venceu (a técnica pegou). */
  venceuEm: string[]
  /** Ninguém falhou e a mecânica devolve o custo: não gastou SP nem uso. */
  naoGastou: boolean
}

/** O combate com os usos, recargas, Overload e o "gastou SP" de antes (a técnica não gastou). */
function semOGastoDaTecnica(depois: CombateDoPersonagem, antes: CombateDoPersonagem | undefined): CombateDoPersonagem {
  const { gastouSp: _gastou, ...semGasto } = depois
  const devolvido: CombateDoPersonagem = { ...semGasto, usos: antes?.usos ?? {}, recargas: antes?.recargas ?? {}, overload: antes?.overload ?? false }
  return antes?.gastouSp === true ? { ...devolvido, gastouSp: true } : devolvido
}

/** O golpe lançado com a disputa rolada em cada alvo. Golpe nenhum: o mesmo lançado. */
export function comADisputaNoUso(lancado: GolpeLancado, disputa: DisputaAMao, ctx: ContextoDaDisputaNoUso): UsoComADisputa {
  const { golpe } = lancado
  if (golpe === null) return { lancado, venceuEm: [], naoGastou: false }
  const venceuEm: string[] = []
  const alvos = golpe.alvos.map((alvo): AlvoDoGolpe => {
    const doAlvo = ctx.fichaDoAlvo(alvo)
    if (doAlvo === null) {
      venceuEm.push(alvo.tokenId)
      return alvo
    }
    const alvoTesta = disputa.testa === 'alvo'
    const resultado = rolarDisputa(disputa, { testa: alvoTesta ? doAlvo : ctx.usa, usa: ctx.usa, resiste: alvoTesta ? ctx.usa : doAlvo }, ctx.sistema, ctx.carga, ctx.rolarD20)
    const venceu = quemUsaVence(resultado, disputa.testa)
    if (venceu) {
      venceuEm.push(alvo.tokenId)
      return { ...alvo, disputa: `${textoDaDisputa(resultado)}, pegou` }
    }
    return { ...alvo, disputa: `${textoDaDisputa(resultado)}, não pegou: nada acontece`, podeReagir: false, saida: 'esquiva', danoFinal: 0, semDano: true }
  })
  const naoGastou = venceuEm.length === 0 && disputa.seQuemUsaPerde?.devolveOCusto === true
  const novo = { ...golpe, alvos: naoGastou ? alvos.map((alvo) => ({ ...alvo, disputa: `${alvo.disputa ?? ''} (não gastou SP nem uso)`.trim() })) : alvos }
  const resolvidos = novo.alvos.filter((alvo) => alvo.danoFinal !== undefined)
  if (!naoGastou) return { lancado: { ...lancado, golpe: novo, resolvidos }, venceuEm, naoGastou }
  const combate = lancado.combate === null ? null : semOGastoDaTecnica(lancado.combate, ctx.combateAntes)
  return { lancado: { ...lancado, golpe: novo, resolvidos, custo: [], combate }, venceuEm, naoGastou }
}
