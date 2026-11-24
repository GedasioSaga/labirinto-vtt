/**
 * CAMA DE TRAPOS de cima com volume (lote L11 dos objetos de 24/11/2026, "Arena e cortiço"; objeto novo). Onde dorme
 * quem não tem catre: um NINHO de panos velhos jogados uns por cima dos outros, cada um para um lado, sem nenhum lado
 * reto. Por baixo, a ESTOPA de saco aberta; em cima dela, um COBERTOR cinza atravessado (girado uns 15 graus); por
 * cima de tudo, a MANTA de dormir, amassada, que escorrega para um lado e passa da estopa, com a ponta de cima virada
 * para trás (o avesso escuro à mostra), dois REMENDOS de outra cor costurados a traços curtos, um rasgo e as pregas.
 * No meio, a COVA de quem dormiu ali. Na cabeceira, o ROLO de pano amarrado com duas voltas de corda, que serve de
 * travesseiro; de um lado, um trapo azul que sobrou. A PALHA de baixo só aparece em TUFOS soltos que escapam aqui e
 * ali (em anel, por toda a volta, lia como um cesto de vime por baixo).
 *
 * A 25% de zoom sobram a mancha comprida e torta em três panos de cores diferentes (areia, cinza e a manta), o rolo
 * claro na ponta e uns fiapos de palha: não é a Esteira de palha (um retângulo bege) nem um saco de dormir.
 * A cabeceira fica em cima no giro 0.
 *
 * Na 3/4 (`{ modo: 'derivado', espessura: 0,1 casa }`) o ninho é uma coluna baixa e o rolo, um tampo grosso em cima
 * dele (a caixa da sombra do rolo desce até o pé da cama, para ele ser pintado depois). Material: `pano` (a manta;
 * sugestão: lã musgo; o ocre fica de fora, colava na estopa e na palha), sempre desbotado: a cor escolhida entra
 * puxada para o cinza do pano velho. Os outros panos são fixos, em cores apagadas. Medidas de 1 x 2 casas.
 */
import { hash } from '../../ruido'
import { cadeia, capsula, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type CriarPeca, type MaterialDaPeca, type Peca } from './motor'
import { materialDaPeca, type MontarMovel } from './contexto'
import { bolha, comMeioEm, girada } from './fossoDeArena'

/** Alturas (casas): o ninho e o alto do rolo. */
const ALTURA_DO_NINHO = 0.1
const ALTURA_DO_ROLO = 0.22
/** Os panos fixos: a estopa, o cobertor cinza, o rolo da cabeceira, o trapo azul, os dois remendos e a sombra da cova. */
const ESTOPA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x9a, 0x8a, 0x6c] }
const COBERTOR: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x80, 0x7c, 0x76] }
const ROLO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xb4, 0xa4, 0x82] }
const TRAPO: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x5f, 0x6e, 0x7a] }
const REMENDO_VINHO: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x86, 0x54, 0x4e] }
const REMENDO_CRU: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xb2, 0xa6, 0x8c] }
const COVA: MaterialDaPeca = { classe: 'liso', rgb: [0x36, 0x2c, 0x26] }
/** A linha da costura dos remendos: escura e meio apagada, em traços curtos (os pontos claros em anel liam como biscoito). */
const LINHA: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0x9c, 0x84] }
const ALFA_DA_LINHA = 0.45
const PONTOS_DA_COSTURA = 9
/** A manta é velha: a cor escolhida vai puxada para o cinza do pano desbotado, este tanto. */
const DESBOTADO = [0x8c, 0x86, 0x7a] as const
const QUANTO_DESBOTA = 0.42
/** O quanto a beira de cada pano ondula (fração do raio) e o quanto ele é redondo (2 = elipse; quanto maior, mais retângulo). */
const ONDA = 0.17
const REDONDO = 2.7
/**
 * Os TUFOS de palha que escapam de baixo dos panos: o rumo de cada um a partir do meio do ninho (rad; 0 = direita,
 * π/2 = para baixo) e quantos fiapos. Poucos e soltos, cada um num lugar; cada fiapo nasce debaixo da beira do pano
 * e sai para um lado (em leque a partir de um ponto, o tufo lia como um pé de galinha).
 */
const TUFOS: readonly (readonly [number, number])[] = [
  [3.62, 4],
  [2.96, 3],
  [2.2, 4],
  [1.42, 3],
  [5.72, 3],
]
/** De onde os rumos dos tufos são medidos (px no tamanho de partida) e quanto um fiapo fica do vizinho, pela beira (rad). */
const MEIO_DO_NINHO: readonly [number, number] = [0, 8]
const ENTRE_FIAPOS = 0.085

/**
 * Um PANO estendido e amassado: a volta de um retângulo de cantos bem redondos (meios lados `mx` e `my`), com a
 * beira ondulada em três ondas de fases sorteadas por `semente`, girado `volta` radianos.
 */
function pano(cx: number, cy: number, mx: number, my: number, volta: number, semente: number, onda = ONDA): Forma {
  const [f1, f2, f3] = [hash(semente, 1, 733) * 6.28, hash(semente, 2, 733) * 6.28, hash(semente, 3, 733) * 6.28]
  const [co, si] = [Math.cos(volta), Math.sin(volta)]
  const pontos: Ponto[] = []
  const n = 36
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * 2 * Math.PI
    // A superelipse: um retângulo mole, sem quina nem lado reto.
    const [c, s] = [Math.cos(t), Math.sin(t)]
    const r = (Math.abs(c) ** REDONDO + Math.abs(s) ** REDONDO) ** (-1 / REDONDO) * (1 + onda * (0.5 * Math.sin(2 * t + f1) + 0.3 * Math.sin(3 * t + f2) + 0.2 * Math.sin(5 * t + f3)))
    const [px, py] = [c * r * mx, s * r * my]
    pontos.push([cx + px * co - py * si, cy + px * si + py * co])
  }
  return poligono(pontos)
}

/** A linha mole que passa pelos pontos (Catmull-Rom), em `porTrecho` pedaços por trecho: dobra de pano não tem quina. */
function mole(pontos: readonly Ponto[], porTrecho = 6): Ponto[] {
  const saida: Ponto[] = []
  const n = pontos.length
  const em = (k: 0 | 1, i: number, t: number): number => {
    const [a, b, c, d] = [pontos[Math.max(0, i - 1)][k], pontos[i][k], pontos[i + 1][k], pontos[Math.min(n - 1, i + 2)][k]]
    return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t)
  }
  for (let i = 0; i + 1 < n; i += 1) for (let j = 0; j < porTrecho; j += 1) saida.push([em(0, i, j / porTrecho), em(1, i, j / porTrecho)])
  saida.push(pontos[n - 1])
  return saida
}

/** Uma PREGA na cor do próprio pano: o vale largo e macio da dobra e o risco fundo no meio dele, meio transparentes. */
function prega(P: CriarPeca, L: Peca[], mat: MaterialDaPeca, pontos: readonly Ponto[], r: number, semente: number, meio?: readonly [number, number]): void {
  const linha = mole(pontos)
  const noLugar = (f: Forma): Forma => (meio === undefined ? f : comMeioEm(f, meio[0], meio[1]))
  L.push(P(noLugar(cadeia(linha, r * 3.4)), mat, { tabua: 0, bisel: 0, contorno: 0, tom: 0.7, alfa: 0.24, suave: r * 3.2, semente }))
  L.push(P(noLugar(cadeia(linha, r)), mat, { tabua: 0, bisel: 0, contorno: 0, tom: 0.6, alfa: 0.4, suave: r, semente }))
}

export const montarCamaDeTrapos: MontarMovel = (c, cena) => {
  const { w, h, g, peca: P } = c
  const escolhido = c.m.pano
  const desbotar = (i: 0 | 1 | 2): number => escolhido.rgb[i] + (DESBOTADO[i] - escolhido.rgb[i]) * QUANTO_DESBOTA
  const manta: MaterialDaPeca = { ...escolhido, rgb: [desbotar(0), desbotar(1), desbotar(2)] }
  const L = cena.partes
  const k = Math.min(w / g, h / (2 * g))
  const palha = materialDaPeca('palha')
  /** O ponto preso dentro da pegada (nenhum fiapo passa dela). */
  const naPegada = (x: number, y: number): Ponto => [Math.max(-w / 2 + 0.8, Math.min(w / 2 - 0.8, x)), Math.max(-h / 2 + 0.8, Math.min(h / 2 - 0.8, y))]

  // ---------- os três panos do NINHO, cada um para um lado: a estopa, o cobertor atravessado e a manta que escorrega ----------
  const estopa = pano(-3.4 * k, 4 * k, 18.4 * k, 43 * k, 0.05, 7420)
  const cobertor = pano(-3 * k, -14 * k, 14 * k, 25 * k, -0.26, 7422)
  const [mx, my, voltaDaManta] = [6 * k, 18 * k, 0.1]
  const corpo = pano(mx, my, 15.4 * k, 29 * k, voltaDaManta, 7440, ONDA + 0.01)
  // O ninho inteiro (os três panos juntos) é a coluna baixa da 3/4 e a mancha de contato no chão.
  const ninho = uniao(uniao(estopa, cobertor), corpo)
  cena.sombras.push({ forma: ninho, z: g * ALTURA_DO_NINHO, forca: 0.28 }, contato(ninho, 0.3))

  // ---------- a PALHA: só uns fiapos soltos, que escapam de baixo da beira dos panos ----------
  /** A beira do ninho no rumo `a` a partir do meio dele: até onde o pano vai (busca pela metade). */
  const beiraDoNinho = (a: number): number => {
    let [dentro, fora] = [4 * k, 80 * k]
    for (let passo = 0; passo < 14; passo += 1) {
      const meio = (dentro + fora) / 2
      if (ninho.d(MEIO_DO_NINHO[0] * k + Math.cos(a) * meio, MEIO_DO_NINHO[1] * k + Math.sin(a) * meio) < 0) dentro = meio
      else fora = meio
    }
    return dentro
  }
  TUFOS.forEach(([rumo, fiapos], i) => {
    for (let j = 0; j < fiapos; j += 1) {
      // Cada fiapo nasce num ponto da beira (um nada para dentro, coberto pelo pano) e sai para o seu lado.
      const a = rumo + (j - (fiapos - 1) / 2) * ENTRE_FIAPOS + (hash(i, j, 7403) - 0.5) * 0.04
      const beira = beiraDoNinho(a)
      const para = a + (hash(i, j + 9, 7403) - 0.5) * 1.5
      const sai = (3.2 + 4.2 * hash(i, j + 18, 7403)) * k
      const [bx, by] = [MEIO_DO_NINHO[0] * k + Math.cos(a) * (beira - 3 * k), MEIO_DO_NINHO[1] * k + Math.sin(a) * (beira - 3 * k)]
      const [de, ate] = [naPegada(bx, by), naPegada(bx + Math.cos(para) * (3 * k + sai), by + Math.sin(para) * (3 * k + sai))]
      const fiapo = capsula(de[0], de[1], ate[0], ate[1], 0.45 * k)
      cena.sombras.push(contato(fiapo, 0.16))
      L.push(P(fiapo, palha, { tabua: 0, eixo: para, bisel: 0.4, tom: 0.82 + 0.16 * hash(i, j + 4, 7403), contorno: 0.26, semente: 7404 + i * 6 + j }))
    }
  })

  // ---------- a ESTOPA aberta, por baixo, e o COBERTOR cinza atravessado ----------
  L.push(P(estopa, ESTOPA, { tabua: 0, eixo: 0.05, bisel: 2.4 * k, ruga: 1.4, contorno: 0.26, semente: 7421 }))
  L.push(P(cobertor, COBERTOR, { tabua: 0, eixo: -0.26, bisel: 2.2 * k, ruga: 1.6, contorno: 0.26, semente: 7423, projeta: { dist: 1.2 * k, forca: 0.3, suave: 1 } }))
  prega(P, L, COBERTOR, [[-13 * k, -34 * k], [-7 * k, -28 * k], [-5 * k, -20 * k]], 0.6 * k, 7424)
  prega(P, L, COBERTOR, [[4 * k, -36 * k], [2 * k, -28 * k], [5 * k, -21 * k]], 0.55 * k, 7425)

  // O TRAPO azul que sobrou, saindo de baixo da manta à esquerda.
  const trapo = bolha(-18.6 * k, 27 * k, 5.6 * k, 9 * k, 7430, 0.2, 0.3)
  L.push(P(trapo, TRAPO, { tabua: 0, bisel: 1.8 * k, ruga: 1.6, contorno: 0.26, semente: 7431, projeta: { dist: 0.9 * k, forca: 0.28 } }))
  prega(P, L, TRAPO, [[-20.6 * k, 21 * k], [-18.2 * k, 27 * k], [-19.6 * k, 33 * k]], 0.5 * k, 7432)

  // ---------- a MANTA de dormir: amassada, escorregada para a direita, com a ponta virada, os remendos, o rasgo e as pregas ----------
  L.push(P(corpo, manta, { tabua: 0, eixo: voltaDaManta, bisel: 2.8 * k, ruga: 2.2, tom: 0.96, contorno: 0.26, semente: 7441, projeta: { dist: 1.6 * k, forca: 0.34, suave: 1.2 } }))
  // A COVA de quem dormiu (o meio afundado, mais escuro, sem beira) e o encardido de anos, em três manchas largas.
  L.push(P(elipseGirada(mx - 0.6 * k, my - 1 * k, 7.6 * k, 19 * k, voltaDaManta), COVA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.2, suave: 6 * k, semente: 7442 }))
  for (const [i, [x, y, a, b]] of ([[-5, 30, 6, 4], [13, 9, 4.6, 7], [6, 42, 7, 3]] as const).entries()) {
    L.push(P(bolha(x * k, y * k, a * k, b * k, 7446 + i, 0.3), COVA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.11, suave: 2.6 * k, semente: 7446 + i }))
  }
  prega(P, L, manta, [[-7 * k, -5 * k], [-4.4 * k, 7 * k], [-6.4 * k, 21 * k], [-3.6 * k, 35 * k]], 0.7 * k, 7443)
  prega(P, L, manta, [[15.6 * k, 2 * k], [13.6 * k, 14 * k], [16.4 * k, 28 * k], [14.2 * k, 39 * k]], 0.65 * k, 7444)
  prega(P, L, manta, [[-0.6 * k, 37 * k], [6.4 * k, 40 * k], [13 * k, 38 * k]], 0.6 * k, 7445)
  // Os REMENDOS, cada um costurado a traços curtos que atravessam a beira dele.
  const remendos: readonly (readonly [number, number, number, number, number, MaterialDaPeca])[] = [
    [12 * k, 28 * k, 4.6 * k, 3.6 * k, 0.3, REMENDO_VINHO],
    [-4.6 * k, 6 * k, 3.4 * k, 4.2 * k, -0.2, REMENDO_CRU],
  ]
  remendos.forEach(([x, y, a, b, volta, mat], i) => {
    L.push(P(pano(x, y, a, b, volta, 7450 + i, 0.05), mat, { tabua: 0, bisel: 0.8 * k, ruga: 1.2, contorno: 0.26, semente: 7452 + i, projeta: { dist: 0.5 * k, forca: 0.2 } }))
    const noRemendo = (t: number, quanto: number): Ponto => {
      const [px, py] = [Math.cos(t) * a * quanto, Math.sin(t) * b * quanto]
      return [x + px * Math.cos(volta) - py * Math.sin(volta), y + px * Math.sin(volta) + py * Math.cos(volta)]
    }
    for (let j = 0; j < PONTOS_DA_COSTURA; j += 1) {
      // Cada ponto num lugar um nada sorteado e um nada torto: costura feita à mão.
      const t = ((j + (hash(i, j, 7460) - 0.5) * 0.5) / PONTOS_DA_COSTURA) * 2 * Math.PI + 0.3
      const [de, ate] = [noRemendo(t, 0.74), noRemendo(t + (hash(i, j + 20, 7460) - 0.5) * 0.36, 1.24)]
      L.push(P(capsula(de[0], de[1], ate[0], ate[1], 0.26 * k), LINHA, { tabua: 0, bisel: 0, contorno: 0, alfa: ALFA_DA_LINHA, semente: 7460 + i }))
    }
  })
  // O rasgo, com o cobertor cinza aparecendo por baixo.
  L.push(P(bolha(0.6 * k, 31 * k, 2.8 * k, 1.5 * k, 7470, 0.25, 0.5), COBERTOR, { tabua: 0, bisel: 0, tom: 0.74, contorno: 0.3, recesso: { k: 0.6, forca: 0.3 }, semente: 7471 }))
  // A PONTA virada para trás, no canto de cima à direita: o avesso, mais escuro, fazendo sombra na manta.
  const [px0, py0] = [mx + 14.4 * k, my - 27.4 * k]
  const dobra = girada(poligono([[px0, py0 + 1 * k], [px0 - 11.6 * k, py0 + 2.2 * k], [px0 - 13.4 * k, py0 + 6.2 * k], [px0 - 5.8 * k, py0 + 12.4 * k], [px0 - 1.2 * k, py0 + 11.4 * k], [px0 + 0.6 * k, py0 + 5 * k]]), mx, my, voltaDaManta)
  L.push(P(dobra, manta, { tabua: 0, bisel: 1.6 * k, ruga: 1.6, tom: 0.8, contorno: 0.28, semente: 7480, projeta: { dist: 1.6 * k, forca: 0.36, suave: 1 } }))

  // ---------- o ROLO da cabeceira, amarrado com duas voltas de corda ----------
  const [ax, ay, bx, by, raio] = [-14 * k, -40 * k, 9.6 * k, -44.4 * k, 6.4 * k]
  const rolo = capsula(ax, ay, bx, by, raio)
  const meio: readonly [number, number] = [(ax + bx) / 2, (ay + by) / 2]
  // A caixa da sombra desce até o pé da cama: na 3/4 o rolo é pintado depois do ninho, por cima.
  cena.sombras.push({ forma: { b: [rolo.b[0], rolo.b[1], rolo.b[2], ninho.b[3] + 0.5], d: rolo.d }, z: g * ALTURA_DO_ROLO, solta: true, forca: 0.26 })
  const aoLongo = Math.atan2(by - ay, bx - ax)
  L.push(P(rolo, ROLO, { tabua: 0, eixo: aoLongo, bisel: raio * 0.9, ruga: 1.3, contorno: 0.26, semente: 7490, projeta: { dist: 2.2 * k, forca: 0.36, suave: 1.3 } }))
  const [ux, uy] = [Math.cos(aoLongo), Math.sin(aoLongo)]
  // As pontas enroladas (o caracol do pano) e as duas voltas de corda.
  for (const [i, lado] of [-1, 1].entries()) {
    const [ex, ey] = lado < 0 ? [ax - ux * raio * 0.5, ay - uy * raio * 0.5] : [bx + ux * raio * 0.5, by + uy * raio * 0.5]
    L.push(P(comMeioEm(elipseGirada(ex, ey, raio * 0.42, raio * 0.72, aoLongo), meio[0], meio[1]), ROLO, { tabua: 0, bisel: 0, tom: 0.76, contorno: 0.2, recesso: { k: 0.8, forca: 0.3 }, semente: 7491 + i }))
  }
  const corda = materialDaPeca('corda')
  for (const [i, t] of [0.24, 0.74].entries()) {
    const [qx, qy] = [ax + (bx - ax) * t, ay + (by - ay) * t]
    L.push(P(comMeioEm(capsula(qx + uy * raio * 0.96, qy - ux * raio * 0.96, qx - uy * raio * 0.96, qy + ux * raio * 0.96, 0.8 * k), meio[0], meio[1]), corda, { tabua: 0, bisel: 0.7 * k, contorno: 0.26, semente: 7494 + i, projeta: { dist: 0.5 * k, forca: 0.22 } }))
  }
  prega(P, L, ROLO, [[ax + ux * 6 * k - uy * 2 * k, ay + uy * 6 * k + ux * 2 * k], [ax + ux * 13 * k - uy * 1 * k, ay + uy * 13 * k + ux * 1 * k], [ax + ux * 19 * k - uy * 2.6 * k, ay + uy * 19 * k + ux * 2.6 * k]], 0.5 * k, 7496, meio)
}
