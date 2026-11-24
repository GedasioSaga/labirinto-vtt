/**
 * RODA DE TORTURA de cima com volume (lote L03 de 24/11/2026, Tortura e fogo;
 * desenho ORIGINAL, só a ideia do objeto dos mapas de referência): a roda
 * grande de carroção deitada no alto de um EIXO, onde o preso é amarrado de
 * braços e pernas abertos. VAZIA: o mestre põe o token em cima. O ARO grosso
 * de madeira em oito cambotas, oito RAIOS e o CUBO com a tampa de ferro. O que
 * a separa de uma roda de carroça são os ESPINHOS de ferro escuro que
 * atravessam o aro e saem pela beira de FORA, em triângulo, e as quatro TIRAS
 * DE COURO escuro (dois pulsos, dois tornozelos): cada uma cruza o aro inteiro
 * como uma faixa larga, com a fivela de ferro e a ponta solta sobrando para
 * fora. Debaixo, a CRUZETA de vigas do pé, que aparece nos vãos entre os
 * raios.
 *
 * A madeira é VELHA de masmorra (a escolhida, escurecida, de veio fechado, com
 * manchas de idade; as vigas do pé escuras de umidade nas pontas). Do alto, o
 * que diz "erguida" é a SOMBRA: a da roda cai longe, para baixo à direita,
 * fraca e bem esfumada, para não brigar com a roda. O cubo está gasto e mais
 * claro. Nada de gente, de sangue ou de mancha vermelha.
 *
 * NA 3/4 é derivada (`tresQuartos.ts`): a roda é um tampo solto na altura do
 * eixo, com a beirada `ESPESSURA_DA_RODA_DE_TORTURA` (o perfil do tipo tem de
 * trazer: `{ modo: 'derivado', espessura: ESPESSURA_DA_RODA_DE_TORTURA }`); o
 * eixo é uma coluna no meio e a cruzeta fica no chão (a caixa de cada viga é
 * centrada num vão, fora da roda). Os espinhos e a ponta solta das tiras ficam
 * fora do aro: a caixa de cada um é centrada no aro, para subir com ele. Nada
 * lê o giro: a roda é igual dos quatro lados.
 *
 * A 25% de zoom sobram o aro, a estrela dos raios, os quatro riscos escuros do
 * couro cruzando o aro e o serrilhado dos espinhos por fora: é o que diz "roda
 * de tortura", e não mesa redonda, poço ou roda de carroça largada. Materiais:
 * `madeira` e `ferragens`. O couro é fixo. Tudo sai do menor lado da pegada
 * (2 x 2 casas de partida).
 */
import { hash, limitar01, passoSuave, type Rgb } from '../../ruido'
import { anel, barra, capsula, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { comMeioEm } from './andaimeDaTresQuartos'

/** A roda foi medida no tamanho de partida (2 casas, 56 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = G
/** A altura da roda em casas (a do eixo) e a grossura dela na 3/4 (px do protótipo). */
const ALTURA = 0.34
export const ESPESSURA_DA_RODA_DE_TORTURA = 0.11 * G

/** O aro, em fração do meio lado: por fora e por dentro; o cubo e a tampa de ferro dele (px de partida). */
const ARO_DE_FORA = 0.9
const ARO_DE_DENTRO = 0.735
const RAIO_DO_CUBO = 9.6
const RAIO_DA_TAMPA = 4.6
/** Os raios: quantos e a largura (px de partida). */
const RAIOS = 8
const LARGURA_DO_RAIO = 5
/**
 * Os espinhos: quantos em volta do aro e as medidas de cada um (px de partida): o quanto passa da beira de fora, a
 * largura da base e o quanto a base entra no aro.
 */
const ESPINHOS = 16
const ESPINHO = { comprimento: 4, base: 2.2, entra: 1.3 }
/** As tiras de couro: o ângulo de cada uma (graus, 0 = a direita, 90 = a frente), a largura da faixa (px de partida) e o quanto ela passa do aro (fração do meio lado). */
const TIRAS: readonly number[] = [-146, -34, 56, 124]
const LARGURA_DA_TIRA = 4
const SOBRA_DA_TIRA = 0.028
/** A ponta solta da tira, para fora do aro: o quanto sai e o quanto cai para o lado (px de partida) e a meia largura dela. */
const PONTA_SOLTA = { sai: 4.4, cai: 1.9, meia: 1.45 }
/** A cruzeta do pé: o meio comprimento (fração do meio lado) e a largura das vigas (px de partida). */
const CRUZETA = 0.74
const LARGURA_DA_VIGA = 7

/** A sombra da roda no chão: fraca e bem esfumada (a de antes tinha a massa da própria roda e brigava com ela). */
const FORCA_DA_SOMBRA_DA_RODA = 0.18
const BORDA_DA_SOMBRA_DA_RODA = 7

/** A madeira de masmorra: a escolhida, escurecida (o carvalho cai perto de #6e5238). */
const TOM_DA_MADEIRA_VELHA = 0.75
/** A umidade nas pontas das vigas do pé: o quanto escurece. */
const UMIDADE = 0.25
const TOM_DO_ARO = 1
const TOM_DO_RAIO = 0.94
const TOM_DO_CUBO = 1.1
const TOM_DA_CRUZETA = 0.62
/** O ferro escuro dos espinhos: o lado da sombra e o lado da luz. */
const TOM_DO_ESPINHO_NA_SOMBRA = 0.62
const TOM_DO_ESPINHO_NA_LUZ = 1.22
const BRILHO_DO_FERRO = 0.36
const ESCURO_DA_MADEIRA: Rgb = [0x4f, 0x3b, 0x2c]
const GRAUS = Math.PI / 180
/** De onde vem a luz no chão (a do motor): de cima à esquerda. */
const LUZ: Ponto = [-0.79, -0.61]

/** O couro escuro das tiras e o escuro das emendas do aro. */
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x45, 0x33] }
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x35, 0x2b, 0x26] }

const DA_MADEIRA = texturaDaClasse('madeira')

/**
 * A madeira velha: o veio da madeira com um veio FINO E FECHADO por cima e manchas escuras de idade. Com `de` e `ate`
 * (px a partir do meio da roda), a umidade escurece a peça de `de` para fora: as pontas das vigas do pé.
 */
function texMadeiraVelha(de: number, ate: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DA_MADEIRA !== null) DA_MADEIRA(u, v, x, y, p, s, escala)
    s[3] += ruido(u * 0.035 + p.su, v * 1.5 + p.sv) * 0.09 - limitar01(ruido(x * 0.1 + p.su, y * 0.1 + p.sv) * 2.4 - 0.2) * 0.12
    if (ate <= de) return
    s[3] -= UMIDADE * passoSuave(de, ate, Math.hypot(x, y) + ruido(x * 0.2 + p.su, y * 0.2) * (ate - de) * 0.6)
  }
}

export const montarRodaDeTortura: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  const k = R / MEIO_LADO_DE_PARTIDA
  const escolhida = c.m.madeira
  const madeira: MaterialDaPeca = { ...escolhida, rgb: [escolhida.rgb[0] * TOM_DA_MADEIRA_VELHA, escolhida.rgb[1] * TOM_DA_MADEIRA_VELHA, escolhida.rgb[2] * TOM_DA_MADEIRA_VELHA] }
  const ferro = c.m.ferragens
  const L = cena.partes
  const altura = 2 * R * ALTURA
  cena.corDoPiso = ESCURO_DA_MADEIRA
  const em = (graus: number, f: number): Ponto => [Math.cos(graus * GRAUS) * f * hw, Math.sin(graus * GRAUS) * f * hh]
  const velha = texMadeiraVelha(0, 0)
  const daMadeira = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: 1.4 * k, contorno: 0.3, textura: velha, semente, ...mais })
  const sombraMiuda = { dist: 1 * k, forca: 0.3 }

  // ---------- as formas da roda: o aro, os raios e o cubo ----------
  const aro = anel(0, 0, ARO_DE_FORA * hw, ARO_DE_FORA * hh, ARO_DE_DENTRO * hw, ARO_DE_DENTRO * hh)
  const cubo = elipse(0, 0, RAIO_DO_CUBO * k, RAIO_DO_CUBO * k)
  const raios: { forma: Forma; angulo: number }[] = []
  for (let i = 0; i < RAIOS; i += 1) {
    const graus = (i * 360) / RAIOS + 22.5
    const [ax, ay] = em(graus, 0.12)
    const [bx, by] = em(graus, ARO_DE_DENTRO + 0.02)
    raios.push({ forma: barra(ax, ay, bx, by, LARGURA_DO_RAIO * k), angulo: Math.atan2(by - ay, bx - ax) })
  }
  const roda = raios.reduce((f, r) => uniao(f, r.forma), uniao(aro, cubo))

  // ---------- as sombras: a roda no ar (longe, para baixo à direita, fraca e esfumada), o eixo e a cruzeta no chão ----------
  const eixo = elipse(0, 0, 4.6 * k, 4.6 * k)
  const vigas = [45, 135].map((graus) => {
    const [ax, ay] = em(graus, CRUZETA)
    return barra(-ax, -ay, ax, ay, LARGURA_DA_VIGA * k)
  })
  cena.sombras.push(contato(uniao(vigas[0], vigas[1]), 0.32))
  cena.sombras.push({ forma: eixo, z: altura - ESPESSURA_DA_RODA_DE_TORTURA, forca: 0.26 })
  cena.sombras.push({ forma: roda, z: altura, solta: true, suave: BORDA_DA_SOMBRA_DA_RODA * k, forca: FORCA_DA_SOMBRA_DA_RODA })

  // ---------- no chão: a cruzeta do pé, escura de umidade nas pontas (a caixa de cada viga centrada num vão, para não subir com a roda) ----------
  const [vx, vy] = em(0, 0.42)
  const umida = texMadeiraVelha(CRUZETA * R * 0.45, CRUZETA * R)
  vigas.forEach((viga, i) => {
    L.push(P(comMeioEm(viga, vx, vy), madeira, daMadeira(25201 + i, { eixo: (45 + 90 * i) * GRAUS, tom: TOM_DA_CRUZETA, bisel: 1.6 * k, textura: umida })))
  })
  for (const graus of [45, 135, 225, 315]) {
    const [px, py] = em(graus, CRUZETA - 0.05)
    L.push(P(comMeioEm(elipse(px, py, 1.5 * k, 1.5 * k), vx, vy), ferro, { tabua: 0, bisel: 1.2 * k, contorno: 0.26, tom: 1.1, metal: BRILHO_DO_FERRO, semente: 25205 + graus }))
  }

  // ---------- a roda: os raios, o aro (o veio pelo arco) com as emendas das cambotas, e o cubo ----------
  raios.forEach((raio, i) => {
    L.push(P(raio.forma, madeira, daMadeira(25210 + i, { eixo: raio.angulo, tom: TOM_DO_RAIO + 0.06 * hash(i, 1, 25210), bisel: LARGURA_DO_RAIO * k * 0.42, projeta: { dist: 5 * k, forca: 0.22, suave: 2.6 * k } })))
  })
  const meioDoAro = (ARO_DE_FORA + ARO_DE_DENTRO) / 2
  L.push(P(aro, madeira, daMadeira(25220, { arco: { cx: 0, cy: 0, r: meioDoAro * R, a0: 0 }, tom: TOM_DO_ARO, bisel: 2 * k, projeta: { dist: 5 * k, forca: 0.22, suave: 2.6 * k } })))
  for (let i = 0; i < RAIOS; i += 1) {
    const [ax, ay] = em((i * 360) / RAIOS, ARO_DE_DENTRO + 0.012)
    const [bx, by] = em((i * 360) / RAIOS, ARO_DE_FORA - 0.012)
    L.push(P(capsula(ax, ay, bx, by, 0.34 * k), VAO, { bisel: 0, contorno: 0, alfa: 0.5, semente: 25230 + i }))
  }
  L.push(P(cubo, madeira, daMadeira(25240, { polar: { cx: 0, cy: 0, r: RAIO_DO_CUBO * k }, tom: TOM_DO_CUBO, bisel: 3 * k, projeta: { dist: 1.6 * k, forca: 0.3 } })))
  L.push(P(elipse(0, 0, RAIO_DA_TAMPA * k, RAIO_DA_TAMPA * k), ferro, { tabua: 0, bisel: 1.6 * k, contorno: 0.3, tom: 1.04, metal: BRILHO_DO_FERRO, semente: 25241, projeta: sombraMiuda }))
  L.push(P(elipse(0, 0, 1.7 * k, 1.7 * k), ferro, { tabua: 0, bisel: 1.4 * k, contorno: 0.24, tom: 1.3, metal: 0.5, semente: 25242 }))

  // ---------- os espinhos de ferro escuro: atravessam o aro e saem pela beira de fora, em triângulo, com o lado da luz claro (nenhum debaixo de uma tira) ----------
  for (let i = 0; i < ESPINHOS; i += 1) {
    const graus = ((i + 0.5) * 360) / ESPINHOS
    if (TIRAS.some((tira) => Math.abs(((graus - tira + 540) % 360) - 180) < 13)) continue
    const [rx, ry] = [Math.cos(graus * GRAUS), Math.sin(graus * GRAUS)]
    const [tx, ty] = [-ry, rx]
    const [bx, by] = em(graus, ARO_DE_FORA)
    const pe: Ponto = [bx - rx * ESPINHO.entra * k, by - ry * ESPINHO.entra * k]
    const ponta: Ponto = [bx + rx * ESPINHO.comprimento * k, by + ry * ESPINHO.comprimento * k]
    const meia = (ESPINHO.base / 2) * k
    const [mx, my] = em(graus, meioDoAro)
    for (const lado of [-1, 1]) {
      const canto: Ponto = [pe[0] + tx * meia * lado, pe[1] + ty * meia * lado]
      // A face deste lado olha para o lado dela: clara se olha para a luz.
      const naLuz = (tx * LUZ[0] + ty * LUZ[1]) * lado > 0
      L.push(P(comMeioEm(poligono([pe, canto, ponta]), mx, my), ferro, { tabua: 0, bisel: 0, contorno: 0.22, tom: naLuz ? TOM_DO_ESPINHO_NA_LUZ : TOM_DO_ESPINHO_NA_SOMBRA, metal: naLuz ? 0.3 : 0, semente: 25250 + i * 2 + lado }))
    }
  }

  // ---------- as tiras de couro escuro: a faixa larga que cruza o aro inteiro, a ponta solta para fora e a fivela de ferro ----------
  TIRAS.forEach((graus, i) => {
    const [rx, ry] = [Math.cos(graus * GRAUS), Math.sin(graus * GRAUS)]
    const [tx, ty] = [-ry, rx]
    const [mx, my] = em(graus, meioDoAro)
    const [ax, ay] = em(graus, ARO_DE_DENTRO - SOBRA_DA_TIRA)
    const [bx, by] = em(graus, ARO_DE_FORA + SOBRA_DA_TIRA)
    // A ponta solta: uma tira reta, de corte reto, que sai para fora do aro um nada caída para um lado (alternado de uma tira para a outra).
    const lado = i % 2 === 0 ? 1 : -1
    const solta = barra(
      bx - rx * 1.5 * k,
      by - ry * 1.5 * k,
      bx + rx * PONTA_SOLTA.sai * k + tx * PONTA_SOLTA.cai * lado * k,
      by + ry * PONTA_SOLTA.sai * k + ty * PONTA_SOLTA.cai * lado * k,
      PONTA_SOLTA.meia * 2 * k,
    )
    L.push(P(comMeioEm(solta, mx, my), COURO, { tabua: 0, bisel: 0.8 * k, contorno: 0.32, tom: 0.84, semente: 25264 + i, projeta: sombraMiuda }))
    L.push(P(barra(ax, ay, bx, by, LARGURA_DA_TIRA * k), COURO, { tabua: 0, bisel: 1 * k, contorno: 0.34, tom: 0.92 + 0.06 * hash(i, 2, 25260), semente: 25260 + i, projeta: { dist: 1.3 * k, forca: 0.34 } }))
    // A fivela de ferro: o quadro atravessado na faixa (mais largo que ela) e o fuzilhão no meio.
    const [fx, fy] = em(graus, meioDoAro + 0.03)
    const atravessa = (meiaLargura: number, grossura: number): Forma => barra(fx - tx * meiaLargura * k, fy - ty * meiaLargura * k, fx + tx * meiaLargura * k, fy + ty * meiaLargura * k, grossura * k)
    const quadro = uniao(menos(atravessa(2.9, 3.4), atravessa(1.9, 1.5)), capsula(fx - rx * 1.5 * k, fy - ry * 1.5 * k, fx + rx * 1.5 * k, fy + ry * 1.5 * k, 0.4 * k))
    L.push(P(comMeioEm(quadro, mx, my), ferro, { tabua: 0, bisel: 0.7 * k, contorno: 0.3, tom: 0.96, metal: 0.36, semente: 25268 + i, projeta: sombraMiuda }))
  })
}
