/**
 * ESTRADO EM MEIA-LUA (lote L05 de 24/11/2026, item 50: construção, do fundo da nave da cripta do mapa 8; desenho
 * próprio, só a ideia do objeto). Três DEGRAUS semicirculares de pedra clara, encostados na parede pelo lado reto (o
 * lado de cima da pegada): o anel de baixo, o do meio e o patamar de cima, cada um mais alto. Os dois anéis são de
 * blocos em leque, com as juntas escuras e DESENCONTRADAS (dez blocos embaixo, nove no meio: nenhuma junta continua
 * de um anel para o outro); o patamar é de três lajes com as juntas paralelas à parede, a faixa de pedra embutida perto
 * da beira e a ROSETA embutida no meio do lado reto, junto da parede. Cada degrau faz sombra no de baixo, as beiras têm
 * lascas e o musgo junta nos cantos da parede. Não barra.
 *
 * Revisão do diretor de arte (24/11): com dez e oito blocos e o patamar em quatro cunhas, as juntas se alinhavam até o
 * centro e o estrado lia como alvo de dardos ou guarda-chuva; os espelhos dos degraus na 3/4 eram claros demais.
 *
 * Na 3/4 (`tresQuartos.ts`: cada sombra com altura é uma estrutura, pintada do norte para o sul; cada peça sobe com a
 * estrutura mais alta que contém o meio da caixa dela) cada degrau é uma coluna da altura dele, pintada antes do
 * degrau de baixo (que cobre o pé dela, como no degrau de verdade). Os anéis vão em duas metades, a da esquerda e a da
 * direita no desenho: girado um quarto de volta, o anel fica deitado na tela e, inteiro, seria pintado depois do
 * degrau de cima e cobriria a beira dele. O meio da caixa de cada bloco é posto no próprio bloco (`comMeioEm`): a
 * caixa de um setor de anel tem o meio no vão de dentro, no degrau de cima. O bloco do meio do anel de nove cai nas
 * duas metades: vai em duas peças com a mesma semente (o grão continua), cortadas em x = 0 sem chanfro, a da esquerda
 * primeiro (a sombra dela cairia na da direita). O ESPELHO de cada degrau (a frente da 3/4) sai do material do fundo
 * de juntas de cada estrutura, a maior peça dela: a pedra escurecida até o tom 0,6 na frente.
 * Material: `pedra`; o musgo é fixo.
 */
import { hash, luz, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, dentroDe, elipse, elipseGirada, menos, poligono, type Forma } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'

/** Os raios dos degraus, em fração do raio de fora, e a altura de cada degrau (casas). */
const RAIO_DO_MEIO = 0.71
const RAIO_DE_CIMA = 0.43
const ALTURA_DO_DEGRAU = 0.1
/**
 * Os blocos de cada anel: dez embaixo (uma junta no meio) e nove no meio (um bloco no meio), para as juntas não se
 * alinharem; e as juntas das lajes do patamar, paralelas à parede (fração do raio dele a partir da parede).
 */
const BLOCOS_DE_BAIXO = 10
const BLOCOS_DO_MEIO = 9
const JUNTAS_DO_PATAMAR: readonly number[] = [0.38, 0.72]
/** A roseta embutida no meio do lado reto do patamar: o raio (px) e as pétalas. */
const RAIO_DA_ROSETA = 5.2
const PETALAS = 5
/**
 * O espelho dos degraus na 3/4: o tom que a 3/4 aplica à frente (o `TOM_DA_FRENTE` de `tresQuartos.ts`; importá-lo
 * fecharia um ciclo quando a 3/4 importar daqui) e o tom que o espelho deve ter.
 */
const TOM_DA_FRENTE_NA_3_4 = 0.74
const TOM_DO_ESPELHO = 0.6
/** A distância "longe" fora do corte do bloco do meio. */
const FORA = 1000
/** A junta entre os blocos (px) e a faixa embutida do patamar (px a partir da beira e largura). */
const JUNTA = 0.9
const FAIXA = 4.4
const LARGURA_DA_FAIXA = 1.5
const MUSGO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }
/**
 * A sombra que cada degrau faz no de baixo. Mais comprida e mais forte que a da altura de verdade (1,5 px a 0,32): de
 * cima, com ela fraca, os três degraus liam como um piso plano em leque. O tom sobe de degrau em degrau pelo mesmo
 * motivo: o de cima, mais perto da luz, é o mais claro.
 */
const SOMBRA_DO_DEGRAU = { dist: 2.3, forca: 0.42 }
/** O escuro da pedra (o do túmulo e do pilar): com a nogueira a beira cinza saía marrom. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

/** A mesma forma com a caixa esticada até o meio dela cair em (cx, cy): muda só a estrutura da 3/4 em que ela sobe. */
function comMeioEm(f: Forma, cx: number, cy: number): Forma {
  const [x0, y0, x1, y1] = f.b
  const rx = Math.max(cx - x0, x1 - cx)
  const ry = Math.max(cy - y0, y1 - cy)
  return { b: [cx - rx, cy - ry, cx + rx, cy + ry], d: f.d }
}

/** A forma `f` só entre x0 (incluso) e x1, sem chanfro nem contorno no corte (fora, "longe"). */
function entreXs(f: Forma, x0: number, x1: number): Forma {
  return { b: [Math.max(f.b[0], x0), f.b[1], Math.min(f.b[2], x1), f.b[3]], d: (x, y) => (x >= x0 && x < x1 ? f.d(x, y) : FORA) }
}

export const montarEstradoEmMeiaLua: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  // O fundo das juntas: a pedra escurecida, que dá o espelho do degrau na 3/4; de cima, o tom da peça compensa.
  const escuro: MaterialDaPeca = { ...pedra, rgb: luz(pedra.rgb, TOM_DO_ESPELHO / TOM_DA_FRENTE_NA_3_4 - 1) }
  const tomDoFundo = 0.6 * (TOM_DA_FRENTE_NA_3_4 / TOM_DO_ESPELHO)
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  // O centro da meia-lua fica no meio do lado da parede.
  const oy = -hh
  const r1 = Math.min(hw, 2 * hh) - 0.5
  const r2 = r1 * RAIO_DO_MEIO
  const r3 = r1 * RAIO_DE_CIMA
  const meiaLua = (r: number): Forma => dentroDe(elipse(0, oy, r, r), caixa(-r - 1, oy, r + 1, oy + r + 1))
  const anelEntre = (dentro: number, fora: number): Forma => menos(meiaLua(fora), elipse(0, oy, dentro, dentro))
  /** O setor entre os ângulos (0 = para a direita, pi/2 = para baixo), com uma folga de junta de cada lado. */
  const setor = (a0: number, a1: number, r: number): Forma => {
    const folga = JUNTA / 2 / r
    const pontos = [a0 + folga, (a0 + a1) / 2, a1 - folga].map((a): readonly [number, number] => [Math.cos(a) * r * 1.6, oy + Math.sin(a) * r * 1.6])
    return poligono([[0, oy], ...pontos])
  }
  const noSetor = (a: number, r: number): readonly [number, number] => [Math.cos(a) * r, oy + Math.sin(a) * r]
  /**
   * A caixa justa do bloco entre os ângulos a0 e a1 (de 0 a pi) e os raios `dentro` e `fora`, com 1 px de folga. A
   * caixa do setor ia até o meio da meia-lua; esticada pelo `comMeioEm`, passava a do fundo de juntas, e o espelho do
   * degrau (o material da maior peça da estrutura) saía da pedra clara.
   */
  const caixaDoBloco = (a0: number, a1: number, dentro: number, fora: number): Forma['b'] => {
    const xs = [Math.cos(a0) * dentro, Math.cos(a0) * fora, Math.cos(a1) * dentro, Math.cos(a1) * fora]
    const ys = [Math.sin(a0) * dentro, Math.sin(a1) * dentro, Math.sin(a0) * fora, Math.sin(a1) * fora]
    const yDeBaixo = a0 <= Math.PI / 2 && a1 >= Math.PI / 2 ? fora : Math.max(...ys)
    return [Math.min(...xs) - 1, oy + Math.min(...ys) - 1, Math.max(...xs) + 1, oy + yDeBaixo + 1]
  }

  cena.sombras.push(contato(meiaLua(r1), 0.32))

  // O MUSGO no chão, no pé da curva, dos dois lados (fica embaixo de tudo).
  const musgo = { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.55, suave: 0.9 }
  L.push(P(elipse(...noSetor(Math.PI * 0.82, r1 + 1.6), 3.4, 2.2), MUSGO, { ...musgo, semente: 5090 }))
  L.push(P(elipse(...noSetor(Math.PI * 0.2, r1 + 1.4), 2.6, 1.8), MUSGO, { ...musgo, alfa: 0.45, semente: 5091 }))

  // Os dois ANÉIS: as metades (estruturas), o fundo escuro das juntas de cada metade e os blocos em leque.
  const aneis = [
    { dentro: r2, fora: r1, z: g * ALTURA_DO_DEGRAU, blocos: BLOCOS_DE_BAIXO, tom: 0.86, projeta: undefined, semente: 5000 },
    { dentro: r3, fora: r2, z: g * ALTURA_DO_DEGRAU * 2, blocos: BLOCOS_DO_MEIO, tom: 0.97, projeta: SOMBRA_DO_DEGRAU, semente: 5030 },
  ]
  for (const a of aneis) {
    const anel = anelEntre(a.dentro, a.fora)
    const rMeio = (a.dentro + a.fora) / 2
    for (const lado of [-1, 1]) {
      // A metade cortada em x = 0 sem chanfro: com o corte de uma caixa, o espelho ganhava um risco de contorno no meio.
      const metade = lado < 0 ? entreXs(anel, -Infinity, 0) : entreXs(anel, 0, Infinity)
      cena.sombras.push({ forma: metade, z: a.z })
      L.push(P(comMeioEm(metade, ...noSetor(lado < 0 ? Math.PI * 0.75 : Math.PI * 0.25, rMeio)), escuro, { tabua: 0, bisel: 0.6, tom: tomDoFundo, contorno: 0.3, semente: a.semente }))
    }
    for (let k = 0; k < a.blocos; k += 1) {
      const a0 = (k / a.blocos) * Math.PI
      const a1 = ((k + 1) / a.blocos) * Math.PI
      const bloco: Forma = { b: caixaDoBloco(a0, a1, a.dentro, a.fora), d: dentroDe(anel, setor(a0, a1, a.fora)).d }
      // O bloco que cai nas duas metades vai em duas peças, a da esquerda (ângulos depois do meio) primeiro.
      const partes = a0 < Math.PI / 2 && a1 > Math.PI / 2
        ? [{ f: entreXs(bloco, -Infinity, 0), meio: (Math.PI / 2 + a1) / 2 }, { f: entreXs(bloco, 0, Infinity), meio: (a0 + Math.PI / 2) / 2 }]
        : [{ f: bloco, meio: (a0 + a1) / 2 }]
      for (const { f, meio } of partes) {
        L.push(P(comMeioEm(f, ...noSetor(meio, rMeio)), pedra, { tabua: 0, bisel: 1.1, tom: a.tom + 0.08 * hash(k, a.blocos, 5010), contorno: 0.24, projeta: a.projeta, semente: a.semente + 1 + k }))
      }
    }
  }

  // As LASCAS da beira do anel de baixo.
  for (const [a, r] of [[0.32, 2.4], [1.9, 2], [2.62, 2.8]] as const) {
    const [lx, ly] = noSetor(a, r1)
    L.push(P(dentroDe(anelEntre(r2, r1), elipse(lx, ly, r * 1.3, r)), pedra, { tabua: 0, bisel: 0.6, tom: 0.7, contorno: 0.2, recesso: { k: 0.8, forca: 0.3 }, semente: 5020 }))
  }

  // O PATAMAR de cima: a estrutura, as três lajes com as juntas paralelas à parede e a faixa embutida perto da beira.
  const patamar = meiaLua(r3)
  cena.sombras.push({ forma: patamar, z: g * ALTURA_DO_DEGRAU * 3 })
  L.push(P(comMeioEm(patamar, ...noSetor(Math.PI / 2, r3 * 0.5)), escuro, { tabua: 0, bisel: 0.6, tom: tomDoFundo, contorno: 0.3, semente: 5060 }))
  const cortes = [oy - 1, ...JUNTAS_DO_PATAMAR.map((t) => oy + r3 * t), oy + r3 + 1]
  for (let k = 0; k < cortes.length - 1; k += 1) {
    const y0 = k === 0 ? cortes[k] : cortes[k] + JUNTA / 2
    const y1 = k === cortes.length - 2 ? cortes[k + 1] : cortes[k + 1] - JUNTA / 2
    const laje = dentroDe(patamar, caixa(-r3 - 1, y0, r3 + 1, y1))
    L.push(P(comMeioEm(laje, 0, (Math.max(y0, oy) + Math.min(y1, oy + r3)) / 2), pedra, { tabua: 0, bisel: 1.2, tom: 1.08 + 0.06 * hash(k, 4, 5061), contorno: 0.24, projeta: SOMBRA_DO_DEGRAU, semente: 5062 + k }))
  }
  const faixa = dentroDe(anelEntre(r3 - FAIXA - LARGURA_DA_FAIXA, r3 - FAIXA), caixa(-r3, oy + 0.6, r3, oy + r3))
  // A faixa fica com a caixa dela (o meio já cai no patamar): posta na beira, a caixa esticada passava a do fundo de
  // juntas e o espelho do patamar saía da pedra clara.
  L.push(P(faixa, pedra, { tabua: 0, bisel: 0.3, tom: 0.7, contorno: 0.16, semente: 5070 }))

  // A ROSETA embutida no meio do lado reto, junto da parede: o meio-disco de pedra mais escura, o friso em volta, as
  // pétalas gravadas e o botão.
  const naParede = caixa(-RAIO_DA_ROSETA - 1, oy + 0.6, RAIO_DA_ROSETA + 1, oy + RAIO_DA_ROSETA + 1)
  const gravada = { tabua: 0, bisel: 0, contorno: 0, tom: 0.66, recesso: { k: 0.5, forca: 0.3 } }
  L.push(P(dentroDe(elipse(0, oy, RAIO_DA_ROSETA, RAIO_DA_ROSETA), naParede), pedra, { tabua: 0, bisel: 0.3, tom: 0.86, contorno: 0.18, recesso: { k: 0.8, forca: 0.3 }, semente: 5072 }))
  L.push(P(dentroDe(menos(elipse(0, oy, RAIO_DA_ROSETA, RAIO_DA_ROSETA), elipse(0, oy, RAIO_DA_ROSETA - 0.7, RAIO_DA_ROSETA - 0.7)), naParede), pedra, { ...gravada, semente: 5073 }))
  for (let k = 0; k < PETALAS; k += 1) {
    const a = ((k + 0.5) / PETALAS) * Math.PI
    const rMeio = RAIO_DA_ROSETA * 0.55
    L.push(P(elipseGirada(Math.cos(a) * rMeio, oy + Math.sin(a) * rMeio, RAIO_DA_ROSETA * 0.3, 0.75, a), pedra, { ...gravada, semente: 5074 + k }))
  }
  L.push(P(dentroDe(elipse(0, oy, 1.4, 1.4), naParede), pedra, { tabua: 0, bisel: 0.5, tom: 1.04, contorno: 0.2, semente: 5080 }))
  L.push(P(comMeioEm(elipse(r3 * 0.62, oy + 3, 3.4, 2.2), ...noSetor(0.3, r3 * 0.5)), MUSGO, { ...musgo, alfa: 0.4, semente: 5071 }))
}
