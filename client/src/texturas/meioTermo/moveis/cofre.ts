/**
 * COFRE de cima com volume (lote 6 dos objetos novos, 11/11/2026): o cofre de
 * ferro pesado, de banco ou de mercador, encostado na parede. De cima aparece
 * o TAMPO de chapa rebitada (a moldura em relevo com a fileira de rebites, o
 * campo afundado no meio e uma cantoneira em L em cada canto) e, na frente, a
 * PORTA saliente: a grossura dela, o canudo da dobradiça na ponta da direita
 * e, saindo dela, a RODA DE SEGREDO vista de cutelo (a barra de latão no fim
 * do eixo) e a ALAVANCA com a bola na ponta.
 *
 * É ferro e tem porta na frente: é o que o separa do baú, que é de madeira,
 * tem tampa em arco e cintas de través.
 *
 * NA 3/4 A FRENTE MOSTRA A PORTA: a chapa com a moldura rebitada e o campo
 * afundado, as duas dobradiças grossas (a tala em ponta e o canudo), a roda de
 * segredo de frente (o aro com as marcas, os quatro raios, o cubo e a seta em
 * cima dela), a alavanca, o espelho da fechadura, a plaqueta do fabricante e o
 * rodapé. A frente que a 3/4 varre sozinha é ferro liso; aqui a porta é
 * desenhada de frente e fica GUARDADA debaixo do tampo na vista de cima, onde
 * nada dela aparece. O que a põe no lugar é a regra de sempre da 3/4
 * (`tresQuartos.ts`): cada peça sobe a altura da estrutura que contém o meio da
 * caixa dela, e as estruturas são pintadas do fundo para a frente. As
 * estruturas daqui, além do corpo e da porta (duas colunas), são PINOS: um
 * ponto sem tamanho nem tinta, que só dá a altura a quem tem o meio da caixa
 * nele:
 * - os da FRENTE, um por peça da porta desenhada, rentes à porta (a caixa
 *   deles vai até a beira da pegada, e por isso são os últimos a ser
 *   pintados), sobem a porta desenhada um terço de px;
 * - o da RODA e o da ALAVANCA sobem o que se vê delas de cima até a altura de
 *   cada uma. Com o cofre de frente, essas peças somem atrás da porta
 *   desenhada; com ele girado, são a roda e a alavanca vistas de lado, na
 *   altura certa, e a porta desenhada some debaixo do corpo.
 * O canudo da dobradiça é parte da coluna da porta: na 3/4 ele desce até o
 * chão, como o pino de uma dobradiça inteira.
 *
 * A 25% de zoom sobram o quadrado escuro com o pontilhado dos rebites e o
 * risco de latão na frente. Materiais: `metal` (o cofre; o latão dá um cofre
 * de bronze) e `ferragens` (a roda, a alavanca, a fechadura e a plaqueta). As
 * profundidades são frações da pegada (1 x 1 casa de partida); a altura é em
 * casas, e encolhe se o mestre fizer o cofre raso demais para guardar a porta.
 */
import { limitar01, rgb, type Rgb } from '../../ruido'
import { anel, caixa, capsula, dentroDe, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { BURACO, G, type MontarMovel } from './contexto'

/** Altura do cofre em casas (a sombra; na 3/4, a frente). */
const ALTURA = 0.8
/** A porta é mais baixa que o corpo: o que sobra em cima dela é o quadro da frente (casas). */
const QUADRO_EM_CIMA_DA_PORTA = 0.07
/** A grossura da porta saliente e o que a roda e a alavanca saem dela, em frações da profundidade da pegada. */
const GROSSURA_DA_PORTA = 0.085
const SALIENCIA_DA_RODA = 0.1
/** A meia largura da porta, em fração da meia largura da pegada: o resto é o quadro dos dois lados. */
const MEIA_PORTA = 0.87
/** O que sobra de pegada na frente da roda (px do protótipo). */
const SOBRA_DA_FRENTE = 0.5
/** O desenho foi medido numa casa (56 px de lado): as medidas miúdas escalam por aqui. */
const LADO_DE_PARTIDA = G

/**
 * O escuro em que o pixel escuro demais é levantado: o cinza-escuro quente do canhão e do caldeirão. Com o
 * piso padrão (a nogueira) o lado da sombra do ferro saía marrom, como madeira.
 */
const ESCURO_DO_FERRO: Rgb = rgb('#4a4541')
/** O ferro escuro do cofre, em tons do metal escolhido: o tampo, a moldura em relevo, o campo afundado e as ferragens batidas. */
const TOM_DO_TAMPO = 0.88
const TOM_DA_MOLDURA = 1
const TOM_DO_CAMPO = 0.84
const TOM_DA_CANTONEIRA = 1.14
const TOM_DO_REBITE = 1.32
const TOM_DA_DOBRADICA = 1.2
/** O mesmo ferro visto de frente, com menos luz: a chapa da porta, o campo dela e o rodapé. */
const TOM_DA_CHAPA = 0.8
const TOM_DO_CAMPO_DA_PORTA = 0.7
const TOM_DO_RODAPE = 0.62
const TOM_DO_REBITE_DA_PORTA = 1.16

/** Abaixo desta escala (pixels da imagem por px do protótipo) o detalhe miúdo cai em menos de 2 pixels e vira chuvisco. */
const ESCALA_DO_DETALHE = 1.5

// ---------- os pinos e a frente guardada ----------

/** Meia largura do pino (px do protótipo): só o meio exato da caixa de uma peça cai nele. */
const MEIO_PINO = 0.001

/**
 * Um PINO: a estrutura da 3/4 sem tamanho nem tinta. Só o ponto (x, y) está dentro dele, então só a peça cuja
 * caixa de pintura tem o meio ali sobe com ele, e a beirada que a 3/4 daria a um tampo no ar não pinta nada.
 * `frente` = até onde a caixa do pino vai para a frente: é pela frente da caixa que a 3/4 ordena as estruturas,
 * e o que sobe com o pino é pintado depois de tudo o que acaba antes dela.
 */
function pino(x: number, y: number, frente = y + MEIO_PINO): Forma {
  return {
    b: [x - MEIO_PINO, y - MEIO_PINO, x + MEIO_PINO, frente],
    d: (px, py) => (Math.abs(px - x) <= MEIO_PINO && Math.abs(py - y) <= MEIO_PINO ? -MEIO_PINO : 1),
  }
}

/**
 * A mesma forma, descida `desce` px, com a caixa de pintura espelhada em volta de (mx, my). O desenho não muda
 * (fora da forma nada pinta); o meio da caixa, que é o que a 3/4 lê para saber em que estrutura a peça está,
 * cai no pino.
 */
function noPino(forma: Forma, mx: number, my: number, desce = 0): Forma {
  const ax = Math.max(Math.abs(forma.b[0] - mx), Math.abs(forma.b[2] - mx))
  const ay = Math.max(Math.abs(forma.b[1] + desce - my), Math.abs(forma.b[3] + desce - my))
  return { b: [mx - ax, my - ay, mx + ax, my + ay], d: (x, y) => forma.d(x, y - desce) }
}

/** A forma `f` andada (dx, dy): a sombra pintada no chão, para baixo à direita. */
function deslocada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/**
 * O deslocamento no desenho que cai em (x, y) NA TELA depois do quarto de volta que a 3/4 pinta (`giro`, em
 * graus; 0 fora dela): a sombra pintada fica onde está.
 */
function desgirada(x: number, y: number, giro: number): Ponto {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

/** Quanto a porta desenhada sobe na 3/4 (px do protótipo): o mínimo para o pino dela valer como estrutura. */
const SUBIDA_DA_FRENTE = 0.3
/**
 * Os pinos da porta desenhada: o primeiro fica este tanto na frente da porta (px do protótipo), fora da coluna
 * dela, e cada um dos seguintes um passo adiante (mais que a largura de um pino: nenhum cai em cima do outro).
 */
const RECUO_DO_PINO_DA_FRENTE = 0.25
const PASSO_DOS_PINOS_DA_FRENTE = 0.004
/** A porta desenhada acaba este tanto acima do chão (px): de cima, a beira dela não aparece debaixo da grossura da porta. */
const PE_DA_FRENTE = 0.9
/** A porta guardada fica a esta distância do fundo da pegada, no mínimo (px do protótipo). */
const FOLGA_DO_GUARDADO = 2.5

// ---------- os rebites ----------

/** O raio da cabeça do rebite e o passo da fileira, em px da casa de partida. */
const RAIO_DO_REBITE = 0.95
const PASSO_DOS_REBITES = 5.4
/** A mais que isto da fileira (px do protótipo) a forma dos rebites nem procura o mais perto: nenhuma sombra nem chanfro chega lá. */
const LONGE_DOS_REBITES = 6

/** Vários rebites numa forma só: uma cabeça redonda de raio `r` em cada ponto. */
function rebites(pontos: readonly Ponto[], r: number): Forma {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of pontos) {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  return {
    b: [x0 - r, y0 - r, x1 + r, y1 + r],
    d(x, y) {
      // Longe da fileira a distância exata não importa (a caixa de pintura da porta guardada é bem maior que ela).
      if (x < x0 - LONGE_DOS_REBITES || x > x1 + LONGE_DOS_REBITES || y < y0 - LONGE_DOS_REBITES || y > y1 + LONGE_DOS_REBITES) return LONGE_DOS_REBITES - r
      let menor = Infinity
      for (const [px, py] of pontos) {
        const dd = (x - px) * (x - px) + (y - py) * (y - py)
        if (dd < menor) menor = dd
      }
      return Math.sqrt(menor) - r
    },
  }
}

/** Os pontos da fileira de rebites em volta do retângulo: os quatro cantos e, entre eles, um a cada `passo`. */
function emVolta(x0: number, y0: number, x1: number, y1: number, passo: number): Ponto[] {
  const nx = Math.max(1, Math.round((x1 - x0) / passo))
  const ny = Math.max(1, Math.round((y1 - y0) / passo))
  const pontos: Ponto[] = []
  for (let i = 0; i <= nx; i += 1) {
    const x = x0 + ((x1 - x0) * i) / nx
    pontos.push([x, y0], [x, y1])
  }
  for (let j = 1; j < ny; j += 1) {
    const y = y0 + ((y1 - y0) * j) / ny
    pontos.push([x0, y], [x1, y])
  }
  return pontos
}

// ---------- a porta de frente ----------

/** A moldura da porta (o que sobra em volta do campo afundado) e o rodapé, em px da casa de partida. */
const MOLDURA_DA_PORTA = 3.6
const RODAPE = 3.3
/** As dobradiças: a que altura ficam (frações da altura da porta), o comprimento da tala, a meia altura dela e o canudo. */
const ALTURAS_DAS_DOBRADICAS: readonly number[] = [0.76, 0.27]
const TALA = { comprimento: 9.6, ponta: 2.6, meiaAltura: 1.8 } as const
const CANUDO = { meiaAltura: 2.8, raio: 1.9 } as const
/** A roda de segredo: onde fica (fração da meia porta e da altura dela) e o raio (o menor entre a fração da meia porta e a da altura). */
const RODA = { x: 0.1, altura: 0.53, raioPelaLargura: 0.4, raioPelaAltura: 0.26 } as const
/** A grossura do aro, o raio do cubo e o do espelho de ferro atrás dele, em px da casa de partida. */
const ARO_DA_RODA = 2
const CUBO_DA_RODA = 2.7
const ESPELHO_DA_RODA = 3.5
/** As marcas do segredo em volta do aro: quantas, e a parte de cada passo que a marca ocupa. */
const MARCAS_DO_SEGREDO = 24
const LARGURA_DA_MARCA = 0.24
/** A alavanca: onde fica o eixo dela (fração da meia porta; a altura é a da roda), para onde a haste desce e o tamanho dela (px). */
const ALAVANCA = { x: -0.6, dx: -5.2, dy: 5.6, grossura: 1.2, bola: 1.9, espelho: 2.5 } as const
/** O espelho da fechadura, acima da alavanca, e a plaqueta do fabricante, abaixo dela (px a partir do eixo da alavanca). */
const FECHADURA = { dx: -1.6, sobe: 9, rx: 1.9, ry: 2.8 } as const
const PLAQUETA = { dx: -5.6, desce: 12.2, meiaLargura: 5, meiaAltura: 1.7 } as const

/** A textura do metal do motor: as texturas próprias daqui pintam por cima dela. */
const DO_METAL = texturaDaClasse('metal')

/** A ferrugem das chapas: o tom, quanto dela entra no ferro e a partir de que valor do ruído ela aparece (as ilhas são poucas). */
const TOM_DA_FERRUGEM: Rgb = [0x7e, 0x5e, 0x4a]
const FERRUGEM_NA_CHAPA = 0.28
const LIMIAR_DA_FERRUGEM = 0.12
/** Quanto de ruído vai da beira ao miolo da ilha de ferrugem: largo, para a mancha não ter recorte duro. */
const BEIRA_DA_FERRUGEM = 0.3

/**
 * A chapa gasta: o ferro do material, umas ilhas de ferrugem (sorteadas por peça) e, de perto, os riscos claros
 * de quem arrastou coisa por cima.
 */
const texDaChapa: Textura = (u, v, x, y, p, s, escala) => {
  if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
  const mancha = ruido(x * 0.1 + p.su, y * 0.1 + p.sv) + ruido(x * 0.37 + p.sv, y * 0.37) * 0.45
  const ferrugem = limitar01((mancha - LIMIAR_DA_FERRUGEM) / BEIRA_DA_FERRUGEM) * FERRUGEM_NA_CHAPA
  s[0] += (TOM_DA_FERRUGEM[0] - s[0]) * ferrugem
  s[1] += (TOM_DA_FERRUGEM[1] - s[1]) * ferrugem
  s[2] += (TOM_DA_FERRUGEM[2] - s[2]) * ferrugem
  if (escala < ESCALA_DO_DETALHE) return
  // O risco mora onde um ruído esticado ao comprido passa por zero, e só nos trechos que outro ruído deixa.
  if (Math.abs(ruido(x * 0.045 + p.sv, y * 0.26 + p.su)) < 0.014 && ruido(x * 0.08 + p.su, y * 0.08) > 0.08) s[3] += 0.1
}

/** As marcas do segredo: riscos escuros em roda do aro, só de perto (no tamanho de mesa viravam chuvisco). */
function texDoSegredo(cx: number, cy: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    if (escala < ESCALA_DO_DETALHE) return
    const volta = (Math.atan2(y - cy, x - cx) / (Math.PI * 2)) * MARCAS_DO_SEGREDO
    if (volta - Math.floor(volta) < LARGURA_DA_MARCA) s[3] -= 0.26
  }
}

/** A plaqueta do fabricante: de perto, duas linhas gravadas (o nome que ninguém lê). */
function texDaPlaqueta(cy: number, meiaAltura: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    if (escala < ESCALA_DO_DETALHE) return
    const linha = Math.abs(Math.abs(y - cy) - meiaAltura * 0.36)
    if (linha < 0.22) s[3] -= 0.2
  }
}

/** Põe uma peça na porta: a forma em coordenadas de frente (x como na pegada, y = 0 no chão e negativo para cima). */
type PorNaFrente = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca) => void

/** O que o desenho da porta devolve: onde ficam a roda e a alavanca, para o que se vê delas de cima. */
interface Ferragens {
  /** O eixo da roda (x) e o raio dela. */
  readonly xDaRoda: number
  readonly raioDaRoda: number
  /** O eixo da alavanca (x) e a altura comum dos dois eixos (px a partir do chão). */
  readonly xDaAlavanca: number
  readonly alturaDosEixos: number
}

/**
 * A porta inteira, de frente: a chapa, o campo afundado, o rodapé, os rebites da moldura, as duas dobradiças, a
 * roda de segredo, a alavanca, a fechadura e a plaqueta.
 */
function desenharPorta(por: PorNaFrente, pw: number, Hd: number, k: number, ferro: MaterialDaPeca, latao: MaterialDaPeca): Ferragens {
  const moldura = MOLDURA_DA_PORTA * k
  const rodape = RODAPE * k
  por(caixa(-pw, -Hd, pw, -PE_DA_FRENTE, 0.8 * k), ferro, { bisel: 1.2 * k, tom: TOM_DA_CHAPA, contorno: 0.3, metal: 0.2, textura: texDaChapa, semente: 4310 })
  por(caixa(-pw + moldura, -Hd + moldura, pw - moldura, -rodape - moldura, 0.6 * k), ferro, { bisel: 0.3 * k, tom: TOM_DO_CAMPO_DA_PORTA, contorno: 0.1, metal: 0.16, recesso: { k: 1.7 * k, forca: 0.36 }, textura: texDaChapa, semente: 4311 })
  por(caixa(-pw + 0.3, -rodape, pw - 0.3, -PE_DA_FRENTE, 0.4 * k), ferro, { bisel: 0.6 * k, tom: TOM_DO_RODAPE, contorno: 0.2, metal: 0.1, semente: 4312 })
  const raioDoRebite = RAIO_DO_REBITE * k
  const daMoldura = emVolta(-pw + moldura / 2, -Hd + moldura / 2, pw - moldura / 2, -rodape - moldura / 2, PASSO_DOS_REBITES * k)
  por(rebites(daMoldura, raioDoRebite), ferro, { bisel: raioDoRebite, tom: TOM_DO_REBITE_DA_PORTA, contorno: 0.16, metal: 0.5, semente: 4313, projeta: { dist: 0.5 * k, forca: 0.26, suave: 0.5 * k } })

  // As dobradiças grossas: a tala em ponta aparafusada na chapa e o canudo na beira da porta.
  for (const [i, fracao] of ALTURAS_DAS_DOBRADICAS.entries()) {
    const y = -Hd * fracao
    const meia = TALA.meiaAltura * k
    const fim = pw - TALA.comprimento * k
    const tala = poligono([[pw, y - meia], [fim + TALA.ponta * k, y - meia], [fim, y], [fim + TALA.ponta * k, y + meia], [pw, y + meia]])
    por(tala, ferro, { bisel: 0.6 * k, tom: TOM_DA_DOBRADICA * 0.92, contorno: 0.26, metal: 0.3, semente: 4320 + i, projeta: { dist: 0.7 * k, forca: 0.3, suave: 0.6 * k } })
    por(rebites([[pw - 2.6 * k, y], [pw - 5.6 * k, y]], raioDoRebite * 0.85), ferro, { bisel: raioDoRebite * 0.85, tom: TOM_DO_REBITE, contorno: 0.14, metal: 0.5, semente: 4322 + i })
    por(capsula(pw + 0.2 * k, y - CANUDO.meiaAltura * k, pw + 0.2 * k, y + CANUDO.meiaAltura * k, CANUDO.raio * k), ferro, { bisel: CANUDO.raio * k * 0.9, tom: TOM_DA_DOBRADICA, contorno: 0.3, metal: 0.5, semente: 4324 + i, projeta: { dist: 0.8 * k, forca: 0.3 } })
  }

  // A roda de segredo: o espelho de ferro, o aro com as marcas, os quatro raios em X, o cubo e a seta em cima dela.
  const alturaDosEixos = Hd * RODA.altura
  const xr = pw * RODA.x
  const yr = -alturaDosEixos
  const raio = Math.min(pw * RODA.raioPelaLargura, Hd * RODA.raioPelaAltura)
  por(elipse(xr, yr, ESPELHO_DA_RODA * k, ESPELHO_DA_RODA * k), ferro, { bisel: 1 * k, tom: 1.04, contorno: 0.24, metal: 0.3, semente: 4330 })
  const raioDoRaio = 0.95 * k
  for (let i = 0; i < 4; i += 1) {
    const rumo = Math.PI / 4 + (i * Math.PI) / 2
    const co = Math.cos(rumo)
    const si = Math.sin(rumo)
    por(capsula(xr + co * CUBO_DA_RODA * k * 0.6, yr + si * CUBO_DA_RODA * k * 0.6, xr + co * (raio - ARO_DA_RODA * k * 0.5), yr + si * (raio - ARO_DA_RODA * k * 0.5), raioDoRaio), latao, { eixo: rumo, bisel: raioDoRaio * 0.9, tom: 0.94, contorno: 0.26, semente: 4331 + i, projeta: { dist: 1.5 * k, forca: 0.34, suave: 0.8 * k } })
  }
  por(anel(xr, yr, raio, raio, raio - ARO_DA_RODA * k, raio - ARO_DA_RODA * k), latao, { bisel: ARO_DA_RODA * k * 0.5, contorno: 0.3, metal: 0.5, textura: texDoSegredo(xr, yr), semente: 4335, projeta: { dist: 1.7 * k, forca: 0.38, suave: 0.9 * k } })
  por(elipse(xr, yr, CUBO_DA_RODA * k, CUBO_DA_RODA * k), latao, { bisel: CUBO_DA_RODA * k * 0.7, tom: 1.06, contorno: 0.28, metal: 0.6, semente: 4336, projeta: { dist: 1 * k, forca: 0.3 } })
  por(elipse(xr, yr, 1 * k, 1 * k), ferro, { bisel: 0.6 * k, tom: 0.9, contorno: 0.2, metal: 0.4, semente: 4337 })
  const seta = yr - raio - 1 * k
  por(poligono([[xr - 1.6 * k, seta - 2.3 * k], [xr + 1.6 * k, seta - 2.3 * k], [xr, seta]]), latao, { bisel: 0.5 * k, contorno: 0.24, semente: 4338 })

  // A alavanca: o espelho de ferro, a haste que desce para o lado de fora e a bola na ponta.
  const xa = pw * ALAVANCA.x
  const ya = -alturaDosEixos
  por(elipse(xa, ya, ALAVANCA.espelho * k, ALAVANCA.espelho * k), ferro, { bisel: 1.1 * k, tom: 1.04, contorno: 0.24, metal: 0.3, semente: 4340 })
  const [bx, by] = [xa + ALAVANCA.dx * k, ya + ALAVANCA.dy * k]
  por(capsula(xa, ya, bx, by, ALAVANCA.grossura * k), latao, { eixo: Math.atan2(ALAVANCA.dy, ALAVANCA.dx), bisel: ALAVANCA.grossura * k * 0.9, contorno: 0.28, metal: 0.5, semente: 4341, projeta: { dist: 1.5 * k, forca: 0.36, suave: 0.8 * k } })
  por(elipse(bx, by, ALAVANCA.bola * k, ALAVANCA.bola * k), latao, { bisel: ALAVANCA.bola * k * 0.9, tom: 1.05, contorno: 0.3, metal: 0.6, semente: 4342, projeta: { dist: 1.6 * k, forca: 0.36, suave: 0.8 * k } })
  por(elipse(xa, ya, 1.4 * k, 1.4 * k), latao, { bisel: 1.1 * k, tom: 1.04, contorno: 0.26, metal: 0.6, semente: 4343 })

  // O espelho da fechadura, com o buraco da chave, e a plaqueta do fabricante.
  const [fx, fy] = [xa + FECHADURA.dx * k, ya - FECHADURA.sobe * k]
  por(elipse(fx, fy, FECHADURA.rx * k, FECHADURA.ry * k), latao, { bisel: 0.7 * k, tom: 0.92, contorno: 0.24, semente: 4344 })
  // O buraco da chave: a roda em cima e a fenda que desce dela.
  por(uniao(elipse(fx, fy - 0.8 * k, 0.68 * k, 0.68 * k), caixa(fx - 0.32 * k, fy - 0.6 * k, fx + 0.32 * k, fy + 1.5 * k, 0.15 * k)), BURACO, { bisel: 0, contorno: 0 })
  const [px, py] = [xa + PLAQUETA.dx * k + PLAQUETA.meiaLargura * k, ya + PLAQUETA.desce * k]
  por(caixa(px - PLAQUETA.meiaLargura * k, py - PLAQUETA.meiaAltura * k, px + PLAQUETA.meiaLargura * k, py + PLAQUETA.meiaAltura * k, 0.5 * k), latao, { bisel: 0.5 * k, tom: 0.9, contorno: 0.24, metal: 0.3, textura: texDaPlaqueta(py, PLAQUETA.meiaAltura * k), semente: 4345 })
  return { xDaRoda: xr, raioDaRoda: raio, xDaAlavanca: xa, alturaDosEixos }
}

// ---------- o tampo ----------

/** A moldura em relevo do tampo: de onde a onde vai, a partir da beira (px da casa de partida). */
const MOLDURA_DE = 2.4
const MOLDURA_ATE = 6.6
/** A cantoneira em L: o braço (fração do menor lado do tampo) e a largura dela (px da casa de partida). */
const BRACO_DA_CANTONEIRA = 0.2
const LARGURA_DA_CANTONEIRA = 3.6
/** A fileira de rebites da grossura da porta começa e acaba a esta distância das pontas dela (px da casa de partida). */
const FOLGA_DOS_REBITES_DA_FOLHA = 3.4
/** O canudo da dobradiça visto de cima e a grossura da roda vista de cutelo (px da casa de partida). */
const CANUDO_DE_CIMA = 2.2
const GROSSURA_DA_RODA = 2.3

export const montarCofre: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const ferro = c.m.metal
  const latao = c.m.ferragens
  const k = Math.min(w, h) / LADO_DE_PARTIDA
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO

  // De trás para a frente: o corpo, a porta saliente e o que sai dela (a roda e a alavanca).
  const yFrente = hh - SOBRA_DA_FRENTE
  const yPorta = yFrente - SALIENCIA_DA_RODA * h
  const yCorpo = yPorta - GROSSURA_DA_PORTA * h
  const pw = MEIA_PORTA * hw
  // A porta desenhada tem de caber debaixo do tampo: o cofre mais raso que a altura dele fica mais baixo.
  const quadro = g * QUADRO_EM_CIMA_DA_PORTA
  const H = Math.min(g * ALTURA, yPorta + hh - FOLGA_DO_GUARDADO + quadro)
  const Hd = H - quadro

  // A porta, guardada debaixo do tampo. Cada peça dela tem o seu pino, rente à frente da porta (fora das duas
  // colunas) e debaixo do meio da peça: a caixa de pintura só é espelhada de cima a baixo, e não fica do tamanho
  // da porta inteira. A caixa de cada pino vai até a beira da pegada: são as últimas estruturas que a 3/4
  // pinta, e, por acabarem todas na mesma linha, saem na ordem em que foram criadas (a das peças).
  const desce = yPorta + SUBIDA_DA_FRENTE
  let guardadas = 0
  const guardar: PorNaFrente = (forma, mat, o) => {
    const px = (forma.b[0] + forma.b[2]) / 2
    const py = yPorta + RECUO_DO_PINO_DA_FRENTE + guardadas * PASSO_DOS_PINOS_DA_FRENTE
    guardadas += 1
    cena.sombras.push({ forma: pino(px, py, hh), z: SUBIDA_DA_FRENTE, solta: true, forca: 0 })
    // A textura própria lê o ponto em coordenadas de frente, como a forma.
    const textura = o.textura
    L.push(P(noPino(forma, px, py, desce), mat, textura === undefined ? o : { ...o, textura: (u, v, x, y, p, s, escala) => textura(u, v, x, y - desce, p, s, escala) }))
  }
  const ferragens = desenharPorta(guardar, pw, Hd, k, ferro, latao)

  // As duas colunas: o corpo e a porta, com o canudo da dobradiça na ponta dela.
  const corpo = caixa(-hw, -hh, hw, yCorpo, 1.3 * k)
  const xCanudo = pw + 0.2 * k
  const yCanudo = (yCorpo + yPorta) / 2 + 0.3 * k
  const canudo = elipse(xCanudo, yCanudo, CANUDO_DE_CIMA * k, CANUDO_DE_CIMA * k)
  const folha = caixa(-pw, yCorpo - 0.5, pw, yPorta, 0.7 * k)
  cena.sombras.push(
    { forma: corpo, z: H },
    { forma: uniao(caixa(-pw, yCorpo, pw, yPorta, 0.7 * k), canudo), z: Hd },
    contato(caixa(-hw, -hh, hw, yPorta, 1.3 * k)),
  )

  // O tampo de chapa rebitada: a beira, a moldura em relevo, o campo afundado, a fileira de rebites e as cantoneiras.
  L.push(P(corpo, ferro, { bisel: 1.6 * k, tom: TOM_DO_TAMPO, contorno: 0.3, metal: 0.22, textura: texDaChapa, semente: 4300 }))
  const de = MOLDURA_DE * k
  const ate = MOLDURA_ATE * k
  L.push(P(caixa(-hw + de, -hh + de, hw - de, yCorpo - de, 0.9 * k), ferro, { bisel: 0.8 * k, tom: TOM_DA_MOLDURA, contorno: 0.2, metal: 0.26, textura: texDaChapa, semente: 4301 }))
  L.push(P(caixa(-hw + ate, -hh + ate, hw - ate, yCorpo - ate, 0.6 * k), ferro, { bisel: 0.3 * k, tom: TOM_DO_CAMPO, contorno: 0.1, metal: 0.2, recesso: { k: 1.5 * k, forca: 0.32 }, textura: texDaChapa, semente: 4302 }))
  const meio = (de + ate) / 2
  const raioDoRebite = RAIO_DO_REBITE * k
  const cabeca: OpcoesDaPeca = { bisel: raioDoRebite, tom: TOM_DO_REBITE, contorno: 0.16, metal: 0.5, projeta: { dist: 0.6 * k, forca: 0.3, suave: 0.5 * k } }
  L.push(P(rebites(emVolta(-hw + meio, -hh + meio, hw - meio, yCorpo - meio, PASSO_DOS_REBITES * k), raioDoRebite), ferro, { ...cabeca, semente: 4303 }))
  const braco = BRACO_DA_CANTONEIRA * Math.min(w, yCorpo + hh)
  const larg = LARGURA_DA_CANTONEIRA * k
  const dasCantoneiras: Ponto[] = []
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const xa = sx * hw
    const ya = sy < 0 ? -hh : yCorpo
    const cantoneira = poligono([[xa, ya], [xa - sx * braco, ya], [xa - sx * braco, ya - sy * larg], [xa - sx * larg, ya - sy * larg], [xa - sx * larg, ya - sy * braco], [xa, ya - sy * braco]])
    L.push(P(dentroDe(cantoneira, corpo), ferro, { bisel: 0.7 * k, tom: TOM_DA_CANTONEIRA, contorno: 0.26, metal: 0.3, semente: 4304, projeta: { dist: 0.7 * k, forca: 0.28, suave: 0.6 * k } }))
    const m = larg / 2
    dasCantoneiras.push([xa - sx * m, ya - sy * m], [xa - sx * (braco - m), ya - sy * m], [xa - sx * m, ya - sy * (braco - m)])
  }
  L.push(P(rebites(dasCantoneiras, raioDoRebite), ferro, { ...cabeca, semente: 4305 }))

  // A grossura da porta saliente, com a fileira de rebites dela, e o canudo da dobradiça, com a cabeça do pino dele.
  L.push(P(folha, ferro, { bisel: 1.1 * k, tom: TOM_DA_MOLDURA, contorno: 0.3, metal: 0.3, textura: texDaChapa, semente: 4306, projeta: { dist: 1 * k, forca: 0.3 } }))
  const yDaFolha = (yCorpo + yPorta) / 2
  const naFolha = Math.max(1, Math.round((2 * pw - 2 * FOLGA_DOS_REBITES_DA_FOLHA * k) / (PASSO_DOS_REBITES * k)))
  const daFolha: Ponto[] = []
  for (let i = 0; i <= naFolha; i += 1) daFolha.push([-pw + FOLGA_DOS_REBITES_DA_FOLHA * k + ((2 * pw - 2 * FOLGA_DOS_REBITES_DA_FOLHA * k) * i) / naFolha, yDaFolha])
  L.push(P(rebites(daFolha, raioDoRebite * 0.85), ferro, { ...cabeca, bisel: raioDoRebite * 0.85, semente: 4309 }))
  L.push(P(canudo, ferro, { bisel: CANUDO_DE_CIMA * k * 0.9, tom: TOM_DA_DOBRADICA, contorno: 0.3, metal: 0.5, semente: 4307, projeta: { dist: 0.8 * k, forca: 0.3 } }))
  L.push(P(elipse(xCanudo, yCanudo, 0.9 * k, 0.9 * k), latao, { bisel: 0.8 * k, contorno: 0.2, metal: 0.5, semente: 4308 }))

  // A roda de segredo vista de cutelo: o eixo que sai da porta e a barra do aro. O pino dela a sobe até a altura
  // do eixo: de frente some atrás da porta desenhada; com o cofre girado, é a roda vista de lado.
  const { xDaRoda, raioDaRoda, xDaAlavanca, alturaDosEixos } = ferragens
  const grossura = Math.min(GROSSURA_DA_RODA * k, (yFrente - yPorta) * 0.5)
  const yDaRoda = yFrente - grossura / 2
  const deCutelo: Peca[] = []
  const naRoda = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    deCutelo.push(P(noPino(forma, xDaRoda, yDaRoda), mat, o))
  }
  naRoda(caixa(xDaRoda - 1.5 * k, yPorta - 0.4, xDaRoda + 1.5 * k, yFrente - grossura + 0.5, 0.4 * k), ferro, { bisel: 0.8 * k, tom: 1.04, contorno: 0.26, metal: 0.3, semente: 4350 })
  const barra = caixa(xDaRoda - raioDaRoda, yFrente - grossura, xDaRoda + raioDaRoda, yFrente, grossura / 2)
  naRoda(barra, latao, { bisel: (grossura / 2) * 0.9, contorno: 0.3, metal: 0.5, semente: 4351, projeta: { dist: 0.8 * k, forca: 0.3 } })
  naRoda(elipse(xDaRoda, yDaRoda, CUBO_DA_RODA * k * 0.8, grossura * 0.62), latao, { bisel: grossura * 0.5, tom: 1.06, contorno: 0.26, metal: 0.6, semente: 4352 })

  // A alavanca vista de cima: o eixo, a haste deitada e a bola na ponta. O pino dela a sobe até a altura do eixo.
  const yDaHaste = yPorta + (yFrente - yPorta) * 0.42
  const xDaBola = xDaAlavanca + ALAVANCA.dx * k
  const [ax, ay] = [(xDaAlavanca + xDaBola) / 2, yDaHaste]
  const naAlavanca = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    deCutelo.push(P(noPino(forma, ax, ay), mat, o))
  }
  naAlavanca(caixa(xDaAlavanca - 1.3 * k, yPorta - 0.4, xDaAlavanca + 1.3 * k, yDaHaste + 0.4 * k, 0.5 * k), ferro, { bisel: 0.8 * k, tom: 1.04, contorno: 0.26, metal: 0.3, semente: 4353 })
  const haste = capsula(xDaAlavanca, yDaHaste, xDaBola, yDaHaste, ALAVANCA.grossura * k)
  naAlavanca(haste, latao, { bisel: ALAVANCA.grossura * k * 0.9, contorno: 0.28, metal: 0.5, semente: 4354, projeta: { dist: 0.7 * k, forca: 0.3 } })
  const raioDaBola = Math.min(ALAVANCA.bola * k, (yFrente - yDaHaste) * 0.95)
  naAlavanca(elipse(xDaBola, yDaHaste, raioDaBola, raioDaBola), latao, { bisel: raioDaBola * 0.9, tom: 1.05, contorno: 0.3, metal: 0.6, semente: 4355 })
  L.push(...deCutelo)

  // Os pinos da roda e da alavanca, e a sombra pintada das duas no chão, para baixo à direita NA TELA.
  const [ox, oy] = desgirada(SOMBRA_X * (yFrente - yPorta), SOMBRA_Y * (yFrente - yPorta), c.giro)
  cena.sombras.push(
    { forma: pino(xDaRoda, yDaRoda), z: alturaDosEixos, solta: true, forca: 0 },
    { forma: pino(ax, ay), z: alturaDosEixos, solta: true, forca: 0 },
    { forma: deslocada(uniao(barra, haste), ox, oy), z: 0, suave: 1.4 * k, forca: 0.2 },
  )
}
