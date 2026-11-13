import type { Agua } from '../../types/map'
import { ajustesDaAgua, larguraDoRio } from './dados'
import { curvaGuardada } from './forma'
import { formaDaLisa, formasNaCaixa, lisasDaAgua, margemDaBeira, semAreiaDaBeira, type EntornoDaAgua, type PecaLisa } from './entorno'
import { CASA_U, buracoDoCampo, caixaDoCorpo, campoDoCorpo, comporCampo, porOBuraco, texelParaCaber, unirCaixas, uPorPx, type CaixaEmTexels, type CampoComposto, type CorpoDoCampo, type FormaDoBuraco } from './campo'

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

/** A marca de margem de cada linha (px de mundo), ou nada quando toda a beira é margem. `lisas`: o Chão Liso por cima desta água. */
function margemDasLinhas(linhas: readonly (readonly number[])[], entorno: EntornoDaAgua | undefined, grid: number, lisas: readonly PecaLisa[]): (Uint8Array | null)[] | undefined {
  if (entorno === undefined) return undefined
  const marcas = linhas.map((xy) => margemDaBeira(xy, entorno, grid, lisas))
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
  // O Chão Liso que fica por cima DESTA água (mais da metade dele nela), como quem vê a recebe.
  const lisas = lisasDaAgua(agua, grid, entorno)
  if (recorte !== undefined) {
    const chaves = new Set(recorte.celulas ?? [])
    if (chaves.size === 0) return null
    const linhas = (recorte.margens ?? []).filter((m) => m.length >= 4)
    const margem = margemDasLinhas(linhas, entorno, grid, lisas)
    const semAreia = semAreiaDasLinhas(linhas, agua, grid)
    return { ...base, margens: linhas.map((m) => escalar(m, k)), celulas: { lado: recorte.celula * k, chaves }, ...(margem === undefined ? {} : { margem }), ...(semAreia === undefined ? {} : { semAreia }) }
  }
  const curva = curvaGuardada(agua, grid)
  if (curva.length < 6) return null
  const margem = margemDasLinhas([curva], entorno, grid, lisas)
  const semAreia = semAreiaDasLinhas([curva], agua, grid)
  return { ...base, contorno: escalar(curva, k), ...(margem === undefined ? {} : { margem }), ...(semAreia === undefined ? {} : { semAreia }) }
}

/** A areia tirada pelo pincel em cada ponto de cada linha (px de mundo), ou nada sem pincel. */
function semAreiaDasLinhas(linhas: readonly (readonly number[])[], agua: Agua, grid: number): (Float32Array | null)[] | undefined {
  if (agua.areia === undefined || agua.areia.length === 0) return undefined
  const valores = linhas.map((xy) => semAreiaDaBeira(xy, agua.areia, grid))
  return valores.some((v) => v !== null) ? valores : undefined
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
  return `${chaveDaForma(agua)}|${JSON.stringify(corpo.limite ?? null)}|${resumoDasMarcas(corpo.margem)}|${resumoDasMarcas(corpo.semAreia)}`
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
  const corpos = aguas.flatMap((agua) => {
    const corpo = corpoDaAgua(agua, grid, entorno)
    return corpo === null ? [] : [{ agua, corpo }]
  })
  if (corpos.length === 0) return null
  const texel = texelDasAguas(corpos.map((c) => c.corpo))
  const lista = corpos.map(({ agua, corpo }) => ({ agua, corpo, campo: campoDoCorpo(corpo, texel) }))
  let caixa: CaixaEmTexels | null = null
  for (const { campo } of lista) caixa = unirCaixas(caixa, campo)
  if (caixa === null) return null
  const formas = formasDoBuraco({ ...caixa, texel }, entorno, grid, lista)
  const composto = comporCampo(lista, caixa, texel, formas.some((f) => f.soNas !== undefined))
  porOBuraco(composto.f4, buracoDoCampo(composto, texel, formas, composto.dono))
  return composto
}

/**
 * As formas do chão por cima da água que tocam a caixa do campo, em u: o
 * buraco que a água abre (`buracoDoCampo`). As salas (`EntornoDaAgua.porCima`)
 * em toda água; cada peça de Chão Liso só nas águas em que mais da metade dela
 * está (`lisasDaAgua`): `soNas` diz quais (a posição em `corpos`, a ordem do
 * campo composto) quando ela também toca outra água, que segue por cima dela.
 */
export function formasDoBuraco(caixa: CaixaEmTexels & { texel: number }, entorno: EntornoDaAgua | undefined, grid: number, corpos: readonly { agua: Agua; campo: CaixaEmTexels }[] = []): FormaDoBuraco[] {
  if (entorno === undefined || caixa.w <= 0 || caixa.h <= 0) return []
  const k = uPorPx(grid)
  const emPx = (c: CaixaEmTexels): { x0: number; y0: number; x1: number; y1: number } => ({ x0: (c.x0 * caixa.texel) / k, y0: (c.y0 * caixa.texel) / k, x1: ((c.x0 + c.w) * caixa.texel) / k, y1: ((c.y0 + c.h) * caixa.texel) / k })
  const r = emPx(caixa)
  const saida: FormaDoBuraco[] = formasNaCaixa(entorno.porCima, r.x0, r.y0, r.x1, r.y1).map((f) => ({ aneis: f.aneis.map((anel) => escalar(anel, k)) }))
  if (entorno.lisas.length === 0) return saida
  const nasAguas = new Map<PecaLisa, number[]>()
  corpos.forEach(({ agua }, i) => {
    for (const lisa of lisasDaAgua(agua, grid, entorno)) nasAguas.set(lisa, [...(nasAguas.get(lisa) ?? []), i])
  })
  const caixas = corpos.map(({ campo }) => emPx(campo))
  for (const [lisa, nas] of nasAguas) {
    const forma = formaDaLisa(lisa, entorno)
    if (forma === null || formasNaCaixa([forma], r.x0, r.y0, r.x1, r.y1).length === 0) continue
    const tocaOutra = caixas.some((c, i) => !nas.includes(i) && c.x1 >= forma.x0 && c.x0 <= forma.x1 && c.y1 >= forma.y0 && c.y0 <= forma.y1)
    saida.push({ aneis: forma.aneis.map((anel) => escalar(anel, k)), ...(tocaOutra ? { soNas: nas } : {}) })
  }
  return saida
}
