/**
 * ARCOSSÓLIO (lote L06 de 24/11/2026, item 58: construção, dos quatro arcos do norte do grande salão da cripta do
 * mapa 8; desenho próprio, só a ideia do objeto). Um trecho de PAREDE de pedra com o NICHO EM ARCO: as ombreiras com
 * a imposta, a ARQUIVOLTA de aduelas com a chave (um cabochão de cristal engastado nela) e, dentro, o JAZIGO: a arca
 * de três painéis sobre o degrau, com a tampa de duas águas. Atrás e dos lados da arca nasceram CRISTAIS ciano, e a
 * luz fria deles enche a boca do arco: o fundo do nicho clareia de baixo para cima, o intradorso pega um fio de luz
 * e a soleira, na frente, um claro. Barra a passagem e tapa a visão (regra de fábrica da construção).
 *
 * DESENHADO DE FRENTE nas duas vistas (perfil `EM_PE`), como o nicho funerário e o columbário do lote L05: de cima, um
 * arco na parede é só o alto de um muro. A parede é a beira de cima da pegada; a luz de verdade é a do integrador
 * (`LUZ_DOS_OBJETOS`). Material: `pedra`; o cristal e o musgo são fixos.
 */
import { hash } from '../../ruido'
import { cadeia, caixa, dentroDe, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'
import { ESCURO_DA_PEDRA } from './apoioDasReferencias'
import { banhada, CIANO, CRISTAL, MUSGO_DA_CRIPTA, texHaloFrio, tomDoCristal, type FonteFria } from './pedestalComCristal'

/** A altura do muro em casas (a sombra comprida) e quanto ele sobe acima da pegada (o teto do plano é 0,2). */
const ALTURA = 1.2
const SUBIDA = 0.18
/** A faixa do alto que pega a luz, a cornija, o pé e a soleira (px). */
const TOPO = 3.6
const CORNIJA = 3
const PE = 2
const SOLEIRA = 6
/** O vão do arco: a meia largura (fração da meia largura do muro), a flecha e a nascente (px acima da soleira). */
const MEIO_VAO = 0.62
const FLECHA = 23
const NASCENTE = 17
/** A arquivolta (a grossura das aduelas, px) e quantas aduelas dão o arco (ímpar: a do meio é a chave). */
const ARQUIVOLTA = 6.4
const ADUELAS = 9
/** O fundo do nicho: o escuro frio da pedra, que o piso de luz segura. */
const FUNDO: MaterialDaPeca = { classe: 'liso', rgb: [0x35, 0x38, 0x3b] }
const SEMENTE = 5800

/** A forma encolhida `d` px para dentro. */
function encolhida(f: Forma, d: number): Forma {
  return { b: f.b, d: (x, y) => f.d(x, y) + d }
}

/** A cor pura do cristal, com a parte que não pega sombra. */
function corAcesa(cor: readonly [number, number, number], emissao: number): Textura {
  return (_u, _v, _x, _y, _p, s) => {
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = emissao
  }
}

/**
 * Um prisma de cristal DE FRENTE: do pé (x, y) sobe `alto` px, pendendo `pende` px por px; a face da esquerda acesa,
 * a da direita no escuro, a faceta da ponta quase branca e o fio de reflexo na quina.
 */
function prismaDeFrente(c: ContextoDoMovel, L: Peca[], x: number, y: number, meia: number, alto: number, pende: number, semente: number): void {
  const P = c.peca
  const ombro: Ponto = [x + pende * alto * 0.7, y - alto * 0.7]
  const bico: Ponto = [x + pende * alto, y - alto]
  const quina = meia * 0.24
  const face = (pontos: readonly Ponto[], tom: number, clareia = 0): void => {
    const cor = tomDoCristal(tom)
    const final: [number, number, number] = [cor[0] + (CIANO.reflexo[0] - cor[0]) * clareia, cor[1] + (CIANO.reflexo[1] - cor[1]) * clareia, cor[2] + (CIANO.reflexo[2] - cor[2]) * clareia]
    L.push(P(poligono(pontos), CRISTAL, { tabua: 0, bisel: 0, contorno: 0.16, textura: corAcesa(final, 0.6), semente }))
  }
  face([[x - meia, y], [ombro[0] - meia, ombro[1]], bico, [ombro[0] + quina, ombro[1]], [x + quina, y]], 0.78)
  face([[x + quina, y], [ombro[0] + quina, ombro[1]], bico, [ombro[0] + meia, ombro[1]], [x + meia, y]], 0.26)
  face([[ombro[0] - meia, ombro[1]], bico, [ombro[0] + quina, ombro[1]]], 1, 0.4)
  L.push(P(cadeia([[x + quina, y], [ombro[0] + quina, ombro[1]], bico], 0.17), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.6, textura: corAcesa(CIANO.reflexo, 1), semente: semente + 1 }))
}

export const montarArcossolio: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  const daPedra = texturaDaClasse(pedra.classe)
  cena.corDoPiso = ESCURO_DA_PEDRA
  const x = hw - 2
  const yPe = hh - PE
  const ySoleira = yPe - SOLEIRA
  const yAlto = -hh - SUBIDA * g
  const yFace = yAlto + TOPO
  // O vão: reto até a nascente, em arco abatido dali para cima.
  const a = x * MEIO_VAO
  const yNascente = ySoleira - NASCENTE
  const b = Math.min(FLECHA, yNascente - yFace - CORNIJA - ARQUIVOLTA - 1.6)
  const meiaElipse = (rx: number, ry: number): Forma => dentroDe(elipse(0, yNascente, rx, ry), caixa(-rx - 1, yNascente - ry - 1, rx + 1, yNascente + 0.4))
  const vao = uniao(caixa(-a, yNascente, a, ySoleira), meiaElipse(a, b))
  /** O ponto do arco no ângulo `t` (0 = a nascente da direita, pi = a da esquerda), `fora` px para fora do intradorso. */
  const noArco = (t: number, fora: number): Ponto => [Math.cos(t) * (a + fora), yNascente - Math.sin(t) * (b + fora)]

  // A luz dos cristais: dos dois lados da arca, dentro do nicho.
  const fontes: FonteFria[] = [
    { x: -a + 8, y: ySoleira - 9, r: 17, forca: 0.5 },
    { x: a - 8, y: ySoleira - 8, r: 14, forca: 0.44 },
  ]
  const naPedra = banhada(daPedra, fontes)
  const juntaDaPedra = { tabua: 0, bisel: 0, contorno: 0, tom: 0.6, alfa: 0.7 }

  // A sombra do muro e o contato no pé.
  cena.sombras.push({ forma: caixa(-x, yPe - 1.6, x, yPe, 0.6), z: g * ALTURA, forca: 0.3 }, contato(caixa(-x - 1.5, yPe - 1.2, x + 1.5, yPe + 1.2, 1), 0.34))

  // O MURO: o alto que pega a luz (atrás) e a face, com as juntas das fiadas dos lados e dos cantos de cima.
  L.push(P(caixa(-x, yAlto, x, yPe - TOPO, 0.6), pedra, { tabua: 0, bisel: 1, tom: 1.1, semente: SEMENTE }))
  L.push(P(caixa(-x, yFace, x, yPe, 0.6), pedra, { tabua: 0, bisel: 1.1, tom: 0.8, contorno: 0.3, semente: SEMENTE + 1 }))
  const xLado = a + ARQUIVOLTA + 1
  for (const lado of [-1, 1]) {
    ;[0.2, 0.52, 0.82].forEach((fy, k) => {
      const y = yFace + CORNIJA + (ySoleira - yFace - CORNIJA) * fy
      // Em cima da nascente a fiada vai só até a arquivolta.
      const ate = y < yNascente ? Math.max(xLado, Math.sqrt(Math.max(0, 1 - ((yNascente - y) / (b + ARQUIVOLTA)) ** 2)) * (a + ARQUIVOLTA) + 1) : xLado
      const [x0, x1] = lado < 0 ? [-x + 0.6, -ate] : [ate, x - 0.6]
      if (x1 - x0 > 2) L.push(P(caixa(x0, y - 0.3, x1, y + 0.3, 0.2), pedra, { ...juntaDaPedra, semente: SEMENTE + 2 + k }))
    })
    L.push(P(caixa(lado * (x - 7) - 0.3, yFace + CORNIJA + 0.6, lado * (x - 7) + 0.3, yFace + CORNIJA + (ySoleira - yFace - CORNIJA) * 0.2 - 0.6, 0.2), pedra, { ...juntaDaPedra, semente: SEMENTE + 5 }))
  }

  // ---------- dentro do nicho: o fundo, a luz fria e o JAZIGO ----------
  L.push(P(vao, FUNDO, { tabua: 0, bisel: 0, contorno: 0.2, recesso: { k: 2.4, forca: 0.36 }, semente: SEMENTE + 10 }))
  L.push(P(dentroDe(elipse(0, ySoleira - 7, a * 1.2, b + NASCENTE + 2), vao), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(0, ySoleira - 7, a * 1.2, b + NASCENTE + 2, 0.62), semente: SEMENTE + 11 }))
  // Os cristais de trás: o grande da esquerda e o da direita saem de trás da arca.
  prismaDeFrente(c, L, -a + 9.4, ySoleira - 4, 2.7, 19.5, -0.1, SEMENTE + 20)
  prismaDeFrente(c, L, -a + 14.6, ySoleira - 4, 2.1, 14.6, 0.24, SEMENTE + 22)
  prismaDeFrente(c, L, a - 9.6, ySoleira - 4, 2.4, 16, 0.14, SEMENTE + 24)

  // A arca: o degrau, o corpo com os três painéis rebaixados e a tampa de duas águas.
  const [dx0, dx1] = [-a + 5, a - 5]
  const [cx0, cx1] = [dx0 + 2.6, dx1 - 2.6]
  const yDegrau = ySoleira - 3.6
  const yCorpo = yDegrau - 9
  const yTampa = yCorpo - 4.4
  L.push(P(caixa(dx0, yDegrau, dx1, ySoleira, 0.4), pedra, { tabua: 0, bisel: 0.7, tom: 0.84, contorno: 0.28, textura: naPedra, semente: SEMENTE + 30 }))
  L.push(P(caixa(cx0, yCorpo, cx1, yDegrau, 0.4), pedra, { tabua: 0, bisel: 0.9, tom: 0.94, contorno: 0.28, textura: naPedra, semente: SEMENTE + 31 }))
  const painel = (cx1 - cx0 - 4) / 3
  for (let k = 0; k < 3; k += 1) {
    const px = cx0 + 2 + painel * (k + 0.5)
    const py = (yCorpo + yDegrau) / 2 + 0.2
    L.push(P(caixa(px - painel / 2 + 1, yCorpo + 2, px + painel / 2 - 1, yDegrau - 1.6, 0.4), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.74, recesso: { k: 0.8, forca: 0.3 }, textura: naPedra, semente: SEMENTE + 32 + k }))
    L.push(P(poligono([[px, py - 2.3], [px + 2.5, py], [px, py + 2.3], [px - 2.5, py]]), pedra, { tabua: 0, bisel: 0.5, tom: 1, contorno: 0.2, textura: naPedra, semente: SEMENTE + 35 + k }))
  }
  const tampa = poligono([[cx0 - 1.6, yCorpo + 0.6], [cx0 - 0.8, yCorpo - 1.6], [cx0 + 4, yTampa], [cx1 - 4, yTampa], [cx1 + 0.8, yCorpo - 1.6], [cx1 + 1.6, yCorpo + 0.6]])
  L.push(P(tampa, pedra, { tabua: 0, bisel: 1, tom: 1.04, contorno: 0.28, textura: naPedra, projeta: { dist: 0.9, forca: 0.3 }, semente: SEMENTE + 40 }))
  L.push(P(caixa(cx0 + 4.4, yTampa + 0.5, cx1 - 4.4, yTampa + 1.3, 0.3), pedra, { tabua: 0, bisel: 0.3, tom: 1.16, contorno: 0, semente: SEMENTE + 41 }))
  // Os cristais da frente: as lascas no degrau e a que nasceu em cima da tampa.
  prismaDeFrente(c, L, -a + 5.6, ySoleira - 0.2, 1.7, 9.4, -0.28, SEMENTE + 50)
  prismaDeFrente(c, L, a - 5.4, ySoleira - 0.2, 1.6, 8.2, 0.3, SEMENTE + 52)
  prismaDeFrente(c, L, a - 13.4, ySoleira - 0.2, 1.3, 5, -0.12, SEMENTE + 54)
  prismaDeFrente(c, L, cx1 - 9, yTampa + 0.4, 1.4, 6.4, 0.16, SEMENTE + 56)

  // O fio de luz no INTRADORSO: a beira de dentro do vão, mais forte perto dos cristais.
  L.push(P(dentroDe(menos(vao, encolhida(vao, 1.3)), caixa(-a - 1, yNascente - b - 1, a + 1, ySoleira - 0.4)), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(0, ySoleira - 4, a * 1.5, (b + NASCENTE) * 1.45, 0.62), semente: SEMENTE + 60 }))

  // ---------- a moldura do nicho: as ombreiras, a imposta, a ARQUIVOLTA e a chave ----------
  for (const lado of [-1, 1]) {
    const [x0, x1] = lado < 0 ? [-a - ARQUIVOLTA, -a] : [a, a + ARQUIVOLTA]
    L.push(P(caixa(x0, yNascente, x1, ySoleira, 0.4), pedra, { tabua: 0, bisel: 1, tom: 0.96, contorno: 0.28, textura: naPedra, projeta: { dist: 1.2, forca: 0.3 }, semente: SEMENTE + 70 }))
    L.push(P(caixa(x0 - 0.3, yNascente + NASCENTE * 0.52, x1 + 0.3, yNascente + NASCENTE * 0.52 + 0.6, 0.2), pedra, { ...juntaDaPedra, semente: SEMENTE + 71 }))
  }
  const arquivolta = menos(meiaElipse(a + ARQUIVOLTA, b + ARQUIVOLTA), elipse(0, yNascente, a, b))
  L.push(P(arquivolta, pedra, { tabua: 0, bisel: 1.1, tom: 1, contorno: 0.28, textura: naPedra, projeta: { dist: 1.4, forca: 0.32 }, semente: SEMENTE + 72 }))
  for (let k = 1; k < ADUELAS; k += 1) {
    // As juntas das aduelas, menos as duas da chave (ela é uma peça por cima).
    if (k === (ADUELAS - 1) / 2 || k === (ADUELAS + 1) / 2) continue
    const t = (k / ADUELAS) * Math.PI
    L.push(P(cadeia([noArco(t, 0.5), noArco(t, ARQUIVOLTA - 0.5)], 0.3), pedra, { ...juntaDaPedra, tom: 0.56 + 0.06 * hash(k, 1, SEMENTE), semente: SEMENTE + 73 }))
  }
  for (const lado of [-1, 1]) {
    const xi = lado * (a + ARQUIVOLTA / 2)
    L.push(P(caixa(xi - ARQUIVOLTA / 2 - 1, yNascente - 1.5, xi + ARQUIVOLTA / 2 + 1, yNascente + 1.7, 0.4), pedra, { tabua: 0, bisel: 0.8, tom: 1.1, contorno: 0.26, projeta: { dist: 0.8, forca: 0.26 }, semente: SEMENTE + 80 }))
  }
  const [t0, t1] = [((ADUELAS + 1) / 2 / ADUELAS) * Math.PI, ((ADUELAS - 1) / 2 / ADUELAS) * Math.PI]
  const chave = poligono([noArco(t0, -0.6), noArco(t0 + 0.02, ARQUIVOLTA + 1.5), noArco(t1 - 0.02, ARQUIVOLTA + 1.5), noArco(t1, -0.6)])
  L.push(P(chave, pedra, { tabua: 0, bisel: 0.9, tom: 1.12, contorno: 0.28, projeta: { dist: 0.9, forca: 0.28 }, semente: SEMENTE + 81 }))
  // O cabochão de cristal engastado na chave.
  const yChave = yNascente - b - ARQUIVOLTA * 0.5
  L.push(P(poligono([[0, yChave - 2.3], [1.7, yChave], [0, yChave + 2.3], [-1.7, yChave]]), CRISTAL, { tabua: 0, bisel: 0.5, contorno: 0.22, textura: corAcesa(tomDoCristal(0.74), 0.6), semente: SEMENTE + 82 }))
  L.push(P(poligono([[0, yChave - 1.3], [0.7, yChave - 0.3], [0, yChave + 0.2], [-0.8, yChave - 0.4]]), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.8, textura: corAcesa(CIANO.reflexo, 1), semente: SEMENTE + 83 }))

  // A CORNIJA no alto e a SOLEIRA no pé, com o claro frio que sai da boca do arco.
  L.push(P(caixa(-x - 1.4, yFace, x + 1.4, yFace + CORNIJA, 0.4), pedra, { tabua: 0, bisel: 0.8, tom: 0.96, contorno: 0.28, projeta: { dist: 1.1, forca: 0.3 }, semente: SEMENTE + 90 }))
  for (const xj of [-0.58, 0.08, 0.6]) L.push(P(caixa(xj * x - 0.3, yFace + 0.5, xj * x + 0.3, yFace + CORNIJA - 0.5, 0.2), pedra, { ...juntaDaPedra, semente: SEMENTE + 91 }))
  const naSoleira = banhada(daPedra, [{ x: 0, y: ySoleira, r: a * 0.8, forca: 0.4 }])
  L.push(P(caixa(-x - 1.4, ySoleira, x + 1.4, ySoleira + 1.6, 0.4), pedra, { tabua: 0, bisel: 0.5, tom: 1.12, contorno: 0.24, textura: naSoleira, semente: SEMENTE + 92 }))
  L.push(P(caixa(-x - 1.4, ySoleira + 1.6, x + 1.4, yPe, 0.5), pedra, { tabua: 0, bisel: 0.8, tom: 0.72, contorno: 0.3, textura: naSoleira, semente: SEMENTE + 93 }))
  for (const xj of [-0.7, -0.24, 0.2, 0.66]) L.push(P(caixa(xj * x - 0.3, ySoleira + 2.2, xj * x + 0.3, yPe - 0.5, 0.2), pedra, { ...juntaDaPedra, semente: SEMENTE + 94 }))

  // As marcas do tempo: a trinca do canto de cima e o MUSGO no pé.
  const trinca: Ponto[] = [[-x + 1, yFace + CORNIJA + 3], [-x + 6, yFace + CORNIJA + 6.6], [-x + 7.4, yFace + CORNIJA + 11], [-x + 12, yFace + CORNIJA + 13.4]]
  L.push(P(cadeia(trinca, 0.3), pedra, { tabua: 0, bisel: 0, tom: 0.44, contorno: 0, semente: SEMENTE + 95 }))
  L.push(P(elipse(x - 9, yPe - 0.8, 8, 1.6), MUSGO_DA_CRIPTA, { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.5, suave: 0.9, semente: SEMENTE + 96 }))
  L.push(P(elipse(-x + 3, ySoleira - 1.4, 2.4, 3.4), MUSGO_DA_CRIPTA, { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.45, suave: 0.9, semente: SEMENTE + 97 }))
}
