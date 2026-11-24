/**
 * BRASEIRO DE CHAMA FRIA (lote L06 de 24/11/2026, item 56: versão do `braseiro`, dos mapas 4 e 8; desenho próprio, só
 * a ideia do objeto). A BACIA larga de ferro batido, com a borda chata rebitada, BAIXA sobre o TRIPÉ de pernas
 * abertas (duas para a frente, uma para trás, com o pé de bola). Dentro, no lugar do carvão, o leito de LASCAS DE
 * CRISTAL, e sobre ele a CHAMA FRIA: três LÍNGUAS DE FOGO curvas em S, de ponta inclinada e fina, quase brancas no
 * pé, ciano no meio e transparentes na ponta. De cima a chama é um CLARÃO redondo e macio, de miolo claro, com as
 * lascas em volta. A borda pega a luz fria por dentro; no chão, o claro fica numa elipse chata debaixo da bacia e a
 * sombra dela cai separada, com o contato escuro em cada pé.
 *
 * A chama é PINTADA (parada): a chama animada do fogo de casa é laranja e não serve aqui, então este tipo NÃO entra
 * em `lib/mobilia/fogoDeCasa.ts`. A luz de verdade é a do integrador (`LUZ_DOS_OBJETOS`), fria e sem fumaça.
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): as pernas inclinadas, o bojo redondo da bacia e as
 * línguas de fogo, cada uma em fatias. Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`. Tudo sai do menor lado
 * da pegada (0,8 x 0,8 casa de partida, como o braseiro). Material: `metal` (a bacia e o tripé); as lascas e o fogo
 * são fixos.
 *
 * Revisão do diretor de arte (24/11/2026): a chama era de lâminas retas e se confundia com cristal (de cima, uma
 * flor); as pernas compridas e finas faziam dele um banquinho alto (a bacia baixou para 55% da altura e as pernas
 * abriram); e o claro do chão, somado à sombra, desenhava um cilindro de vidro entre as pernas.
 */
import { hash, limitar01, misturar, type Rgb } from '../../ruido'
import { anel, capsula, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { bordaDaSombra, contato, ruido, texturaDaClasse, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { alturas, novoFatiador, rumoDaSombra, sombraNoAr } from './pilhaDeFatias'
import { disco, lisa, luzDaNormal } from './apoioDasReferencias'
import { banhada, CIANO, CRISTAL, graoNaAltura, LUZ_FRIA, texHaloFrio, tomDoCristal, type FonteFria } from './pedestalComCristal'

/** O braseiro foi medido no tamanho de partida (0,8 casa): as medidas miúdas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = 0.4 * G
const GRAUS = Math.PI / 180
/** A altura da borda, em fração do menor lado: 55% da do braseiro de carvão (0,9), para a bacia ficar baixa. */
const ALTURA_DA_BORDA = 0.5
/** Os raios da bacia, em fração do menor meio lado: a borda por fora e por dentro, os rebites, o leito e o bojo. */
const BORDA_DE_FORA = 0.82
const BORDA_DE_DENTRO = 0.675
const RAIO_DOS_REBITES = 0.748
const REBITES = 14
const RAIO_DO_LEITO = 0.7
const RAIO_DO_BOJO = 0.8
/** A fundura do bojo abaixo da borda (fração do menor meio lado) e o raio do fundo dele (fração do bojo). */
const FUNDURA_DO_BOJO = 0.42
const FUNDO_DO_BOJO = 0.4
/**
 * As pernas ABERTAS: o ângulo de cada uma (90 = a frente), o raio no chão e onde somem debaixo do bojo, a grossura e
 * a bola do pé. Abrem uns 23° da vertical: com a bacia baixa, é um tripé de braseiro, não um banquinho.
 */
const PERNAS: readonly number[] = [30, 150, 270]
const PERNA_NO_CHAO = 0.97
const PERNA_NO_ALTO = 0.6
const GROSSURA_DA_PERNA = 0.1
const RAIO_DA_BOLA = 0.105
/** As lascas do leito: quantas, até onde vão e o tamanho (px de partida). */
const LASCAS = 30
const ALCANCE_DAS_LASCAS = 0.62
const TAMANHO_DA_LASCA = 2.7
const ANGULO_DOURADO = 2.39996
/**
 * As três LÍNGUAS de fogo nascem JUNTAS, no meio do leito (um pé só, largo), e se separam ao subir: a do meio, a
 * mais alta, e uma para cada lado. De cima, por isso, a chama é um clarão redondo de miolo claro, e não três
 * manchas. De cada uma: o pé (x e y, fração do menor meio lado), o raio do pé e a altura (idem), para que lado a
 * ponta inclina (x e y, idem) e a fase do S.
 */
const LINGUAS: readonly (readonly [number, number, number, number, number, number, number])[] = [
  [0.01, -0.06, 0.32, 1.36, 0.14, -0.08, 0.5],
  [-0.15, 0.05, 0.25, 0.92, -0.4, 0.04, 2.3],
  [0.15, 0.06, 0.23, 0.76, 0.38, 0.06, 5.2],
]
const PASSO_DA_CHAMA = 0.6
/**
 * O S: a largura (fração do raio do pé) e quantas ondas dá do pé à ponta. O meio da língua anda em hélice (de lado
 * e, a um terço disso, para a frente e para trás): na 3/4 é o S de lado; de cima, as voltas ficam dentro do clarão.
 */
const LARGURA_DO_S = 0.66
const ONDAS_DO_S = 0.95
/** O clarão da chama no leito (o pé do fogo, nas duas vistas): o raio (fração do menor meio lado) e o alfa no meio. */
const CLARAO = { raio: 0.56, alfa: 0.6 } as const
/** O clarão que só a vista DE CIMA mostra, por cima das línguas: o raio (idem) e o alfa no meio. */
const CLARAO_DE_CIMA = { raio: 0.62, alfa: 0.96 } as const
/** O claro no chão: a elipse CHATA debaixo da bacia (raios em fração do menor meio lado) e o halo largo e fraco em volta. */
const CLARO_NO_CHAO = { rx: 0.74, ry: 0.36, alfa: 0.46 } as const
const HALO_LARGO = { raio: 1.5, alfa: 0.16 } as const
const TOM_DO_FERRO = { bojo: 0.74, borda: 1.02, rebite: 1.34, perna: 0.92, pe: 0.8 } as const
const BRILHO_DO_FERRO = 0.3
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]
/** O miolo da chama: quase branco, um nada azul. */
const MIOLO_DA_CHAMA: Rgb = [0xf2, 0xfb, 0xfb]
const SEMENTE = 5600

const DO_METAL = texturaDaClasse('metal')

/** Uma lasca do leito: um polígono de cinco ou seis pontas de raio sorteado. */
function lasca(cx: number, cy: number, r: number, semente: number): Forma {
  const lados = 5 + (hash(semente, 0, 5601) < 0.5 ? 0 : 1)
  const giro = hash(semente, 1, 5601) * Math.PI * 2
  const pontos: Ponto[] = []
  for (let i = 0; i < lados; i += 1) {
    const a = giro + (i / lados) * Math.PI * 2
    const raio = r * (0.7 + 0.55 * hash(semente, i + 2, 5601))
    pontos.push([cx + Math.cos(a) * raio, cy + Math.sin(a) * raio])
  }
  return poligono(pontos)
}

/** Os rebites numa forma só: uma cabeça redonda de raio `r` em cada ponto. */
function rebites(pontos: readonly Ponto[], r: number): Forma {
  return pontos.map(([x, y]): Forma => disco(x, y, r)).reduce((a, b) => uniao(a, b))
}

export const montarBraseiroDeChamaFria: MontarMovel = (c, cena) => {
  const { peca: P } = c
  const R = Math.min(c.hw, c.hh)
  const k = R / MEIO_LADO_DE_PARTIDA
  const ferro = c.m.metal
  const L = cena.partes
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  cena.corDoPiso = ESCURO_DO_FERRO
  const altura = 2 * R * ALTURA_DA_BORDA
  const [sx, sy] = rumoDaSombra(q)
  const fontes: FonteFria[] = [{ x: 0, y: 0, r: R * 0.72, forca: 0.5 }]

  /** O ferro batido: as covinhas do martelo por cima do metal, com a luz desenhada. */
  const ferroBatido = (luz: (x: number, y: number) => number, z?: number): Textura => {
    const grao = z === undefined ? DO_METAL : graoNaAltura(DO_METAL, z)
    return (u, v, x, y, p, s, escala) => {
      if (grao !== null) grao(u, v, x, y, p, s, escala)
      s[3] += (0.14 - Math.abs(ruido(x * 0.6 + p.su, y * 0.6 + p.sv))) * 0.2 + luz(x, y)
    }
  }

  // ---------- no chão: o halo largo e fraco, a elipse CHATA de luz debaixo da bacia, os pés e as sombras ----------
  const rHalo = R * HALO_LARGO.raio
  L.push(P(elipse(0, 0, rHalo, rHalo), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(0, 0, rHalo, rHalo, HALO_LARGO.alfa), semente: SEMENTE }))
  // A elipse é chata NA TELA: com um quarto de volta, os raios trocam (senão ela ficaria de pé entre as pernas).
  const [crx, cry] = q % 2 === 0 ? [R * CLARO_NO_CHAO.rx, R * CLARO_NO_CHAO.ry] : [R * CLARO_NO_CHAO.ry, R * CLARO_NO_CHAO.rx]
  L.push(P(elipse(0, 0, crx, cry), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, suave: 1.6, textura: (_u, _v, x, y, _p, s) => {
    const d2 = Math.min(1, (x / crx) * (x / crx) + (y / cry) * (y / cry))
    s[0] = LUZ_FRIA[0]
    s[1] = LUZ_FRIA[1]
    s[2] = LUZ_FRIA[2]
    s[4] = 1
    s[5] = CLARO_NO_CHAO.alfa * (1 - 0.6 * d2)
  }, semente: SEMENTE + 5 }))
  const pernas = PERNAS.map((graus) => {
    const [co, si] = [Math.cos(graus * GRAUS), Math.sin(graus * GRAUS)]
    return { pe: [co * PERNA_NO_CHAO * R, si * PERNA_NO_CHAO * R] as const, topo: [co * PERNA_NO_ALTO * R, si * PERNA_NO_ALTO * R] as const, co, si }
  })
  // A sombra da bacia cai SEPARADA do claro (para o lado da sombra); a de cada perna risca o chão do pé até lá.
  cena.sombras.push(sombraNoAr(disco(0, 0, BORDA_DE_FORA * R), altura, q, 0.3, bordaDaSombra({ z: altura })))
  pernas.forEach(({ pe, topo }, i) => {
    cena.sombras.push({ forma: capsula(pe[0], pe[1], topo[0] + sx * altura, topo[1] + sy * altura, GROSSURA_DA_PERNA * R), z: 0, forca: 0.3, suave: 1.1 })
    const bola = elipse(pe[0], pe[1], RAIO_DA_BOLA * R, RAIO_DA_BOLA * R)
    // O contato de cada pé: curto e escuro, é ele que prende o tripé no chão.
    cena.sombras.push(contato(elipse(pe[0] + sx * 1.2, pe[1] + sy * 1.2, RAIO_DA_BOLA * R * 1.5, RAIO_DA_BOLA * R * 1.2), 0.42))
    L.push(P(bola, ferro, { tabua: 0, bisel: RAIO_DA_BOLA * R * 0.9, tom: TOM_DO_FERRO.pe, metal: BRILHO_DO_FERRO, contorno: 0.28, semente: SEMENTE + 1 + i }))
  })

  // ---------- as PERNAS abertas, do pé até sumirem debaixo do bojo ----------
  const zDaPerna = altura - FUNDURA_DO_BOJO * R * 0.4
  pernas.forEach(({ pe, topo }, i) => {
    for (const z of alturas(0.6, zDaPerna, 0.9)) {
      const t = z / zDaPerna
      const [x, y] = [pe[0] + (topo[0] - pe[0]) * t, pe[1] + (topo[1] - pe[1]) * t]
      // O nó forjado a meia altura: a perna engrossa num anel curto.
      const r = GROSSURA_DA_PERNA * R * (Math.abs(t - 0.5) < 0.06 ? 1.45 : 1)
      const redonda = ferroBatido((px, py) => {
        const a = Math.atan2(py - y, px - x)
        return luzDaNormal(Math.cos(a), Math.sin(a), 0, q) * 1.5
      }, z)
      f.fatia(0, z, disco(x, y, r), ferro, lisa(TOM_DO_FERRO.perna, redonda, SEMENTE + 10 + i))
    }
  })

  // ---------- o BOJO da bacia: redondo por baixo, do fundo até a borda ----------
  const zFundo = altura - FUNDURA_DO_BOJO * R
  // O bojo acaba ABAIXO do leito: de cima, o que se vê dentro da borda são as lascas, e não o ferro.
  for (const z of alturas(zFundo, altura - 2 * k, 0.8)) {
    const t = (z - zFundo) / (altura - zFundo)
    const r = RAIO_DO_BOJO * R * (FUNDO_DO_BOJO + (1 - FUNDO_DO_BOJO) * Math.sqrt(1 - (1 - t) * (1 - t)))
    const barriga = ferroBatido((x, y) => {
      const a = Math.atan2(y, x)
      return luzDaNormal(Math.cos(a), Math.sin(a), -0.8 * (1 - t), q) * 1.6 - 0.1 * (1 - t)
    }, z)
    f.fatia(0, z, disco(0, 0, r), ferro, lisa(TOM_DO_FERRO.bojo, barriga, SEMENTE + 20))
  }

  // ---------- a boca: o leito, as lascas de cristal e a borda rebitada ----------
  const rLeito = RAIO_DO_LEITO * R
  const leito: Textura = (_u, _v, x, y, _p, s) => {
    const d = Math.hypot(x, y) / rLeito
    const cor = tomDoCristal(0.34 * (1 - d) + 0.24 * ruido(x * 0.42 + 3, y * 0.42 + 7))
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = 0.7
  }
  f.fatia(0, altura - 1.4 * k, disco(0, 0, rLeito), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, recesso: { k: 2.4 * k, forca: 0.44 }, textura: leito, semente: SEMENTE + 30 })
  for (let i = 0; i < LASCAS; i += 1) {
    const a = i * ANGULO_DOURADO + (hash(i, 1, SEMENTE) - 0.5) * 0.5
    const d = Math.sqrt((i + 0.5) / LASCAS) * ALCANCE_DAS_LASCAS
    const [x, y] = [Math.cos(a) * d * R, Math.sin(a) * d * R]
    const r = TAMANHO_DA_LASCA * k * (0.8 + 0.5 * hash(i, 2, SEMENTE))
    // As do miolo ardem (claras); as da beira são cristal frio, com uma face clara e outra escura.
    const quente = 1 - limitar01(d / ALCANCE_DAS_LASCAS)
    const corte = hash(i, 3, SEMENTE) * Math.PI
    const [nx, ny] = [Math.cos(corte), Math.sin(corte)]
    const face: Textura = (_u, _v, px, py, _p, s) => {
      const lado = (px - x) * nx + (py - y) * ny > 0 ? 0.26 : -0.2
      const cor = tomDoCristal(0.3 + 0.5 * quente + lado)
      s[0] = cor[0]
      s[1] = cor[1]
      s[2] = cor[2]
      s[4] = 0.4 + 0.4 * quente
    }
    f.fatia(1, altura - 1 * k + 1.2 * k * quente, lasca(x, y, r, SEMENTE + 40 + i), CRISTAL, { tabua: 0, bisel: 0, contorno: 0.2, textura: face, semente: SEMENTE + 40 + i })
  }
  const borda = anel(0, 0, BORDA_DE_FORA * R, BORDA_DE_FORA * R, BORDA_DE_DENTRO * R, BORDA_DE_DENTRO * R)
  // A borda escurece para dentro (a fuligem de antes) e pega a luz fria na beira de dentro.
  const naBorda = banhada(ferroBatido((x, y) => -0.2 * limitar01((BORDA_DE_FORA - Math.hypot(x, y) / R) / (BORDA_DE_FORA - BORDA_DE_DENTRO))), fontes)
  f.fatia(2, altura, borda, ferro, { tabua: 0, bisel: 1.3 * k, tom: TOM_DO_FERRO.borda, metal: BRILHO_DO_FERRO, contorno: 0.3, textura: naBorda, semente: SEMENTE + 80 })
  const roda: Ponto[] = []
  for (let i = 0; i < REBITES; i += 1) {
    const a = ((i + 0.5) / REBITES) * Math.PI * 2
    roda.push([Math.cos(a) * RAIO_DOS_REBITES * R, Math.sin(a) * RAIO_DOS_REBITES * R])
  }
  f.fatia(3, altura + 0.2, rebites(roda, 1.05 * k), ferro, { tabua: 0, bisel: 1.05 * k, tom: TOM_DO_FERRO.rebite, metal: 0.55, contorno: 0.2, semente: SEMENTE + 81 })

  // ---------- o CLARÃO da chama no leito: o pé do fogo, macio, por baixo das línguas ----------
  const clarao = (raio: number, alfa: number, cheio: number): Textura => (_u, _v, x, y, _p, s) => {
    const d2 = Math.min(1, (x * x + y * y) / (raio * raio))
    const cor = misturar(CIANO.claro, MIOLO_DA_CHAMA, (1 - d2) * (1 - d2))
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = 1
    // `cheio` segura o alfa do meio para fora antes de ele cair: o clarão de cima é um disco macio, não um ponto.
    s[5] = alfa * (1 - Math.pow(d2, cheio))
  }
  const rClarao = CLARAO.raio * R
  f.fatia(3, altura + 0.3, disco(0, 0, rClarao), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: clarao(rClarao, CLARAO.alfa, 1), semente: SEMENTE + 99 })
  // O clarão DE CIMA: redondo, de miolo claro, com as lascas em volta. De cima as línguas, que abrem para os lados,
  // desenhariam uma nuvem; este disco as cobre. Na 3/4 ele fica escondido dentro do bojo, por baixo do leito.
  const rDeCima = CLARAO_DE_CIMA.raio * R
  const deCima = clarao(rDeCima, CLARAO_DE_CIMA.alfa, 1.6)
  f.fatia(0, altura - 2.4 * k, disco(0, 0, rDeCima), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: deCima, semente: SEMENTE + 98 })

  // ---------- a CHAMA FRIA: três línguas curvas em S, em fatias ----------
  LINGUAS.forEach(([fx, fy, fr, fh, inclinaX, inclinaY, fase], i) => {
    const alto = fh * R
    const r0 = fr * R
    for (const h of alturas(0, alto, PASSO_DA_CHAMA)) {
      const t = h / alto
      // A língua engorda logo acima do pé e afina até a ponta fina.
      const r = r0 * (0.7 + 0.42 * Math.sin(Math.min(1, t * 3.2) * Math.PI * 0.5)) * Math.pow(1 - t, 0.82)
      if (r < 0.3) continue
      // O S: o meio da língua vai e volta de lado ao subir, cada vez mais largo, e a ponta inclina para um lado.
      const volta = t * ONDAS_DO_S * Math.PI * 2 + fase
      const largo = r0 * LARGURA_DO_S * Math.pow(t, 0.8)
      const x = fx * R + (Math.sin(volta) - Math.sin(fase)) * largo + inclinaX * R * t * t
      const y = fy * R + (Math.cos(volta) - Math.cos(fase)) * largo * 0.34 + inclinaY * R * t * t
      // Quase branco no pé, ciano no meio, transparente na ponta; e o MIOLO da língua mais claro que a beira dela em
      // toda a altura (de cima, é o miolo que aparece: o clarão fica claro no meio, e não um anel).
      const doAlto = tomDoCristal(0.96 - 0.64 * t)
      const branco = 0.2 + 0.78 * Math.pow(1 - t, 1.8)
      const alfa = 0.96 * (1 - Math.pow(t, 1.5))
      const fogo: Textura = (_u, _v, px, py, _p, s) => {
        const [dx, dy] = [(px - x) / r, (py - y) / r]
        const d2 = limitar01(dx * dx + dy * dy)
        const miolo = 1 - limitar01(dx * dx + 0.45 * dy * dy)
        const w = branco * miolo * Math.sqrt(miolo)
        s[0] = doAlto[0] + (MIOLO_DA_CHAMA[0] - doAlto[0]) * w
        s[1] = doAlto[1] + (MIOLO_DA_CHAMA[1] - doAlto[1]) * w
        s[2] = doAlto[2] + (MIOLO_DA_CHAMA[2] - doAlto[2]) * w
        s[4] = 1
        // A beira some no ar: as fatias fundem numa chama só, sem degraus.
        s[5] = Math.min(1, alfa * (1 - d2) * (1.6 - 0.6 * d2))
      }
      f.fatia(4 + i, altura + 0.7 * k + h, disco(x, y, r), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, suave: 0.6, textura: fogo, semente: SEMENTE + 90 + i })
    }
  })
  f.fechar()
  // O clarão de cima passa para o FIM da lista (a vista de cima pinta a lista na ordem, e a pilha a deixa pela
  // altura). Na 3/4 nada muda: lá quem dá a altura e a ordem é a âncora de cada fatia, e a dele fica dentro do bojo.
  const doClarao = cena.partes.findIndex((p) => p.tex === deCima)
  if (doClarao >= 0) cena.partes.push(...cena.partes.splice(doClarao, 1))
}
