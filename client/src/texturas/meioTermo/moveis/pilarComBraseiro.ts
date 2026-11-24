/**
 * PILAR COM BRASEIRO de cima com volume (lote L04 de 24/11/2026, a Fortaleza
 * do ritual; versão do pilar). O pilar de salão de fortaleza que carrega o
 * fogo: o PLINTO quadrado, o FUSTE de pedra de quinas chanfradas (oito faces),
 * o CAPITEL em dois degraus e, assentada nele, a BACIA de ferro batido cheia
 * de carvão em brasa. Ilumina (a luz é do integrador, `LUZ_DOS_OBJETOS`).
 *
 * De cima aparecem a moldura do plinto, o tampo do capitel escuro de fuligem
 * e a bacia redonda com o miolo quente. É a roda de fogo dentro do quadrado
 * de pedra, com a sombra comprida, que diz "pilar com braseiro" e não "pilar"
 * (a roda de gomos, sem fogo) nem "braseiro" (o anel de ferro em três pés).
 *
 * ACESO (variante 0) e APAGADO (variante 1), como o braseiro: a imagem parada
 * só tem o fogo parado (o leito em brasa, o carvão, o halo e três línguas de
 * chama curtas) ou o carvão frio e a cinza.
 * `PILAR_COM_BRASEIRO` é a disposição que a chama animada leria, se o
 * integrador a ligar (o formato da `BRASEIRO` de `lib/mobilia/fogoDeCasa.ts`).
 *
 * NA 3/4 o pilar sobe pelo que `tresQuartos.ts` faz com as sombras (cada
 * sombra com altura é uma estrutura; as estruturas saem do norte para o sul
 * pela base da caixa; cada peça sobe com a mais alta que contém o meio dela):
 * - o PLINTO vai em duas metades, a do norte e a do sul NA TELA, com o pé do
 *   fuste recortado: a do norte fica atrás do fuste e a do sul na frente. O
 *   tampo dele vai em seis tiras, o meio de cada uma na metade certa;
 * - o FUSTE são três colunas, a face da frente e as duas quinas chanfradas,
 *   cada uma com o seu tom (a da esquerda pega luz, a da direita fica na
 *   sombra): o fuste lê de oito faces, e não chapado. Elas têm a altura do
 *   ábaco: empatada com ele, a peça do topo de cada coluna fica com a coluna
 *   (a estrutura mais justa), e a frente sai no tom dela;
 * - o CAPITEL são dois tampos soltos, o colarinho e o ábaco, cada um com a
 *   beirada `ESPESSURA_DO_ABACO_DO_PILAR_COM_BRASEIRO` (o perfil da 3/4 usa).
 *   O meio da caixa das peças do tampo fica na aba, fora do fuste: senão
 *   seriam peças da coluna do meio, e a beirada do ábaco as cobriria;
 * - a BACIA sobe em dois pinos, como a do braseiro: o do bojo, um pouco mais
 *   baixo, e o da boca, com a borda, o carvão e o fogo.
 * O desenho é montado JÁ NA TELA (`montadaNaTela`): o pilar é igual dos quatro
 * lados, e as metades do norte e do sul continuam certas com ele girado.
 *
 * REVISÃO DO DIRETOR DE ARTE (24/11/2026):
 * - o FOGO: o disco laranja chapado, com 34 torrões escuros, lia como pizza.
 *   Agora o leito é um degradê de calor (o miolo amarelo-palha no meio, o
 *   laranja em volta e o vermelho-escuro na beira, junto do aro), com cinco
 *   pedaços GRANDES de carvão de contorno irregular em volta do miolo e três
 *   línguas de chama curtas e opacas, todas pendendo para o mesmo lado;
 * - a PEDRA: o salpico do granito cai à metade nos tampos e some nas frentes
 *   que a 3/4 varre (o material das peças de pedra é liso; o grão vem da
 *   textura de cada tampo), e é sempre o tom escuro da própria pedra;
 * - o FUSTE na 3/4: a face clara e a escura ficam a uns 20% de luz uma da
 *   outra, sem o tom sorteado por peça que as igualava.
 *
 * As medidas redondas saem do menor lado da pegada; o plinto acompanha a
 * pegada. Materiais: `pedra` (o pilar) e `metal` (a bacia). O carvão, a cinza
 * e o fogo são fixos.
 */
import { hash, limitar01, luz, misturar, type Rgb } from '../../ruido'
import { anel, caixa, dentroDe, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { bordaDaSombra, contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { CINZA, G, type MontarMovel } from './contexto'
import { comMeioEm, deslocada, emOrdem, montadaNaTela, pino, solta, texturaComSombra } from './andaimeDaTresQuartos'
import { FOGO_PARADO, texCinza, texHalo } from './fogoDeCasa'
import { BRASA_QUENTE } from './fogueira'

/** Alturas em casas: o plinto, o alto do ábaco (o tampo do capitel) e a borda da bacia. */
const ALTURA_DO_PLINTO = 0.12
const ALTURA_DO_CAPITEL = 1.36
const ALTURA_DA_BORDA = 1.6
/** A espessura de cada degrau do capitel (casas e px do protótipo): a beirada dos tampos soltos. O perfil da 3/4 usa o valor em px. */
const ABACO_EM_CASAS = 0.14
export const ESPESSURA_DO_ABACO_DO_PILAR_COM_BRASEIRO = ABACO_EM_CASAS * G
/**
 * Onde a chama animada nasceria, no formato da `BRASEIRO` de `lib/mobilia/fogoDeCasa.ts`: o meio do carvão em
 * fração da pegada e a altura da borda da bacia em fração do menor lado (o pilar de partida tem 1 casa).
 */
export const PILAR_COM_BRASEIRO = { fogo: { x: 0, y: 0 }, alturaDaBorda: ALTURA_DA_BORDA } as const

/** O meio lado do plinto (fração da meia pegada) e, em fração do menor meio lado, o do fuste, do colarinho e do ábaco. */
const PLINTO = 0.97
const FUSTE = 0.58
const COLARINHO = 0.7
const ABACO = 0.83
/** O chanfro das quinas: do fuste (fração do meio lado dele) e do ábaco (fração do menor meio lado). */
const CHANFRO_DO_FUSTE = 0.34
const CHANFRO_DO_ABACO = 0.12
/**
 * O tom de cada coluna do fuste na frente: a quina que pega luz, a face e a quina na sombra. A clara e a escura
 * ficam a 20% de luz uma da outra (0,89 / 1,11), e a frente é lisa: com a textura da pedra, o tom sorteado por peça
 * (até 6% para cada lado) igualava as três faces num pilar e exagerava noutro.
 */
const TONS_DO_FUSTE: readonly [number, number, number] = [0.11, 0, -0.11]
/** Quanto do salpico do granito fica nos tampos do pilar: a metade (inteiro, lia como sujeira). */
const SALPICO_DA_PEDRA = 0.5

/** A bacia, em fração do menor meio lado: a borda por fora e por dentro, a roda dos rebites, o carvão e o bojo. */
const BORDA_DE_FORA = 0.56
const BORDA_DE_DENTRO = 0.445
const RAIO_DOS_REBITES = 0.503
const REBITES = 10
const RAIO_DO_REBITE = 0.75
const RAIO_DO_CARVAO = 0.47
const RAIO_DO_BOJO = 0.53
/** Quanto o bojo fica abaixo da borda na 3/4 (fração do menor meio lado): a barriga da bacia aparece redonda debaixo dela. */
const DESCIDA_DO_BOJO = 0.2
/** O ferro velho da bacia: os tons e o brilho (o metal novo é 0,42). */
const TOM_DO_BOJO = 0.72
const TOM_DA_BORDA = 1
const TOM_DO_REBITE = 1.32
const BRILHO_DO_FERRO = 0.3
const FULIGEM_NA_BORDA = 0.3

/**
 * Os pedaços de carvão: o meio (fração do menor meio lado), o raio e o quanto cada um é comprido. São poucos e
 * grandes, de contorno irregular, e ficam em volta do miolo do leito, que aparece entre eles.
 */
const PEDACOS_DE_CARVAO: readonly (readonly [number, number, number, number])[] = [
  [-0.24, -0.13, 0.165, 1.25],
  [0.2, -0.23, 0.13, 1.1],
  [0.27, 0.1, 0.155, 1.3],
  [-0.05, 0.28, 0.14, 1.2],
  [-0.31, 0.17, 0.105, 1.15],
]
const LADOS_DO_PEDACO = 7
const CARVAO: MaterialDaPeca = { classe: 'liso', rgb: [0x42, 0x3d, 0x39] }
/** Aceso, a beira de cada pedaço virada para o miolo está em brasa: quanto ela sobra do carvão e para onde (px). */
const BEIRA_EM_BRASA = 0.9
const PUXADA_PARA_O_MIOLO = 0.7
/**
 * O degradê de calor do leito: o amarelo-palha do miolo, o laranja e o vermelho-escuro da beira, junto do aro.
 * `LARANJA_EM` é onde o laranja fica entre a beira (0) e o miolo (1); o ruído entorta as faixas, para o leito não
 * sair em alvo de roda.
 */
const PALHA: Rgb = [0xf2, 0xc4, 0x6a]
const LARANJA: Rgb = [0xd8, 0x76, 0x34]
const VERMELHO_ESCURO: Rgb = [0x7a, 0x2a, 0x18]
const LARANJA_EM = 0.42
const VERMELHO_ATE = 0.08
const PALHA_EM = 0.85
const RUIDO_DO_CALOR = 0.18
const EMISSAO_DO_LEITO = 0.9
/**
 * As línguas de chama: a base (fração do menor meio lado), o comprimento e a meia largura na base. Curtas e opacas;
 * sobem na tela e pendem todas para a direita (`RUMO_DA_CHAMA`), com a ponta dobrando um pouco mais (`DOBRA`).
 */
const LINGUAS: readonly (readonly [number, number, number, number])[] = [
  [-0.15, 0.07, 0.4, 0.085],
  [0.04, -0.03, 0.5, 0.1],
  [0.17, 0.15, 0.33, 0.075],
]
const RUMO_DA_CHAMA: Ponto = [0.34, -0.94]
const DOBRA_DA_CHAMA = 0.18
const ONDA_DA_CHAMA = 0.45
const PASSOS_DA_LINGUA = 6
const COR_DA_CHAMA: Rgb = [0xe6, 0x8a, 0x36]
const MIOLO_DA_CHAMA: Rgb = [0xf8, 0xdc, 0x8e]
/** O fogo parado: o halo no carvão, o brilho na beira de dentro da borda e o clarão no tampo do capitel. */
const ALFA_DO_HALO = 0.16
const ALFA_DO_BRILHO_NA_BORDA = 0.18
const RAIO_DO_CLARAO = 0.8
const ALFA_DO_CLARAO = 0.16
/** A fuligem no tampo do capitel, em volta da bacia: até onde vai (fração do menor meio lado) e a força. */
const FULIGEM_ATE = 0.8
const FORCA_DA_FULIGEM = 0.3
/** Apagado, a cinza fria por cima do carvão (x, y e raio em fração do menor meio lado). */
const MANCHAS_DE_CINZA: readonly (readonly [number, number, number])[] = [
  [-0.13, -0.09, 0.12],
  [0.04, -0.2, 0.07],
  [0.16, 0.08, 0.09],
  [-0.05, 0.16, 0.06],
]
const ALFA_DA_CINZA = 0.7

/** As sombras: a força da do capitel e a da bacia no chão, e a que o fuste e a bacia pintam nos tampos. */
const FORCA_DA_SOMBRA_DO_CAPITEL = 0.24
const FORCA_DA_SOMBRA_DA_BACIA = 0.2
const BORDA_DA_SOMBRA_DO_FUSTE = 1.6
const SOMBRA_PINTADA = { borda: 1.3, forca: 0.28 } as const
/** O escuro em que o pixel escuro demais é levantado: o cinza quente da pedra (com o da nogueira a beira saía marrom). */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]
/** Mais longe que qualquer peça: as metades e as tiras são caixas até aqui. */
const LONGE = 4096

const DA_PEDRA = texturaDaClasse('pedra')
const DO_METAL = texturaDaClasse('metal')

/** A pedra dos tampos: a do material, com o salpico do granito à metade (multiplicado na cor: o tom escuro dela, nunca preto). */
const DA_PEDRA_MANSA: Textura = (u, v, x, y, p, s, escala) => {
  if (DA_PEDRA !== null) DA_PEDRA(u, v, x, y, p, s, escala)
  s[6] *= SALPICO_DA_PEDRA
}

/** O quadrado de meio lado (mx, my) com as quinas chanfradas `c` px. */
function quadradoChanfrado(mx: number, my: number, c: number): Forma {
  const pontos: Ponto[] = [[-mx + c, -my], [mx - c, -my], [mx, -my + c], [mx, my - c], [mx - c, my], [-mx + c, my], [-mx, my - c], [-mx, -my + c]]
  return poligono(pontos)
}

/** A forma pintada só dentro da caixa, SEM borda no corte (o chanfro e o contorno continuam os da forma inteira). */
function recortada(f: Forma, x0: number, y0: number, x1: number, y1: number): Forma {
  return { b: [Math.max(f.b[0], x0), Math.max(f.b[1], y0), Math.min(f.b[2], x1), Math.min(f.b[3], y1)], d: (x, y) => f.d(x, y) }
}

/** Os rebites numa forma só: uma cabeça redonda de raio `r` em cada ponto. */
function rebites(pontos: readonly Ponto[], r: number): Forma {
  const xs = pontos.map(([x]) => x)
  const ys = pontos.map(([, y]) => y)
  return {
    b: [Math.min(...xs) - r, Math.min(...ys) - r, Math.max(...xs) + r, Math.max(...ys) + r],
    d(x, y) {
      let menor = Infinity
      for (const [px, py] of pontos) {
        const dd = (x - px) * (x - px) + (y - py) * (y - py)
        if (dd < menor) menor = dd
      }
      return Math.sqrt(menor) - r
    },
  }
}

/**
 * Um pedaço de carvão: um polígono de pontas de raio sorteado em volta de `r` (de 0,6 a 1,25 vez), `comprido`
 * vezes mais longo num rumo sorteado. Nada de roda: cada um tem a sua quina.
 */
function pedacoDeCarvao(cx: number, cy: number, r: number, comprido: number, semente: number): Forma {
  const giro = hash(semente, 1, 3209) * Math.PI * 2
  const [co, si] = [Math.cos(giro), Math.sin(giro)]
  const pontos: Ponto[] = []
  for (let i = 0; i < LADOS_DO_PEDACO; i += 1) {
    const a = ((i + (hash(semente, i + 9, 3209) - 0.5) * 0.5) / LADOS_DO_PEDACO) * Math.PI * 2
    const raio = r * (0.6 + 0.65 * hash(semente, i + 2, 3209))
    const [lx, ly] = [Math.cos(a) * raio * comprido, (Math.sin(a) * raio) / Math.sqrt(comprido)]
    pontos.push([cx + lx * co - ly * si, cy + lx * si + ly * co])
  }
  return poligono(pontos)
}

/** A forma engordada `r` px e deslocada (dx, dy): a beira em brasa que sobra de um pedaço de carvão, e o canto arredondado da chama. */
function engordada(f: Forma, r: number, dx = 0, dy = 0): Forma {
  return { b: [f.b[0] - r + dx, f.b[1] - r + dy, f.b[2] + r + dx, f.b[3] + r + dy], d: (x, y) => f.d(x - dx, y - dy) - r }
}

/**
 * Uma língua de chama: da base (bx, by), `comprimento` px no rumo da chama, com a meia largura `meia` na base e
 * afinando até a ponta, que dobra um pouco mais para o lado. `fina` (0 ou 1) é o miolo claro: mais curto e estreito.
 */
function lingua(bx: number, by: number, comprimento: number, meia: number, fina: number): Forma {
  const [rx, ry] = RUMO_DA_CHAMA
  const [px, py] = [-ry, rx]
  const esquerda: Ponto[] = []
  const direita: Ponto[] = []
  const l = comprimento * (1 - 0.34 * fina)
  const m = meia * (1 - 0.48 * fina)
  for (let i = 0; i <= PASSOS_DA_LINGUA; i += 1) {
    const s = i / PASSOS_DA_LINGUA
    // A língua ondula um pouco de um lado para o outro (meia volta e pouco ao longo dela) além de dobrar na ponta.
    const dobra = comprimento * DOBRA_DA_CHAMA * s * s + meia * ONDA_DA_CHAMA * Math.sin(s * Math.PI * 1.5)
    const [x, y] = [bx + rx * l * s + px * dobra, by + ry * l * s + py * dobra]
    // A barriga fica a um quarto do caminho; a base é um pouco mais estreita, como numa gota.
    const largura = m * (i === 0 ? 0.62 : (1 - s) ** 0.8 * (1 + 0.5 * s))
    esquerda.push([x - px * largura, y - py * largura])
    direita.push([x + px * largura, y + py * largura])
  }
  return engordada(poligono([...esquerda, ...direita.reverse()]), 0.35)
}

/** A chama: do miolo claro, na base, ao laranja da ponta; toda emissão. */
function texDaChama(by: number, comprimento: number, miolo: boolean): Textura {
  return (_u, _v, _x, y, _p, s) => {
    const t = limitar01((by - y) / comprimento)
    const cor = miolo ? misturar(MIOLO_DA_CHAMA, PALHA, t) : misturar(PALHA, COR_DA_CHAMA, limitar01(0.3 + t * 1.2))
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = 1
  }
}

/** O ferro batido: as covinhas do martelo por cima da textura do metal e, na borda, a fuligem que sobe do carvão. */
function texFerroBatido(R: number, fuligem: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    s[3] += (0.14 - Math.abs(ruido(x * 0.6 + p.su, y * 0.6 + p.sv))) * 0.2
    if (fuligem <= 0) return
    const t = limitar01((BORDA_DE_FORA - Math.hypot(x, y) / R) / (BORDA_DE_FORA - BORDA_DE_DENTRO))
    s[3] -= fuligem * t * t * (0.75 + ruido(x * 0.35 + 9, y * 0.35) * 0.9)
  }
}

/** A cor do calor `t` (0 = a beira do leito, 1 = o miolo): o vermelho-escuro, o laranja e o amarelo-palha. */
function corDoCalor(t: number): Rgb {
  if (t < LARANJA_EM) return misturar(VERMELHO_ESCURO, LARANJA, (t - VERMELHO_ATE) / (LARANJA_EM - VERMELHO_ATE))
  return misturar(LARANJA, PALHA, limitar01((t - LARANJA_EM) / (PALHA_EM - LARANJA_EM)) ** 0.9)
}

/** O leito em brasa: o degradê de calor, do miolo amarelo-palha (no meio) ao vermelho-escuro da beira, junto do aro. */
function texLeitoEmBrasa(R: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const rr = Math.hypot(x, y) / (R * RAIO_DO_CARVAO)
    const cor = corDoCalor(limitar01(0.94 - rr + ruido(x * 0.3 + 3, y * 0.3 + 7) * RUIDO_DO_CALOR))
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = EMISSAO_DO_LEITO
  }
}

/** A beira em brasa de um pedaço de carvão: o calor do leito naquele ponto, um passo mais quente. */
function texBeiraEmBrasa(R: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const cor = corDoCalor(limitar01(1.2 - Math.hypot(x, y) / (R * RAIO_DO_CARVAO)))
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = 1
  }
}

/** O brilho do fogo na beira de dentro da borda. */
function texBrilhoNaBorda(R: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = limitar01((BORDA_DE_FORA - Math.hypot(x, y) / R) / (BORDA_DE_FORA - BORDA_DE_DENTRO))
    s[0] = BRASA_QUENTE[0]
    s[1] = BRASA_QUENTE[1]
    s[2] = BRASA_QUENTE[2]
    s[4] = 1
    s[5] = ALFA_DO_BRILHO_NA_BORDA * t * t
  }
}

/** A pedra do tampo do capitel: a fuligem em volta da bacia, mais forte junto dela, em manchas. */
function texDoTampo(R: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    DA_PEDRA_MANSA(u, v, x, y, p, s, escala)
    const t = limitar01((FULIGEM_ATE - Math.hypot(x, y) / R) / (FULIGEM_ATE - BORDA_DE_FORA))
    s[3] -= FORCA_DA_FULIGEM * t * (0.7 + ruido(x * 0.3 + 5, y * 0.3 + 1) * 0.9)
  }
}

const montar: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const R = Math.min(hw, hh)
  // A pedra das peças é LISA: a frente que a 3/4 varre leva o material da peça, e com a classe da pedra saía com o
  // salpico inteiro. O grão dos tampos vem da textura de cada um (`DA_PEDRA_MANSA`), que lê o tipo de pedra daqui.
  const pedra: MaterialDaPeca = { ...c.m.pedra, classe: 'liso' }
  const ferro = c.m.metal
  const aceso = c.variante !== 1
  const L: Peca[] = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const zPlinto = g * ALTURA_DO_PLINTO
  const zCapitel = g * ALTURA_DO_CAPITEL
  const zColarinho = zCapitel - ESPESSURA_DO_ABACO_DO_PILAR_COM_BRASEIRO
  const zBorda = g * ALTURA_DA_BORDA
  const [px, py] = [hw * PLINTO, hh * PLINTO]
  const mf = R * FUSTE
  const corte = mf * (1 - CHANFRO_DO_FUSTE)

  // ---------- o plinto: as duas metades, com o pé do fuste recortado, e o tampo em seis tiras ----------
  const fuste = quadradoChanfrado(mf, mf, mf * CHANFRO_DO_FUSTE)
  const quadrado = quadradoChanfrado(px, py, R * 0.08)
  const plinto = menos(quadrado, fuste)
  cena.sombras.push(contato(quadrado, 0.3))
  cena.sombras.push({ forma: dentroDe(plinto, caixa(-LONGE, -LONGE, LONGE, 0)), z: zPlinto }, { forma: dentroDe(plinto, caixa(-LONGE, 0, LONGE, LONGE)), z: zPlinto })
  // A sombra do fuste no tampo do plinto (o chão dele é o tampo): só a 3/4 a vê, de cima o capitel a cobre.
  const comSombraDoFuste = texturaComSombra(DA_PEDRA_MANSA, [{ forma: fuste, de: 0, ate: g * 0.5 }], SOMBRA_PINTADA.borda, SOMBRA_PINTADA.forca)
  // O meio da caixa de cada tira fica na moldura de fora, que o ábaco não cobre: senão ela subiria com ele.
  const [mx, my] = [(px + R * ABACO) / 2, (py + R * ABACO) / 2]
  const tiras: readonly (readonly [number, number, number, number, number, number])[] = [
    [-LONGE, -LONGE, LONGE, -mf, 0, -my],
    [-LONGE, mf, LONGE, LONGE, 0, my],
    [-LONGE, -mf, -mf, 0, -mx, -mf / 2],
    [-LONGE, 0, -mf, mf, -mx, mf / 2],
    [mf, -mf, LONGE, 0, mx, -mf / 2],
    [mf, 0, LONGE, mf, mx, mf / 2],
  ]
  for (const [x0, y0, x1, y1, cx, cy] of tiras) {
    L.push(P(comMeioEm(recortada(quadrado, x0, y0, x1, y1), cx, cy), pedra, { tabua: 0, bisel: 1.6, tom: 0.9, contorno: 0.28, textura: comSombraDoFuste, semente: 3201 }))
  }

  // ---------- o fuste: a quina da esquerda, a face e a quina da direita, cada coluna com o seu tom ----------
  const colunas: readonly (readonly [number, number])[] = [[-LONGE, -corte], [-corte, corte], [corte, LONGE]]
  colunas.forEach(([x0, x1], i) => {
    const coluna = dentroDe(fuste, caixa(x0, -LONGE, x1, LONGE))
    cena.sombras.push({ forma: coluna, z: zCapitel, suave: BORDA_DA_SOMBRA_DO_FUSTE })
    // O topo da coluna some debaixo do capitel: está aqui para a frente que a 3/4 varre sair no tom dele.
    L.push(P(coluna, { ...pedra, rgb: luz(pedra.rgb, TONS_DO_FUSTE[i]) }, { tabua: 0, bisel: 0, contorno: 0, semente: 3210 + i }))
  })

  // ---------- o capitel: o colarinho e o ábaco (dois tampos soltos) e o tampo de cima, com a fuligem ----------
  const colarinho = quadradoChanfrado(R * COLARINHO, R * COLARINHO, R * CHANFRO_DO_ABACO)
  const abaco = quadradoChanfrado(R * ABACO, R * ABACO, R * CHANFRO_DO_ABACO)
  cena.sombras.push(solta(colarinho, zColarinho), { forma: abaco, z: zCapitel, solta: true, forca: FORCA_DA_SOMBRA_DO_CAPITEL })
  const bacia = elipse(0, 0, BORDA_DE_FORA * R, BORDA_DE_FORA * R)
  const comSombraDaBacia = texturaComSombra(texDoTampo(R), [{ forma: bacia, de: 0, ate: zBorda - zCapitel }], SOMBRA_PINTADA.borda, SOMBRA_PINTADA.forca)
  // O meio da caixa das peças do tampo: na aba do ábaco, ao norte, fora do fuste.
  const naAba = (f: Forma): Forma => comMeioEm(f, 0, (-R * (FUSTE + ABACO)) / 2)
  L.push(P(naAba(abaco), pedra, { tabua: 0, bisel: 1.8, tom: 1.04, contorno: 0.28, textura: comSombraDaBacia, semente: 3220 }))
  // O friso rebaixado em volta do tampo.
  const friso = menos(quadradoChanfrado(R * (ABACO - 0.09), R * (ABACO - 0.09), R * CHANFRO_DO_ABACO * 0.8), quadradoChanfrado(R * (ABACO - 0.14), R * (ABACO - 0.14), R * CHANFRO_DO_ABACO * 0.7))
  L.push(P(naAba(friso), pedra, { tabua: 0, bisel: 0, tom: 0.78, contorno: 0, recesso: { k: 1, forca: 0.3 }, textura: comSombraDaBacia, semente: 3220 }))
  if (aceso) {
    const rc = RAIO_DO_CLARAO * R
    L.push(P(naAba(elipse(0, 0, rc, rc)), FOGO_PARADO, { textura: texHalo(0, 0, rc, rc, ALFA_DO_CLARAO), bisel: 0, contorno: 0, semente: 3221 }))
  }

  // ---------- a bacia: a sombra dela no chão e os dois pinos que a sobem na 3/4 ----------
  cena.sombras.push({ forma: deslocada(bacia, SOMBRA_X * zBorda, SOMBRA_Y * zBorda), z: 0, suave: bordaDaSombra({ z: zBorda }), forca: FORCA_DA_SOMBRA_DA_BACIA })
  // Os pinos ficam fora do meio (o meio é do tampo do capitel) e um pouco ao norte: o fio da beirada deles some na bacia.
  const pinoDoBojo: Ponto = [-1.2, -1.6]
  const pinoDaBoca: Ponto = [1.2, -1.6]
  const [doBojo, daBoca] = emOrdem([pino(pinoDoBojo[0], pinoDoBojo[1]), pino(pinoDaBoca[0], pinoDaBoca[1])], py)
  cena.sombras.push(solta(doBojo, zBorda - DESCIDA_DO_BOJO * R), solta(daBoca, zBorda))

  // O bojo: escondido debaixo da borda de cima; na 3/4, a barriga da bacia.
  const rBojo = RAIO_DO_BOJO * R
  L.push(P(comMeioEm(elipse(0, 0, rBojo, rBojo), pinoDoBojo[0], pinoDoBojo[1]), ferro, { tabua: 0, bisel: rBojo * 0.62, tom: TOM_DO_BOJO, metal: BRILHO_DO_FERRO, contorno: 0.3, textura: texFerroBatido(R, 0), semente: 3230 }))

  // A boca: o leito, o carvão, o fogo, a borda e os rebites (sobem juntos pelo pino da boca).
  const boca: Peca[] = []
  const rCarvao = RAIO_DO_CARVAO * R
  boca.push(aceso
    ? P(elipse(0, 0, rCarvao, rCarvao), FOGO_PARADO, { tabua: 0, bisel: 0, contorno: 0, recesso: { k: 1.8, forca: 0.42 }, textura: texLeitoEmBrasa(R), semente: 3240 })
    : P(elipse(0, 0, rCarvao, rCarvao), CINZA, { tabua: 0, bisel: 0.5, tom: 0.6, contorno: 0, recesso: { k: 1.8, forca: 0.42 }, textura: texCinza(0, 0, rCarvao), semente: 3240 }))
  // Os pedaços de carvão, em volta do miolo: aceso, cada um com a beira virada para o miolo em brasa.
  const naBoca = elipse(0, 0, rCarvao, rCarvao)
  PEDACOS_DE_CARVAO.forEach(([fx, fy, fr, comprido], i) => {
    const [x, y, r] = [fx * R, fy * R, fr * R]
    const forma = dentroDe(pedacoDeCarvao(x, y, r, comprido, 3250 + i), naBoca)
    if (aceso) {
      const ate = Math.hypot(x, y) || 1
      const brasa = dentroDe(engordada(forma, BEIRA_EM_BRASA, (-x / ate) * PUXADA_PARA_O_MIOLO, (-y / ate) * PUXADA_PARA_O_MIOLO), naBoca)
      boca.push(P(brasa, FOGO_PARADO, { textura: texBeiraEmBrasa(R), bisel: 0, contorno: 0, semente: 3240 + i }))
    }
    boca.push(P(forma, CARVAO, { tabua: 0, bisel: r * 0.5, tom: 0.9 + 0.24 * hash(i, 8, 3250), contorno: 0.2, semente: 3250 + i, projeta: { dist: 0.8, forca: aceso ? 0.14 : 0.3 } }))
  })
  if (aceso) {
    boca.push(P(elipse(0, 0, rCarvao * 1.05, rCarvao * 1.05), FOGO_PARADO, { textura: texHalo(0, 0, rCarvao * 1.05, rCarvao * 1.05, ALFA_DO_HALO), bisel: 0, contorno: 0, semente: 3290 }))
  } else {
    MANCHAS_DE_CINZA.forEach(([fx, fy, f], i) => {
      boca.push(P(pedacoDeCarvao(fx * R, fy * R, f * R, 1.1, 3291 + i), CINZA, { tabua: 0, bisel: 0, tom: 1.32, contorno: 0, alfa: ALFA_DA_CINZA, suave: f * R * 0.45, textura: texCinza(fx * R, fy * R, f * R), semente: 3291 + i }))
    })
  }
  boca.push(P(anel(0, 0, BORDA_DE_FORA * R, BORDA_DE_FORA * R, BORDA_DE_DENTRO * R, BORDA_DE_DENTRO * R), ferro, {
    tabua: 0,
    bisel: 1.2,
    tom: TOM_DA_BORDA,
    metal: BRILHO_DO_FERRO,
    contorno: 0.3,
    textura: texFerroBatido(R, FULIGEM_NA_BORDA),
    projeta: { dist: 1.2, forca: 0.38 },
    semente: 3295,
  }))
  const roda: Ponto[] = []
  for (let i = 0; i < REBITES; i += 1) {
    const a = ((i + 0.5) / REBITES) * Math.PI * 2
    roda.push([Math.cos(a) * RAIO_DOS_REBITES * R, Math.sin(a) * RAIO_DOS_REBITES * R])
  }
  boca.push(P(rebites(roda, RAIO_DO_REBITE), ferro, { tabua: 0, bisel: RAIO_DO_REBITE, tom: TOM_DO_REBITE, metal: 0.55, contorno: 0.2, semente: 3296 }))
  if (aceso) {
    boca.push(P(bacia, FOGO_PARADO, { textura: texBrilhoNaBorda(R), bisel: 0, contorno: 0, semente: 3297 }))
    // As línguas de chama, por cima de tudo: a de fora e o miolo claro de cada uma.
    LINGUAS.forEach(([fx, fy, comprimento, meia], i) => {
      const [x, y, l] = [fx * R, fy * R, comprimento * R]
      boca.push(P(lingua(x, y, l, meia * R, 0), FOGO_PARADO, { textura: texDaChama(y, l, false), bisel: 0, contorno: 0.1, semente: 3298 + i }))
      boca.push(P(lingua(x, y, l, meia * R, 1), FOGO_PARADO, { textura: texDaChama(y, l, true), bisel: 0, contorno: 0, semente: 3302 + i }))
    })
  }
  L.push(...boca.map((p) => ({ ...p, forma: comMeioEm(p.forma, pinoDaBoca[0], pinoDaBoca[1]) })))
}

/** Montado na tela e devolvido ao referencial do objeto: igual dos quatro lados, com a frente sempre embaixo. */
export const montarPilarComBraseiro: MontarMovel = montadaNaTela(montar)
