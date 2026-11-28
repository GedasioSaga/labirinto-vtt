/**
 * PORTAL MÁGICO (lote L09 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; temas Inferno e
 * Lava): o ANEL DE PEDRA em pé, de aduelas lavradas com uma runa em cada, preso num BERÇO que abraça a parte de baixo
 * dele e posto em cima de um PLINTO de dois degraus. Dentro do anel, o REDEMOINHO: o disco de luz em espiral de três
 * braços, escuro na beira e claro no miolo, com lascas de luz presas nos braços.
 *
 * DESENHADO DE FRENTE nas duas vistas (perfil `EM_PE`, como o crânio e a peça de xadrez): de cima, um portal é uma
 * risca; o que diz "portal" é o anel em pé com a luz girando dentro. Os degraus mostram o tampo (mais claro) e a
 * frente (mais escura), como quem olha um nada de cima. A sombra no chão sai do pé do plinto, curta, para baixo à
 * direita.
 *
 * O redemoinho é a PEÇA QUE MEXE (`montarPortalMagicoQueMexe`, animador `girar` de `lib/mobilia/animadores.ts`, com o
 * pivô no meio do anel: `ANIMACAO_DO_PORTAL_MAGICO`). Ele é um disco inteiro, de raio menor que o vão do anel: girado,
 * cobre o redemoinho parado da imagem sem sair do vão. `montarPortalMagico` é só a parte parada da 1ª versão; as
 * imagens inteiras de cada versão (a parte parada com o redemoinho em repouso, a de "menos movimento") são
 * `montarPortalMagicoInfernal` (a de `MONTADORES`), `...Arcano`, `...Gelo` e `...Apagado`. O redemoinho de cada versão
 * está em `VORTICE_DO_PORTAL_MAGICO` (o Apagado não tem: não gira).
 *
 * As quatro versões (a mesma pedra, o mesmo anel, a mesma pegada):
 * - INFERNAL: o redemoinho de brasa (vinho na beira, laranja no miolo), as runas em brasa, as rachaduras com brasa
 *   dentro e os espinhos de pedra que saem de trás do anel, no alto;
 * - ARCANO: o redemoinho violeta, as runas violeta, o filete de luz na beira de dentro do anel e a gema no fecho;
 * - GELO: o redemoinho azul-gelo, as runas de geada, a neve no alto do anel e nos degraus e os pingentes;
 * - APAGADO: o anel vazio (o vão mostra o chão de trás), as runas mortas, a fuligem na beira de dentro, a lasca que
 *   caiu do anel e o fecho rachado.
 *
 * O desenho é feito em 112 x 112 px (2 x 2 casas) e escala inteiro com o menor lado, centrado. Material: `pedra` (o
 * plinto, o berço, o anel e os espinhos); a luz, a gema, a neve e a fuligem são fixas.
 */
import type { Rgb } from '../../ruido'
import type { AnimacaoDoMovel } from '../../../lib/mobilia/animadores'
import { anel, cadeia, caixa, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/** O lado do desenho (px do protótipo): duas casas. */
const LADO_DO_DESENHO = 112
const GRAUS = Math.PI / 180

// ---------- as medidas (px do desenho, meio da pegada em 0, 0; y para baixo) ----------

/** O anel: o meio dele, o raio de fora e o do vão. O redemoinho tem raio um nada menor que o vão. */
const MEIO_DO_ANEL = -8
const RAIO_DE_FORA = 39
const RAIO_DO_VAO = 27.5
const RAIO_DO_VORTICE = 26.6
/** Os degraus do plinto: a meia largura, o alto do tampo, onde o tampo vira frente e o pé. */
const DEGRAU_DE_BAIXO = { meia: 45, tampo: 38, frente: 41.2, pe: 50 }
const DEGRAU_DE_CIMA = { meia: 33, tampo: 29, frente: 32.2, pe: 39.5 }
/** O berço: a meia largura e o alto (ele abraça o anel do alto até o tampo do degrau de cima). */
const BERCO = { meia: 42, alto: 2, pe: 31.5, canto: 3 }
/** As juntas das aduelas, em graus a partir do alto (no sentido do relógio); o fecho fica entre -15 e 15. */
const JUNTAS: readonly number[] = [-135, -105, -75, -45, -15, 15, 45, 75, 105, 135]
/** O fecho, mais saliente: de onde até onde ele vai no raio. */
const FECHO = { de: RAIO_DO_VAO - 1.6, ate: RAIO_DE_FORA + 2.6, meioAngulo: 15 }
/** As runas: no meio de cada aduela (graus) e o meio alto de cada uma (px). */
const RUNAS_NO_ANEL: readonly number[] = [-150, -120, -90, -60, -30, 30, 60, 90, 120, 150]
const MEIA_RUNA = 3.1
/** As alturas (px) com que a sombra sai do pé: o plinto e o anel (só a base arrasta: o anel é vazado). */
const ALTURA_DA_SOMBRA = 34
const PE_DO_PORTAL = { y: 47, rx: 47, ry: 5 }

/**
 * As runas, cada uma em traços numa caixa de -1 a 1 (y para baixo; o alto da runa aponta para fora do anel): o
 * galho, o A, a cruzada, a seta e o S.
 */
const RUNAS: readonly (readonly (readonly Ponto[])[])[] = [
  [[[0, -1], [0, 1]], [[0, -0.15], [0.72, -0.85]]],
  [[[-0.7, 1], [0, -1], [0.7, 1]], [[-0.36, 0.18], [0.36, 0.18]]],
  [[[0, -1], [0, 1]], [[-0.72, -0.48], [0.72, 0.48]]],
  [[[-0.62, -1], [0.62, 0], [-0.62, 1]]],
  [[[0.62, -1], [-0.6, -0.32], [0.6, 0.32], [-0.62, 1]]],
]

// ---------- as cores ----------

/** O redemoinho: a beira funda, o meio, o claro dos braços e o miolo. */
interface TonsDoVortice {
  readonly fundo: Rgb
  readonly meio: Rgb
  readonly claro: Rgb
  readonly miolo: Rgb
}

const VORTICE_INFERNAL: TonsDoVortice = { fundo: [0x5c, 0x32, 0x2a], meio: [0x8e, 0x4a, 0x36], claro: [0xcc, 0x90, 0x68], miolo: [0xe0, 0xc4, 0xa0] }
const VORTICE_ARCANO: TonsDoVortice = { fundo: [0x26, 0x1e, 0x3e], meio: [0x58, 0x44, 0x8c], claro: [0xae, 0x9a, 0xd8], miolo: [0xe0, 0xd6, 0xf0] }
const VORTICE_DE_GELO: TonsDoVortice = { fundo: [0x1c, 0x34, 0x46], meio: [0x3e, 0x6e, 0x8a], claro: [0x9c, 0xc6, 0xd8], miolo: [0xde, 0xec, 0xf0] }

/** A luz das runas acesas de cada versão. */
const RUNA_EM_BRASA: Rgb = [0xd4, 0xa4, 0x7c]
const RUNA_VIOLETA: Rgb = [0xc4, 0xb6, 0xe4]
const RUNA_DE_GEADA: Rgb = [0xc6, 0xe2, 0xec]
/** O escuro lavrado (o sulco da runa, a junta, a rachadura) e a fuligem. */
const OCO: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x2a, 0x2c] }
const FULIGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x24, 0x21, 0x22] }
/** A brasa das rachaduras do Infernal e o halo dela. */
const BRASA: MaterialDaPeca = { classe: 'liso', rgb: [0xcc, 0x8c, 0x5c] }
const HALO_DE_BRASA: MaterialDaPeca = { classe: 'liso', rgb: [0x8e, 0x4e, 0x36] }
/** A gema do fecho do Arcano: a face clara e a funda. */
const GEMA_CLARA: MaterialDaPeca = { classe: 'liso', rgb: [0xb8, 0xa6, 0xe0] }
const GEMA_FUNDA: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x46, 0x8e] }
/** A neve e a geada do Gelo, e o pingente (a metade da luz e a da sombra). */
const NEVE: MaterialDaPeca = { classe: 'liso', rgb: [0xe4, 0xea, 0xee] }
const GEADA: MaterialDaPeca = { classe: 'liso', rgb: [0xcc, 0xdc, 0xe4] }
const PINGENTE: MaterialDaPeca = { classe: 'liso', rgb: [0xd2, 0xe4, 0xec] }
const PINGENTE_NA_SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x92, 0xb2, 0xc4] }
/** O escuro em que o pixel escuro demais é levantado: o cinza frio da pedra (o da nogueira avermelhava a sombra). */
const ESCURO_DA_PEDRA: Rgb = [0x3c, 0x3a, 0x3e]

/**
 * O redemoinho: quantos braços e o quanto a espiral torce (a espiral logarítmica, braço = a + torção·ln r), mais a
 * espiral fina por cima. Com 2,6 de torção (1ª folha, 28/11/2026) os três braços liam hélice de ventilador.
 */
const BRACOS = 3
const TORCAO = 4.4
const BRACOS_FINOS = 5
const TORCAO_FINA = 8
/** As lascas de luz presas nos braços: raio (fração do redemoinho), ângulo (graus) e tamanho (px). */
const LASCAS: readonly (readonly [number, number, number])[] = [
  [0.34, 20, 1.1],
  [0.5, 140, 1.3],
  [0.66, 262, 1.2],
  [0.78, 76, 1],
  [0.44, 300, 0.9],
  [0.6, 204, 1],
  [0.86, 338, 0.9],
  [0.72, 168, 0.8],
]

// ---------- ajudantes ----------

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

function suave(a: number, b: number, t: number): number {
  const u = limitar((t - a) / (b - a), 0, 1)
  return u * u * (3 - 2 * u)
}

function entre(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** O ponto do anel no ângulo `graus` (a partir do alto, no sentido do relógio) e no raio `r` (px do desenho). */
function noAnel(graus: number, r: number): Ponto {
  return [Math.sin(graus * GRAUS) * r, MEIO_DO_ANEL - Math.cos(graus * GRAUS) * r]
}

/** Os pontos do desenho levados para a pegada (vezes `k`). */
function escalados(pontos: readonly Ponto[], k: number): Ponto[] {
  return pontos.map(([x, y]): Ponto => [x * k, y * k])
}

/** A peça acende: a cor dela não pega luz nem sombra (`forca` de 0 a 1). */
function texAcesa(forca: number): Textura {
  return (_u, _v, _x, _y, _p, s) => {
    s[4] = forca
  }
}

/** A geada por cima da pedra: aparece em manchas (o ruído largo) e some no resto. */
function texGeada(k: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const n = ruido((x / k) * 0.16 + 3, (y / k) * 0.16) + ruido((x / k) * 0.5, (y / k) * 0.5 + 9) * 0.35
    s[5] *= suave(-0.1, 0.45, n)
  }
}

/**
 * O redemoinho: a espiral de três braços em volta do meio do anel. A luz vai da beira funda ao miolo claro, os braços
 * clareiam e escurecem por cima, e tudo acende (não pega a luz do mapa: é a luz que sai do portal).
 */
function texVortice(r: number, k: number, tons: TonsDoVortice): Textura {
  const cy = MEIO_DO_ANEL * k
  return (_u, _v, x, y, _p, s) => {
    const dx = x
    const dy = y - cy
    const rr = Math.min(1, Math.hypot(dx, dy) / r)
    const angulo = Math.atan2(dy, dx)
    const raio = Math.log(rr + 0.06)
    const braco = Math.sin(BRACOS * angulo + TORCAO * raio)
    const fino = Math.sin(BRACOS_FINOS * angulo + TORCAO_FINA * raio + 1.3)
    const fundo = suave(1, 0.06, rr)
    const beira = suave(0.8, 1, rr)
    const t = limitar(0.3 + 0.52 * fundo ** 1.5 + 0.13 * braco + 0.06 * fino - 0.26 * beira + ruido((x / k) * 0.4, (y / k) * 0.4) * 0.04, 0, 1)
    const cor = t < 0.5 ? entre(tons.fundo, tons.meio, t / 0.5) : t < 0.85 ? entre(tons.meio, tons.claro, (t - 0.5) / 0.35) : entre(tons.claro, tons.miolo, (t - 0.85) / 0.15)
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = 1
  }
}

// ---------- as partes ----------

/** O plinto de dois degraus (tampo claro, frente escura, as juntas da frente) e o berço que abraça o anel. */
function plintoEBerco(c: ContextoDoMovel, cena: Cena, k: number): void {
  const P = c.peca
  const L = cena.partes
  const pedra = c.m.pedra
  const base = elipse(0, PE_DO_PORTAL.y * k, PE_DO_PORTAL.rx * k, PE_DO_PORTAL.ry * k)
  // O contato fraco: a sombra de baixo forte é a da 3/4 em pé (`tresQuartos.ts`), que a folha confere.
  cena.sombras.push(contato(base, 0.16), { forma: base, z: ALTURA_DA_SOMBRA * k, suave: 1.6, forca: 0.24 })
  DEGRAUS.forEach((d, i) => {
    L.push(P(caixa(-d.meia * k, d.frente * k, d.meia * k, d.pe * k, 1 * k), pedra, { bisel: 1.4 * k, tabua: 0, tom: 0.8, contorno: 0.3, semente: 9100 + i }))
    L.push(P(caixa(-d.meia * k, d.tampo * k, d.meia * k, d.frente * k + 0.4 * k, 0.8 * k), pedra, { bisel: 0.9 * k, tabua: 0, tom: 1.08, contorno: 0.28, semente: 9102 + i, projeta: { dist: 1.2 * k, forca: 0.3 } }))
    for (const x of i === 0 ? [-24, 9, 31] : [-12, 15]) {
      L.push(P(cadeia([[x * k, d.frente * k + 0.6 * k], [x * k, d.pe * k - 0.8 * k]], 0.3 * k), OCO, { bisel: 0, contorno: 0, alfa: 0.5, semente: 9104 + i }))
    }
  })
  const berco = menos(caixa(-BERCO.meia * k, BERCO.alto * k, BERCO.meia * k, BERCO.pe * k, BERCO.canto * k), elipse(0, MEIO_DO_ANEL * k, (RAIO_DE_FORA + 0.4) * k, (RAIO_DE_FORA + 0.4) * k))
  L.push(P(berco, pedra, { bisel: 1.8 * k, tabua: 0, tom: 0.9, contorno: 0.3, semente: 9106, projeta: { dist: 1.4 * k, forca: 0.3 } }))
}

const DEGRAUS = [DEGRAU_DE_BAIXO, DEGRAU_DE_CIMA] as const

/** O anel de aduelas: o corpo, o fecho saliente e as juntas lavradas (o sulco escuro e a beira clara do lado da luz). */
function anelDePedra(c: ContextoDoMovel, cena: Cena, k: number, lasca: Forma | null): void {
  const P = c.peca
  const L = cena.partes
  const pedra = c.m.pedra
  const corpo = anel(0, MEIO_DO_ANEL * k, RAIO_DE_FORA * k, RAIO_DE_FORA * k, RAIO_DO_VAO * k, RAIO_DO_VAO * k)
  L.push(P(lasca === null ? corpo : menos(corpo, lasca), pedra, { bisel: 3.4 * k, tabua: 0, tom: 1, contorno: 0.3, semente: 9110, projeta: { dist: 1.6 * k, forca: 0.32 } }))
  const f = FECHO
  const fecho = poligono(escalados([noAnel(-f.meioAngulo, f.de), noAnel(-f.meioAngulo - 1.5, f.ate), noAnel(f.meioAngulo + 1.5, f.ate), noAnel(f.meioAngulo, f.de)], k))
  L.push(P(fecho, pedra, { bisel: 2 * k, tabua: 0, tom: 1.06, contorno: 0.32, semente: 9111, projeta: { dist: 1.4 * k, forca: 0.34 } }))
  JUNTAS.forEach((graus, i) => {
    const de = noAnel(graus, RAIO_DO_VAO + 0.6)
    const ate = noAnel(graus, Math.abs(graus) === 15 ? FECHO.ate - 0.4 : RAIO_DE_FORA - 0.5)
    L.push(P(cadeia(escalados([[de[0] - 0.45, de[1] - 0.45], [ate[0] - 0.45, ate[1] - 0.45]], k), 0.3 * k), pedra, { bisel: 0, contorno: 0, tom: 1.25, alfa: 0.55, semente: 9112 + i }))
    L.push(P(cadeia(escalados([de, ate], k), 0.38 * k), OCO, { bisel: 0, contorno: 0, alfa: 0.62, semente: 9124 + i }))
  })
}

/** Os traços de uma runa, no ângulo do anel em que ela fica (o alto dela aponta para fora). */
function tracosDaRuna(graus: number, i: number, k: number): Ponto[][] {
  const [mx, my] = noAnel(graus, (RAIO_DO_VAO + RAIO_DE_FORA) / 2)
  const co = Math.cos(graus * GRAUS)
  const si = Math.sin(graus * GRAUS)
  return RUNAS[i % RUNAS.length].map((traco) => traco.map(([x, y]): Ponto => [(mx + (x * co - y * si) * MEIA_RUNA * 0.72) * k, (my + (x * si + y * co) * MEIA_RUNA) * k]))
}

/** As runas: o sulco lavrado e, se acesas, a luz dentro dele e o halo em volta. */
function runas(c: ContextoDoMovel, cena: Cena, k: number, luz: Rgb | null): void {
  const P = c.peca
  const L = cena.partes
  const acesa: MaterialDaPeca = { classe: 'liso', rgb: luz ?? OCO.rgb }
  RUNAS_NO_ANEL.forEach((graus, i) => {
    for (const traco of tracosDaRuna(graus, i, k)) {
      const linha = cadeia(traco, 0.62 * k)
      L.push(P(linha, OCO, { bisel: 0, contorno: 0, alfa: 0.72, recesso: { k: 0.5 * k, forca: 0.3 }, semente: 9140 + i }))
      if (luz === null) continue
      L.push(P(cadeia(traco, 1.5 * k), acesa, { bisel: 0, contorno: 0, alfa: 0.3, suave: 1.3 * k, textura: texAcesa(1), semente: 9150 + i }))
      L.push(P(cadeia(traco, 0.36 * k), acesa, { bisel: 0, contorno: 0, alfa: 0.95, textura: texAcesa(1), semente: 9160 + i }))
    }
  })
}

/** A luz do redemoinho na pedra: a beira de dentro do anel e o tampo do degrau de cima, banhados nela. */
function luzNaPedra(c: ContextoDoMovel, cena: Cena, k: number, tons: TonsDoVortice): void {
  const P = c.peca
  const banho: MaterialDaPeca = { classe: 'liso', rgb: tons.claro }
  const cy = MEIO_DO_ANEL * k
  cena.partes.push(P(anel(0, cy, (RAIO_DO_VAO + 4.5) * k, (RAIO_DO_VAO + 4.5) * k, RAIO_DO_VAO * k, RAIO_DO_VAO * k), banho, { bisel: 0, contorno: 0, alfa: 0.26, suave: 2.6 * k, textura: texAcesa(1), semente: 9170 }))
  cena.partes.push(P(elipse(0, (DEGRAU_DE_CIMA.tampo + 1.6) * k, 18 * k, 2.4 * k), banho, { bisel: 0, contorno: 0, alfa: 0.22, suave: 2 * k, textura: texAcesa(1), semente: 9171 }))
}

/** O redemoinho em repouso: o disco em espiral e as lascas de luz presas nos braços. */
function vortice(c: ContextoDoMovel, cena: Cena, tons: TonsDoVortice): void {
  const k = Math.min(c.w, c.h) / LADO_DO_DESENHO
  const P = c.peca
  const r = RAIO_DO_VORTICE * k
  const cy = MEIO_DO_ANEL * k
  cena.partes.push(P(elipse(0, cy, r, r), { classe: 'liso', rgb: tons.meio }, { bisel: 0, contorno: 0.12, suave: 0.6 * k, textura: texVortice(r, k, tons), semente: 9180 }))
  const lasca: MaterialDaPeca = { classe: 'liso', rgb: tons.miolo }
  LASCAS.forEach(([raio, graus, tamanho], i) => {
    const [x, y] = [Math.cos(graus * GRAUS) * raio * r, cy + Math.sin(graus * GRAUS) * raio * r]
    cena.partes.push(P(elipse(x, y, tamanho * k, tamanho * 0.7 * k), lasca, { bisel: 0, contorno: 0, alfa: 0.7, suave: 0.4 * k, textura: texAcesa(1), semente: 9181 + i }))
  })
}

// ---------- o que cada versão tem a mais ----------

/** INFERNAL: os espinhos de pedra que saem de trás do anel, no alto (pintados antes dele). */
function espinhos(c: ContextoDoMovel, cena: Cena, k: number): void {
  const P = c.peca
  const pontas: readonly (readonly [number, number, number])[] = [
    [-52, 9, 3.4],
    [-26, 12.5, 4],
    [0, 15, 4.4],
    [26, 12, 4],
    [52, 8.5, 3.4],
  ]
  pontas.forEach(([graus, comprido, meia], i) => {
    const dobra = (i - 2) * 2.4
    const pe1 = noAnel(graus - meia * 1.6, RAIO_DE_FORA - 3)
    const pe2 = noAnel(graus + meia * 1.6, RAIO_DE_FORA - 3)
    const meio = noAnel(graus + dobra * 0.4, RAIO_DE_FORA + comprido * 0.55)
    const ponta = noAnel(graus + dobra, RAIO_DE_FORA + comprido)
    const forma = poligono(escalados([pe1, [meio[0] - 1.1, meio[1]], ponta, [meio[0] + 1.1, meio[1]], pe2], k))
    cena.partes.push(P(forma, c.m.pedra, { bisel: 1.6 * k, tabua: 0, tom: 0.86, contorno: 0.32, semente: 9200 + i, projeta: { dist: 1.2 * k, forca: 0.3 } }))
  })
}

/** As rachaduras com brasa dentro: o halo largo e esfumado e o fio aceso, nas aduelas e na frente dos degraus. */
const RACHADURAS: readonly (readonly Ponto[])[] = [
  [noAnel(-121, 28.8), noAnel(-118, 30.6), noAnel(-119.5, 32.4), noAnel(-116, 34.2), noAnel(-117.5, 36.2), noAnel(-114, 38.5)],
  [noAnel(66, 38.6), noAnel(63.5, 36.8), noAnel(65, 34.6), noAnel(61.5, 32.6), noAnel(62.5, 30.4), noAnel(59.5, 28.6)],
  [noAnel(-41, 38.8), noAnel(-38.5, 37), noAnel(-39.5, 35.2), noAnel(-36.5, 33.6)],
  [noAnel(141, 38.4), noAnel(139, 36.4), noAnel(141.5, 34.6)],
]

function rachadurasEmBrasa(c: ContextoDoMovel, cena: Cena, k: number): void {
  const P = c.peca
  RACHADURAS.forEach((linha, i) => {
    const pontos = escalados(linha, k)
    cena.partes.push(P(cadeia(pontos, 1.6 * k), HALO_DE_BRASA, { bisel: 0, contorno: 0, alfa: 0.34, suave: 1.4 * k, textura: texAcesa(1), semente: 9210 + i }))
    cena.partes.push(P(cadeia(pontos, 0.5 * k), OCO, { bisel: 0, contorno: 0, alfa: 0.8, semente: 9220 + i }))
    cena.partes.push(P(cadeia(pontos, 0.3 * k), BRASA, { bisel: 0, contorno: 0, alfa: 0.95, textura: texAcesa(1), semente: 9230 + i }))
  })
}

/** ARCANO: o filete de luz na beira de dentro do anel e a gema lapidada no fecho, com o halo. */
function fileteEGema(c: ContextoDoMovel, cena: Cena, k: number): void {
  const P = c.peca
  const cy = MEIO_DO_ANEL * k
  const r = (RAIO_DO_VAO + 1.5) * k
  const filete: MaterialDaPeca = { classe: 'liso', rgb: RUNA_VIOLETA }
  cena.partes.push(P(anel(0, cy, r + 0.45 * k, r + 0.45 * k, r - 0.45 * k, r - 0.45 * k), filete, { bisel: 0, contorno: 0, alfa: 0.75, textura: texAcesa(1), semente: 9240 }))
  const [gx, gy] = noAnel(0, (FECHO.de + FECHO.ate) / 2)
  const [x, y] = [gx * k, gy * k]
  cena.partes.push(P(elipse(x, y, 6 * k, 6 * k), filete, { bisel: 0, contorno: 0, alfa: 0.3, suave: 2.4 * k, textura: texAcesa(1), semente: 9241 }))
  const alto: Ponto = [x, y - 4.2 * k]
  const baixo: Ponto = [x, y + 4.2 * k]
  const esq: Ponto = [x - 2.8 * k, y]
  const dir: Ponto = [x + 2.8 * k, y]
  cena.partes.push(P(poligono([alto, dir, baixo, esq]), GEMA_FUNDA, { bisel: 0.6 * k, contorno: 0.35, textura: texAcesa(0.7), semente: 9242 }))
  cena.partes.push(P(poligono([alto, [x, y], esq]), GEMA_CLARA, { bisel: 0, contorno: 0, alfa: 0.9, textura: texAcesa(1), semente: 9243 }))
  cena.partes.push(P(elipse(x - 0.9 * k, y - 1.6 * k, 0.5 * k, 0.8 * k), { classe: 'liso', rgb: [0xec, 0xe6, 0xf4] }, { bisel: 0, contorno: 0, alfa: 0.85, textura: texAcesa(1), semente: 9244 }))
}

/** GELO: a geada na pedra do anel, a neve no alto dele e nos tampos, e os pingentes debaixo das beiras. */
function neveEGeada(c: ContextoDoMovel, cena: Cena, k: number): void {
  const P = c.peca
  const cy = MEIO_DO_ANEL * k
  cena.partes.push(P(anel(0, cy, RAIO_DE_FORA * k, RAIO_DE_FORA * k, RAIO_DO_VAO * k, RAIO_DO_VAO * k), GEADA, { bisel: 0, contorno: 0, alfa: 0.42, suave: 0.8 * k, textura: texGeada(k), semente: 9250 }))
  // A neve no alto do anel: a crescente que engrossa no meio, por cima da beira de fora.
  const fora: Ponto[] = []
  const dentro: Ponto[] = []
  for (let graus = -78; graus <= 78; graus += 6) {
    const grossa = 3.4 * Math.cos(graus * 1.15 * GRAUS) + 0.4
    fora.push(noAnel(graus, RAIO_DE_FORA + 0.9 + 0.6 * Math.cos(graus * 3 * GRAUS)))
    dentro.unshift(noAnel(graus, RAIO_DE_FORA + 0.9 - grossa))
  }
  cena.partes.push(P(poligono(escalados([...fora, ...dentro], k)), NEVE, { bisel: 1.4 * k, contorno: 0.22, semente: 9251, projeta: { dist: 0.8 * k, forca: 0.24 } }))
  // A neve nos tampos dos degraus e no alto do berço.
  for (const [i, d] of DEGRAUS.entries()) {
    const monte = uniao(caixa((-d.meia + 1.5) * k, (d.tampo - 0.8) * k, (d.meia - 1.5) * k, (d.frente - 0.2) * k, 1.2 * k), elipse(-d.meia * 0.35 * k, (d.tampo - 0.4) * k, d.meia * 0.3 * k, 1.4 * k))
    cena.partes.push(P(monte, NEVE, { bisel: 1 * k, contorno: 0.2, semente: 9252 + i, projeta: { dist: 0.7 * k, forca: 0.22 } }))
  }
  for (const lado of [-1, 1]) {
    cena.partes.push(P(elipse(lado * (BERCO.meia - 3.4) * k, (BERCO.alto + 0.6) * k, 3.6 * k, 1.5 * k), NEVE, { bisel: 0.8 * k, contorno: 0.2, semente: 9255 + lado }))
  }
  // Os pingentes: debaixo da beira de cada tampo e do berço.
  const pingentes: readonly (readonly [number, number, number])[] = [
    [-38, DEGRAU_DE_BAIXO.frente, 4.2],
    [-29, DEGRAU_DE_BAIXO.frente, 2.6],
    [-9, DEGRAU_DE_BAIXO.frente, 3.4],
    [27, DEGRAU_DE_BAIXO.frente, 3.8],
    [36, DEGRAU_DE_BAIXO.frente, 2.4],
    [-25, DEGRAU_DE_CIMA.frente, 3.2],
    [-17, DEGRAU_DE_CIMA.frente, 2.2],
    [12, DEGRAU_DE_CIMA.frente, 2.8],
    [24, DEGRAU_DE_CIMA.frente, 3.6],
  ]
  pingentes.forEach(([x, y, comprido], i) => {
    const largo = 1.05
    cena.partes.push(P(poligono(escalados([[x - largo, y], [x, y], [x + 0.1, y + comprido]], k)), PINGENTE, { bisel: 0, contorno: 0.2, semente: 9260 + i }))
    cena.partes.push(P(poligono(escalados([[x, y], [x + largo, y], [x + 0.1, y + comprido]], k)), PINGENTE_NA_SOMBRA, { bisel: 0, contorno: 0.2, semente: 9270 + i }))
  })
}

/** APAGADO: a lasca que falta no anel (o recorte), a que caiu no degrau, o fecho rachado e a fuligem na beira de dentro. */
function lascaQueFalta(k: number): Forma {
  return poligono(escalados([noAnel(48, RAIO_DE_FORA + 2), noAnel(54, RAIO_DE_FORA - 4.6), noAnel(61, RAIO_DE_FORA - 3.2), noAnel(66, RAIO_DE_FORA + 2)], k))
}

function abandono(c: ContextoDoMovel, cena: Cena, k: number): void {
  const P = c.peca
  const cy = MEIO_DO_ANEL * k
  cena.partes.push(P(anel(0, cy, (RAIO_DO_VAO + 3.6) * k, (RAIO_DO_VAO + 3.6) * k, RAIO_DO_VAO * k, RAIO_DO_VAO * k), FULIGEM, { bisel: 0, contorno: 0, alfa: 0.42, suave: 2.2 * k, semente: 9280 }))
  const racha = escalados([noAnel(-4, FECHO.ate - 0.6), noAnel(2, FECHO.ate - 3.4), noAnel(-3, FECHO.ate - 6.4), noAnel(3, FECHO.de + 2.4)], k)
  cena.partes.push(P(cadeia(racha.map(([x, y]): Ponto => [x - 0.4 * k, y - 0.35 * k]), 0.26 * k), c.m.pedra, { bisel: 0, contorno: 0, tom: 1.25, alfa: 0.6, semente: 9281 }))
  cena.partes.push(P(cadeia(racha, 0.36 * k), OCO, { bisel: 0, contorno: 0, alfa: 0.85, semente: 9282 }))
  // A lasca caída no degrau de cima, à direita, e o pó dela.
  const caida = poligono(escalados([[18, 33.6], [21.5, 30.6], [26.4, 31.2], [27.6, 34.8], [22.6, 36.4]], k))
  cena.sombras.push(contato(caida, 0.3), { forma: caida, z: 3 * k, forca: 0.26 })
  cena.partes.push(P(caida, c.m.pedra, { bisel: 1.2 * k, tabua: 0, tom: 0.92, contorno: 0.3, semente: 9283, projeta: { dist: 0.8 * k, forca: 0.3 } }))
  for (const [x, y, r] of [[15.5, 35.2, 0.7], [29.4, 35.6, 0.6], [24.6, 37.4, 0.5]] as const) {
    cena.partes.push(P(elipse(x * k, y * k, r * k, r * 0.8 * k), c.m.pedra, { bisel: 0.4 * k, tabua: 0, tom: 0.9, contorno: 0.25, semente: 9284 }))
  }
}

// ---------- as versões ----------

interface VersaoDoPortal {
  readonly vortice: TonsDoVortice | null
  readonly runa: Rgb | null
}

const INFERNAL: VersaoDoPortal = { vortice: VORTICE_INFERNAL, runa: RUNA_EM_BRASA }
const ARCANO: VersaoDoPortal = { vortice: VORTICE_ARCANO, runa: RUNA_VIOLETA }
const GELO: VersaoDoPortal = { vortice: VORTICE_DE_GELO, runa: RUNA_DE_GEADA }
const APAGADO: VersaoDoPortal = { vortice: null, runa: null }

/** A parte parada de uma versão: o plinto, o berço, o anel, as runas e o que a versão tem a mais. */
function parado(v: VersaoDoPortal, antes: ((c: ContextoDoMovel, cena: Cena, k: number) => void) | null, depois: ((c: ContextoDoMovel, cena: Cena, k: number) => void) | null, lasca: boolean): MontarMovel {
  return (c, cena) => {
    const k = Math.min(c.w, c.h) / LADO_DO_DESENHO
    cena.corDoPiso = ESCURO_DA_PEDRA
    plintoEBerco(c, cena, k)
    antes?.(c, cena, k)
    anelDePedra(c, cena, k, lasca ? lascaQueFalta(k) : null)
    runas(c, cena, k, v.runa)
    if (v.vortice !== null) luzNaPedra(c, cena, k, v.vortice)
    depois?.(c, cena, k)
  }
}

/** INFERNAL, a parte parada: a 1ª versão (o redemoinho é do animador). */
export const montarPortalMagico: MontarMovel = parado(INFERNAL, espinhos, rachadurasEmBrasa, false)
const paradoArcano: MontarMovel = parado(ARCANO, null, fileteEGema, false)
const paradoGelo: MontarMovel = parado(GELO, null, neveEGeada, false)

/** A peça que mexe da 1ª versão: o redemoinho de brasa em repouso. */
export const montarPortalMagicoQueMexe: MontarMovel = (c, cena) => vortice(c, cena, VORTICE_INFERNAL)

const queMexeArcano: MontarMovel = (c, cena) => vortice(c, cena, VORTICE_ARCANO)
const queMexeGelo: MontarMovel = (c, cena) => vortice(c, cena, VORTICE_DE_GELO)

/** O redemoinho de cada versão que gira (o Apagado não tem), pelo id da versão. */
export const VORTICE_DO_PORTAL_MAGICO: Readonly<Record<string, MontarMovel>> = {
  infernal: montarPortalMagicoQueMexe,
  arcano: queMexeArcano,
  gelo: queMexeGelo,
}

/** O redemoinho gira em volta do meio do anel: uma volta a cada 6 s (devagar, de coisa grande). */
export const ANIMACAO_DO_PORTAL_MAGICO: AnimacaoDoMovel = {
  animador: 'girar',
  pivo: { x: 0.5, y: (LADO_DO_DESENHO / 2 + MEIO_DO_ANEL) / LADO_DO_DESENHO },
  periodoMs: 6000,
}

function inteira(parada: MontarMovel, queMexe: MontarMovel): MontarMovel {
  return (c, cena) => {
    parada(c, cena)
    queMexe(c, cena)
  }
}

/** As imagens inteiras (a parte parada e o redemoinho em repouso): a de `MONTADORES` e as das versões. */
export const montarPortalMagicoInfernal: MontarMovel = inteira(montarPortalMagico, montarPortalMagicoQueMexe)
export const montarPortalMagicoArcano: MontarMovel = inteira(paradoArcano, queMexeArcano)
export const montarPortalMagicoGelo: MontarMovel = inteira(paradoGelo, queMexeGelo)
export const montarPortalMagicoApagado: MontarMovel = parado(APAGADO, null, abandono, true)
