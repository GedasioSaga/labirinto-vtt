/**
 * ESCORREGADOR de cima com volume (lote L12 dos objetos novos, 14/11/2026, "Descanso e brincadeira"): o de
 * quintal ou de praça, de madeira, comprido ao longo da largura da pegada. Do lado do poente, a ESCADA inclinada
 * (dois banzos e cinco degraus redondos, gastos de pé); no meio, a PLATAFORMA de tábuas com os quatro postes e o
 * GUARDA-CORPO dos dois lados compridos; do lado do nascente, a CALHA que desce em curva (reta no alto, íngreme
 * no meio, deitada na saída) e acaba na SAÍDA quase rente ao chão. A calha é uma chapa de metal polido (o
 * material `calha`) entre duas tábuas de beira (a `madeira`); um par de pés a segura no meio da descida.
 *
 * A 25% de zoom sobram os degraus em listras curtas, o quadrado da plataforma com os quatro postes e a faixa
 * clara e comprida da chapa com a beira de madeira: é o que diz escorregador, e não banco ou mesa. A sombra
 * comprida da calha, que encurta até a saída, diz que ela desce.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado SEM beirada, `espessura: 0`, como o balanço): os postes são colunas; a
 * plataforma, o guarda-corpo e cada degrau são tampos soltos na altura deles; os banzos e a calha são cortados em
 * FATIAS ao longo de x, cada uma um tampo solto na altura do meio dela (a técnica da banqueta e do balanço: cada
 * fatia é a forma inteira, só pintada dentro da faixa dela, e a faixa passa do corte para fechar o degrau). As
 * estruturas das fatias são âncoras sem sombra; as sombras de verdade da calha e dos banzos são as formas
 * projetadas no chão, calculadas aqui. A grossura da plataforma e da calha é PINTADA (uma cópia mais escura,
 * descida `ESPESSURA_PINTADA`, como o assento do balanço): com beirada, cada fatia ganhava um dente embaixo e a
 * calha saía num pente. Visto com um quarto de volta, a calha vem de frente e as fatias podem mostrar degraus
 * miúdos.
 *
 * O escorregador corre sempre ao longo de x: esticado, a calha cresce e a escada e a plataforma ficam do tamanho
 * da largura (`c.h`). Materiais: `madeira` e `calha`.
 */
import { limitar01, type Rgb } from '../../ruido'
import { barra, caixa, capsula, dentroDe, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type Peca, type Textura } from './motor'
import { QUARTO, type MontarMovel } from './contexto'

/** A grossura pintada da plataforma e da calha (casas) e o tom dela: a borda de baixo que a 3/4 mostra. */
const ESPESSURA_PINTADA = 0.06
const TOM_DA_ESPESSURA = 0.6

/** As alturas, em casas: a plataforma, o guarda-corpo acima dela e a saída da calha. */
const ALTURA_DA_PLATAFORMA = 0.78
const ALTURA_DO_GUARDA_CORPO = 0.34
const ALTURA_DA_SAIDA = 0.1

/** Ao longo de x, em frações da largura `c.h`: o pé da escada (a partir da beira), o vão dela e o fundo da plataforma. */
const PE_DA_ESCADA = 0.04
const VAO_DA_ESCADA = 0.52
const FUNDO_DA_PLATAFORMA = 0.56
/** A calha entra um pouco na plataforma, o trecho deitado da saída e a folga até a beira, em frações de `c.h`. */
const CALHA_NA_PLATAFORMA = 0.05
const SAIDA = 0.28
const FOLGA_DA_PONTA = 0.02

/** De través (y), meias larguras em frações de `c.h`: a plataforma, a escada e a calha. */
const MEIA_PLATAFORMA = 0.42
const MEIA_ESCADA = 0.27
const MEIA_CALHA = 0.22
/** Fração da meia calha em que a chapa acaba e começa a tábua da beira. */
const BEIRA_DA_CALHA = 0.7

/** Grossuras, em frações de `c.h`: o meio lado do poste, o raio do banzo, o do degrau e a meia largura do guarda-corpo. */
const MEIO_POSTE = 0.055
const RAIO_DO_BANZO = 0.036
const RAIO_DO_DEGRAU = 0.028
const MEIO_GUARDA_CORPO = 0.035
/** O par de pés da calha: onde fica na descida (fração dela) e o meio lado de cada pé (fração de `c.h`). */
const PES_DA_CALHA = 0.5
const MEIO_PE_DA_CALHA = 0.035

const DEGRAUS = 5
/** Fatias miúdas: na 3/4 o degrau entre uma e a seguinte fica abaixo de 1,5 px e a beira da calha sai lisa. */
const FATIAS_DA_CALHA = 52
const FATIAS_DO_BANZO = 26
/** Quanto cada fatia pinta além do corte, em fração do passo dela: fecha o degrau entre uma altura e a seguinte. */
const SOBRA_DA_FATIA = 1
/** Pontos de cada beira da sombra da calha: a curva dela no chão. */
const PONTOS_DA_SOMBRA = 12

/** Tons da madeira: o degrau gasto de pé, o topo dos postes e o tampo do guarda-corpo, mais claros. */
const TOM_DO_DEGRAU = 1.12
const TOM_DO_POSTE = 0.86
const TOM_DO_TOPO = 1.06

/**
 * A chapa da calha: metal polido. As riscas finas correm ao longo dela; a parede de dentro do lado da luz (o
 * norte) fica na sombra, a do sul pega luz; o reflexo comprido corre um pouco acima do meio; na descida a chapa
 * vira as costas para a luz e escurece. A tábua de cada beira é a madeira, com o vinco escuro onde encontra a chapa.
 */
function texDaCalha(meia: number, aco: Rgb, descida: readonly [number, number]): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    const a = Math.abs(y) / meia
    const naDescida = x > descida[0] && x < descida[1] ? Math.sin((Math.PI * (x - descida[0])) / (descida[1] - descida[0])) : 0
    if (a >= BEIRA_DA_CALHA) {
      if (madeira !== null) madeira(u, v, x, y, p, s, escala)
      // A tábua da beira: o vinco escuro junto da chapa e o fio claro na quina de fora, do lado da luz.
      const vinco = 1 - limitar01((a - BEIRA_DA_CALHA) / 0.1)
      const quina = limitar01((a - 0.88) / 0.08) * (y < 0 ? 1 : 0.3)
      s[3] += -0.06 - 0.34 * vinco * vinco + 0.16 * quina - 0.06 * naDescida
      return
    }
    s[0] = aco[0]
    s[1] = aco[1]
    s[2] = aco[2]
    const q = y / (meia * BEIRA_DA_CALHA)
    let luz = ruido(x * 0.05 + p.su, y * 0.7) * 0.07 + ruido(x * 0.45, y * 0.45 + p.sv) * 0.02
    // A chapa é côncava: a parede do norte (de costas para a luz) escurece, a do sul clareia.
    if (q < -0.45) luz -= 0.3 * ((-q - 0.45) / 0.55)
    else if (q > 0.45) luz += 0.12 * ((q - 0.45) / 0.55)
    const brilho = (q + 0.1) / 0.16
    luz += 0.28 * Math.exp(-brilho * brilho)
    s[3] += luz - 0.16 * naDescida
  }
}

/**
 * Uma peça reta ao longo de x cortada em FATIAS (a calha, o banzo): cada fatia é a forma inteira, pintada só
 * dentro da faixa dela (a caixa da peça), e a estrutura dela é uma âncora sem sombra na altura do meio da faixa.
 * `pintar` faz as peças de cada fatia, de baixo para cima; a fatia que pisa no chão não sobe.
 */
function emFatias(cena: Cena, forma: Forma, fatias: number, altura: (x: number) => number, pintar: (fatia: Forma) => readonly Peca[]): void {
  const [x0, y0, x1, y1] = forma.b
  const passo = (x1 - x0) / fatias
  const sobra = passo * SOBRA_DA_FATIA
  for (let j = 0; j < fatias; j += 1) {
    const de = x0 + j * passo
    const ate = de + passo
    const z = altura((de + ate) / 2)
    if (z > 0) cena.sombras.push({ forma: dentroDe(forma, caixa(de, y0 - 1, ate, y1 + 1)), z, solta: true, forca: 0, suave: 0.1 })
    cena.partes.push(...pintar({ b: [Math.max(x0, de - sobra), y0, Math.min(x1, ate + sobra), y1], d: forma.d }))
  }
}

/** A sombra no chão de uma faixa reta ao longo de x, de meia largura `meia` em volta de `y`, com a altura `altura(x)`. */
function sombraDaFaixa(x0: number, x1: number, y: number, meia: number, altura: (x: number) => number): Forma {
  const norte: Ponto[] = []
  const sul: Ponto[] = []
  for (let i = 0; i <= PONTOS_DA_SOMBRA; i += 1) {
    const x = x0 + ((x1 - x0) * i) / PONTOS_DA_SOMBRA
    const z = altura(x)
    norte.push([x + SOMBRA_X * z, y - meia + SOMBRA_Y * z])
    sul.push([x + SOMBRA_X * z, y + meia + SOMBRA_Y * z])
  }
  return poligono([...norte, ...sul.reverse()])
}

export const montarEscorregador: MontarMovel = (c, cena) => {
  const { hw, h, g, peca: P } = c
  const mad = c.m.madeira
  const calha = c.m.calha
  const L = cena.partes
  const H = g * ALTURA_DA_PLATAFORMA
  const topoDoGuarda = H + g * ALTURA_DO_GUARDA_CORPO
  const zSaida = g * ALTURA_DA_SAIDA
  const grossura = g * ESPESSURA_PINTADA

  // Ao longo de x: a escada, a plataforma e a calha (o resto do comprimento).
  const xPe = -hw + h * PE_DA_ESCADA
  const xP0 = xPe + h * VAO_DA_ESCADA
  const xP1 = xP0 + h * FUNDO_DA_PLATAFORMA
  const xC0 = xP1 - h * CALHA_NA_PLATAFORMA
  const xC1 = hw - h * FOLGA_DA_PONTA
  const xD1 = Math.max(xP1 + h * 0.3, xC1 - h * SAIDA)
  const mp = h * MEIA_PLATAFORMA
  const me = h * MEIA_ESCADA
  const mc = h * MEIA_CALHA
  const rp = h * MEIO_POSTE

  /** A altura da calha: reta na plataforma, a descida em S (íngreme no meio) e a saída deitada. */
  const alturaDaCalha = (x: number): number => {
    if (x <= xP1) return H
    if (x >= xD1) return zSaida
    const t = (x - xP1) / (xD1 - xP1)
    return zSaida + (H - zSaida) * (0.5 + 0.5 * Math.cos(Math.PI * t))
  }
  const alturaDaEscada = (x: number): number => H * limitar01((x - xPe) / (xP0 - xPe))

  // OS PÉS DA CALHA, debaixo dela (de cima a chapa os tapa; na 3/4 são as duas colunas que a seguram).
  const xPes = xP1 + (xD1 - xP1) * PES_DA_CALHA
  const zPes = alturaDaCalha(xPes) - 1
  const rpc = h * MEIO_PE_DA_CALHA
  for (const lado of [-1, 1]) {
    const pe = caixa(xPes - rpc, lado * (mc - rpc * 1.6) - rpc, xPes + rpc, lado * (mc - rpc * 1.6) + rpc, rpc * 0.3)
    cena.sombras.push({ forma: pe, z: zPes }, contato(pe, 0.3))
    L.push(P(pe, mad, { eixo: QUARTO, tabua: 0, bisel: rpc * 0.5, tom: TOM_DO_POSTE, semente: 7300 + lado }))
  }

  // A PLATAFORMA de tábuas, tampo solto na altura dela, com a sombra afastada no chão e a grossura pintada embaixo.
  const plataforma = caixa(xP0, -mp, xP1, mp, rp * 0.4)
  cena.sombras.push({ forma: plataforma, z: H, solta: true })
  L.push(P(plataforma, mad, { dy: grossura, eixo: 0, tabua: 0, bisel: rp * 0.3, tom: TOM_DA_ESPESSURA, contorno: 0.28, semente: 7309 }))
  L.push(P(plataforma, mad, { eixo: QUARTO, tabua: h * 0.11, bisel: rp * 0.5, semente: 7310 }))

  // A CALHA, em fatias, com a sombra dela no chão (a faixa que encurta até a saída) e o contato na saída.
  const formaDaCalha = caixa(xC0, -mc, xC1, mc, mc * 0.55)
  cena.sombras.push(
    { forma: sombraDaFaixa(xC0, xC1, 0, mc, alturaDaCalha), z: 0, suave: 2.2, forca: 0.27 },
    contato(caixa(xD1, -mc, xC1, mc, mc * 0.55), 0.22),
  )
  const aco: Rgb = [calha.rgb[0] * 1.32, calha.rgb[1] * 1.32, calha.rgb[2] * 1.3]
  const texCalha = texDaCalha(mc, aco, [xP1, xD1])
  emFatias(cena, formaDaCalha, FATIAS_DA_CALHA, alturaDaCalha, (fatia) => [
    P(fatia, mad, { dy: grossura, eixo: 0, tabua: 0, bisel: mc * 0.09, tom: TOM_DA_ESPESSURA, contorno: 0.3, semente: 7319 }),
    P(fatia, mad, { eixo: 0, tabua: 0, bisel: mc * 0.09, tom: 0.92, metal: 0.3, contorno: 0.3, textura: texCalha, semente: 7320, projeta: { dist: 1.2, forca: 0.24 } }),
  ])

  // A ESCADA: os degraus primeiro (passam entre os banzos), cada um um tampo solto na altura dele; depois os banzos.
  const rd = h * RAIO_DO_DEGRAU
  const rb = h * RAIO_DO_BANZO
  for (let i = 0; i < DEGRAUS; i += 1) {
    const x = xPe + ((xP0 - xPe) * (i + 1)) / (DEGRAUS + 1)
    const degrau = capsula(x, -me + rb, x, me - rb, rd)
    cena.sombras.push({ forma: degrau, z: alturaDaEscada(x), solta: true, forca: 0.24 })
    L.push(P(degrau, mad, { eixo: QUARTO, tabua: 0, bisel: rd, tom: TOM_DO_DEGRAU, contorno: 0.3, semente: 7330 + i, projeta: { dist: 1.4, forca: 0.26 } }))
  }
  for (const lado of [-1, 1]) {
    const y = lado * me
    const banzo = capsula(xPe, y, xP0 + rp, y, rb)
    cena.sombras.push({ forma: sombraDaFaixa(xPe, xP0 + rp, y, rb, alturaDaEscada), z: 0, suave: 1.6, forca: 0.26 }, contato(elipse(xPe, y, rb * 1.3, rb * 1.3), 0.3))
    emFatias(cena, banzo, FATIAS_DO_BANZO, alturaDaEscada, (fatia) => [P(fatia, mad, { eixo: 0, tabua: 0, bisel: rb, tom: 0.94, contorno: 0.28, semente: 7340 + lado })])
  }

  // OS POSTES nos quatro cantos, do chão até o guarda-corpo, e o GUARDA-CORPO dos dois lados compridos.
  const cantos: readonly Ponto[] = [
    [xP0 + rp, -mp + rp],
    [xP1 - rp, -mp + rp],
    [xP0 + rp, mp - rp],
    [xP1 - rp, mp - rp],
  ]
  cantos.forEach(([x, y]) => {
    const poste = caixa(x - rp, y - rp, x + rp, y + rp, rp * 0.3)
    cena.sombras.push({ forma: poste, z: topoDoGuarda }, contato(poste, 0.32))
  })
  const mg = h * MEIO_GUARDA_CORPO
  for (const lado of [-1, 1]) {
    const y = lado * (mp - rp)
    const guarda = barra(xP0 + rp, y, xP1 - rp, y, mg * 2)
    cena.sombras.push({ forma: guarda, z: topoDoGuarda, solta: true, forca: 0.22 })
    L.push(P(guarda, mad, { eixo: 0, tabua: 0, bisel: mg, tom: TOM_DO_TOPO, contorno: 0.28, semente: 7350 + lado, projeta: { dist: 3.6, forca: 0.3, suave: 1.2 } }))
  }
  cantos.forEach(([x, y], i) => {
    const topo = caixa(x - rp, y - rp, x + rp, y + rp, rp * 0.3)
    L.push(P(topo, mad, { eixo: QUARTO, tabua: 0, bisel: rp * 0.6, tom: TOM_DO_POSTE, contorno: 0.3, semente: 7360 + i, projeta: { dist: 1.6, forca: 0.3 } }))
    L.push(P(elipse(x, y, rp * 0.5, rp * 0.5), mad, { tabua: 0, bisel: rp * 0.5, tom: TOM_DO_TOPO, contorno: 0.2, semente: 7365 + i }))
  })
}
