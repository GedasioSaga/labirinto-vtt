/**
 * TORRE DE VIGIA de cima com volume (lote 17 dos objetos novos, 12/11/2026,
 * grupo Rua e jardim): a torre de madeira de acampamento e de fronteira.
 * Quatro POSTES grossos de tora em sapatas de pedra, travados em X; no alto,
 * a PLATAFORMA de tábuas com GUARDA-CORPO (duas tábuas corridas e os postes
 * dos cantos), aberto na frente onde chega a ESCADA de mão encostada; quatro
 * esteios seguram o TELHADO de quatro águas de palha. Na plataforma, um
 * BANCO, um BALDE com água e um BERRANTE pendurado no guarda-corpo.
 *
 * De cima: o telhado de quatro águas no meio, a volta de tábuas da
 * plataforma com o guarda-corpo, o banco, o balde e o berrante, a escada
 * saindo pela frente (a frente é o lado da escada) e a SOMBRA comprida para
 * baixo à direita: a da plataforma, a do telhado e a risca de cada poste. Não
 * é o galinheiro (a casinha baixa no chão) nem o palco (o tablado baixo).
 *
 * NA 3/4 (`tresQuartos.ts`; todo tampo tem a beirada
 * `ESPESSURA_DA_TORRE_DE_VIGIA`, que é a espessura do perfil):
 * - os postes são colunas até debaixo da plataforma; as MÃOS-FRANCESAS em X
 *   das caras da frente e de trás NA TELA são discos empilhados ao longo de
 *   cada diagonal (a cara de lado fica de quina e não aparece);
 * - a plataforma é um tampo; tudo o que fica em cima dela (guarda-corpo,
 *   esteios, banco, balde, escada) tem a caixa esticada para a frente NA TELA
 *   para sair depois dela, e o telhado sai por último, camada por camada;
 * - o telhado são três tampos em degrau, cada um com as quatro águas dele
 *   (as de cima mais claras do lado da luz); os três têm um furo no meio
 *   exato, para a tábua da plataforma (a caixa dela é centrada ali) não
 *   subir com eles;
 * - a escada são discos empilhados ao longo de cada banzo, e cada pedaço de
 *   banzo e cada degrau sobe com o disco dele.
 * Por isso o desenho lê `c.giro`. As alturas são em lados (o menor lado).
 * Materiais: `madeira` (postes, plataforma, guarda-corpo, escada) e
 * `telhado` (a palha). A pedra das sapatas, a água e o berrante são fixos.
 */
import { anel, caixa, capsula, elipse, menos, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca, type Sombra } from './motor'
import { G, QUARTO, materialDaPeca, type MontarMovel } from './contexto'

/** A beirada de cada tampo da torre (px do protótipo): a grossura da plataforma, das tábuas e das camadas do telhado. */
export const ESPESSURA_DA_TORRE_DE_VIGIA = 0.14 * G

/** As medidas de cima, em fração do menor meio lado. */
const POSTE_EM = 0.64
const RAIO_DO_POSTE = 0.085
const MEIA_SAPATA = 0.13
const SAPATA_PARA_FORA = 0.11
const PLATAFORMA = 0.72
const GUARDA_DE_DENTRO = 0.66
const VAO_DA_ESCADA: readonly [number, number] = [0.06, 0.34]
const POSTE_DA_GUARDA = 0.045
const ESTEIO_EM = 0.4
const RAIO_DO_ESTEIO = 0.055
/** As três camadas do telhado (meio lado de cada uma). */
const CAMADAS_DO_TELHADO: readonly number[] = [0.52, 0.34, 0.16]
const RAIO_DA_MAO_FRANCESA = 0.048
const DISCOS_DA_MAO_FRANCESA = 22
/** A escada: o meio dela, a meia largura, onde o pé toca o chão, a grossura dos banzos e dos degraus. */
const ESCADA_EM = 0.2
const MEIA_LARGURA_DA_ESCADA = 0.11
const PE_DA_ESCADA = 0.98
const RAIO_DO_BANZO = 0.03
const RAIO_DO_DEGRAU = 0.022
/** As coisas na plataforma (x, y, raio). */
const BANCO: readonly [number, number, number] = [-0.58, -0.18, 0.065]
const BALDE: readonly [number, number, number] = [0.12, -0.58, 0.075]

/** Alturas em lados (2 casas na pegada de partida): a plataforma (1,5 casa), as tábuas do guarda-corpo, a base do telhado. */
const ALTURA_DA_PLATAFORMA = 0.75
const ALTURA_DA_TABUA_DE_CIMA = 0.975
const ALTURA_DA_TABUA_DO_MEIO = 0.85
const ALTURA_DO_TELHADO = 1.22
const PE_DA_MAO_FRANCESA = 0.06
/** Quanto a escada passa da plataforma, em lados. */
const ESCADA_ACIMA = 0.12
/** O passo de altura entre os discos da escada (px). */
const PASSO_DA_ESCADA = 6

const SOMBRA_DO_POSTE = { suave: 1.2, forca: 0.26 } as const
const FORCA_DA_SOMBRA_DA_PLATAFORMA = 0.3
const FORCA_DA_SOMBRA_DO_TELHADO = 0.26
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: [0x46, 0x5a, 0x5e] }
const BERRANTE: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xc7, 0xa0] }
const PONTA_DO_BERRANTE: MaterialDaPeca = { classe: 'liso', rgb: [0x4e, 0x3e, 0x30] }

function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

function naTela(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [-y, x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [y, -x] : [x, y]
}

function doDesenho(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

/** Até onde a caixa desce NA TELA (é por aí que a 3/4 escolhe a vez de cada estrutura). */
function baseNaTela(b: Caixa, quartos: number): number {
  return Math.max(naTela(b[0], b[1], quartos)[1], naTela(b[2], b[3], quartos)[1], naTela(b[0], b[3], quartos)[1], naTela(b[2], b[1], quartos)[1])
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

export const montarTorreDeVigia: MontarMovel = (c, cena) => {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const lado = 2 * R
  const e = ESPESSURA_DA_TORRE_DE_VIGIA
  const madeira = c.m.madeira
  const palha = c.m.telhado
  const pedra = materialDaPeca('granito')
  const quartos = quartosDoGiro(c.giro)
  const L = cena.partes
  const S = cena.sombras
  const f = (v: number): number => v * R
  const zPlataforma = ALTURA_DA_PLATAFORMA * lado
  const zTelhado = ALTURA_DO_TELHADO * lado
  const disco = (x: number, y: number, r: number): Forma => elipse(x, y, r, r)
  const quadrado = (a: number, raio = 1): Forma => caixa(-a, -a, a, a, raio)
  const solta = (forma: Forma, z: number, forca = 0): Sombra => ({ forma, z, solta: true, forca })
  /** O que fica em cima da plataforma sai depois dela, na ordem da base de cada um NA TELA. */
  const emCima = (forma: Forma): Forma => esticadaParaAFrente(forma, R * (0.75 + 0.01 * (baseNaTela(forma.b, quartos) / R + 1)), quartos)
  /** Tampos empilhados de `de` a `ate`, sem fresta. */
  const pilha = (forma: Forma, de: number, ate: number): Sombra[] => {
    const n = Math.max(1, Math.ceil((ate - de) / e - 0.01))
    const passo = n > 1 ? (ate - de - e) / (n - 1) : 0
    return Array.from({ length: n }, (_, k) => solta(forma, ate - k * passo))
  }
  const tabua = (semente: number, eixo = 0, tom = 1) => ({ tabua: 0, eixo, bisel: 0.9, tom, contorno: 0.3, projeta: { dist: 1.1, forca: 0.3 }, semente })

  // ---------- no chão: as sapatas de pedra e os postes (colunas), com a risca da sombra de cada um ----------
  const cantos: readonly Ponto[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  cantos.forEach(([sx, sy], i) => {
    const [x, y] = [sx * f(POSTE_EM), sy * f(POSTE_EM)]
    const sapata = caixa(x - f(MEIA_SAPATA), y - f(MEIA_SAPATA), x + f(MEIA_SAPATA), y + f(MEIA_SAPATA), 1.4)
    S.push(contato(sapata, 0.32))
    L.push(P(comMeioEm(sapata, x + sx * f(SAPATA_PARA_FORA), y), pedra, { bisel: 1.6, contorno: 0.3, tom: 0.92, semente: 17700 + i }))
    S.push({ forma: disco(x, y, f(RAIO_DO_POSTE)), z: zPlataforma - e, ...SOMBRA_DO_POSTE })
  })

  // ---------- as mãos-francesas em X nas caras da frente e de trás NA TELA ----------
  const zPe = PE_DA_MAO_FRANCESA * lado
  for (const cara of [-1, 1]) {
    for (const sentido of [-1, 1]) {
      for (let k = 0; k < DISCOS_DA_MAO_FRANCESA; k += 1) {
        const t = k / (DISCOS_DA_MAO_FRANCESA - 1)
        const [x, y] = doDesenho(sentido * f(POSTE_EM) * (2 * t - 1), cara * f(POSTE_EM), quartos)
        S.push(solta(disco(x, y, f(RAIO_DA_MAO_FRANCESA)), zPe + (zPlataforma - e - zPe) * t))
      }
    }
  }

  // ---------- a plataforma: sai depois dos postes da frente e antes de tudo o que fica em cima ----------
  const plataforma = quadrado(f(PLATAFORMA))
  S.push(solta(esticadaParaAFrente(plataforma, f(0.73), quartos), zPlataforma, FORCA_DA_SOMBRA_DA_PLATAFORMA))
  L.push(P(plataforma, madeira, { tabua: 7, bisel: 1.2, contorno: 0.3, projeta: { dist: 1.4, forca: 0.32 }, semente: 17710 }))

  // ---------- o banco e o balde ----------
  const [bx, by, br] = BANCO.map(f)
  const [ax, ay, ar] = BALDE.map(f)
  S.push(solta(emCima(disco(bx, by, br)), zPlataforma + e), solta(emCima(disco(ax, ay, ar)), zPlataforma + e))
  L.push(P(disco(bx, by, br), madeira, { tabua: 0, bisel: br * 0.5, tom: 1.12, contorno: 0.3, projeta: { dist: 1.2, forca: 0.3 }, semente: 17711 }))
  L.push(P(anel(ax, ay, ar, ar, ar * 0.74, ar * 0.74), madeira, { tabua: 0, bisel: 0.7, tom: 0.92, contorno: 0.3, projeta: { dist: 1.2, forca: 0.3 }, semente: 17712 }))
  L.push(P(disco(ax, ay, ar * 0.74), AGUA, { tabua: 0, bisel: 0, contorno: 0.1, recesso: { k: 1, forca: 0.3 }, semente: 17713 }))

  // ---------- os esteios do telhado ----------
  for (const [sx, sy] of cantos) S.push(...pilha(emCima(disco(sx * f(ESTEIO_EM), sy * f(ESTEIO_EM), f(RAIO_DO_ESTEIO))), zPlataforma, zTelhado))

  // ---------- o guarda-corpo: duas tábuas corridas em cada lado (a da frente aberta na escada) e os postes ----------
  const [D, Gd] = [f(PLATAFORMA), f(GUARDA_DE_DENTRO)]
  const [v0, v1] = [f(VAO_DA_ESCADA[0]), f(VAO_DA_ESCADA[1])]
  const tabuas: readonly (readonly [Forma, number])[] = [
    [caixa(-D, -D, D, -Gd), 0],
    [caixa(Gd, -D, D, D), QUARTO],
    [caixa(-D, -D, -Gd, D), QUARTO],
    [caixa(-D, Gd, v0, D), 0],
    [caixa(v1, Gd, D, D), 0],
  ]
  const zCima = ALTURA_DA_TABUA_DE_CIMA * lado
  tabuas.forEach(([forma, eixo], i) => {
    S.push(solta(emCima(forma), zCima), solta(emCima(forma), ALTURA_DA_TABUA_DO_MEIO * lado))
    L.push(P(forma, madeira, tabua(17720 + i, eixo, 1.06)))
  })
  // Os postes do vão ficam na ponta das tábuas, longe dos banzos (um disco da escada dentro deles subiria com eles).
  const postesDaGuarda: readonly Ponto[] = [...cantos.map(([sx, sy]): Ponto => [sx * f(0.69), sy * f(0.69)]), [v0 - f(0.02), f(0.69)], [v1 + f(0.02), f(0.69)]]
  for (const [x, y] of postesDaGuarda) S.push(...pilha(emCima(disco(x, y, f(POSTE_DA_GUARDA))), zPlataforma, zCima))

  // O berrante pendurado na tábua da direita: o corno claro, a boca e a ponta escura.
  const [gx, gy] = [f(0.69), 0]
  L.push(P(comMeioEm(capsula(f(0.7), f(0.16), f(0.72), f(0.02), f(0.045)), gx, gy), BERRANTE, { tabua: 0, bisel: f(0.03), contorno: 0.3, projeta: { dist: 1, forca: 0.3 }, semente: 17730 }))
  L.push(P(comMeioEm(capsula(f(0.72), f(0.02), f(0.68), f(-0.13), f(0.026)), gx, gy), BERRANTE, { tabua: 0, bisel: f(0.02), tom: 0.94, contorno: 0.3, semente: 17731 }))
  L.push(P(comMeioEm(disco(f(0.68), f(-0.14), f(0.026)), gx, gy), PONTA_DO_BERRANTE, { tabua: 0, bisel: 0.5, contorno: 0.2, semente: 17732 }))
  L.push(P(comMeioEm(disco(f(0.7), f(0.17), f(0.03)), gx, gy), PONTA_DO_BERRANTE, { tabua: 0, bisel: 0, tom: 0.7, contorno: 0.1, recesso: { k: 0.6, forca: 0.3 }, semente: 17733 }))

  // ---------- a escada encostada na frente: discos ao longo dos banzos; cada pedaço e cada degrau sobe com o seu ----------
  const zEscada = zPlataforma + ESCADA_ACIMA * lado
  const pe = f(PE_DA_ESCADA)
  const yNa = (z: number): number => pe - (pe - D) * (z / zPlataforma)
  const niveis = Math.ceil(zEscada / PASSO_DA_ESCADA)
  const banzos = [f(ESCADA_EM - MEIA_LARGURA_DA_ESCADA), f(ESCADA_EM + MEIA_LARGURA_DA_ESCADA)]
  const rBanzo = f(RAIO_DO_BANZO)
  const zDoNivel = (k: number): number => zEscada * (1 - k / niveis)
  banzos.forEach((x, lado2) => {
    for (let k = 0; k < niveis; k += 1) {
      const [y, y2] = [yNa(zDoNivel(k)), yNa(zDoNivel(k + 1))]
      // Só o trecho acima da plataforma sai depois dela; o de baixo segue a base dele (atrás da torre, some).
      const banzo = disco(x, y, rBanzo)
      S.push(solta(zDoNivel(k) > zPlataforma ? emCima(banzo) : banzo, zDoNivel(k)))
      const pedaco = capsula(x, y, x, y2, rBanzo)
      L.push(P(comMeioEm(pedaco, x, y), madeira, { tabua: 0, eixo: QUARTO, bisel: rBanzo, tom: 1.04, contorno: 0.32, projeta: { dist: 0.9, forca: 0.3 }, semente: 17740 + lado2 * 50 + k }))
    }
  })
  for (let k = 1; k < niveis; k += 2) {
    const y = yNa(zDoNivel(k))
    L.push(P(comMeioEm(capsula(banzos[0], y, banzos[1], y, f(RAIO_DO_DEGRAU)), banzos[0], y), madeira, { tabua: 0, bisel: f(RAIO_DO_DEGRAU), tom: 0.98, contorno: 0.32, semente: 17850 + k }))
  }
  S.push(contato(capsula(banzos[0], pe, banzos[1], pe, rBanzo * 1.4), 0.3))

  // ---------- o telhado de quatro águas: três camadas em degrau; as águas do lado da luz mais claras ----------
  const furo = disco(0, 0, 0.3)
  const normais: readonly Ponto[] = [[0, -1], [1, 0], [0, 1], [-1, 0]]
  CAMADAS_DO_TELHADO.forEach((meio, i) => {
    const a = f(meio)
    const b = i + 1 < CAMADAS_DO_TELHADO.length ? f(CAMADAS_DO_TELHADO[i + 1]) : 0
    const camada = esticadaParaAFrente(menos(quadrado(a, 1.5), furo), R * (0.8 + 0.001 * i), quartos)
    S.push(solta(camada, zTelhado + e * (1 + i * 0.85), i === 0 ? FORCA_DA_SOMBRA_DO_TELHADO : 0))
    normais.forEach(([nx, ny], j) => {
      const [tx, ty] = [-ny, nx]
      const fora: Ponto[] = [[nx * a - tx * a, ny * a - ty * a], [nx * a + tx * a, ny * a + ty * a]]
      const dentro: Ponto[] = b > 0 ? [[nx * b + tx * b, ny * b + ty * b], [nx * b - tx * b, ny * b - ty * b]] : [[0, 0]]
      const [sx, sy] = naTela(nx, ny, quartos)
      // A palha clara demais lia como cesto de vime: o tom fica abaixo do material, e a água da luz sobe pouco.
      const tom = 0.86 - 0.1 * (sx + sy)
      L.push(P(poligono([...fora, ...dentro]), palha, { eixo: nx === 0 ? QUARTO : 0, bisel: 1.2, tom, contorno: 0.22, projeta: { dist: 1.6, forca: 0.32 }, semente: 17860 + i * 4 + j }))
    })
  })
}
