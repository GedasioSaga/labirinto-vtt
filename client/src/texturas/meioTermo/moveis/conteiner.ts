/**
 * CONTÊINER de cima com volume (14/11/2026, lote L16, construções da base militar; serve também o porto): a caixa
 * de aço de 20 pés, de chapa ondulada pintada, com as QUATRO QUINAS de ferro fundido (os furos de içar), as
 * CANTONEIRAS de cima ao comprido, os QUADROS das duas pontas e, na ponta da porta, as QUATRO TRANCAS de barra.
 *
 * De cima: o teto de chapa com a onda de través (o que diz "contêiner" e não caixa ou armário), as cantoneiras
 * claras do lado da luz, as quinas escuras com o furo, as trancas saindo da ponta da porta, as manchas de
 * ferrugem e a SOMBRA comprida para baixo à direita. A pintura é trocável (`pintura`, as lãs da tabela: o vinho é
 * o vermelho de óxido do contêiner de porto, o musgo o do exército, o azul e o ocre os de companhia).
 *
 * NA 3/4 (`tresQuartos.ts`): o corpo é uma coluna da pegada até `ALTURA_DO_CONTEINER`. Em cada face, as
 * CRISTAS da chapa são colunas finas que saem um tico da parede (a frente de cada uma, de crista clara, faz as
 * listras de pé da chapa); por cima delas, a CANTONEIRA de cima (um tampo) e o RODAPÉ (uma coluna baixa), e nas
 * quinas os POSTES de ferro escuro. Na ponta da porta, no lugar das cristas, as trancas e a fresta das duas
 * folhas. Cada faixa tem a peça dela no tico que sai da parede (`apoioDasConstrucoes.ts`). Lê `c.giro`: as cristas,
 * a cantoneira e o rodapé só entram na face que fica de frente na tela (as outras somem atrás do corpo, e as
 * cristas são o que custa: cada uma é uma estrutura).
 *
 * Corre pelo lado MAIOR da pegada (u ao comprido, v de través, trocados no contêiner em pé). As alturas são em
 * fração do lado MENOR (a largura do contêiner): esticar o comprimento não o faz mais alto.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, elipse, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca } from './motor'
import { BURACO, materialDaPeca, type MontarMovel } from './contexto'
import { chapaOndulada, frenteNoDesenho, solta, tingido } from './apoioDasConstrucoes'

/** A beirada dos tampos do contêiner (px do protótipo): a altura da cantoneira de cima. O perfil usa este valor. */
export const ESPESSURA_DA_CANTONEIRA_DO_CONTEINER = 5.6

/** A altura do corpo em larguras (2,59 m de altura para 2,44 m de largura). */
const ALTURA_DO_CONTEINER = 1.06
/** A altura do rodapé, em larguras. */
const ALTURA_DO_RODAPE = 0.06
/** A folga entre a pegada e a chapa (px): o que sai da parede (as cristas, as trancas) cabe nela. */
const FOLGA = 2.4
/** O passo das cristas na parede e da onda no teto (px). */
const PASSO_DA_CRISTA = 6.4
const PASSO_DA_ONDA_DO_TETO = 4.6
/** A crista ocupa esta fração do passo. */
const CHEIO_DA_CRISTA = 0.5
/** Quanto sai da parede (px): a crista, a cantoneira, o rodapé, o poste da quina e a tranca. */
const SAI_A_CRISTA = 1
const SAI_A_CANTONEIRA = 1.4
const SAI_O_RODAPE = 1.8
const SAI_O_POSTE = 2.1
const SAI_A_TRANCA = 1.2
/** O que entra da parede para dentro (px), para a faixa colar na chapa sem fresta. */
const ENTRA = 0.3
/** As cantoneiras de cima e os quadros das pontas, vistos de cima (px). */
const CANTONEIRA = 1.7
const QUADRO_DA_PONTA = 2.8
const QUINA = 3.4
/** As quatro trancas na ponta da porta, em fração da meia largura. */
const TRANCAS: readonly number[] = [-0.62, -0.2, 0.2, 0.62]
/** As manchas de ferrugem no teto: (u, v) em fração, os raios em px e o giro. */
const FERRUGENS: readonly (readonly [number, number, number, number])[] = [
  [-0.72, -0.78, 4.2, 1.1],
  [-0.3, 0.74, 3.2, 0.9],
  [0.18, -0.8, 5, 1],
  [0.66, 0.7, 2.8, 0.8],
  [0.86, -0.1, 1.6, 1.4],
]

const FERRO = materialDaPeca('ferro')
const FERRUGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x7a, 0x4c, 0x34] }
const DO_METAL = texturaDaClasse('metal')

type Face = 'norte' | 'sul' | 'oeste' | 'leste'

/** O escuro em que o pixel escuro demais é levantado: neutro, claro o bastante para o piso de luz (o da tinta era escuro demais). */
const ESCURO_DO_CONTEINER: Rgb = [0x4a, 0x46, 0x42]

/** A face do contêiner que fica de frente na tela (u ao comprido; no contêiner em pé, u corre em y). */
function faceDaFrente(giro: number, deitado: boolean): Face {
  const [dx, dy] = frenteNoDesenho(giro)
  const [du, dv] = deitado ? [dx, dy] : [dy, dx]
  return dv > 0 ? 'sul' : dv < 0 ? 'norte' : du > 0 ? 'leste' : 'oeste'
}

export const montarConteiner: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const S = cena.sombras
  const deitado = c.w >= c.h
  const [meioC, meiaL] = deitado ? [c.hw, c.hh] : [c.hh, c.hw]
  const [U, V] = [meioC - FOLGA, meiaL - FOLGA]
  const largura = 2 * meiaL
  const H = ALTURA_DO_CONTEINER * largura
  const tinta: MaterialDaPeca = { classe: 'metal', rgb: c.m.pintura.rgb }
  const crista = tingido(tinta, 1.12)
  const escura = tingido(tinta, 0.78)
  cena.corDoPiso = ESCURO_DO_CONTEINER

  /** A caixa em (u, v), virada para a pegada em pé quando o contêiner corre de pé. */
  const bloco = (u0: number, v0: number, u1: number, v1: number, raio = 0): Forma => (deitado ? caixa(u0, v0, u1, v1, raio) : caixa(v0, u0, v1, u1, raio))
  const pt = (u: number, v: number): Ponto => (deitado ? [u, v] : [v, u])
  const meiaFace = (face: Face): number => (face === 'norte' || face === 'sul' ? U : V)
  /** A faixa de `t0` a `t1` ao longo da face, saindo dela de `de` a `ate` px. */
  const naFace = (face: Face, t0: number, t1: number, de: number, ate: number): Forma =>
    face === 'sul' ? bloco(t0, V + de, t1, V + ate) : face === 'norte' ? bloco(t0, -V - ate, t1, -V - de) : face === 'leste' ? bloco(U + de, t0, U + ate, t1) : bloco(-U - ate, t0, -U - de, t1)

  // ---------- o corpo: a coluna da pegada, com a sombra comprida e o contato ----------
  const corpo = bloco(-U, -V, U, V, 0.6)
  S.push(contato(bloco(-U - 0.6, -V - 0.6, U + 0.6, V + 0.6, 0.8), 0.36), { forma: corpo, z: H })

  // ---------- o teto: a chapa com a onda de través, as cantoneiras, os quadros das pontas ----------
  const teto = chapaOndulada(DO_METAL, PASSO_DA_ONDA_DO_TETO, 0.09, deitado)
  L.push(P(bloco(-U + QUADRO_DA_PONTA, -V + CANTONEIRA, U - QUADRO_DA_PONTA, V - CANTONEIRA), tinta, { tabua: 0, bisel: 0.5, contorno: 0.24, metal: 0.16, textura: teto, semente: 16100 }))
  L.push(P(bloco(-U, -V, U, -V + CANTONEIRA, 0.4), tinta, { tabua: 0, bisel: 0.6, tom: 1.12, contorno: 0.3, metal: 0.24, semente: 16101 }))
  L.push(P(bloco(-U, V - CANTONEIRA, U, V, 0.4), tinta, { tabua: 0, bisel: 0.6, tom: 0.9, contorno: 0.3, metal: 0.24, semente: 16102 }))
  L.push(P(bloco(-U, -V, -U + QUADRO_DA_PONTA, V, 0.4), tinta, { tabua: 0, bisel: 0.8, tom: 0.96, contorno: 0.3, metal: 0.2, semente: 16103 }))
  L.push(P(bloco(U - QUADRO_DA_PONTA, -V, U, V, 0.4), tinta, { tabua: 0, bisel: 0.8, tom: 0.92, contorno: 0.3, metal: 0.2, semente: 16104 }))

  // As manchas de ferrugem, que escorrem da cantoneira para o meio do teto.
  FERRUGENS.forEach(([fu, fv, ru, rv], i) => {
    const [x, y] = pt(fu * U, fv * V)
    const [rx, ry] = deitado ? [ru, rv] : [rv, ru]
    L.push(P(elipse(x, y, rx, ry), FERRUGEM, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.42 + 0.2 * hash(i, 1, 1611), suave: 1.1, semente: 16110 + i }))
  })

  // As quatro quinas de ferro fundido, cada uma com o furo de içar.
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const [u, v] = [su * (U - QUINA / 2), sv * (V - QUINA / 2)]
    L.push(P(bloco(u - QUINA / 2, v - QUINA / 2, u + QUINA / 2, v + QUINA / 2, 0.5), FERRO, { tabua: 0, bisel: 0.7, tom: 0.78, contorno: 0.34, metal: 0.3, semente: 16120 + su * 3 + sv }))
    const [x, y] = pt(u, v)
    L.push(P(deitado ? elipse(x, y, 0.95, 0.55) : elipse(x, y, 0.55, 0.95), BURACO, { tabua: 0, bisel: 0, contorno: 0.1, tom: 0.7, semente: 16130 + su * 3 + sv }))
  }

  // ---------- as faces: as cristas (ou as trancas na ponta da porta), a cantoneira de cima e o rodapé ----------
  const faces: readonly Face[] = [faceDaFrente(c.giro, deitado)]
  faces.forEach((face, f) => {
    const meia = meiaFace(face)
    const semente = 16200 + f * 100
    if (face === 'leste') {
      // A ponta da porta: as quatro trancas de barra e a fresta entre as duas folhas.
      TRANCAS.forEach((t, i) => {
        const barra = naFace(face, t * meia - 0.55, t * meia + 0.55, -ENTRA, SAI_A_TRANCA)
        S.push({ forma: barra, z: 0.94 * H, forca: 0 })
        L.push(P(barra, FERRO, { tabua: 0, bisel: 0.4, tom: 1.08, contorno: 0.3, metal: 0.4, semente: semente + i }))
      })
      const fresta = naFace(face, -0.35, 0.35, -ENTRA, SAI_A_CRISTA)
      S.push({ forma: fresta, z: H, forca: 0 })
      L.push(P(fresta, BURACO, { tabua: 0, bisel: 0, contorno: 0.1, semente: semente + 9 }))
    } else {
      const cristas = Math.floor((2 * meia - 2 * QUINA) / PASSO_DA_CRISTA)
      const inicio = -((cristas - 1) * PASSO_DA_CRISTA) / 2
      const meiaCrista = (PASSO_DA_CRISTA * CHEIO_DA_CRISTA) / 2
      for (let k = 0; k < cristas; k += 1) {
        const t = inicio + k * PASSO_DA_CRISTA
        const faixa = naFace(face, t - meiaCrista, t + meiaCrista, -ENTRA, SAI_A_CRISTA)
        S.push({ forma: faixa, z: H, forca: 0 })
        L.push(P(faixa, crista, { tabua: 0, bisel: 0.45, contorno: 0.26, metal: 0.2, semente: semente + 10 + k }))
      }
    }
    // A cantoneira de cima (tampo) e o rodapé (coluna baixa), cada um com a peça no tico só dele.
    S.push(solta(naFace(face, -meia, meia, -ENTRA, SAI_A_CANTONEIRA), H))
    L.push(P(naFace(face, -meia + QUINA, meia - QUINA, SAI_A_CRISTA, SAI_A_CANTONEIRA), tinta, { tabua: 0, bisel: 0, contorno: 0.2, semente: semente + 80 }))
    S.push({ forma: naFace(face, -meia, meia, -ENTRA, SAI_O_RODAPE), z: ALTURA_DO_RODAPE * largura, forca: 0 })
    L.push(P(naFace(face, -meia + QUINA, meia - QUINA, SAI_A_CANTONEIRA, SAI_O_RODAPE), escura, { tabua: 0, bisel: 0, contorno: 0.2, semente: semente + 81 }))
  })

  // ---------- os postes de ferro das quatro quinas, do chão à cantoneira ----------
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const [u0, u1] = su > 0 ? [U - QUINA, U + SAI_O_POSTE] : [-U - SAI_O_POSTE, -U + QUINA]
    const [v0, v1] = sv > 0 ? [V - QUINA, V + SAI_O_POSTE] : [-V - SAI_O_POSTE, -V + QUINA]
    S.push({ forma: bloco(u0, v0, u1, v1), z: H, forca: 0 })
    const [pu, pv] = [su * (U + SAI_O_POSTE - 0.4), sv * (V + SAI_O_POSTE - 0.4)]
    L.push(P(bloco(pu - 0.35, pv - 0.35, pu + 0.35, pv + 0.35), escura, { tabua: 0, bisel: 0, contorno: 0, semente: 16190 + su * 3 + sv }))
  }
}
