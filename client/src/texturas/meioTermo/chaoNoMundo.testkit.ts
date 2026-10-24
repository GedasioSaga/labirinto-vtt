/**
 * Ajudantes dos testes do chão sem repetição (MT7): o ladrilho de hoje de uma
 * textura do catálogo, o chão dela num mapa de prova, uma região do mundo
 * pintada PEDAÇO A PEDAÇO (os mesmos bytes que a tela recebe) e o desenho de
 * antes (o ladrilho repetido, como o `TilingSprite` com mipmap o mostra).
 *
 * Só para teste: nenhum código do app importa isto.
 */
import { writeFileSync } from 'node:fs'
import { texturaDoCatalogo } from '../catalogo'
import { LADO_DO_LADRILHO, pixelsDoLadrilho } from '../ladrilhos'
import { escalaDaTextura, ladoDoLadrilhoNoMundo } from '../../pixi/drawTexturas'
import { LADO_DO_PEDACO, mipDoLadrilho, pintarPedaco, sementeDoChao, torcaoDaTextura, type ChaoDaTextura, type ImagemDoLadrilho } from './chaoNoMundo'
import type { Cinza } from './repeticao.testkit'

/**
 * Mapa de prova: 30 x 20 casas de 64 px. As três texturas ficam com o
 * ladrilho no mínimo de 3 casas (192 px = 2 blocos de 96): o desenho de antes
 * repete EXATAMENTE a cada 2 blocos, o pior caso para a prova.
 */
export const MAPA_DE_PROVA = { width: 30, height: 20, grid: 64 }

/** Os três biomas medidos: grama (Campo verde), terra e floresta (a de copas, a de mais estrutura). */
export const BIOMAS = ['grama', 'terra', 'floresta'] as const

const ladrilhos = new Map<string, ImagemDoLadrilho>()

/** O ladrilho de hoje da textura, com o lado dela (o mesmo que `drawTexturas` gera). */
export function ladrilhoDe(id: string): ImagemDoLadrilho {
  const pronto = ladrilhos.get(id)
  if (pronto !== undefined) return pronto
  const textura = texturaDoCatalogo(id)
  if (textura === null) throw new Error(`textura ${id} fora do catálogo`)
  const lado = textura.lado ?? LADO_DO_LADRILHO
  const img = { lado, pixels: pixelsDoLadrilho(textura.cor, lado) }
  ladrilhos.set(id, img)
  return img
}

/** O chão da textura no mapa, com a semente e a torção que o app usa (`drawTexturas`). */
export function chaoDe(id: string, mapa: { width: number; height: number; grid: number } = MAPA_DE_PROVA): ChaoDaTextura {
  return {
    ladrilho: ladrilhoDe(id),
    ladoNoMundo: ladoDoLadrilhoNoMundo(mapa, escalaDaTextura(id)),
    semente: sementeDoChao(id),
    torcao: torcaoDaTextura(texturaDoCatalogo(id)),
  }
}

export interface Regiao {
  readonly largura: number
  readonly altura: number
  readonly rgba: Uint8ClampedArray
}

/** `colunas` x `linhas` pedaços a partir do pedaço (i0, j0), no nível pedido, colados numa imagem só. */
export function pintarRegiao(chao: ChaoDaTextura, i0: number, j0: number, colunas: number, linhas: number, nivel = 0): Regiao {
  const L = LADO_DO_PEDACO
  const largura = colunas * L
  const altura = linhas * L
  const rgba = new Uint8ClampedArray(largura * altura * 4)
  for (let j = 0; j < linhas; j += 1) {
    for (let i = 0; i < colunas; i += 1) {
      const px = pintarPedaco(chao, { i: i0 + i, j: j0 + j, nivel })
      for (let y = 0; y < L; y += 1) rgba.set(px.subarray(y * L * 4, (y + 1) * L * 4), ((j * L + y) * largura + i * L) * 4)
    }
  }
  return { largura, altura, rgba }
}

/**
 * O desenho de ANTES: o ladrilho repetido a partir da origem do mundo, lido
 * bilinear (o filtro linear do `TilingSprite`), um pixel a cada `passo` px do
 * mundo, no mip que a placa escolheria.
 */
export function pintarAntes(img: ImagemDoLadrilho, ladoNoMundo: number, largura: number, altura: number, passo = 1, x0 = 0, y0 = 0): Regiao {
  const r = img.lado / ladoNoMundo
  const m = r * passo < 2 ? 0 : Math.floor(Math.log2(r * passo))
  const tex = mipDoLadrilho(img, m)
  const L = tex.lado
  const escala = L / ladoNoMundo
  const rgba = new Uint8ClampedArray(largura * altura * 4)
  const volta = (n: number) => ((n % L) + L) % L
  for (let y = 0; y < altura; y += 1) {
    const v = (y0 + (y + 0.5) * passo) * escala - 0.5
    const iv = Math.floor(v)
    const fv = v - iv
    for (let x = 0; x < largura; x += 1) {
      const u = (x0 + (x + 0.5) * passo) * escala - 0.5
      const iu = Math.floor(u)
      const fu = u - iu
      const a = (volta(iv) * L + volta(iu)) * 4
      const b = (volta(iv) * L + volta(iu + 1)) * 4
      const c = (volta(iv + 1) * L + volta(iu)) * 4
      const d = (volta(iv + 1) * L + volta(iu + 1)) * 4
      const o = (y * largura + x) * 4
      for (let k = 0; k < 3; k += 1) {
        const p = tex.pixels
        rgba[o + k] = p[a + k] * (1 - fu) * (1 - fv) + p[b + k] * fu * (1 - fv) + p[c + k] * (1 - fu) * fv + p[d + k] * fu * fv
      }
      rgba[o + 3] = 255
    }
  }
  return { largura, altura, rgba }
}

/** Um recorte (x, y, w, h) da região. */
export function recortar(r: Regiao, x: number, y: number, w: number, h: number): Regiao {
  const rgba = new Uint8ClampedArray(w * h * 4)
  for (let j = 0; j < h; j += 1) rgba.set(r.rgba.subarray(((y + j) * r.largura + x) * 4, ((y + j) * r.largura + x + w) * 4), j * w * 4)
  return { largura: w, altura: h, rgba }
}

/**
 * Registra uma medida: no console e, com `MEDIDAS_MT7=<arquivo>`, também no
 * arquivo (o vitest 4 esconde o console dos testes que passam).
 */
const registradas: string[] = []
export function registrar(linha: string): void {
  console.log(linha)
  const arquivo: unknown = import.meta.env.MEDIDAS_MT7
  if (typeof arquivo !== 'string' || arquivo === '') return
  registradas.push(linha)
  writeFileSync(arquivo, new TextEncoder().encode(`${registradas.join('\n')}\n`))
}

/** A luz (Rec. 709, 0-255) de cada pixel, para as medidas de repetição. */
export function cinzaDe(r: Regiao): Cinza {
  const luz = new Uint8Array(r.largura * r.altura)
  for (let i = 0; i < luz.length; i += 1) luz[i] = Math.round(0.2126 * r.rgba[i * 4] + 0.7152 * r.rgba[i * 4 + 1] + 0.0722 * r.rgba[i * 4 + 2])
  return { largura: r.largura, altura: r.altura, luz }
}
