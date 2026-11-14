/**
 * VARAL DE LANTERNAS DE PAPEL de cima com volume (L09 dos objetos novos,
 * 14/11/2026, grupo Taverna e festa): os mesmos dois MASTROS e a mesma CORDA
 * com barriga do varal de bandeirinhas (`varalDeBandeirinhas.ts`), e, presas
 * nela, as LANTERNAS redondas de papel, acesas: vermelhas, âmbar e creme, que
 * se alternam. Cada uma tem o chapéu escuro de laca no alto, onde a corda
 * passa, os aros de bambu que dão a forma (anéis finos, mais escuros) e as
 * costuras do papel, e brilha de dentro: o miolo quase branco e quente e a
 * beira na cor do papel, em boa parte emissão (não pega sombra). No chão, a
 * POÇA de luz quente debaixo da fila, a sombra da corda e a de cada lanterna,
 * fracas (é a luz do dia; a de noite é a da ferramenta Luz).
 *
 * A luz DE VERDADE vem da ficha (o integrador põe a linha em
 * `LUZ_DOS_OBJETOS`, `lib/luzDoFogo.ts`); o brilho daqui é o que a lanterna
 * mostra mesmo sem ela.
 *
 * Uma esfera é quase igual vista de cima e na 3/4: cada lanterna é desenhada
 * uma vez só, como a esfera vista um pouco de cima e de frente (os aros são
 * arcos, o chapéu fica no polo de cima), sem a sanfona das bandeirinhas. Na
 * vista de cima o chapéu cai na linha da corda e o bojo fica ao sul dela; na
 * 3/4 a lanterna sobe a altura da corda e fica pendurada logo abaixo dela. A
 * estrutura de cada lanterna é o miolo, longe da linha da corda (senão os
 * pedaços da corda subiam com ela). A poça de luz é uma peça só, com o meio
 * da caixa longe de qualquer estrutura: fica no chão na 3/4.
 *
 * As lanternas têm medida própria: o varal esticado ganha mais lanternas.
 * Material: `madeira` (os mastros); a corda, o papel e o chapéu são fixos.
 */
import { misturar, type Rgb } from '../../ruido'
import { caixa, elipse, type Forma } from './formas'
import { ruido, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { circulo, comMeioEm, criarVaral, montarCorda, montarMastros, repartir, sombraDaCorda, vaoDaCorda, zDaCorda, type Varal } from './varalDeBandeirinhas'

/** A lanterna (casas): o raio, a folga entre duas e a folga até o mastro (px). */
const RAIO_DA_LANTERNA = 0.12
const FOLGA_ENTRE_LANTERNAS = 0.17
const FOLGA_DO_MASTRO = 3
/** A estrutura de cada lanterna (fração do raio): longe da linha da corda, para os pedaços dela não subirem junto. */
const MIOLO_DA_ESTRUTURA = 0.5

/** O papel das lanternas, na ordem em que se alternam (contidos: saturação até ~0,6). */
const PAPEIS: readonly Rgb[] = [
  [0xb0, 0x5c, 0x48],
  [0xc8, 0x96, 0x52],
  [0xd6, 0xc0, 0x96],
]
/** O miolo aceso, quase branco e quente, e quanto ele toma do papel no centro. */
const MIOLO: Rgb = [0xf4, 0xde, 0xb4]
const MIOLO_NO_CENTRO = 0.72
/** A parte da cor que não pega luz nem sombra: maior no miolo, menor na beira. */
const EMISSAO = { miolo: 0.62, beira: 0.3 } as const
/** De que altura a lanterna é vista (radianos acima do horizonte): a de cima e a 3/4 mostram o mesmo desenho. */
const ELEVACAO = 0.62
/** Os aros de bambu, as latitudes deles (radianos), a largura (radianos) e quanto escurecem. */
const AROS: readonly number[] = [-0.75, -0.38, 0, 0.38, 0.75]
const LARGURA_DO_ARO = 0.07
const SOMBRA_DO_ARO = 0.17
/** As costuras do papel (os meridianos): quantas em volta e quanto escurecem. */
const COSTURAS = 12
const SOMBRA_DA_COSTURA = 0.045
/** O chapéu de laca no polo de cima: as meias medidas (frações do raio). */
const CHAPEU = { largura: 0.36, altura: 0.2 } as const
const LACA: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x30, 0x2c] }
/** A sombra de cada lanterna, fraca. */
const FORCA_DA_SOMBRA = 0.1

/** A poça de luz no chão: a cor, o alfa no centro de cada lanterna e o raio (casas). */
const COR_DA_POCA: Rgb = [226, 170, 96]
const ALFA_DA_POCA = 0.12
const RAIO_DA_POCA = 0.42

/**
 * O papel aceso, ponto a ponto, como a esfera vista um pouco de cima e de
 * frente: os aros são os paralelos dela (arcos que se abrem para baixo, e não
 * anéis em volta do meio, que liam como rosca), as costuras são os
 * meridianos, e o miolo claro fica no meio, em boa parte emissão.
 */
function texDoPapel(cx: number, cy: number, raio: number, papel: Rgb): Textura {
  const eixoY = -Math.cos(ELEVACAO)
  const eixoZ = Math.sin(ELEVACAO)
  return (_u, _v, x, y, p, s) => {
    const nx = (x - cx) / raio
    const ny = (y - cy) / raio
    const r2 = Math.min(1, nx * nx + ny * ny)
    const nz = Math.sqrt(1 - r2)
    const cor = misturar(papel, MIOLO, MIOLO_NO_CENTRO * (1 - r2))
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    let luz = ruido(x * 0.7 + p.su, y * 0.7) * 0.03
    // O paralelo do ponto (a latitude na esfera de eixo inclinado) e o meridiano.
    const alto = ny * eixoY + nz * eixoZ
    const latitude = Math.asin(Math.max(-1, Math.min(1, alto)))
    for (const a of AROS) {
      const longe = Math.abs(latitude - a)
      if (longe < LARGURA_DO_ARO) luz -= SOMBRA_DO_ARO * (1 - longe / LARGURA_DO_ARO)
    }
    const deLado = ny * eixoZ - nz * eixoY
    const meridiano = (Math.atan2(nx, deLado) / (2 * Math.PI)) * COSTURAS
    if (Math.abs(meridiano - Math.round(meridiano)) < 0.05 && Math.abs(latitude) < 1.1) luz -= SOMBRA_DA_COSTURA
    s[3] += luz
    s[4] = EMISSAO.beira + (EMISSAO.miolo - EMISSAO.beira) * nz
  }
}

/** A poça de luz: a cor quente com o alfa que cai suave de cada lanterna, somado e limitado. */
function texDaPoca(v: Varal, meios: readonly number[], raio: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    let alfa = 0
    for (const xf of meios) {
      const q = Math.min(1, ((x - xf) * (x - xf) + (y - v.yCorda) * (y - v.yCorda)) / (raio * raio))
      alfa += ALFA_DA_POCA * (1 - q) * (1 - q)
    }
    s[0] = COR_DA_POCA[0]
    s[1] = COR_DA_POCA[1]
    s[2] = COR_DA_POCA[2]
    s[4] = 1
    s[5] = Math.min(ALFA_DA_POCA * 1.4, alfa)
  }
}

export const montarVaralDeLanternas: MontarMovel = (c, cena) => {
  const v = criarVaral(c, cena)
  const raio = RAIO_DA_LANTERNA * c.g
  const vao = vaoDaCorda(v) - FOLGA_DO_MASTRO
  const meios = repartir(-vao, vao, 2 * raio, FOLGA_ENTRE_LANTERNAS * c.g)
  const L = cena.partes

  // A POÇA de luz no chão, por baixo de tudo: o meio da caixa dela fica longe da corda (não sobe na 3/4).
  const poca = RAIO_DA_POCA * c.g
  const faixa: Forma = caixa(-vao - poca, v.yCorda - poca, vao + poca, v.yCorda + poca, poca)
  L.push(v.P(comMeioEm(faixa, 0, v.yCorda + poca), { classe: 'liso', rgb: COR_DA_POCA }, { textura: texDaPoca(v, meios, poca), bisel: 0, contorno: 0, semente: 9301 }))

  sombraDaCorda(v)
  // O polo de cima da esfera vista de lado, a partir do meio dela: é onde o chapéu fica, na linha da corda.
  const polo = Math.cos(ELEVACAO) * raio
  meios.forEach((xf, i) => {
    const cy = v.yCorda + polo
    const papel = PAPEIS[i % PAPEIS.length]
    // Uma estrutura só (a sombra fraca dela é a da lanterna), na altura da corda e menor que a distância até ela.
    cena.sombras.push({ forma: circulo(xf, cy, raio * MIOLO_DA_ESTRUTURA), z: zDaCorda(v, xf), solta: true, forca: FORCA_DA_SOMBRA })
    L.push(v.P(elipse(xf, cy, raio, raio), { classe: 'liso', rgb: papel }, { bisel: raio * 0.45, contorno: 0.2, textura: texDoPapel(xf, cy, raio, papel), semente: 9310 + i }))
    // O chapéu de laca no polo de cima: a corda passa por cima dele.
    const chapeu = elipse(xf, cy - polo, CHAPEU.largura * raio, CHAPEU.altura * raio)
    L.push(v.P(comMeioEm(chapeu, xf, cy), LACA, { bisel: CHAPEU.altura * raio * 0.8, contorno: 0.24, metal: 0.15, semente: 9340 + i }))
  })

  // A corda por cima dos chapéus, e os mastros, mais altos, por último.
  montarCorda(v)
  montarMastros(v, c.m.madeira)
}
