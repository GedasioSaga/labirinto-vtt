/**
 * JARDINEIRA de cima com volume (peça nova da MT5): desenho original inspirado
 * na jardineira do Estilo Mother da vila (`docs/design/vila-estilo-mother/
 * prototipo/mother.js`, `jardineira`): a caixa de tábuas com chanfro, a terra
 * escura afundada e uma fileira de flores de 5 pétalas em zigue-zague (a do
 * meio amarela, as outras laranja, todas com o miolo amarelo) com folhas
 * compridas entre elas. Material: `madeira`; terra, folhas e flores são fixas,
 * em tons contidos.
 *
 * Esticada no comprimento, ganha mais flores (uma a cada ~1/7 de casa da
 * caixa), nunca flores esticadas.
 */
import { rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, elipse, elipseGirada, uniao, type Forma } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'

const TERRA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('lenha', 0.78)) }
const FOLHA: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x74, 0x46] }
/** Laranja e amarelo da vila, contidos: saturação HSV 0,53 e 0,48 (os da vila passavam de 0,7). */
const LARANJA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#c98a5e') }
const AMARELO: MaterialDaPeca = { classe: 'liso', rgb: rgb('#d8c070') }

const texFolha: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.5 + p.su, y * 0.5 + p.sv) * 0.24
}

/** Altura da caixa em casas (a sombra). */
const ALTURA = 0.35
/**
 * A caixa sai sempre um pouco mais escura que a madeira: com a terra escura e as
 * flores claras por cima, a caixa clara (pinho) dava a média na luz do chão padrão
 * e a jardineira virava mancha a 1x.
 */
const TOM_DA_CAIXA = 0.84

export const montarJardineira: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, peca: P } = c
  const deitada = w >= h
  const comprido = deitada ? w : h
  const curto = deitada ? h : w
  const noMundo = (u: number, v: number): [number, number] => (deitada ? [u, v] : [v, u])
  const borda = Math.min(0.2 * curto, 0.12 * comprido)
  const caixaToda = caixa(-hw, -hh, hw, hh, Math.min(2.6, curto * 0.12))
  cena.sombras.push({ forma: caixaToda, z: c.g * ALTURA }, contato(caixaToda, 0.28))
  const L = cena.partes
  L.push(P(caixaToda, c.m.madeira, { eixo: deitada ? 0 : Math.PI / 2, tabua: curto / 3, bisel: 1.4, contorno: 0.26, tom: TOM_DA_CAIXA, semente: 10 }))
  L.push(P(caixa(-hw + borda, -hh + borda, hw - borda, hh - borda, 1.5), TERRA, { bisel: 0, contorno: 0, recesso: { k: 1.3, forca: 0.32 }, semente: 11 }))
  const n = Math.max(3, Math.round((7 * comprido) / c.g))
  const passo = (comprido - 2 * borda) / n
  const raio = Math.min(passo * 0.66, (curto - 2 * borda) * 0.42)
  const desvio = (curto - 2 * borda) * 0.14
  // Folhas primeiro, entre as flores: alongadas (1,6 : 1, a mesma área do disco de antes), inclinadas
  // para um lado e para o outro; depois as flores por cima, em zigue-zague.
  const folhaLonga = raio * 0.75 * Math.sqrt(PROPORCAO_DA_FOLHA)
  const eixoDaCaixa = deitada ? 0 : Math.PI / 2
  for (let i = 0; i <= n; i += 1) {
    const u = -comprido / 2 + borda + passo * i
    const [x, y] = noMundo(u, (i % 2 ? -1 : 1) * desvio)
    const angulo = eixoDaCaixa + (i % 2 ? -1 : 1) * INCLINACAO_DA_FOLHA
    L.push(P(elipseGirada(x, y, folhaLonga, folhaLonga / PROPORCAO_DA_FOLHA, angulo), FOLHA, { textura: texFolha, bisel: raio * 0.35, contorno: 0.16, semente: 20 + i }))
  }
  for (let i = 0; i < n; i += 1) {
    const u = -comprido / 2 + borda + passo * (i + 0.5)
    const [x, y] = noMundo(u, (i % 2 ? 1 : -1) * desvio)
    const flor = i === Math.floor(n / 2) ? AMARELO : LARANJA
    L.push(P(florDeCincoPetalas(x, y, raio, i), flor, { bisel: raio * 0.3, contorno: 0.16, tom: 0.97, semente: 40 + i }))
    L.push(P(elipse(x, y, raio * 0.35, raio * 0.35), AMARELO, { bisel: 0, contorno: 0, tom: flor === AMARELO ? 0.86 : 1.02, semente: 60 + i }))
  }
}

/** Folha da jardineira: comprida e estreita, inclinada em relação à caixa. */
const PROPORCAO_DA_FOLHA = 1.6
const INCLINACAO_DA_FOLHA = 0.6

/**
 * A FLOR de 5 pétalas (revisão de design da MT5: as bolas lisas com brilho
 * eram iguais às frutas da barraca e a jardineira a 3x lia como caixote de
 * laranjas): 5 círculos a meio raio do centro, de raio 0,45 a 0,55 R, numa
 * forma só (um contorno por fora, sem risco entre as pétalas). O giro de cada
 * flor sai do índice, para a fileira não sair carimbada.
 */
function florDeCincoPetalas(x: number, y: number, R: number, i: number): Forma {
  const giro = i * 0.9
  let flor: Forma | null = null
  for (let k = 0; k < 5; k += 1) {
    const a = giro + (k * Math.PI * 2) / 5
    const r = R * (k % 2 ? 0.45 : 0.55)
    const petala = elipse(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5, r, r)
    flor = flor === null ? petala : uniao(flor, petala)
  }
  return flor ?? elipse(x, y, R, R)
}
