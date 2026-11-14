/**
 * BAIA DE CAVALO de cima com volume (lote L18 dos objetos e construções de 14/11/2026, construção do grupo Praça,
 * rua e campo): a cocheira de duas baias, de tábuas, com o TELHADO de duas águas de tabuinhas (escamas de madeira
 * em fiadas desencontradas) e a CUMEEIRA de um lado ao outro. Na frente, sob o beiral, as duas MEIAS-PORTAS
 * fechadas embaixo e abertas em cima (o vão escuro da baia), os três ESTEIOS e a VERGA por cima; da baia da direita
 * o CAVALO põe a cabeça para fora (castanho, crina escura, a lista branca na cara). No terreiro da frente, o FARDO
 * DE FENO, a SELA no cavalete, com a manta vinho e os estribos, e o BALDE de água.
 *
 * De cima: o telhado manda (a água do norte, virada para a luz, clara; a do sul na sombra; cada fiada de tabuinha
 * com a sombra da de cima), a cumeeira, a cabeça do cavalo saindo debaixo do beiral, a sela, o fardo e o balde, e a
 * SOMBRA para baixo à direita. É a cabeça do cavalo com a sela que diz "baia" e não galinheiro (casinha nos pés,
 * cercado) nem barraca.
 *
 * NA 3/4 (`tresQuartos.ts`; todo tampo tem a beirada `ESPESSURA_DA_BAIA`, a espessura do perfil):
 * - as paredes são uma coluna até o beiral, com o pingo de madeira no pé da frente;
 * - o TELHADO são faixas ao longo da cumeeira, cada uma um tampo na altura dela (as do norte subindo, as do sul
 *   descendo para a frente), a caixa esticada para a frente NA TELA (saem depois da parede e da fachada). Todas têm
 *   uma fresta rente à parede da frente, mais estreita que a beirada (a varredura a fecha e a tabuinha a cobre): é
 *   nela que ficam os pingos da parede, das meias-portas, dos esteios e da verga, que assim não sobem com o telhado;
 * - cada MEIA-PORTA é uma coluna, os ESTEIOS são colunas até o beiral, a VERGA é um tampo raso, um tico na frente;
 * - o VÃO de cada baia é um tampo escuro na altura da verga, fundo para a frente o bastante para a cara dele descer
 *   até a meia-porta (o pingo dele fica fora do beiral);
 * - a CABEÇA do cavalo é um tampo na altura dela, com as peças presas na ponta do focinho (fora do beiral e do vão);
 * - o fardo, a sela e o balde são colunas baixas.
 * Lê `c.giro` só para esticar a caixa das faixas do telhado para a frente NA TELA; a fachada anda com o objeto.
 * Materiais: `madeira` (paredes, portas, esteios, cavalete, balde) e `telhado` (as tabuinhas). O cavalo, o feno,
 * a sela, a manta, o ferro e a água são fixos.
 */
import { hash, limitar01, luz } from '../../ruido'
import { anel, caixa, capsula, elipse, menos, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Sombra, type Textura } from './motor'
import { G, materialDaPeca, QUARTO, type MontarMovel } from './contexto'

/** A beirada de cada tampo da baia (px do protótipo): a grossura de cada faixa do telhado, da verga e do vão. */
export const ESPESSURA_DA_BAIA = 0.075 * G

/** A cocheira em fração da pegada: as paredes (x), o fundo e a frente (y), e o beiral de trás e da frente. */
const PAREDE_X = 0.95
const FUNDO = -0.88
const FRENTE = 0.2
const BEIRAL_DE_TRAS = -0.98
/** O beiral da frente passa da parede este tanto (px na escala de partida): cobre as portas, deixa a cabeça. */
const BEIRAL_DA_FRENTE = 8
/** Alturas em casas: o beiral (a parede), a cumeeira, a meia-porta, a verga e a cabeça do cavalo. */
const ALTURA_DO_BEIRAL = 1.42
const ALTURA_DA_CUMEEIRA = 2.04
const ALTURA_DA_MEIA_PORTA = 0.62
const ALTURA_DA_VERGA = 1.24
const ALTURA_DA_CABECA = 0.98
const FAIXAS_POR_AGUA = 8
/** As portas: o meio de cada uma (fração da meia largura) e a meia abertura (px na escala de partida). */
const PORTAS_EM: readonly number[] = [-0.5, 0.5]
const MEIA_PORTA = 17.5
/** Os esteios da fachada (fração da meia largura). */
const ESTEIOS_EM: readonly number[] = [-0.97, 0, 0.97]
/** As tabuinhas (px): a largura de cada uma e a altura de cada fiada, descendo a água. */
const LARGURA_DA_TABUINHA = 5
const FIADA_DA_TABUINHA = 4.2
const PASSO_NITIDO = 3
const PASSO_SUMIDO = 1.5
const TOM_DA_AGUA_DA_LUZ = 1.06
const TOM_DA_AGUA_DA_SOMBRA = 0.84

/** O cavalo castanho: o pelo, a crina e o focinho escuros, a lista branca. */
const PELO: MaterialDaPeca = { classe: 'liso', rgb: [0x7c, 0x55, 0x3d] }
const CRINA: MaterialDaPeca = { classe: 'liso', rgb: [0x31, 0x27, 0x21] }
const LISTA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xdc, 0xcf] }
const FOCINHO: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x3b, 0x33] }
const FENO = materialDaPeca('palha')
const CORDA = materialDaPeca('corda')
const MANTA = materialDaPeca('vinho')
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x6b, 0x47, 0x2e] }
const FERRO = materialDaPeca('ferro')
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: [0x46, 0x5a, 0x5e] }
const DA_MADEIRA = texturaDaClasse('madeira')

function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

function doDesenho(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

/** A mesma forma com a caixa esticada até `ate` px do centro, do lado que fica embaixo NA TELA (sai depois). */
function esticadaParaAFrente(forma: Forma, ate: number, quartos: number): Forma {
  const [dx, dy] = doDesenho(0, 1, quartos)
  const [x0, y0, x1, y1] = forma.b
  const b: Caixa =
    dx > 0.5 ? [x0, y0, Math.max(x1, ate), y1] : dx < -0.5 ? [Math.min(x0, -ate), y0, x1, y1] : dy > 0.5 ? [x0, y0, x1, Math.max(y1, ate)] : [x0, Math.min(y0, -ate), x1, y1]
  return { b, d: forma.d }
}

function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/**
 * As TABUINHAS de uma água que desce para `sentido` (-1 = norte, 1 = sul): fiadas ao longo da cumeeira, cada
 * tabuinha no seu tom, desencontradas de uma fiada para a outra, a junta escura e a sombra da fiada de cima.
 */
function tabuinhas(sentido: number, base: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (base !== null) base(u, v, x, y, p, s, escala)
    const nitidez = limitar01((FIADA_DA_TABUINHA * escala - PASSO_SUMIDO) / (PASSO_NITIDO - PASSO_SUMIDO))
    if (nitidez <= 0) return
    const descendo = (sentido * y) / FIADA_DA_TABUINHA
    const fiada = Math.floor(descendo)
    const naFiada = descendo - fiada
    const ao = x / LARGURA_DA_TABUINHA + (((fiada % 2) + 2) % 2) * 0.5
    const coluna = Math.floor(ao)
    s[3] += nitidez * (hash(coluna, fiada, 18890) - 0.5) * 0.22
    if (naFiada < 0.28) s[3] -= nitidez * 0.26 * (1 - naFiada / 0.28)
    if (Math.min(ao - coluna, 1 - ao + coluna) * LARGURA_DA_TABUINHA < 0.4) s[3] -= nitidez * 0.18
  }
}

export const montarBaiaDeCavalo: MontarMovel = (c, cena) => {
  const P = c.peca
  const k = Math.min(c.hw, c.hh) / G
  const quartos = quartosDoGiro(c.giro)
  const madeira = c.m.madeira
  const telhado = c.m.telhado
  const L = cena.partes
  const S = cena.sombras
  const e = ESPESSURA_DA_BAIA
  const solta = (forma: Forma, z: number, forca = 0): Sombra => ({ forma, z, solta: true, forca })
  const [px, yB, yF] = [c.hw * PAREDE_X, c.hh * FUNDO, c.hh * FRENTE]
  const [eT, eF] = [c.hh * BEIRAL_DE_TRAS, yF + BEIRAL_DA_FRENTE * k]
  const yCumeeira = (yB + yF) / 2
  const [zBeiral, zCumeeira] = [ALTURA_DO_BEIRAL * c.g, ALTURA_DA_CUMEEIRA * c.g]
  const maior = Math.max(c.hw, c.hh)
  /** A madeira um tanto mais escura: as portas e os esteios se destacam da parede na 3/4. */
  const escura = (f: number): MaterialDaPeca => ({ ...madeira, rgb: luz(madeira.rgb, -f) })
  const pingo = (x: number, y: number, mat: MaterialDaPeca, semente: number): void => {
    L.push(P(elipse(x, y, 0.2, 0.2), mat, { tabua: 0, bisel: 0, contorno: 0, semente }))
  }
  const portas = PORTAS_EM.map((f) => f * px)

  // ---------- as sombras: o contato e a coluna da cocheira (a sombra comprida) ----------
  const paredes = caixa(-px, yB, px, yF)
  S.push(contato(caixa(-px - 1, yB - 1, px + 1, yF + 1, 1), 0.36), { forma: paredes, z: zBeiral, forca: 0.34 })

  // ---------- no terreiro: o fardo de feno, a sela no cavalete, o balde ----------
  const [fx, fy] = [-c.hw * 0.74, c.hh * 0.7]
  const fardo = caixa(fx - 14 * k, fy - 8.5 * k, fx + 14 * k, fy + 8.5 * k, 1.6 * k)
  S.push(contato(fardo, 0.34), { forma: fardo, z: 0.42 * c.g, forca: 0.26 })
  L.push(P(fardo, FENO, { tabua: 0, eixo: 0, bisel: 2.4 * k, contorno: 0.3, tom: 0.98, ruga: 0.5, semente: 18900 }))
  for (const dx of [-6.5, 6.5]) L.push(P(comMeioEm(caixa(fx + (dx - 0.8) * k, fy - 8.8 * k, fx + (dx + 0.8) * k, fy + 8.8 * k), fx, fy), CORDA, { tabua: 0, eixo: QUARTO, bisel: 0.4, contorno: 0.3, tom: 0.92, semente: 18901 }))
  for (let i = 0; i < 9; i += 1) {
    const [x, y] = [fx + (hash(i, 1, 18902) - 0.5) * 34 * k, fy + (9 + 3 * hash(i, 3, 18902)) * k]
    const a = hash(i, 4, 18902) * Math.PI
    L.push(P(capsula(x, y, x + Math.cos(a) * 3.4 * k, y + Math.sin(a) * 3.4 * k, 0.35 * k), FENO, { tabua: 0, bisel: 0, contorno: 0.24, tom: 0.9, semente: 18903 + i }))
  }
  // A sela no cavalete: as pernas em X nas pontas, a manta vinho com a barra clara, o couro, o arção e os estribos.
  const [sx, sy] = [-c.hw * 0.2, c.hh * 0.7]
  const manta = caixa(sx - 11 * k, sy - 9 * k, sx + 11 * k, sy + 9 * k, 1.4 * k)
  const cavalete = caixa(sx - 15 * k, sy - 4 * k, sx + 15 * k, sy + 4 * k, 1)
  // O cavalete é a coluna de madeira (as pernas e a trave têm o meio na ponta dele); a manta com a sela, um tampo por cima.
  S.push(contato(cavalete, 0.3), { forma: cavalete, z: 0.46 * c.g, forca: 0.24 }, solta(manta, 0.56 * c.g, 0.22))
  const doCavalete = (forma: Forma, o: OpcoesDaPeca): void => {
    L.push(P(comMeioEm(forma, sx + 13.5 * k, sy), madeira, { tabua: 0, ...o }))
  }
  const daSela = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    L.push(P(comMeioEm(forma, sx, sy), mat, { tabua: 0, ...o }))
  }
  for (const lado of [-1, 1]) {
    doCavalete(capsula(sx + lado * 12 * k, sy - 3.6 * k, sx + lado * 15 * k, sy + 3.6 * k, 1 * k), { bisel: 0.6, contorno: 0.32, tom: 0.86, semente: 18920 })
    doCavalete(capsula(sx + lado * 15 * k, sy - 3.6 * k, sx + lado * 12 * k, sy + 3.6 * k, 1 * k), { bisel: 0.6, contorno: 0.32, tom: 0.8, semente: 18921 })
  }
  doCavalete(caixa(sx - 13.5 * k, sy - 1.3 * k, sx + 13.5 * k, sy + 1.3 * k, 0.5), { eixo: 0, bisel: 0.6, contorno: 0.32, tom: 1.02, semente: 18922 })
  daSela(manta, MANTA, { bisel: 1.2 * k, contorno: 0.3, tom: 0.95, ruga: 0.4, semente: 18923 })
  daSela(anel(sx, sy, 10.2 * k, 8.2 * k, 8.8 * k, 6.8 * k), LISTA, { bisel: 0, contorno: 0.12, tom: 0.78, alfa: 0.7, semente: 18924 })
  for (const lado of [-1, 1]) {
    daSela(capsula(sx - 1 * k, sy + lado * 5 * k, sx - 1.4 * k, sy + lado * 10.5 * k, 0.8 * k), COURO, { bisel: 0.4, contorno: 0.32, tom: 0.8, semente: 18925 })
    daSela(anel(sx - 1.4 * k, sy + lado * 11.8 * k, 2.2 * k, 1.5 * k, 1.2 * k, 0.6 * k), FERRO, { bisel: 0.4, contorno: 0.32, metal: 0.4, semente: 18926 })
  }
  daSela(uniao(elipse(sx, sy, 8 * k, 5.6 * k), elipse(sx + 6.5 * k, sy, 3.2 * k, 3.6 * k)), COURO, { bisel: 2.2 * k, contorno: 0.32, tom: 1.04, projeta: { dist: 1.2, forca: 0.3 }, semente: 18927 })
  daSela(elipse(sx - 1 * k, sy, 4.4 * k, 3.6 * k), COURO, { bisel: 0, contorno: 0.16, tom: 1.16, recesso: { k: 1.2, forca: 0.28 }, semente: 18928 })
  daSela(elipse(sx + 7.6 * k, sy, 1.5 * k, 1.6 * k), COURO, { bisel: 0.8 * k, contorno: 0.34, tom: 0.84, semente: 18929 })
  // O balde de água, de aduelas, à direita.
  const [bx, by] = [c.hw * 0.82, c.hh * 0.76]
  const balde = elipse(bx, by, 6 * k, 6 * k)
  S.push(contato(balde, 0.32), { forma: balde, z: 0.26 * c.g, forca: 0.24 })
  L.push(P(balde, madeira, { tabua: 0, bisel: 1 * k, contorno: 0.32, tom: 0.92, polar: { cx: bx, cy: by, r: 6 * k }, semente: 18930 }))
  L.push(P(elipse(bx, by, 4.6 * k, 4.6 * k), AGUA, { tabua: 0, bisel: 0, contorno: 0.2, recesso: { k: 1, forca: 0.32 }, semente: 18931 }))
  L.push(P(anel(bx, by, 6 * k, 6 * k, 5.2 * k, 5.2 * k), FERRO, { tabua: 0, bisel: 0.3, contorno: 0.3, metal: 0.4, semente: 18932 }))

  // ---------- a cabeça do cavalo saindo da baia da direita (antes do telhado: o beiral cobre o pescoço) ----------
  const hx = portas[1]
  const [y0, yP] = [yF - 2 * k, yF + 34 * k]
  const pescoco = poligono([[hx - 5 * k, y0], [hx + 5 * k, y0], [hx + 4.6 * k, yF + 9 * k], [hx - 4.6 * k, yF + 9 * k]])
  const cara = uniao(elipse(hx, yF + 11 * k, 4.9 * k, 5.6 * k), capsula(hx, yF + 12 * k, hx, yP - 3.2 * k, 3.3 * k))
  S.push(solta(uniao(pescoco, cara), ALTURA_DA_CABECA * c.g, 0.26))
  const daCabeca = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    L.push(P(comMeioEm(forma, hx, yP - 1 * k), mat, { tabua: 0, ...o }))
  }
  daCabeca(pescoco, PELO, { eixo: QUARTO, bisel: 2 * k, contorno: 0.3, tom: 0.9, semente: 18940 })
  daCabeca(capsula(hx, y0, hx, yF + 7 * k, 1.6 * k), CRINA, { eixo: QUARTO, bisel: 0.8 * k, contorno: 0.3, ruga: 0.5, semente: 18941 })
  for (const l of [-1, 1]) daCabeca(poligono([[hx + l * 1.6 * k, yF + 7.5 * k], [hx + l * 4.6 * k, yF + 7.4 * k], [hx + l * 3.9 * k, yF + 3 * k]]), PELO, { bisel: 0.8 * k, contorno: 0.34, tom: 0.84, semente: 18942 })
  daCabeca(cara, PELO, { eixo: QUARTO, bisel: 2.6 * k, contorno: 0.32, tom: 1.04, projeta: { dist: 1.2, forca: 0.3 }, semente: 18943 })
  daCabeca(poligono([[hx - 2 * k, yF + 9.5 * k], [hx + 1.6 * k, yF + 8.6 * k], [hx + 0.9 * k, yF + 12.5 * k], [hx - 1.2 * k, yF + 12.8 * k]]), CRINA, { bisel: 0.4, contorno: 0.3, semente: 18944 })
  daCabeca(uniao(elipse(hx, yF + 13.5 * k, 1.6 * k, 1.8 * k), capsula(hx, yF + 14 * k, hx + 0.3 * k, yP - 6 * k, 0.9 * k)), LISTA, { bisel: 0.4, contorno: 0.24, tom: 0.98, semente: 18945 })
  daCabeca(elipse(hx, yP - 3.2 * k, 3.4 * k, 3.4 * k), FOCINHO, { bisel: 1.4 * k, contorno: 0.32, semente: 18946 })
  for (const l of [-1, 1]) {
    daCabeca(elipse(hx + l * 1.7 * k, yP - 2.4 * k, 0.75 * k, 1 * k), CRINA, { bisel: 0, contorno: 0.1, semente: 18947 })
    daCabeca(elipse(hx + l * 4.4 * k, yF + 13 * k, 0.8 * k, 1.1 * k), CRINA, { bisel: 0.3, contorno: 0.2, semente: 18948 })
  }

  // ---------- o telhado: as faixas das duas águas, com a fresta rente à parede da frente ----------
  const fresta = caixa(-maior - 2, yF - 0.5, maior + 2, yF + 2.8)
  const aguas: readonly (readonly [number, number, number])[] = [
    [eT, yCumeeira, -1],
    [yCumeeira, eF, 1],
  ]
  let ordem = 0
  aguas.forEach(([de, ate, sentido], a) => {
    for (let i = 0; i < FAIXAS_POR_AGUA; i += 1) {
      const [ya, yb] = [de + ((ate - de) * i) / FAIXAS_POR_AGUA, de + ((ate - de) * (i + 1)) / FAIXAS_POR_AGUA]
      // A faixa mede a altura do lado mais alto dela (o de perto da cumeeira).
      const subida = sentido < 0 ? (i + 1) / FAIXAS_POR_AGUA : 1 - i / FAIXAS_POR_AGUA
      const z = zBeiral + e + (zCumeeira - zBeiral - e) * subida
      const faixa = caixa(-px - 2 * k, ya, px + 2 * k, yb + (sentido > 0 ? 0 : 0.6))
      S.push(solta(esticadaParaAFrente(menos(faixa, fresta), maior + 1 + 0.01 * ordem, quartos), z, i === 0 && a === 1 ? 0.3 : 0))
      ordem += 1
      // O meio da tabuinha fica na faixa, fora da fresta (senão ela subiria com o esteio do meio).
      const meio = (ya + yb) / 2
      const meioForaDaFresta = meio < yF - 0.5 || meio > yF + 2.8 ? meio : yb > yF + 2.8 ? (yF + 2.8 + yb) / 2 : (ya + yF - 0.5) / 2
      L.push(P(comMeioEm(faixa, 0, meioForaDaFresta), telhado, { tabua: 0, eixo: 0, bisel: 0.5, contorno: 0.16, tom: sentido < 0 ? TOM_DA_AGUA_DA_LUZ : TOM_DA_AGUA_DA_SOMBRA, textura: tabuinhas(sentido, DA_MADEIRA), semente: 18960 + ordem }))
    }
  })
  // A cumeeira: a tábua dobrada de ponta a ponta, por cima das duas águas (na faixa mais alta do sul).
  const yTopo = yCumeeira + (eF - yCumeeira) / FAIXAS_POR_AGUA / 2
  L.push(P(comMeioEm(caixa(-px - 2.5 * k, yCumeeira - 2.6 * k, px + 2.5 * k, yCumeeira + 2.6 * k, 0.8), 0, yTopo), telhado, { tabua: 0, eixo: 0, bisel: 1 * k, contorno: 0.32, tom: 0.92, projeta: { dist: 1.6, forca: 0.34 }, semente: 18990 }))
  // A testeira da frente: a tábua do beiral, que de cima arremata a água da sombra.
  L.push(P(comMeioEm(caixa(-px - 2 * k, eF - 1.6 * k, px + 2 * k, eF, 0.5), 0, eF - (eF - yCumeeira) / FAIXAS_POR_AGUA / 2), madeira, { tabua: 0, eixo: 0, bisel: 0.5, contorno: 0.3, tom: 0.82, semente: 18991 }))

  // ---------- a fachada: o pingo da parede, os vãos escuros, as meias-portas, os esteios e a verga ----------
  pingo(-px * 0.9, yF - 0.3, madeira, 19000)
  const zVerga = ALTURA_DA_VERGA * c.g
  const zPorta = ALTURA_DA_MEIA_PORTA * c.g
  portas.forEach((x, i) => {
    // O vão: um tampo na altura da verga, fundo para a frente até a cara descer na beira de cima da meia-porta.
    const fundo = zVerga - zPorta - e - 4.5
    S.push(solta(caixa(x - MEIA_PORTA * k, yF + 2, x + MEIA_PORTA * k, yF + 2 + fundo), zVerga - 2))
    pingo(x - MEIA_PORTA * k * 0.6, yF + 2 + fundo - 0.5, { classe: 'liso', rgb: [0x2a, 0x22, 0x1d] }, 19001 + i)
    S.push({ forma: caixa(x - MEIA_PORTA * k, yF - 0.5, x + MEIA_PORTA * k, yF + 1.8), z: zPorta, forca: 0 })
    // Fora do meio da porta: a cabeça do cavalo (mais alta) sai do meio da porta da direita.
    pingo(x + 9 * k, yF + 1.4, escura(0.16), 19003 + i)
  })
  ESTEIOS_EM.forEach((f, i) => {
    const x = f * px
    S.push({ forma: caixa(x - 2.4 * k, yF - 1, x + 2.4 * k, yF + 2.4), z: zBeiral, forca: 0 })
    pingo(x, yF + 2.2, escura(0.24), 19005 + i)
  })
  S.push(solta(caixa(-px, yF + 2, px, yF + 2.8), zVerga + 2.6))
  pingo(portas[0] + 6 * k, yF + 2.5, escura(0.28), 19008)
}
