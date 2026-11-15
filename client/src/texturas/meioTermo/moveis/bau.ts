/**
 * BAÚ de cima com volume (`objetos.js:997-1063`). De Frente: a tampa em arco
 * com duas cintas, os rebites, as cantoneiras e o fecho com o buraco da
 * fechadura. De Lado: o corpo, a tampa em arco com a cinta de ferro e a alça.
 * Materiais: `madeira` e `ferragens`.
 *
 * NA 3/4 A FRENTE É DESENHADA (15/11/2026, "o 3/4 do baú é estranho"): antes a
 * tampa subia inteira e a frente era a madeira lisa que a 3/4 varre, do mesmo
 * tamanho que a tampa, com o fecho na beira de cima. Agora a frente mostra a
 * TAMPA (a faixa de cima, de tábuas deitadas) e o CORPO, separados pela fresta
 * com a sombra da tampa; as duas CINTAS descem do tampo até o chão, partidas na
 * fresta, com os rebites; as cantoneiras fecham os quatro cantos. É a frente em
 * faixas do guarda-roupa (`guardaRoupa.ts`), toda guardada debaixo da tampa na
 * vista de cima. O FECHO é uma peça só com a fresta dele, como o puxador do
 * guarda-roupa: de cima fica na beira da frente, como sempre foi; na 3/4 desce
 * pela frente e fica pendurado da tampa sobre o corpo, com a fechadura. Com o
 * baú girado a frente dele fica de lado ou atrás, e o fecho sobe com a tampa,
 * na beira dela, como antes. A face que o giro põe embaixo na tela também é
 * desenhada (`guardarFaceGirada`), no lugar da madeira lisa que a 3/4 varria: a
 * LATERAL com a tampa e o corpo, uma cinta de pé no meio com a alça presa nela
 * e as cantoneiras; as COSTAS como a frente sem o fecho, com as dobradiças nas
 * cintas, na fresta da tampa.
 */
import { anel, caixa, capsula, dentroDe, elipse, poligono, uniao, type Forma } from './formas'
import { contato, texturaDaClasse, type Cena, type CurvaY, type Peca, type Textura } from './motor'
import { BURACO, sombraDeLado, type ContextoDoMovel, type MontarMovel } from './contexto'
import { CANTONEIRA, FRESTA, SOMBRA_DA_MADEIRA, fatiar, guardarFaceGirada, naFaixa, type PecaDaFrente } from './guardaRoupa'
import { comMeioEm, quartosDeVolta } from './varalDeBandeirinhas'

/** Altura do baú de lado, em px do protótipo (a sombra). */
const ALTURA_DE_LADO = 12
/** Altura do baú de frente, em casas (a sombra; na 3/4, a frente). */
const ALTURA = 0.55

function montarBauDeLado(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, h, peca: P } = c
  const mad = c.m.madeira
  const fer = c.m.ferragens
  const costura = -hh + h * 0.4
  const raio = costura + hh
  const corpo = caixa(-hw, costura, hw, hh, 0.6)
  const arco = dentroDe(elipse(0, costura, hw, raio), caixa(-hw, -hh - 1, hw, costura + 0.5))
  sombraDeLado(cena, uniao(corpo, arco), ALTURA_DE_LADO)
  const L = cena.partes
  L.push(P(corpo, mad, { tabua: (hh - costura) / 3, bisel: 0.9, semente: 8 }))
  L.push(P(arco, mad, { tabua: raio / 2, bisel: 1, semente: 9 }))
  L.push(P(dentroDe(anel(0, costura, hw, raio, hw - 2.4, raio - 2.4), caixa(-hw, -hh - 1, hw, costura)), fer, { bisel: 0.8, contorno: 0.25 }))
  L.push(P(caixa(-hw, costura - 0.4, hw, costura + 1.6, 0.3), fer, { bisel: 0.6, tom: 0.92 }))
  const ya = costura + (hh - costura) * 0.5
  L.push(P(caixa(-3.4, ya - 3.4, 3.4, ya - 1.6, 0.5), fer, { bisel: 0.6 }))
  L.push(P(anel(0, ya + 0.2, 3.1, 3.1, 1.9, 1.9), fer, { bisel: 0.6, projeta: { dist: 0.8, forca: 0.3 } }))
  for (const sx of [-1, 1]) {
    const xa = sx * hw
    L.push(P(poligono([[xa, hh], [xa - sx * 5, hh], [xa, hh - 5]]), fer, { bisel: 0.6 }))
  }
}

/** A tampa vista de cima: tábuas em arco, as duas cintas com rebites e as quatro cantoneiras. */
function tampa(c: ContextoDoMovel, cena: Cena, arco: CurvaY): void {
  const { hw, hh, w, h, peca: P } = c
  const mad = c.m.madeira
  const fer = c.m.ferragens
  const L = cena.partes
  L.push(P(caixa(-hw, -hh, hw, hh, 2), mad, { tabua: h / 4, bisel: 1.2, curvaY: arco, semente: 2 }))
  for (const sx of [-1, 1]) {
    const xc = sx * 0.3 * w
    L.push(P(caixa(xc - 0.045 * w, -hh, xc + 0.045 * w, hh, 0.5), fer, { bisel: 0.8, curvaY: arco, projeta: { dist: 0.8, forca: 0.25, suave: 0.7 }, semente: 3 + sx }))
    for (const fy of [-0.32, 0, 0.32]) L.push(P(elipse(xc, fy * h, 0.9, 0.9), fer, { bisel: 0.9, contorno: 0.1, tom: 0.9 }))
  }
  const cw = 0.13 * w
  const ch = 0.2 * h
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const xa = sx * hw
    const ya = sy * hh
    L.push(P(poligono([[xa, ya], [xa - sx * cw, ya], [xa, ya - sy * ch]]), fer, { bisel: 0.7, curvaY: arco, contorno: 0.2 }))
  }
}

// ---------- a frente na 3/4, desenhada de frente ----------

/** Onde a tampa encontra o corpo, em fração da altura a partir do chão (a tampa é o terço de cima). */
const COSTURA = 0.64
/**
 * Os tons da madeira vista de frente: o corpo na sombra da tampa e a frente da tampa, no tom em que o ombro da tampa
 * chega à junta (`OMBRO`): a tampa fechada é uma peça só, do tampo até a fresta (15/11/2026; antes 0,9, mais clara
 * que a beira do tampo, e a quina lia como dobra para dentro).
 */
const TOM_DO_CORPO = 0.8
const TOM_DA_TAMPA = 0.8
/** As cintas (o meio, em fração da largura, e a meia largura) e as alturas dos rebites (frações da altura). */
const CINTA = { meio: 0.3, meiaLargura: 0.045 } as const
const REBITES_DA_FRENTE: readonly number[] = [0.82, 0.46, 0.14]
/** As cantoneiras da frente: o braço deitado (fração da largura) e o de pé (fração da altura). */
const CANTONEIRA_DA_FRENTE = { deitada: 0.13, dePe: 0.22 } as const
/**
 * O fecho: a meia largura (fração da largura), a parte da profundidade que ele ocupa de cima, onde fica a fechadura
 * (fração do fecho a partir da beira) e quanto passa da beira (px). O fundo tem teto em fração da altura do corpo:
 * no baú fundo demais o fecho, pendurado na 3/4, passaria do chão.
 */
const FECHO = { meiaLargura: 0.065, fundo: 0.26, fechadura: 0.46, alem: 0.6, tetoNoCorpo: 0.6 } as const
/**
 * Na 3/4, o alto do fecho fica este tanto acima da fresta da tampa (px): ele pende da tampa e passa a junta até o
 * corpo, uns 45% dele na tampa (15/11/2026: com 3 px o fecho lia como chapa do corpo, e a tampa como aberta).
 */
const FECHO_SOBRE_A_TAMPA = 4.2

/**
 * A junta da tampa FECHADA (15/11/2026, "ele parece está aberto"): a tampa desce até quase a junta e a fresta é um
 * fio, com a sombra curta da tampa no alto do corpo; o corpo começa debaixo da tampa, para a quina de cima dele não
 * acender um friso claro na junta (o friso lia como a borda da caixa aberta). Em px do protótipo, a partir da junta.
 */
const JUNTA = { tampaAte: 0.3, frestaAcima: 0.45, frestaAbaixo: 0.2, alfaDaFresta: 0.8, corpoDebaixoDaTampa: 2, sombra: 1.8, alfaDaSombra: 0.3 } as const

/**
 * A BEIRA GUARDADA de cada lado da face (px do protótipo). De cima, a face guardada debaixo da tampa aparece um fio
 * pela borda dela: no pixel da borda a tampa cobre só uma parte e o que está embaixo entra na mistura. Para a vista
 * de cima não mudar um byte com o baú fechado (15/11/2026), essa faixa fica com o desenho de antes (`beiraDeAntes`) e
 * o desenho novo vale do lado de dentro. A faixa é o meio pixel da imagem do serrilhado (a tampa cobre o pixel
 * inteiro a partir de meio pixel para dentro da borda) e um fio de folga: `MEIO_PIXEL` dividido pelos pixels por px
 * do protótipo, 0,58 px no nível 1 e 0,19 px no 3. Na 3/4 a cantoneira de pé da frente (`CANTONEIRA`, meio px) passa
 * por cima dela.
 */
const MEIO_PIXEL = 0.52
/** A peça da beira não existe daqui para dentro da face (px do protótipo a partir da borda): o pintor nem acende o pixel. */
const LONGE_DA_BEIRA = 2
const FORA_DA_BEIRA = 1e3

/** Se o ponto `x` da face de meia largura `hw` cai na beira guardada, com `escala` pixels por px do protótipo. */
function naBeiraGuardada(x: number, hw: number, escala: number): boolean {
  return Math.abs(x) > hw - MEIO_PIXEL / escala
}

/** A peça só onde `vale(x, escala)`, com x da face: no resto a textura apaga o pixel. */
function soOnde(peca: PecaDaFrente, vale: (x: number, escala: number) => boolean): PecaDaFrente {
  const doMaterial = peca.o.textura ?? texturaDaClasse(peca.mat.classe)
  const textura: Textura = (u, v, x, y, p, s, escala) => {
    if (!vale(x, escala)) {
      s[5] = 0
      return
    }
    if (doMaterial !== null) doMaterial(u, v, x, y, p, s, escala)
  }
  return { ...peca, o: { ...peca.o, textura } }
}

/** A peça só na beira guardada da face de meia largura `hw`, igual a antes ali (a forma, o chanfro e o veio). */
function soNaBeira(peca: PecaDaFrente, hw: number): PecaDaFrente {
  const f = peca.forma
  const longe = hw - LONGE_DA_BEIRA
  const forma: Forma = { b: f.b, d: (x, y) => (Math.abs(x) < longe ? FORA_DA_BEIRA : f.d(x, y)) }
  return soOnde({ ...peca, forma }, (x, escala) => naBeiraGuardada(x, hw, escala))
}

/**
 * O desenho de antes de 15/11/2026 do que chega à beira da face, na ordem de antes: o corpo, a sombra da tampa, a
 * frente da tampa, a fresta e as cantoneiras de cima e de baixo. As cintas, os rebites, a alça e as dobradiças não
 * chegam lá.
 */
function beiraDeAntes(c: ContextoDoMovel, H: number, hw: number): PecaDaFrente[] {
  const mad = c.m.madeira
  const fer = c.m.ferragens
  const yc = -H * COSTURA
  const cw = CANTONEIRA_DA_FRENTE.deitada * c.w
  const ch = CANTONEIRA_DA_FRENTE.dePe * H
  const pecas: PecaDaFrente[] = [
    { forma: caixa(-hw, yc, hw, 0, 0.8), mat: mad, o: { eixo: 0, tabua: (H * COSTURA) / 3, bisel: 0.9, tom: TOM_DO_CORPO, semente: 960 } },
    { forma: caixa(-hw + 0.6, yc, hw - 0.6, yc + 3, 0), mat: SOMBRA_DA_MADEIRA, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 1.4, semente: 961 } },
    { forma: caixa(-hw, -H, hw, yc - 0.5, 1.2), mat: mad, o: { eixo: 0, tabua: (H * (1 - COSTURA)) / 2, bisel: 1.1, tom: 0.9, semente: 962 } },
    { forma: caixa(-hw + 0.3, yc - 0.7, hw - 0.3, yc + 0.3), mat: BURACO, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.85, semente: 963 } },
  ]
  for (const sx of [-1, 1]) {
    const xa = sx * hw
    pecas.push({ forma: poligono([[xa, -H], [xa - sx * cw, -H], [xa, -H + ch]]), mat: fer, o: { bisel: 0.7, contorno: 0.2 } })
    pecas.push({ forma: poligono([[xa, 0], [xa - sx * cw, 0], [xa, -ch]]), mat: fer, o: { bisel: 0.7, contorno: 0.2 } })
  }
  return pecas.map((p) => soNaBeira(p, hw))
}

/** A face inteira de meia largura `hw`: a beira de antes e, do lado de dentro, o desenho novo. */
function comABeiraDeAntes(c: ContextoDoMovel, H: number, hw: number, novas: readonly PecaDaFrente[]): PecaDaFrente[] {
  return [...beiraDeAntes(c, H, hw), ...novas.map((p) => soOnde(p, (x, escala) => !naBeiraGuardada(x, hw, escala)))]
}

/** A madeira de uma face de meia largura `hw` (x de -hw a hw): o corpo de tábuas deitadas com a sombra da tampa no alto, a tampa e a fresta entre os dois. */
function madeiraDaFace(c: ContextoDoMovel, H: number, hw: number): PecaDaFrente[] {
  const mad = c.m.madeira
  const yc = -H * COSTURA
  return [
    { forma: caixa(-hw, yc - JUNTA.corpoDebaixoDaTampa, hw, 0, 0.8), mat: mad, o: { eixo: 0, tabua: (H * COSTURA) / 3, bisel: 0.9, tom: TOM_DO_CORPO, semente: 960 } },
    { forma: caixa(-hw + 0.6, yc, hw - 0.6, yc + JUNTA.sombra, 0), mat: SOMBRA_DA_MADEIRA, o: { tabua: 0, bisel: 0, contorno: 0, alfa: JUNTA.alfaDaSombra, suave: 1.2, semente: 961 } },
    { forma: caixa(-hw, -H, hw, yc - JUNTA.tampaAte, 1.2), mat: mad, o: { eixo: 0, tabua: (H * (1 - COSTURA)) / 2, bisel: 1.1, tom: TOM_DA_TAMPA, semente: 962 } },
    { forma: caixa(-hw + 0.3, yc - JUNTA.frestaAcima, hw - 0.3, yc + JUNTA.frestaAbaixo), mat: BURACO, o: { tabua: 0, bisel: 0, contorno: 0, alfa: JUNTA.alfaDaFresta, semente: 963 } },
  ]
}

/**
 * As cantoneiras de uma face de meia largura `hw`: só as de baixo, no pé do corpo. As de cima da tampa saíram
 * (15/11/2026): coladas nas da beira do tampo, as duas pontas formavam uma seta na quina e liam como a dobradiça da
 * tampa levantada.
 */
function cantoneirasDaFace(c: ContextoDoMovel, H: number, hw: number): PecaDaFrente[] {
  const fer = c.m.ferragens
  const cw = CANTONEIRA_DA_FRENTE.deitada * c.w
  const ch = CANTONEIRA_DA_FRENTE.dePe * H
  return [-1, 1].map((sx): PecaDaFrente => {
    const xa = sx * hw
    return { forma: poligono([[xa, 0], [xa - sx * cw, 0], [xa, -ch]]), mat: fer, o: { bisel: 0.7, contorno: 0.2 } }
  })
}

/** A cinta passa a junta com um fio de folga só (px do protótipo, acima e abaixo da junta): a tampa fechada em cima do corpo. */
const FOLGA_DA_CINTA = { acima: 0.35, abaixo: 0.25 } as const

/** Uma cinta de pé em `xc`, do tampo até o chão, partida no fio da junta, com os rebites nas alturas `rebites`. */
function cintaDePe(c: ContextoDoMovel, H: number, xc: number, rebites: readonly number[]): PecaDaFrente[] {
  const fer = c.m.ferragens
  const yc = -H * COSTURA
  const m = CINTA.meiaLargura * c.w
  return [
    { forma: caixa(xc - m, -H, xc + m, yc - FOLGA_DA_CINTA.acima, 0.4), mat: fer, o: { bisel: 0.8, contorno: 0.22, semente: 964 } },
    { forma: caixa(xc - m, yc + FOLGA_DA_CINTA.abaixo, xc + m, 0, 0.4), mat: fer, o: { bisel: 0.8, contorno: 0.22, tom: 0.92, semente: 965 } },
    ...rebites.map((f): PecaDaFrente => ({ forma: elipse(xc, -H * f, 0.9, 0.9), mat: fer, o: { bisel: 0.9, contorno: 0.1, tom: 0.9 } })),
  ]
}

/** O desenho da frente (x como na pegada, y = 0 no chão e negativo para cima): a madeira, as duas cintas e as cantoneiras. */
function desenhoDaFrente(c: ContextoDoMovel, H: number): PecaDaFrente[] {
  const pecas = madeiraDaFace(c, H, c.hw)
  for (const sx of [-1, 1]) pecas.push(...cintaDePe(c, H, sx * CINTA.meio * c.w, REBITES_DA_FRENTE))
  pecas.push(...cantoneirasDaFace(c, H, c.hw))
  return pecas
}

/** A frente inteira, de frente, com a beira de antes. */
function desenharFrente(c: ContextoDoMovel, H: number): PecaDaFrente[] {
  return comABeiraDeAntes(c, H, c.hw, desenhoDaFrente(c, H))
}

/**
 * A alça de cada lado, a do baú de Lado (`montarBauDeLado`): a chapa presa na cinta e a argola pendurada dela, na
 * metade do corpo, com a sombra da argola na madeira (px).
 */
const ALCA = { meiaChapa: 3.4, alto: 3.4, pe: 1.6, raio: 3.1, furo: 1.9, desce: 0.2, sombra: { dx: 0.7, dy: 0.9, alfa: 0.32 } } as const
/** Na lateral os rebites ficam na tampa e no pé: o do meio cairia na chapa da alça. */
const REBITES_DA_LATERAL: readonly number[] = [0.82, 0.14]

/** A LATERAL (o baú girado um quarto de volta), de frente: a madeira, uma cinta de pé no meio com a alça presa nela e as cantoneiras. */
function desenharLateral(c: ContextoDoMovel, H: number, hw: number): PecaDaFrente[] {
  const fer = c.m.ferragens
  const pecas = madeiraDaFace(c, H, hw)
  pecas.push(...cintaDePe(c, H, 0, REBITES_DA_LATERAL))
  const ya = (-H * COSTURA) / 2
  const argola = (dx: number, dy: number): Forma => anel(dx, ya + ALCA.desce + dy, ALCA.raio, ALCA.raio, ALCA.furo, ALCA.furo)
  pecas.push(
    { forma: argola(ALCA.sombra.dx, ALCA.sombra.dy), mat: SOMBRA_DA_MADEIRA, o: { tabua: 0, bisel: 0, contorno: 0, alfa: ALCA.sombra.alfa, suave: 0.9, semente: 966 } },
    { forma: caixa(-ALCA.meiaChapa, ya - ALCA.alto, ALCA.meiaChapa, ya - ALCA.pe, 0.5), mat: fer, o: { bisel: 0.6, contorno: 0.2, semente: 967 } },
    { forma: argola(0, 0), mat: fer, o: { bisel: 0.6, contorno: 0.2, tom: 1.04, semente: 968 } },
  )
  pecas.push(...cantoneirasDaFace(c, H, hw))
  return comABeiraDeAntes(c, H, hw, pecas)
}

/** A dobradiça das costas: o canudo deitado na fresta da tampa, um pouco mais largo que a cinta (px). */
const DOBRADICA = { sobra: 0.9, raio: 1.05 } as const

/** As COSTAS (meia volta), de frente: a frente sem o fecho (que é peça à parte) e as dobradiças nas cintas. */
function desenharCostas(c: ContextoDoMovel, H: number): PecaDaFrente[] {
  const pecas = desenhoDaFrente(c, H)
  const yc = -H * COSTURA
  const m = CINTA.meiaLargura * c.w + DOBRADICA.sobra
  for (const sx of [-1, 1]) {
    const xc = sx * CINTA.meio * c.w
    pecas.push({ forma: capsula(xc - m, yc, xc + m, yc, DOBRADICA.raio), mat: c.m.ferragens, o: { eixo: 0, tabua: 0, bisel: DOBRADICA.raio * 0.9, contorno: 0.24, tom: 0.96, semente: 969 } })
  }
  return comABeiraDeAntes(c, H, c.hw, pecas)
}

/**
 * A frente toda guardada debaixo da tampa (sem faixa de cima: de cima o baú é a tampa, como sempre foi): o corpo
 * até a frente, as cantoneiras, as frestas das faixas e a do fecho na beira, e as cópias da frente, que vêm antes da
 * tampa na lista para ela as cobrir de cima.
 */
function guardarAFrente(c: ContextoDoMovel, cena: Cena, H: number, altoDoFecho: number): void {
  const { hw, hh, h } = c
  const { faixas, frente } = fatiar(H, 0, 0, h, hh)
  cena.sombras.push({ forma: caixa(-hw, -hh, hw, frente, 2), z: H })
  for (const xa of [-hw, hw - CANTONEIRA]) cena.sombras.push({ forma: caixa(xa, frente, xa + CANTONEIRA, hh), z: H })
  for (const fx of faixas) {
    if (fx.topo > fx.pe) cena.sombras.push({ forma: caixa(-hw + CANTONEIRA, fx.base, hw - CANTONEIRA, fx.base + FRESTA), z: fx.z, solta: true, forca: 0 })
  }
  const zDoFecho = altoDoFecho - (frente - H * COSTURA - FECHO_SOBRE_A_TAMPA)
  cena.sombras.push({ forma: caixa(-0.15, hh - FRESTA, 0.15, hh), z: zDoFecho, solta: true, forca: 0 })
  const desenho = desenharFrente(c, H)
  for (const fx of faixas) {
    for (const peca of desenho) {
      const copia = naFaixa(c.peca, peca, fx)
      if (copia !== null) cena.partes.push(copia)
    }
  }
}

// ---------- o ombro da tampa na 3/4 ----------

/** A força do arco da tampa vista de cima: a normal inclina pela distância ao meio da profundidade. */
const FORCA_DO_ARCO = 0.55

/**
 * O OMBRO DA TAMPA na 3/4 (15/11/2026, "ele parece está aberto"). De cima, a tampa em arco escurece até quase o
 * preto na beira da frente (a curva cai longe da luz); na 3/4 essa beira escura ficava logo acima da frente da
 * tampa, mais clara, e a quina lia como uma dobra para dentro: a tampa em pé atrás da caixa aberta. Na 3/4, a faixa
 * de baixo do tampo, de `comeco` da meia profundidade até a junta com a frente, é pintada de novo com a MESMA tampa
 * (o mesmo veio, as cintas, os rebites e as cantoneiras), num arco mais aberto que desce sem degrau da luz do tampo
 * até a da frente da tampa (`normalNaJunta`: a luz do `TOM_DA_TAMPA`): a quina vira o ombro arredondado de uma
 * tampa fechada. De cima a faixa fica guardada debaixo da tampa (as peças vêm antes dela na lista), fora da beira
 * guardada (`naBeiraGuardada`); a fresta dela é a da faixa de cima da frente, que no baú fica vazia. Só sem giro e na meia
 * volta: girado um quarto, o arco corre de lado na tela e a beira de baixo do tampo não escurece.
 */
const OMBRO = { comeco: 0.4, normalNaJunta: 0.27 } as const
/** O arco do ombro é quase reto: o raio fica este tanto de vezes a maior distância ao centro dele. */
const RAIO_DO_OMBRO = 10

/** A inclinação da normal no arco (`curvaY` do motor) a `q` raios do centro. */
function inclinacaoNoArco(q: number): number {
  return q / Math.sqrt(1 - q * q)
}

/** O arco do ombro NA TELA: a normal vale `v` em `y0` (a do tampo ali, sem degrau) e chega a `n` em `y1`, quase em linha reta. */
function arcoDoOmbro(y0: number, v: number, y1: number, n: number): CurvaY {
  const c = (v * y1 - n * y0) / (v - n)
  const r = RAIO_DO_OMBRO * Math.max(Math.abs(y0 - c), Math.abs(y1 - c))
  return { c, r, forca: v / inclinacaoNoArco((y0 - c) / r) }
}

/**
 * Guarda o ombro da tampa, sem giro ou na meia volta (`quartos` 0 ou 2): a fresta da faixa de cima da frente, que
 * leva o ombro à altura do baú, e as peças da tampa no arco do ombro, só na faixa dele, com a caixa de pintura no meio
 * da fresta. Na meia volta a faixa fica na beira de trás da tampa e o centro do arco troca de lado.
 */
function guardarOOmbro(c: ContextoDoMovel, cena: Cena, H: number, quartos: number): void {
  const { hw, hh, h } = c
  const { frente } = fatiar(H, 0, 0, h, hh)
  const comeco = OMBRO.comeco * hh
  const arco = arcoDoOmbro(comeco, FORCA_DO_ARCO * inclinacaoNoArco(OMBRO.comeco), frente, OMBRO.normalNaJunta)
  const s = quartos === 0 ? 1 : -1
  const ya = s > 0 ? comeco : -frente
  const yb = s > 0 ? frente : -comeco
  const fresta = s > 0 ? frente : -frente - FRESTA
  cena.sombras.push({ forma: caixa(-hw + CANTONEIRA, fresta, hw - CANTONEIRA, fresta + FRESTA), z: H, solta: true, forca: 0 })
  const meioDaFresta = fresta + FRESTA / 2
  const noOmbro = (p: Peca): Peca => {
    const b = p.forma.b
    const forma = comMeioEm({ b: [b[0], Math.max(b[1], ya - 1), b[2], Math.min(b[3], yb + 1)], d: p.forma.d }, (b[0] + b[2]) / 2, meioDaFresta)
    const tex = p.tex
    const textura: Textura = (u, v, x, y, q, saida, escala) => {
      if (y < ya || y > yb || naBeiraGuardada(x, hw, escala)) {
        saida[5] = 0
        return
      }
      if (tex !== null) tex(u, v, x, y, q, saida, escala)
    }
    return { ...p, forma, projeta: undefined, tex: textura }
  }
  const daTampa: Cena = { partes: [], sombras: [] }
  tampa(c, daTampa, { ...arco, c: s * arco.c })
  for (const p of daTampa.partes) {
    if (p.forma.b[3] >= ya && p.forma.b[1] <= yb) cena.partes.push(noOmbro(p))
  }
}

export const montarBau: MontarMovel = (c, cena) => {
  if (c.lado === 'lado') {
    montarBauDeLado(c, cena)
    return
  }
  const { hw, hh, w, h, g, peca: P } = c
  const H = g * ALTURA
  const corpo = caixa(-hw, -hh, hw, hh, 2)
  const fundoDoFecho = Math.min(FECHO.fundo * h, FECHO.tetoNoCorpo * H * COSTURA)
  const altoDoFecho = hh - fundoDoFecho
  // Sem giro, a frente desenhada. Girado, a frente fica de lado ou atrás na 3/4 e não é guardada (deixaria só um fio
  // dela na beira da lateral): a face que fica embaixo na tela é a lateral (um quarto de volta: a pegada deitada na
  // tela) ou as costas, guardadas do mesmo jeito.
  const quartos = quartosDeVolta(c.giro)
  const deFrente = quartos === 0
  if (deFrente) guardarAFrente(c, cena, H, altoDoFecho)
  else if (quartos % 2 === 1) guardarFaceGirada(P, cena, quartos, H, { xa: -hh, xb: hh, y0: -hw, y1: hw, raio: 2 }, desenharLateral(c, H, hh))
  else guardarFaceGirada(P, cena, quartos, H, { xa: -hw, xb: hw, y0: -hh, y1: hh, raio: 2 }, desenharCostas(c, H))
  if (quartos % 2 === 0) guardarOOmbro(c, cena, H, quartos)
  cena.sombras.push(contato(corpo))
  tampa(c, cena, { c: 0, r: hh, forca: FORCA_DO_ARCO })
  // O fecho na frente, com o buraco da fechadura. Sem giro, o meio da caixa dos dois fica na fresta do fecho, que os
  // sobe só até a altura dele na frente: na 3/4 ele pende da tampa sobre o corpo. Girado, ele sobe com a tampa, na
  // beira dela, como se vê de cima.
  const yDoFecho = hh - FRESTA / 2
  const naFresta = (f: Forma): Forma => (deFrente ? comMeioEm(f, 0, yDoFecho) : f)
  const mf = FECHO.meiaLargura * w
  cena.partes.push(P(naFresta(caixa(-mf, altoDoFecho, mf, hh + FECHO.alem, 0.8)), c.m.ferragens, { bisel: 0.9, projeta: { dist: 0.9, forca: 0.3 } }))
  cena.partes.push(P(naFresta(elipse(0, hh - FECHO.fechadura * fundoDoFecho, 0.75, 1.15)), BURACO, { bisel: 0, contorno: 0 }))
}
