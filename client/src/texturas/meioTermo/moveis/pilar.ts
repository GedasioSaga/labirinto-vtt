/**
 * PILAR de pedra de cima com volume (11/11/2026, lote 1 dos objetos novos): a
 * coluna de templo ou de masmorra. De baixo para cima: o PLINTO quadrado com
 * uma quina partida, o TORO (a moldura redonda do pé), o FUSTE redondo de
 * dezesseis gomos (as caneluras) e o CAPITEL redondo, com um gomo em cima de
 * cada canelura, o ábaco liso, o sulco torneado, o furo de içar e uma trinca.
 *
 * De cima aparecem o plinto, o toro e o capitel (mais largo que o fuste, ele o
 * cobre); quem diz "coluna" é a roda de gomos dentro do anel dentro do
 * quadrado, e a sombra comprida. Na 3/4 a coluna sobe, e o desenho é montado
 * para o que `tresQuartos.ts` faz com as sombras (cada sombra com altura é uma
 * estrutura; as estruturas são pintadas do norte para o sul; cada peça sobe
 * com a estrutura mais alta que contém o meio da caixa dela):
 * - cada GOMO do fuste é uma coluna própria: a frente de cada um sai com o
 *   chanfro e o contorno dela, e o conjunto lê como fuste canelado (um fuste
 *   inteiriço daria uma frente lisa). O topo de cada gomo, escondido debaixo
 *   do capitel, leva para a frente o tom do lado dele: claro à esquerda, de
 *   onde vem a luz, escuro à direita;
 * - o CAPITEL é um tampo solto, com a beirada da espessura dele
 *   (`ESPESSURA_DO_CAPITEL`, que o perfil da 3/4 usa);
 * - o PLINTO e o TORO vão em duas metades, a do norte e a do sul: inteiros,
 *   seriam pintados por último (a base deles é a mais ao sul) e cobririam o
 *   fuste. Assim a metade do norte fica atrás da coluna e a do sul na frente,
 *   com o pé redondo recortado nela. O corte acompanha o quarto de volta que a
 *   3/4 pinta (`c.giro`): no pilar girado de lado ele é de pé no desenho, e
 *   deitado na tela;
 * - o tampo do plinto e o do toro vão em FATIAS (a mesma pedra, sem emenda): o
 *   meio da caixa de cada fatia fica fora do que está em cima dela, senão a
 *   peça subiria junto.
 *
 * As medidas redondas saem do menor lado da pegada (a coluna continua redonda
 * no objeto esticado); o plinto acompanha a pegada. Material: `pedra`.
 */
import { luz, type Rgb } from '../../ruido'
import { cadeia, caixa, dentroDe, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type Peca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

/** Gomos do fuste e do capitel, e fatias dos tampos: múltiplo de 4 (o pilar girado um quarto de volta é o mesmo). */
const GOMOS = 16
const PASSO = (2 * Math.PI) / GOMOS
/** Altura do plinto e do toro acima dele, em casas. */
const ALTURA_DO_PLINTO = 0.11
const ALTURA_DO_TORO = 0.1
/** Altura da coluna inteira, do chão ao alto do capitel, em casas. */
const ALTURA = 1.85
/** A espessura do capitel (px do protótipo): a beirada dele na 3/4. O perfil do pilar em `tresQuartos.ts` usa este valor. */
export const ESPESSURA_DO_CAPITEL = 0.16 * G
/** Meio lado do plinto, em fração da meia pegada. */
const PLINTO = 0.97
/** A quina partida do plinto, em fração do menor meio lado. */
const QUINA_PARTIDA = 0.2
/** Os raios, em fração do menor meio lado. */
const RAIO_DO_TORO = 0.74
const RAIO_DO_FUSTE = 0.5
const RAIO_DOS_GOMOS_DO_CAPITEL = 0.525
const GOMO_DO_CAPITEL = 0.112
const MIOLO_DO_CAPITEL = 0.55
const RAIO_DO_ABACO = 0.49
/**
 * Quanto do raio do fuste é o meio do gomo: com dezesseis gomos, o raio do
 * gomo (o resto) passa um pouco de meia corda, e os vizinhos se encostam sem
 * fresta. O meio dos gomos do capitel fica fora dos gomos do fuste (senão o
 * gomo do capitel seria peça do fuste, e a beirada do capitel o cobriria).
 */
const MEIO_DO_GOMO = 0.829
/** A frente do fuste: um pouco mais clara que a frente de sempre, mais clara do lado da luz e mais escura do outro. */
const LUZ_DO_FUSTE = 0.14
const SOMBRA_DO_FUSTE = 0.22
/** A borda da sombra de cada gomo (px do protótipo): firme, a sombra macia do alto é a do capitel. */
const BORDA_DA_SOMBRA_DO_GOMO = 1.6
/** A sombra do toro no plinto: para onde cai (px do protótipo, baixo à direita), a borda e a força. */
const SOMBRA_DO_TORO_X = 2
const SOMBRA_DO_TORO_Y = 1.6
const BORDA_DA_SOMBRA_DO_TORO = 1.2
const FORCA_DA_SOMBRA_DO_TORO = 0.3
/**
 * O escuro em que o pixel escuro demais é levantado (o piso de luz): um cinza quente, de luminância linear
 * 0,056. Com o escuro de sempre (o da nogueira) a beira da pedra cinza, na sombra, saía marrom.
 */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

/**
 * O gomo do fuste: o círculo com a distância exata, de uma raiz só (a da elipse faz duas e duas divisões).
 * São dezesseis, cada um varrido do pé ao alto na sombra e na frente da 3/4: é a conta que mais se repete.
 */
function disco(cx: number, cy: number, r: number): Forma {
  return {
    b: [cx - r, cy - r, cx + r, cy + r],
    d(x, y) {
      const dx = x - cx
      const dy = y - cy
      return Math.sqrt(dx * dx + dy * dy) - r
    },
  }
}

/**
 * A roda de gomos: o miolo redondo de raio `miolo` e `GOMOS` gomos de raio
 * `gomo` com o meio a `raio` do centro, o primeiro para a direita. A distância
 * olha só o gomo mais perto pelo ângulo: exata perto da borda, onde importa.
 */
function rodaDeGomos(raio: number, gomo: number, miolo: number): Forma {
  const fora = Math.max(raio + gomo, miolo)
  return {
    b: [-fora, -fora, fora, fora],
    d(x, y) {
      const perto = Math.round(Math.atan2(y, x) / PASSO) * PASSO
      const doGomo = Math.hypot(x - Math.cos(perto) * raio, y - Math.sin(perto) * raio) - gomo
      const doMiolo = Math.hypot(x, y) - miolo
      return doGomo < doMiolo ? doGomo : doMiolo
    },
  }
}

/**
 * A forma em `GOMOS` FATIAS em volta do centro: cada uma é a mesma forma
 * pintada só na caixa do setor entre os raios `deDentro` e `deFora`, SEM borda
 * no corte (o chanfro e o contorno continuam os da forma inteira; com a mesma
 * semente, o grão continua de uma fatia para a outra). É uma pedra só, em
 * pedaços que a 3/4 sobe um a um.
 */
function emFatias(forma: Forma, deDentro: number, deFora: number): Forma[] {
  const fatias: Forma[] = []
  for (let i = 0; i < GOMOS; i += 1) {
    const cantos = [i * PASSO, (i + 1) * PASSO].flatMap((a) => [deDentro, deFora].map((r): Ponto => [Math.cos(a) * r, Math.sin(a) * r]))
    const xs = cantos.map(([x]) => x)
    const ys = cantos.map(([, y]) => y)
    const b = forma.b
    fatias.push({
      b: [Math.max(b[0], Math.min(...xs)), Math.max(b[1], Math.min(...ys)), Math.min(b[2], Math.max(...xs)), Math.min(b[3], Math.max(...ys))],
      d: (x, y) => forma.d(x, y),
    })
  }
  return fatias
}

/**
 * O quarto de volta que a 3/4 pinta no desenho (0 a 3; de cima é sempre 0: quem gira é a imagem pronta). Com
 * ele, o que tem de ficar no lugar NA TELA (o corte das metades, a sombra pintada) é desgirado no desenho.
 */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O deslocamento no desenho que, depois de `quartos` quartos de volta (`girarPonto` de `tresQuartos.ts`), cai em (dx, dy) na tela. */
function desgirado(dx: number, dy: number, quartos: number): [number, number] {
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/**
 * A pedra do plinto com a sombra do toro de raio `raio` pintada nela, caída para (dx, dy). As fatias do toro
 * não projetam sombra (`projeta`): cada uma escureceria as vizinhas, que são a mesma pedra, e o anel sairia
 * em retalhos.
 */
function texDoPlinto(raio: number, dx: number, dy: number): Textura {
  const daPedra = texturaDaClasse('pedra')
  return (u, v, x, y, p, s, escala) => {
    if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
    const k = 0.5 - (Math.hypot(x - dx, y - dy) - raio) / (2 * BORDA_DA_SOMBRA_DO_TORO)
    if (k > 0) s[3] -= FORCA_DA_SOMBRA_DO_TORO * (k < 1 ? k : 1)
  }
}

/**
 * As duas metades de uma forma em volta do centro: na tela, a do norte (atrás da coluna na 3/4) e a do sul
 * (na frente). `deLado` = o desenho vai ser girado um quarto de volta: o corte é de pé nele.
 */
function metades(forma: Forma, deLado: boolean): [Forma, Forma] {
  const [x0, y0, x1, y1] = forma.b
  if (deLado) return [dentroDe(forma, caixa(x0 - 1, y0 - 1, 0, y1 + 1)), dentroDe(forma, caixa(0, y0 - 1, x1 + 1, y1 + 1))]
  return [dentroDe(forma, caixa(x0 - 1, y0 - 1, x1 + 1, 0)), dentroDe(forma, caixa(x0 - 1, 0, x1 + 1, y1 + 1))]
}

export const montarPilar: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const R = Math.min(hw, hh)
  const pedra = c.m.pedra
  const L: Peca[] = cena.partes
  const alto = g * ALTURA
  cena.corDoPiso = ESCURO_DA_PEDRA
  const rToro = R * RAIO_DO_TORO
  const rFuste = R * RAIO_DO_FUSTE
  const quartos = quartosDoGiro(c.giro)
  const deLado = quartos % 2 === 1

  // O PLINTO: o quadrado com a quina de baixo à direita partida e o pé do toro recortado no meio.
  const px = hw * PLINTO
  const py = hh * PLINTO
  const q = R * QUINA_PARTIDA
  const quadrado: Ponto[] = [[-px, -py], [px, -py], [px, py - q], [px - q * 0.4, py - q * 0.32], [px - q, py], [-px, py]]
  const plinto = menos(poligono(quadrado), elipse(0, 0, rToro, rToro))
  const zPlinto = g * ALTURA_DO_PLINTO
  for (const metade of metades(plinto, deLado)) cena.sombras.push({ forma: metade, z: zPlinto })
  cena.sombras.push(contato(poligono(quadrado), 0.3))
  const comSombraDoToro = texDoPlinto(rToro, ...desgirado(SOMBRA_DO_TORO_X, SOMBRA_DO_TORO_Y, quartos))
  for (const fatia of emFatias(plinto, rToro, Math.hypot(px, py))) L.push(P(fatia, pedra, { tabua: 0, bisel: 1.7, tom: 0.88, contorno: 0.28, textura: comSombraDoToro, semente: 701 }))

  // O TORO: o anel de borda redonda entre o plinto e o fuste.
  const toro = menos(elipse(0, 0, rToro, rToro), elipse(0, 0, rFuste, rFuste))
  const zToro = zPlinto + g * ALTURA_DO_TORO
  for (const metade of metades(toro, deLado)) cena.sombras.push({ forma: metade, z: zToro })
  for (const fatia of emFatias(toro, rFuste, rToro)) {
    L.push(P(fatia, pedra, { tabua: 0, bisel: (rToro - rFuste) / 2, tom: 0.98, contorno: 0.3, semente: 702 }))
  }

  // O FUSTE: cada gomo é uma coluna da altura do pilar (empatada com o capitel, a peça fica com a estrutura
  // mais justa: o topo do gomo é do gomo). O topo leva o tom do lado para a frente que a 3/4 pinta.
  const rMeio = rFuste * MEIO_DO_GOMO
  const rGomo = rFuste - rMeio
  for (let i = 0; i < GOMOS; i += 1) {
    const a = i * PASSO
    const gomo = disco(Math.cos(a) * rMeio, Math.sin(a) * rMeio, rGomo)
    cena.sombras.push({ forma: gomo, z: alto, suave: BORDA_DA_SOMBRA_DO_GOMO })
    // O lado do gomo NA TELA (a luz vem da esquerda dela): o ângulo dele no desenho mais o quarto de volta.
    const paraADireita = Math.cos(a + (quartos * Math.PI) / 2)
    L.push(P(gomo, { ...pedra, rgb: luz(pedra.rgb, LUZ_DO_FUSTE - SOMBRA_DO_FUSTE * paraADireita) }, { tabua: 0, bisel: rGomo, semente: 720 + i }))
  }

  // O CAPITEL: a roda de gomos (o tampo solto no alto), o ábaco, o sulco, o furo de içar e a trinca.
  const rGomos = R * RAIO_DOS_GOMOS_DO_CAPITEL
  const gomoDoCapitel = R * GOMO_DO_CAPITEL
  const capitel = rodaDeGomos(rGomos, gomoDoCapitel, R * MIOLO_DO_CAPITEL)
  cena.sombras.push({ forma: capitel, z: alto, solta: true, forca: 0.22 })
  // O fundo entre os gomos, um pouco mais escuro.
  L.push(P(capitel, pedra, { tabua: 0, bisel: 1, tom: 0.8, contorno: 0.3, semente: 740 }))
  for (let i = 0; i < GOMOS; i += 1) {
    const a = i * PASSO
    L.push(P(elipse(Math.cos(a) * rGomos, Math.sin(a) * rGomos, gomoDoCapitel, gomoDoCapitel), pedra, { tabua: 0, bisel: gomoDoCapitel * 0.8, tom: 0.98, contorno: 0.26, semente: 741 + i }))
  }
  const rAbaco = R * RAIO_DO_ABACO
  L.push(P(elipse(0, 0, rAbaco, rAbaco), pedra, { tabua: 0, bisel: 1.9, tom: 1.06, contorno: 0.26, semente: 760, projeta: { dist: 1.5, forca: 0.3 } }))
  L.push(P(menos(elipse(0, 0, rAbaco * 0.7, rAbaco * 0.7), elipse(0, 0, rAbaco * 0.6, rAbaco * 0.6)), pedra, { tabua: 0, bisel: 0, tom: 0.76, contorno: 0, recesso: { k: 1, forca: 0.3 }, semente: 761 }))
  const furo = rAbaco * 0.13
  L.push(P(caixa(-furo, -furo, furo, furo, 0.3), pedra, { tabua: 0, bisel: 0, tom: 0.5, contorno: 0, recesso: { k: 1.2, forca: 0.4 }, semente: 762 }))
  // A trinca, do furo até perto da beira do ábaco. O meio da caixa dela fica no oco do fuste, fora dos gomos.
  const trinca: Ponto[] = [[-0.05, 0.06], [0.1, -0.02], [0.2, -0.12], [0.33, -0.13], [0.44, -0.25]]
  L.push(P(cadeia(trinca.map(([x, y]): Ponto => [x * R, y * R]), 0.36), pedra, { tabua: 0, bisel: 0, tom: 0.5, contorno: 0, semente: 763 }))
}
