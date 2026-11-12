/**
 * SANGUE NO CHÃO (lote 14 dos objetos novos, 11/11/2026; pedido do mestre: "coloca tambem como objeto sangue
 * no shão"): a mancha que o mestre põe para marcar uma cena, uma luta ou uma pista. Sem corpo e sem parte de
 * corpo: só o sangue.
 *
 * A POÇA tem o contorno irregular de líquido que escorreu (lóbulos com a beira ondulada pelo ruído) e duas
 * camadas: a PELÍCULA seca em volta, marrom-ferrugem, fosca e rala, que some no piso sem contorno; e a poça
 * MOLHADA por cima, que vai do marrom da beira ao vinho escuro do miolo. A molhada é a única peça com chanfro
 * e brilho: a beira do lado da luz pega o reflexo (é o que diz "líquido" e não "tinta"), e um fio do céu
 * refletido corre por dentro da beira de cima dos lóbulos grandes. Em volta, os RESPINGOS: gotas redondas,
 * umas com a cauda apontando para longe da poça (a gota que chegou de lado) e uns pingos secos. Para a
 * esquerda, o RASTRO curto de alguma coisa ARRASTADA, com os riscos ao comprido e mais ralo no fim; para a
 * direita, a marca de uma PEGADA de bota saindo da poça (o salto e a sola, com as travas da sola).
 *
 * As cores são vinho e marrom contidos (saturação HSV ~0,5 a 0,6), nada de vermelho vivo. É OBJETO DE CHÃO
 * RENTE: nenhuma peça tem altura nem sombra, e por isso a 3/4 sai igual à vista de cima (o tipo precisa da
 * exceção de chão, como o campinho). Escreve `cena.corDoPiso` (o escuro do sangue): com o da nogueira o miolo
 * levantado saía marrom de madeira.
 *
 * Esticada, a poça, a película e o rastro esticam com a pegada (lóbulos e rastro em frações dela), e as gotas,
 * a pegada e o reflexo têm o tamanho do menor lado: as gotas continuam redondas, sem virar riscos. A pegada de
 * partida é 1,5 x 1 casa. Sem material no painel.
 */
import type { Rgb } from '../../ruido'
import { elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { ruido, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

// ---------- as cores (fixas) ----------

/** O miolo molhado: vinho escuro puxado para o marrom (o brilho do motor ainda soma um cinza claro por cima). */
const MIOLO: Rgb = [0x5a, 0x25, 0x21]
/** A beira da poça molhada, onde ela já é rala: o vinho clareia e puxa para o marrom. */
const BEIRA_MOLHADA: Rgb = [0x74, 0x3e, 0x31]
/** A película seca em volta da poça e o rastro: marrom-ferrugem, fosco. */
const SECO: Rgb = [0x80, 0x52, 0x40]
/** As gotas: um pouco mais claras que o miolo (a gota é rasa). */
const GOTA: MaterialDaPeca = { classe: 'liso', rgb: [0x62, 0x2a, 0x25] }
/** O pingo que já secou. */
const PINGO_SECO: MaterialDaPeca = { classe: 'liso', rgb: SECO }
/** O céu refletido na beira da poça do lado da luz, um pouco puxado para o tom do sangue. */
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xc6, 0xc0] }
/** A peça de sangue com textura própria: a cor sai da textura (a beira, o miolo, o seco). */
const SANGUE: MaterialDaPeca = { classe: 'liso', rgb: MIOLO }
/**
 * O escuro em que o pixel escuro demais é levantado: vinho-escuro com luminância linear 0,049 (acima do piso de
 * 0,045) e saturação HSV 0,55. Com o da nogueira o miolo saía marrom de madeira.
 */
const ESCURO_DO_SANGUE: Rgb = [0x62, 0x30, 0x2c]

// ---------- as medidas ----------

/** A pegada de partida (1,5 x 1 casa): as gotas, a pegada e o reflexo têm o tamanho de desenho nela. */
const LARGURA_DE_PARTIDA = 1.5 * G
const FUNDO_DE_PARTIDA = G

/**
 * Os lóbulos da poça molhada: meio e raios em frações da meia pegada (os raios esticam com ela, como na poça
 * do barril quebrado: presos ao menor lado, a poça esticada se partia em gotas).
 */
const LOBULOS: readonly (readonly [number, number, number, number])[] = [
  [-0.14, 0.04, 0.34, 0.4],
  [-0.38, -0.2, 0.18, 0.3],
  [0.1, 0.22, 0.17, 0.25],
  [-0.3, 0.34, 0.15, 0.2],
  [0.06, -0.24, 0.13, 0.18],
  [0.2, -0.02, 0.1, 0.16],
]
/** A película seca passa da poça molhada: os lóbulos crescem esta fração e mais este tanto (px). */
const CRESCE_A_PELICULA = 1.07
const SOBRA_DA_PELICULA = 1.4
/** A beira ondulada: a amplitude (px) e a escala do ruído (o líquido não acaba num contorno de compasso). */
const ONDA_DA_POCA = 1.4
const ONDA_DA_PELICULA = 1.6
const ESCALA_DA_ONDA = 0.21
/** Quanto a poça molhada leva, da beira para dentro, para chegar ao vinho do miolo e para ficar opaca (px). */
const FUNDO_DO_MIOLO = 6.5
const FUNDO_OPACO = 2.4
/** A opacidade na beira da molhada (o chão ainda aparece um pouco por baixo do sangue raso). */
const ALFA_DA_BEIRA = 0.62
/** A película: a opacidade mais forte, a faixa (px) em que ela some no piso e o borrão da borda. */
const ALFA_DO_SECO = 0.52
const BORDA_DO_SECO = 3
const SUAVE_DO_SECO = 1.6
/**
 * O chanfro e o brilho da molhada: só o menisco da beira pega a luz. Com o chanfro largo a poça virava uma
 * gelatina abaulada; a poça de verdade é rasa e o brilho dela é o reflexo.
 */
const CHANFRO_DA_POCA = 1
const BRILHO_DA_POCA = 0.3
/** Os coágulos: manchas mais escuras no miolo, em duas escalas. */
const COAGULO = 0.08

/**
 * O rastro arrastado: começa dentro da poça e vai para a esquerda e para baixo (frações da meia pegada); a
 * largura no começo e no fim (frações do meio fundo); o passo dos riscos ao comprido (px no tamanho de partida).
 */
const RASTRO_DE: Ponto = [-0.46, 0.16]
const RASTRO_ATE: Ponto = [-0.93, 0.52]
const LARGURA_DO_RASTRO_NO_COMECO = 0.34
const LARGURA_DO_RASTRO_NO_FIM = 0.13
const PASSO_DOS_RISCOS = 1.3
const ALFA_DO_RASTRO = 0.66
/** O rastro é um borrão contínuo com os riscos mais escuros por cima: o mínimo da opacidade entre os riscos. */
const FUNDO_DO_RASTRO = 0.55

/**
 * A pegada de bota saindo da poça: o meio do salto (frações da meia pegada), a direção dos dedos (radianos),
 * o comprimento e a largura (px no tamanho de partida). Maior que a escala da casa pede, para ler no tamanho
 * de mesa.
 */
const PEGADA: Ponto = [0.36, -0.12]
const DIRECAO_DA_PEGADA = -0.42
const COMPRIMENTO_DA_PEGADA = 15
const LARGURA_DA_PEGADA = 6
/**
 * As travas da sola: o passo (px no tamanho de partida), a fração da trava que marca e o quanto o vão entre
 * duas travas ainda marca; a beira da sola (px), que marca inteira e desenha o contorno da bota; a opacidade.
 */
const PASSO_DAS_TRAVAS = 1.6
const LIMIAR_DA_TRAVA = -0.35
const VAO_DA_TRAVA = 0.4
const BEIRA_DA_SOLA = 0.8
const ALFA_DA_PEGADA = 0.78

/**
 * As gotas: meio (frações da meia pegada), raio e cauda (px no tamanho de partida) e para onde a cauda aponta
 * (radianos; a gota que chegou de lado se alonga para longe da poça). Cauda zero = gota redonda.
 */
const GOTAS: readonly (readonly [number, number, number, number, number])[] = [
  [0.34, 0.44, 1.7, 0, 0],
  [0.47, 0.2, 1.15, 2.6, 0.3],
  [0.57, 0.56, 0.95, 2.1, 0.62],
  [0.64, 0.1, 0.75, 1.8, 0.12],
  [0.28, -0.6, 1.3, 0, 0],
  [0.1, -0.66, 0.85, 2, -1.35],
  [-0.2, -0.62, 1.05, 0, 0],
  [-0.42, -0.7, 0.75, 1.6, -1.95],
  [-0.64, -0.36, 1.25, 0, 0],
  [-0.73, 0.02, 0.85, 1.8, 3.05],
  [0.75, 0.38, 0.65, 1.5, 0.42],
  [0.84, -0.04, 0.55, 0, 0],
  [-0.06, 0.68, 0.95, 1.7, 1.62],
  [0.18, 0.74, 0.6, 0, 0],
  [-0.5, 0.72, 0.7, 0, 0],
]
/** Os pingos que já secaram: meio (frações da meia pegada) e raio (px no tamanho de partida). */
const PINGOS_SECOS: readonly (readonly [number, number, number])[] = [
  [0.42, 0.7, 0.55],
  [0.7, 0.66, 0.45],
  [0.52, -0.42, 0.5],
  [-0.08, -0.84, 0.45],
  [-0.82, -0.62, 0.5],
  [0.9, 0.24, 0.4],
  [-0.86, 0.3, 0.45],
]
/**
 * A gota molhada também tem chanfro e brilho (a gota de sangue é abaulada). A que chegou de lado é uma lágrima:
 * o corpo alongado (fração do raio ao comprido e de través), a cauda afinando até a ponta a partir desta fração
 * do raio e, nas caudas compridas, o pingo satélite além da ponta.
 */
const CHANFRO_DA_GOTA = 0.5
const BRILHO_DA_GOTA = 0.3
const GOTA_AO_COMPRIDO = 1.15
const GOTA_DE_TRAVES = 0.9
const BASE_DA_CAUDA = 0.78
const CAUDA_COM_SATELITE = 1.9
const RAIO_DO_SATELITE = 0.32
const ALEM_DA_PONTA = 0.9

/** O fio do céu refletido em cada lóbulo grande: a fração do raio em que ele fica e o tamanho dele. */
const LOBULOS_COM_REFLEXO = 3
const ALFA_DO_REFLEXO = 0.32

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

function suave01(t: number): number {
  const x = limitar(t, 0, 1)
  return x * x * (3 - 2 * x)
}

/** A forma com a beira ondulada pelo ruído: `amplitude` px para dentro e para fora. */
function ondular(f: Forma, amplitude: number, semente: number): Forma {
  const b = f.b
  return {
    b: [b[0] - amplitude, b[1] - amplitude, b[2] + amplitude, b[3] + amplitude],
    d: (x, y) => f.d(x, y) + ruido(x * ESCALA_DA_ONDA + semente, y * ESCALA_DA_ONDA - semente) * 2 * amplitude,
  }
}

/** Escreve em `s` a mistura de `a` e `b` (t de 0 a 1). */
function pintarMistura(s: Float32Array, a: Rgb, b: Rgb, t: number): void {
  s[0] = a[0] + (b[0] - a[0]) * t
  s[1] = a[1] + (b[1] - a[1]) * t
  s[2] = a[2] + (b[2] - a[2]) * t
}

/** A poça molhada: da beira rala e marrom para o vinho do miolo, com os coágulos mais escuros. */
const texDaPoca: Textura = (_u, _v, x, y, p, s) => {
  const fundo = -p.forma.d(x, y)
  pintarMistura(s, BEIRA_MOLHADA, MIOLO, suave01(fundo / FUNDO_DO_MIOLO))
  s[3] += (ruido(x * 0.3 + p.su, y * 0.3 + p.sv) + ruido(x * 0.9 + p.sv, y * 0.9) * 0.5) * COAGULO
  s[5] = ALFA_DA_BEIRA + (1 - ALFA_DA_BEIRA) * suave01(fundo / FUNDO_OPACO)
}

/** A película seca: rala, em manchas, sumindo no piso numa faixa larga (sem contorno). */
const texDoSeco: Textura = (_u, _v, x, y, p, s) => {
  const fundo = -p.forma.d(x, y)
  const mancha = ruido(x * 0.19 + p.su, y * 0.19 + p.sv) + ruido(x * 0.62 + p.sv, y * 0.62) * 0.5
  pintarMistura(s, SECO, BEIRA_MOLHADA, limitar(0.3 + mancha * 0.5, 0, 1))
  s[3] += mancha * 0.05
  s[5] = ALFA_DO_SECO * suave01(fundo / BORDA_DO_SECO) * limitar(0.8 + mancha * 0.5, 0.35, 1)
}

/**
 * O rastro arrastado: os riscos ao comprido (o pano ou os dedos que arrastaram), cada um com a largura
 * sorteada pelo ruído, mais ralo no fim. As medidas na direção do arrasto saem do começo e do ângulo.
 */
function texDoRastro(x0: number, y0: number, angulo: number, comprimento: number, k: number): Textura {
  const cos = Math.cos(angulo)
  const sen = Math.sin(angulo)
  return (_u, _v, x, y, p, s) => {
    const ao = ((x - x0) * cos + (y - y0) * sen) / comprimento
    const atravessa = (-(x - x0) * sen + (y - y0) * cos) / k
    const risco = 0.5 + 0.5 * Math.sin((atravessa / PASSO_DOS_RISCOS) * Math.PI * 2 + ruido(ao * 4 + p.su, atravessa * 0.35) * 4)
    const fim = 1 - suave01((ao - 0.45) / 0.55)
    pintarMistura(s, SECO, BEIRA_MOLHADA, risco * (0.4 + 0.6 * fim))
    s[5] = ALFA_DO_RASTRO * (FUNDO_DO_RASTRO + (1 - FUNDO_DO_RASTRO) * risco) * (0.25 + 0.75 * fim) * suave01(-p.forma.d(x, y) / 1.6)
  }
}

/**
 * A pegada: a beira da sola marca inteira (é ela que desenha a bota), por dentro as travas de través com o vão
 * mais claro, a marca mais cheia no salto e falhando na ponta.
 */
function texDaPegada(x0: number, y0: number, angulo: number, comprimento: number, k: number): Textura {
  const cos = Math.cos(angulo)
  const sen = Math.sin(angulo)
  return (_u, _v, x, y, p, s) => {
    const ao = ((x - x0) * cos + (y - y0) * sen) / k
    const dentro = -p.forma.d(x, y)
    const trava = Math.sin((ao / PASSO_DAS_TRAVAS) * Math.PI * 2) > LIMIAR_DA_TRAVA ? 1 : VAO_DA_TRAVA
    const marca = dentro < BEIRA_DA_SOLA * k ? 1 : trava * limitar(0.75 + ruido(x * 0.5 + p.su, y * 0.5 + p.sv) * 0.5, 0, 1)
    const cheia = 1 - 0.55 * suave01(ao / (comprimento / k))
    pintarMistura(s, SECO, BEIRA_MOLHADA, cheia)
    s[5] = ALFA_DA_PEGADA * cheia * marca * suave01(dentro / 0.6)
  }
}

/** O contorno de uma sola de bota (salto, cintura e ponta), com o salto em (0, 0) e os dedos para +x. */
function formaDaPegada(comprimento: number, largura: number): Forma {
  const L = comprimento
  const W = largura / 2
  const salto = elipse(L * 0.13, 0, L * 0.15, W * 0.78)
  const sola = poligono([
    [L * 0.36, -W * 0.62],
    [L * 0.58, -W * 0.98],
    [L * 0.8, -W * 0.92],
    [L * 0.95, -W * 0.6],
    [L, -W * 0.05],
    [L * 0.95, W * 0.55],
    [L * 0.8, W * 0.86],
    [L * 0.6, W * 0.9],
    [L * 0.4, W * 0.55],
  ])
  return uniao(salto, sola)
}

/** A forma deslocada para (x0, y0) e girada `angulo` (a pegada desenhada com o salto na origem). */
function posta(f: Forma, x0: number, y0: number, angulo: number): Forma {
  const cos = Math.cos(angulo)
  const sen = Math.sin(angulo)
  const b = f.b
  const cantos: Ponto[] = [
    [b[0], b[1]],
    [b[2], b[1]],
    [b[0], b[3]],
    [b[2], b[3]],
  ].map(([x, y]): Ponto => [x0 + x * cos - y * sen, y0 + x * sen + y * cos])
  const xs = cantos.map(([x]) => x)
  const ys = cantos.map(([, y]) => y)
  return {
    b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    d: (x, y) => {
      const dx = x - x0
      const dy = y - y0
      return f.d(dx * cos + dy * sen, -dx * sen + dy * cos)
    },
  }
}

export const montarSangueNoChao: MontarMovel = (c, cena) => {
  const { hw, hh } = c
  const k = Math.min(c.w / LARGURA_DE_PARTIDA, c.h / FUNDO_DE_PARTIDA)
  const P = c.peca
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_SANGUE

  // 1. A película seca, por baixo de tudo: os lóbulos crescidos, sumindo no piso.
  const pelicula = LOBULOS.map(([fx, fy, rx, ry]) => elipse(fx * hw, fy * hh, rx * hw * CRESCE_A_PELICULA + SOBRA_DA_PELICULA, ry * hh * CRESCE_A_PELICULA + SOBRA_DA_PELICULA)).reduce(uniao)
  L.push(P(ondular(pelicula, ONDA_DA_PELICULA, 7.3), SANGUE, { bisel: 0, contorno: 0, suave: SUAVE_DO_SECO, textura: texDoSeco, semente: 1400 }))

  // 2. O rastro arrastado, saindo da poça (o começo fica debaixo da molhada).
  const [ax, ay] = [RASTRO_DE[0] * hw, RASTRO_DE[1] * hh]
  const [bx, by] = [RASTRO_ATE[0] * hw, RASTRO_ATE[1] * hh]
  const angulo = Math.atan2(by - ay, bx - ax)
  const comprimento = Math.hypot(bx - ax, by - ay)
  const [nx, ny] = [-Math.sin(angulo), Math.cos(angulo)]
  const largo = (LARGURA_DO_RASTRO_NO_COMECO * hh) / 2
  const fino = (LARGURA_DO_RASTRO_NO_FIM * hh) / 2
  const rastro = poligono([
    [ax + nx * largo, ay + ny * largo],
    [bx + nx * fino, by + ny * fino],
    [bx + Math.cos(angulo) * fino, by + Math.sin(angulo) * fino],
    [bx - nx * fino, by - ny * fino],
    [ax - nx * largo, ay - ny * largo],
  ])
  L.push(P(ondular(rastro, ONDA_DA_POCA, 3.1), SANGUE, { bisel: 0, contorno: 0, suave: 1.2, textura: texDoRastro(ax, ay, angulo, comprimento, k), semente: 1401 }))

  // 3. A pegada saindo da poça, para a direita.
  const pegada = posta(formaDaPegada(COMPRIMENTO_DA_PEGADA * k, LARGURA_DA_PEGADA * k), PEGADA[0] * hw, PEGADA[1] * hh, DIRECAO_DA_PEGADA)
  L.push(P(pegada, SANGUE, { bisel: 0, contorno: 0, suave: 0.8, textura: texDaPegada(PEGADA[0] * hw, PEGADA[1] * hh, DIRECAO_DA_PEGADA, COMPRIMENTO_DA_PEGADA * k, k), semente: 1402 }))

  // 4. A poça molhada, com a beira arredondada que pega a luz, e o fio do céu dentro da beira de cima.
  const poca = LOBULOS.map(([fx, fy, rx, ry]) => elipse(fx * hw, fy * hh, rx * hw, ry * hh)).reduce(uniao)
  L.push(P(ondular(poca, ONDA_DA_POCA, 1.9), SANGUE, { bisel: CHANFRO_DA_POCA, contorno: 0, metal: BRILHO_DA_POCA, suave: 0.9, textura: texDaPoca, semente: 1403 }))
  LOBULOS.slice(0, LOBULOS_COM_REFLEXO).forEach(([fx, fy, rx, ry], i) => {
    const forma = elipseGirada(fx * hw - rx * hw * 0.28, fy * hh - ry * hh * 0.5, rx * hw * 0.38, Math.max(0.55, 0.5 * k), -0.28)
    L.push(P(forma, REFLEXO, { bisel: 0, contorno: 0, alfa: ALFA_DO_REFLEXO, suave: 0.7, semente: 1410 + i }))
  })

  // 5. Os respingos: as gotas molhadas, abauladas, e os pingos secos.
  GOTAS.forEach(([fx, fy, r, cauda, direcao], i) => {
    const [gx, gy] = [fx * hw, fy * hh]
    const raio = r * k
    const opcoes = { bisel: Math.min(CHANFRO_DA_GOTA * raio, 1.2), contorno: 0, metal: BRILHO_DA_GOTA, alfa: 0.94, suave: 0.5, semente: 1420 + i }
    if (cauda <= 0) {
      L.push(P(elipse(gx, gy, raio, raio), GOTA, opcoes))
      return
    }
    // A lágrima: o corpo alongado e a cauda afinando até a ponta, para longe da poça.
    const [ux, uy] = [Math.cos(direcao), Math.sin(direcao)]
    const [nx, ny] = [-uy, ux]
    const base = raio * BASE_DA_CAUDA
    const [px, py] = [gx + ux * (raio + cauda * k), gy + uy * (raio + cauda * k)]
    const corpo = elipseGirada(gx, gy, raio * GOTA_AO_COMPRIDO, raio * GOTA_DE_TRAVES, direcao)
    const pontas: Ponto[] = [
      [gx + nx * base, gy + ny * base],
      [px, py],
      [gx - nx * base, gy - ny * base],
    ]
    L.push(P(uniao(corpo, poligono(pontas)), GOTA, opcoes))
    if (cauda >= CAUDA_COM_SATELITE) {
      const longe = raio * ALEM_DA_PONTA
      const satelite = raio * RAIO_DO_SATELITE
      L.push(P(elipse(px + ux * longe, py + uy * longe, satelite, satelite), GOTA, { ...opcoes, bisel: satelite * CHANFRO_DA_GOTA, semente: 1460 + i }))
    }
  })
  PINGOS_SECOS.forEach(([fx, fy, r], i) => {
    L.push(P(elipse(fx * hw, fy * hh, r * k, r * k), PINGO_SECO, { bisel: 0, contorno: 0, alfa: 0.6, suave: 0.6, semente: 1440 + i }))
  })
}
