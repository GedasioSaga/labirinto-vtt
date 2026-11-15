/**
 * MURO DE FOGO de cima, PARADO (pedido do mestre de 15/11/2026,
 * `lib/mobilia/muroDeFogo.ts`): a faixa de chão queimado ao longo do traço, com
 * 1 casa de grossura. A fuligem, os pontos de cinza clara e a brasa no pé de
 * cada língua são os do objeto Fogo (`fogo.ts`). Sem material, como ele.
 *
 * As LÍNGUAS, o brilho, as fagulhas e a fumaça não entram na imagem: são a
 * camada animada `pixi/fogosDoMapa.ts`, que lê a mesma disposição
 * (`linguasDoMuro`). A imagem nunca é repintada por causa da animação.
 */
import { eixoDoMuro, linguasDoMuro, pontoNoEixo, simplificarEixo, type PontoDoMuro } from '../../../lib/mobilia/muroDeFogo'
import { elipse, type Forma } from './formas'
import type { Textura } from './motor'
import { CINZA, type MontarMovel } from './contexto'
import { RAIO_DA_BRASA, pintarFuligem, texBrasa, texCinzaClara } from './fogo'

/** Quanto a linha da imagem pode sair do traço, em fração da meia grossura (1 px do protótipo no muro de 1 casa). */
const AFINAR_O_EIXO = 0.04
/** Até onde, além da faixa, a distância ainda sai certa (px do protótipo): a borda suave do pintor. */
const FOLGA_DA_DISTANCIA = 4
/** Um ponto de cinza clara a cada duas línguas, mais 3 (a conta do Fogo). */
const CINZAS_POR_LINGUA = 0.5
/** Até onde os pontos de cinza saem da linha, em fração da meia grossura. */
const ALCANCE_DA_CINZA = 0.6

interface FaixaDoMuro {
  readonly forma: Forma
  /** Distância do ponto à linha, em px do protótipo. */
  distancia(x: number, y: number): number
}

/**
 * A faixa em volta da linha, como forma do pintor. A distância à linha sai por
 * uma GRADE de baldes: cada casa da grade guarda só os trechos que passam a
 * menos de uma faixa dela, então o custo por pixel não cresce com o tamanho do
 * traço (o traço à mão tem centenas de trechos, e a imagem, até 1 milhão de
 * pixels). O último ponto perguntado fica guardado: o pintor pergunta a forma
 * e, no mesmo pixel, a textura pergunta de novo.
 */
function faixaDoMuro(pontos: readonly PontoDoMuro[], meia: number): FaixaDoMuro {
  const n = pontos.length
  const alcance = meia + FOLGA_DA_DISTANCIA
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pontos) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const x0 = minX - alcance
  const y0 = minY - alcance
  const colunas = Math.max(1, Math.ceil((maxX + alcance - x0) / alcance))
  const linhas = Math.max(1, Math.ceil((maxY + alcance - y0) / alcance))
  const baldes: number[][] = Array.from({ length: colunas * linhas }, () => [])
  const coluna = (x: number): number => Math.min(colunas - 1, Math.max(0, Math.floor((x - x0) / alcance)))
  const linha = (y: number): number => Math.min(linhas - 1, Math.max(0, Math.floor((y - y0) / alcance)))
  for (let i = 1; i < n; i += 1) {
    const a = pontos[i - 1]
    const b = pontos[i]
    for (let l = linha(Math.min(a.y, b.y) - alcance); l <= linha(Math.max(a.y, b.y) + alcance); l += 1) {
      for (let c = coluna(Math.min(a.x, b.x) - alcance); c <= coluna(Math.max(a.x, b.x) + alcance); c += 1) baldes[l * colunas + c].push(i)
    }
  }
  // Longe de todo trecho a distância exata não importa: basta ficar fora da faixa.
  const longe = 4 * alcance * alcance
  let ultimoX = NaN
  let ultimoY = NaN
  let ultima = 0
  const distancia = (x: number, y: number): number => {
    if (x === ultimoX && y === ultimoY) return ultima
    let menor = longe
    const c = Math.floor((x - x0) / alcance)
    const l = Math.floor((y - y0) / alcance)
    if (c >= 0 && c < colunas && l >= 0 && l < linhas) {
      for (const i of baldes[l * colunas + c]) {
        const a = pontos[i - 1]
        const dx = pontos[i].x - a.x
        const dy = pontos[i].y - a.y
        const px = x - a.x
        const py = y - a.y
        let h = (px * dx + py * dy) / (dx * dx + dy * dy || 1e-9)
        h = h < 0 ? 0 : h > 1 ? 1 : h
        const qx = px - dx * h
        const qy = py - dy * h
        const dd = qx * qx + qy * qy
        if (dd < menor) menor = dd
      }
    }
    ultimoX = x
    ultimoY = y
    ultima = Math.sqrt(menor)
    return ultima
  }
  return { forma: { b: [minX - meia, minY - meia, maxX + meia, maxY + meia], d: (x, y) => distancia(x, y) - meia }, distancia }
}

export const montarMuroDeFogo: MontarMovel = (c, cena) => {
  const eixo = eixoDoMuro(c.w, c.h, c.tracado)
  if (eixo === null) return
  const { meia } = eixo
  const L = cena.partes
  // A faixa de fuligem: uma peça só pelo traço inteiro (em pedaços, a emenda de dois pedaços escurecia).
  const faixa = faixaDoMuro(simplificarEixo(eixo.pontos, meia * AFINAR_O_EIXO), meia)
  const texFaixa: Textura = (_u, _v, x, y, _p, s) => {
    const d = faixa.distancia(x, y) / meia
    pintarFuligem(x, y, d * d, s)
  }
  L.push(c.peca(faixa.forma, CINZA, { textura: texFaixa, bisel: 0, contorno: 0, semente: 300 }))
  const linguas = linguasDoMuro(eixo)
  // Pontos de cinza clara, sempre nos mesmos lugares da faixa.
  const cinzas = 3 + Math.floor(linguas.length * CINZAS_POR_LINGUA)
  for (let i = 0; i < cinzas; i += 1) {
    const p = pontoNoEixo(eixo, (eixo.comprimento * (i + 0.5)) / cinzas)
    const lado = Math.sin(i * 2.39996 + 1.1) * ALCANCE_DA_CINZA * meia
    const raio = 0.9 + (0.5 * ((i * 7) % 3)) / 2
    L.push(c.peca(elipse(p.x + p.nx * lado, p.y + p.ny * lado, raio, raio), CINZA, { textura: texCinzaClara, bisel: 0, contorno: 0, semente: 400 + i }))
  }
  // Uma brasa no pé de cada língua: a camada animada nasce exatamente aqui.
  linguas.forEach((lingua, i) => {
    const raio = RAIO_DA_BRASA * Math.max(0.6, Math.min(1.6, lingua.altura / c.g))
    L.push(c.peca(elipse(lingua.x, lingua.y, raio, raio * 0.75), CINZA, { textura: texBrasa(lingua.x, lingua.y, raio), bisel: 0, contorno: 0, semente: 500 + i }))
  })
}
