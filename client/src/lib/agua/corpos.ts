import type { Agua } from '../../types/map'
import { ajustesDaAgua, larguraDoRio } from './dados'
import { curvaGuardada } from './forma'
import { CASA_U, caixaDoCorpo, campoDoCorpo, comporCampo, texelParaCaber, unirCaixas, uPorPx, type CaixaEmTexels, type CampoComposto, type CampoDoCorpo, type CorpoDoCampo } from './campo'

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

/** O corpo do campo desta água, ou `null` (forma que não fecha, recorte vazio). */
export function corpoDaAgua(agua: Agua, grid: number): CorpoDoCampo | null {
  const k = uPorPx(grid)
  const ajustes = ajustesDaAgua(agua)
  const base = { id: agua.id, tipo: agua.tipo, cor: rgbDe(agua.cor), velocidade: ajustes.velocidade, ondas: ajustes.ondas, espuma: ajustes.espuma }
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
    return { ...base, margens: (recorte.margens ?? []).filter((m) => m.length >= 4).map((m) => escalar(m, k)), celulas: { lado: recorte.celula * k, chaves } }
  }
  const contorno = escalar(curvaGuardada(agua, grid), k)
  return contorno.length < 6 ? null : { ...base, contorno }
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
export function campoDasAguas(aguas: readonly Agua[], grid: number): CampoComposto | null {
  const corpos = aguas.map((a) => corpoDaAgua(a, grid)).filter((c): c is CorpoDoCampo => c !== null)
  if (corpos.length === 0) return null
  const texel = texelDasAguas(corpos)
  const lista: { corpo: CorpoDoCampo; campo: CampoDoCorpo }[] = corpos.map((corpo) => ({ corpo, campo: campoDoCorpo(corpo, texel) }))
  let caixa: CaixaEmTexels | null = null
  for (const { campo } of lista) caixa = unirCaixas(caixa, campo)
  return caixa === null ? null : comporCampo(lista, caixa, texel)
}
