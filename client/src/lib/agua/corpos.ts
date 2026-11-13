import type { Agua } from '../../types/map'
import { ajustesDaAgua, larguraDoRio } from './dados'
import { curvaGuardada } from './forma'
import { formasNaCaixa, margemDaBeira, type EntornoDaAgua } from './entorno'
import { CASA_U, buracoDoCampo, caixaDoCorpo, campoDoCorpo, comporCampo, porOBuraco, texelParaCaber, unirCaixas, uPorPx, type CaixaEmTexels, type CampoComposto, type CampoDoCorpo, type CorpoDoCampo } from './campo'

/**
 * ÁGUA: cada `Agua` do mapa (ou do recorte do jogador) vira o corpo do campo
 * (`campo.ts`), em unidades do protótipo. O jogador recebe a água já cortada
 * (`Agua.recorte`): os pontos vêm vazios e o corpo sai dos trechos.
 */

function rgbDe(hex: string): [number, number, number] {
  const v = Number.parseInt(hex.slice(1, 7), 16)
  return Number.isFinite(v) ? [(v >> 16) & 255, (v >> 8) & 255, v & 255] : [75, 135, 168]
}

const escalar = (xy: readonly number[], k: number): number[] => xy.map((v) => v * k)

/** Posição ao longo da polilinha, a partir de `s0`. */
function aoLongo(xy: readonly number[], s0: number): number[] {
  const s = [s0]
  for (let i = 2; i + 1 < xy.length; i += 2) s.push(s[s.length - 1] + Math.hypot(xy[i] - xy[i - 2], xy[i + 1] - xy[i - 1]))
  return s
}

/** O retângulo do mapa em u, ou nada (mapa sem tamanho, ou sem entorno). */
function limiteEmU(entorno: EntornoDaAgua | undefined, k: number): CorpoDoCampo['limite'] {
  const m = entorno?.mapa ?? null
  return m === null ? undefined : { x0: 0, y0: 0, x1: m.largura * k, y1: m.altura * k }
}

/** A marca de margem de cada linha (px de mundo), ou nada quando toda a beira é margem. */
function margemDasLinhas(linhas: readonly (readonly number[])[], entorno: EntornoDaAgua | undefined, grid: number): (Uint8Array | null)[] | undefined {
  if (entorno === undefined) return undefined
  const marcas = linhas.map((xy) => margemDaBeira(xy, entorno, grid))
  return marcas.some((m) => m !== null) ? marcas : undefined
}

/**
 * O corpo do campo desta água, ou `null` (forma que não fecha, recorte vazio).
 * `entorno` (`lib/agua/entorno.ts`): o mapa corta o campo e tira a margem da
 * beira na borda. Sem entorno, como antes.
 */
export function corpoDaAgua(agua: Agua, grid: number, entorno?: EntornoDaAgua): CorpoDoCampo | null {
  const k = uPorPx(grid)
  const ajustes = ajustesDaAgua(agua)
  const limite = limiteEmU(entorno, k)
  const base = { id: agua.id, tipo: agua.tipo, cor: rgbDe(agua.cor), velocidade: ajustes.velocidade, ondas: ajustes.ondas, espuma: ajustes.espuma, ...(limite === undefined ? {} : { limite }) }
  const recorte = agua.recorte
  if (agua.tipo === 'rio') {
    const meia = (larguraDoRio(agua) * CASA_U) / 2
    if (recorte !== undefined) {
      const trechos = (recorte.trechos ?? []).filter((t) => t.pontos.length >= 4).map((t) => {
        const xy = escalar(t.pontos, k)
        return { xy, s: aoLongo(xy, t.s0 * k) }
      })
      return trechos.length === 0 ? null : { ...base, meia, trechos }
    }
    const xy = escalar(curvaGuardada(agua, grid), k)
    return xy.length < 4 ? null : { ...base, meia, trechos: [{ xy, s: aoLongo(xy, 0) }] }
  }
  if (recorte !== undefined) {
    const chaves = new Set(recorte.celulas ?? [])
    if (chaves.size === 0) return null
    const linhas = (recorte.margens ?? []).filter((m) => m.length >= 4)
    const margem = margemDasLinhas(linhas, entorno, grid)
    return { ...base, margens: linhas.map((m) => escalar(m, k)), celulas: { lado: recorte.celula * k, chaves }, ...(margem === undefined ? {} : { margem }) }
  }
  const curva = curvaGuardada(agua, grid)
  if (curva.length < 6) return null
  const margem = margemDasLinhas([curva], entorno, grid)
  return { ...base, contorno: escalar(curva, k), ...(margem === undefined ? {} : { margem }) }
}

/** Uma lista de marcas em texto curto (trechos iguais juntos), para a chave do campo. */
function resumoDasMarcas(marcas: readonly (ArrayLike<number> | null)[] | undefined): string {
  if (marcas === undefined) return ''
  return marcas
    .map((m) => {
      if (m === null) return '-'
      let s = ''
      let atual = -1
      let vezes = 0
      for (let i = 0; i < m.length; i += 1) {
        const v = Math.round(m[i] * 255)
        if (v === atual) vezes += 1
        else {
          if (vezes > 0) s += `${atual}x${vezes},`
          atual = v
          vezes = 1
        }
      }
      return `${s}${atual}x${vezes}`
    })
    .join(';')
}

/** A chave do campo DESTE corpo: a forma da água e o que o entorno mudou nele (corte do mapa, margens). */
export function chaveDoCorpo(agua: Agua, corpo: CorpoDoCampo): string {
  return `${chaveDaForma(agua)}|${JSON.stringify(corpo.limite ?? null)}|${resumoDasMarcas(corpo.margem)}`
}

/** A chave que muda quando o campo desta água muda (forma, largura, linha reta, pincel de areia, recorte); cor e ajustes só recompõem. */
export function chaveDaForma(agua: Agua): string {
  return JSON.stringify([agua.tipo, agua.pontos, agua.tipo === 'rio' ? larguraDoRio(agua) : 0, agua.reto === true, agua.areia ?? null, agua.recorte ?? null])
}

/** O texel (u) que cabe todas as águas desta lista no teto de memória. */
export function texelDasAguas(corpos: readonly CorpoDoCampo[]): number {
  let caixa: CaixaEmTexels | null = null
  for (const c of corpos) caixa = unirCaixas(caixa, caixaDoCorpo(c, 1))
  return caixa === null ? 4 : texelParaCaber({ largura: caixa.w, altura: caixa.h })
}

/** Tudo de uma vez (a imagem exportada, o teste): o campo composto das águas, ou `null` sem água. */
export function campoDasAguas(aguas: readonly Agua[], grid: number, entorno?: EntornoDaAgua): CampoComposto | null {
  const corpos = aguas.map((a) => corpoDaAgua(a, grid, entorno)).filter((c): c is CorpoDoCampo => c !== null)
  if (corpos.length === 0) return null
  const texel = texelDasAguas(corpos)
  const lista: { corpo: CorpoDoCampo; campo: CampoDoCorpo }[] = corpos.map((corpo) => ({ corpo, campo: campoDoCorpo(corpo, texel) }))
  let caixa: CaixaEmTexels | null = null
  for (const { campo } of lista) caixa = unirCaixas(caixa, campo)
  if (caixa === null) return null
  const composto = comporCampo(lista, caixa, texel)
  porOBuraco(composto.f4, buracoDoCampo(composto, texel, formasDoBuraco(composto, entorno, grid)))
  return composto
}

/**
 * As formas do chão por cima da água (salas e Chão Liso, `EntornoDaAgua.porCima`)
 * que tocam a caixa do campo, em u: o buraco que a água abre (`buracoDoCampo`).
 */
export function formasDoBuraco(caixa: CaixaEmTexels & { texel: number }, entorno: EntornoDaAgua | undefined, grid: number): number[][][] {
  if (entorno === undefined || entorno.porCima.length === 0 || caixa.w <= 0 || caixa.h <= 0) return []
  const k = uPorPx(grid)
  const x0 = (caixa.x0 * caixa.texel) / k
  const y0 = (caixa.y0 * caixa.texel) / k
  const x1 = ((caixa.x0 + caixa.w) * caixa.texel) / k
  const y1 = ((caixa.y0 + caixa.h) * caixa.texel) / k
  return formasNaCaixa(entorno.porCima, x0, y0, x1, y1).map((f) => f.aneis.map((anel) => escalar(anel, k)))
}
