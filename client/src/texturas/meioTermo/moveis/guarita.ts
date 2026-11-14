/**
 * GUARITA de cima com volume (14/11/2026, lote L16, construções da base militar): a casinha do sentinela no
 * portão da base. As PAREDES de bloco caiado com a faixa de JANELAS de vidro em volta, a PORTA de chapa na
 * frente (o lado da porta é a frente), o TELHADO de quatro águas de chapa ondulada verde-oliva com a BEIRA
 * pintada em listras vermelhas e brancas (a marca de posto de controle), o GIROFLEX laranja no alto, e no chão a
 * LAJE de concreto com o DEGRAU da porta.
 *
 * De cima: o telhado de quatro águas (as arestas em X até o giroflex), a beira listrada em volta, a laje cinza
 * com o degrau e a SOMBRA para baixo à direita. É a beira listrada e o giroflex que dizem "guarita" e não torre
 * de vigia (de madeira, no alto) nem bunker (laje baixa). Sem material escolhido: tudo é fixo.
 *
 * NA 3/4 (`tresQuartos.ts`): as paredes são uma coluna até o beiral; as janelas, tampos de vidro que saem um tico
 * de cada face (com o pingo de cada um no tico, `apoioDasConstrucoes.ts`); a porta e o rodapé, colunas que saem
 * um pouco mais; o telhado são três tampos em degrau, o de baixo um anel só do beiral (para não levar consigo as
 * janelas, a porta e o rodapé, que ficam debaixo dele); o giroflex, tampos de disco em cima de tudo. Lê
 * `c.giro` para cada camada do telhado e o giroflex saírem depois do que fica debaixo deles.
 *
 * Medidas em fração da meia pegada; alturas em fração do lado MENOR.
 */
import { caixa, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca } from './motor'
import { QUARTO, type MontarMovel } from './contexto'
import { chapaOndulada, comMeioEm, discosQueAlargam, esticadaParaAFrente, faixaQueSai, pingo, solta, tingido } from './apoioDasConstrucoes'

/** A beirada dos tampos da guarita (px do protótipo): a grossura do beiral e de cada degrau do telhado. O perfil usa este valor. */
export const ESPESSURA_DO_BEIRAL_DA_GUARITA = 0.13 * 56

/** As medidas de cima, em fração da meia pegada: a laje, a parede, o beiral e as camadas do telhado. */
const LAJE = 0.96
const PAREDE = 0.58
const CAMADAS_DO_TELHADO: readonly number[] = [0.76, 0.5, 0.24]
/** A largura da beira listrada (px) e o passo das listras (px). */
const BEIRA_LISTRADA = 2.6
const PASSO_DA_LISTRA = 5.2
/** O anel do beiral começa este tanto (px) fora da parede: a porta, o rodapé e as janelas ficam aquém dele. */
const ANEL_DO_BEIRAL = 2.3
/** A janela em cada face (fração da face) e a porta na face da frente (de-até, em fração). */
const JANELA: readonly [number, number] = [-0.44, 0.44]
const JANELA_DA_FRENTE: readonly [number, number] = [-0.44, 0.02]
const PORTA: readonly [number, number] = [0.12, 0.44]
/** Quanto sai da parede (px): a janela de cima, o rodapé e a porta. */
const SAI_A_JANELA = 0.8
const SAI_O_RODAPE = 1.7
const SAI_A_PORTA = 2.1
const ENTRA = 0.3
/** O degrau da porta: de-até em x (fração) e até onde vai na frente. */
const DEGRAU_ATE = 0.9
/** Onde fica o meio da caixa do degrau (fração): fora do beiral, para ele não subir com o telhado. */
const MEIO_DO_DEGRAU = 0.79
/** A beira de dentro das placas da laje (fração): a casa e o beiral cobrem o resto. */
const PLACA_DE_DENTRO = 0.6
/** Alturas em lados: o beiral, a faixa das janelas, a porta, o rodapé, o degrau e o giroflex acima do telhado. */
const ALTURA_DO_BEIRAL = 0.68
const JANELA_DE = 0.36
const JANELA_ATE = 0.56
const ALTURA_DA_PORTA = 0.54
const ALTURA_DO_RODAPE = 0.07
const ALTURA_DO_DEGRAU = 0.035
const SOBE_O_TELHADO = 0.075
const ALTURA_DO_GIROFLEX = 0.06
const RAIO_DO_GIROFLEX = 0.06

const CONCRETO: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0xa8, 0xa5, 0x9c] }
const CAIACAO: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0xc6, 0xc1, 0xb3] }
const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0x48, 0x58, 0x5e] }
const CHAPA: MaterialDaPeca = { classe: 'metal', rgb: [0x68, 0x6e, 0x50] }
const PORTA_DE_CHAPA: MaterialDaPeca = { classe: 'metal', rgb: [0x5a, 0x60, 0x48] }
const VERMELHO: MaterialDaPeca = { classe: 'liso', rgb: [0xa4, 0x4e, 0x44] }
const BRANCO: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xd0, 0xc2] }
const LARANJA: MaterialDaPeca = { classe: 'liso', rgb: [0xc8, 0x86, 0x44] }
const DO_METAL = texturaDaClasse('metal')

type Face = 'norte' | 'sul' | 'oeste' | 'leste'

export const montarGuarita: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const S = cena.sombras
  const lado = 2 * Math.min(c.hw, c.hh)
  const e = ESPESSURA_DO_BEIRAL_DA_GUARITA
  const fx = (v: number): number => v * c.hw
  const fy = (v: number): number => v * c.hh
  const [PX, PY] = [fx(PAREDE), fy(PAREDE)]
  const zBeiral = ALTURA_DO_BEIRAL * lado
  cena.corDoPiso = [0x47, 0x47, 0x40]

  /** A faixa de `t0` a `t1` (fração) ao longo da face, saindo dela de `de` a `ate` px. */
  const naFace = (face: Face, t0: number, t1: number, de: number, ate: number): Forma =>
    face === 'sul' ? caixa(fx(t0), PY + de, fx(t1), PY + ate) : face === 'norte' ? caixa(fx(t0), -PY - ate, fx(t1), -PY - de) : face === 'leste' ? caixa(PX + de, fy(t0), PX + ate, fy(t1)) : caixa(-PX - ate, fy(t0), -PX - de, fy(t1))
  const meioDaFace = (face: Face, t: number, dist: number): Ponto =>
    face === 'sul' ? [fx(t), PY + dist] : face === 'norte' ? [fx(t), -PY - dist] : face === 'leste' ? [PX + dist, fy(t)] : [-PX - dist, fy(t)]

  // ---------- no chão: a laje e o degrau da porta ----------
  // A laje em quatro placas em volta da casa, com a junta de dilatação nas quinas: a caixa de cada placa fica
  // centrada fora do beiral (inteira, centrada no meio, a 3/4 a faria subir com o giroflex).
  const laje = caixa(-fx(LAJE), -fy(LAJE), fx(LAJE), fy(LAJE), 2)
  S.push(contato(laje, 0.22))
  const [lx, ly, mx, my] = [fx(LAJE), fy(LAJE), fx(PLACA_DE_DENTRO), fy(PLACA_DE_DENTRO)]
  const placas: readonly Forma[] = [caixa(-lx, -ly, lx, -my, 2), caixa(-lx, my, lx, ly, 2), caixa(-lx, -my, -mx, my, 0.6), caixa(mx, -my, lx, my, 0.6)]
  placas.forEach((placa, i) => L.push(P(placa, CONCRETO, { tabua: 0, bisel: 1.2, tom: 0.92, contorno: 0.24, semente: 16600 + i * 7 })))
  const degrau = caixa(fx(PORTA[0] - 0.06), PY, fx(PORTA[1] + 0.06), fy(DEGRAU_ATE), 1)
  S.push({ forma: degrau, z: ALTURA_DO_DEGRAU * lado, forca: 0.2 })
  L.push(P(comMeioEm(degrau, fx((PORTA[0] + PORTA[1]) / 2), fy(MEIO_DO_DEGRAU)), CONCRETO, { tabua: 0, bisel: 0.8, tom: 1.08, contorno: 0.3, semente: 16601 }))

  // ---------- as paredes: a coluna até o beiral, com o pingo da caiação longe do telhado ----------
  S.push({ forma: caixa(-PX, -PY, PX, PY), z: zBeiral })
  L.push(pingo(P, PX - 1.4, 0, CAIACAO, 16602))

  // ---------- as janelas em volta, o rodapé e a porta ----------
  const faces: readonly Face[] = ['norte', 'sul', 'oeste', 'leste']
  faces.forEach((face, i) => {
    const [t0, t1] = face === 'sul' ? JANELA_DA_FRENTE : JANELA
    faixaQueSai(P, cena, (sai) => naFace(face, t0, t1, -ENTRA, sai), (sai) => meioDaFace(face, (t0 + t1) / 2, sai), { sai: SAI_A_JANELA, de: JANELA_DE * lado, ate: JANELA_ATE * lado, espessura: e }, VIDRO, 16610 + i * 10)
    S.push({ forma: naFace(face, -PAREDE, PAREDE, -ENTRA, SAI_O_RODAPE), z: ALTURA_DO_RODAPE * lado, forca: 0 })
    const [px, py] = meioDaFace(face, 0, SAI_O_RODAPE - 0.08)
    L.push(pingo(P, px, py, tingido(CAIACAO, 0.62), 16650 + i))
  })
  S.push({ forma: naFace('sul', PORTA[0], PORTA[1], -ENTRA, SAI_A_PORTA), z: ALTURA_DA_PORTA * lado, forca: 0 })
  L.push(P(naFace('sul', PORTA[0], PORTA[1], SAI_O_RODAPE + 0.1, SAI_A_PORTA), PORTA_DE_CHAPA, { tabua: 0, bisel: 0.3, contorno: 0.3, metal: 0.25, semente: 16660 }))

  // ---------- o telhado de quatro águas: três camadas em degrau, a de baixo só o anel do beiral ----------
  const normais: readonly Ponto[] = [[0, -1], [1, 0], [0, 1], [-1, 0]]
  const extremo = Math.max(fx(CAMADAS_DO_TELHADO[0]), fy(CAMADAS_DO_TELHADO[0])) + 1
  const miolo = caixa(-PX - ANEL_DO_BEIRAL, -PY - ANEL_DO_BEIRAL, PX + ANEL_DO_BEIRAL, PY + ANEL_DO_BEIRAL)
  CAMADAS_DO_TELHADO.forEach((meio, i) => {
    const [a, ay] = [fx(meio), fy(meio)]
    const proxima = CAMADAS_DO_TELHADO[i + 1]
    const [b, by] = proxima === undefined ? [0, 0] : [fx(proxima), fy(proxima)]
    const camada = caixa(-a, -ay, a, ay, 1)
    const z = zBeiral + i * SOBE_O_TELHADO * lado
    // Cada camada sai depois da de baixo (e de tudo o que fica debaixo do beiral): a caixa vai até além da beira, embaixo na tela.
    S.push(solta(esticadaParaAFrente(i === 0 ? menos(camada, miolo) : camada, extremo + 0.01 * i, c.giro), z + e, i === 0 ? 0.3 : 0))
    normais.forEach(([nx, ny], j) => {
      const [tx, ty] = [-ny, nx]
      const fora: Ponto[] = [[nx * a - tx * a, ny * ay - ty * ay], [nx * a + tx * a, ny * ay + ty * ay]]
      const dentro: Ponto[] = b > 0 ? [[nx * b + tx * b, ny * by + ty * by], [nx * b - tx * b, ny * by - ty * by]] : [[0, 0]]
      // A água virada para a luz (norte e oeste) clara, a do outro lado escura.
      const tom = 1 - 0.13 * (nx + ny)
      const onda = chapaOndulada(DO_METAL, 4.2, 0.08, nx === 0)
      L.push(P(poligono([...fora, ...dentro]), CHAPA, { tabua: 0, eixo: nx === 0 ? QUARTO : 0, bisel: 0.9, tom, contorno: 0.24, metal: 0.18, textura: onda, projeta: { dist: 1.4, forca: 0.3 }, semente: 16670 + i * 4 + j }))
    })
  })

  // A beira listrada em volta do beiral, por cima das águas de baixo.
  const [A, AY] = [fx(CAMADAS_DO_TELHADO[0]), fy(CAMADAS_DO_TELHADO[0])]
  const listras = (de: number, ate: number, fixo: number, aoLongoDeX: boolean, semente: number): void => {
    const n = Math.max(2, Math.round((ate - de) / PASSO_DA_LISTRA))
    const passo = (ate - de) / n
    for (let k = 0; k < n; k += 1) {
      const [s0, s1] = [de + k * passo, de + (k + 1) * passo]
      const forma = aoLongoDeX ? caixa(s0, fixo - BEIRA_LISTRADA / 2, s1, fixo + BEIRA_LISTRADA / 2) : caixa(fixo - BEIRA_LISTRADA / 2, s0, fixo + BEIRA_LISTRADA / 2, s1)
      L.push(P(forma, k % 2 === 0 ? VERMELHO : BRANCO, { tabua: 0, bisel: 0.4, contorno: 0.16, semente: semente + k }))
    }
  }
  const meiaBeira = BEIRA_LISTRADA / 2
  listras(-A, A, -AY + meiaBeira, true, 16700)
  listras(-A, A, AY - meiaBeira, true, 16740)
  listras(-AY + BEIRA_LISTRADA, AY - BEIRA_LISTRADA, -A + meiaBeira, false, 16780)
  listras(-AY + BEIRA_LISTRADA, AY - BEIRA_LISTRADA, A - meiaBeira, false, 16820)

  // ---------- o giroflex no alto: a base de chapa e a cúpula laranja ----------
  const zTopo = zBeiral + (CAMADAS_DO_TELHADO.length - 1) * SOBE_O_TELHADO * lado + e
  const raio = RAIO_DO_GIROFLEX * lado
  const noAlto = (f: Forma): Forma => esticadaParaAFrente(f, extremo + 0.1, c.giro)
  discosQueAlargam(P, cena, [0, 0], raio * 0.8, 0.3, { de: zTopo, ate: zTopo + ALTURA_DO_GIROFLEX * lado, espessura: e, forca: 0.22, estica: noAlto }, LARANJA, 16860)
  L.push(P(caixa(-raio, -raio, raio, raio, raio * 0.3), CHAPA, { tabua: 0, bisel: 0.8, tom: 0.8, contorno: 0.3, metal: 0.3, semente: 16870 }))
  L.push(P(caixa(-raio * 0.78, -raio * 0.78, raio * 0.78, raio * 0.78, raio * 0.78), LARANJA, { tabua: 0, bisel: raio * 0.5, tom: 1.04, contorno: 0.3, projeta: { dist: 1, forca: 0.3 }, semente: 16871 }))
  L.push(P(caixa(-raio * 0.42, -raio * 0.42, -raio * 0.1, -raio * 0.1, raio * 0.2), BRANCO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.7, semente: 16872 }))
}
