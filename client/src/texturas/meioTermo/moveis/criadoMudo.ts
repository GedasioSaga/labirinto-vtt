/**
 * CRIADO-MUDO COM VELA de cima com volume (lote 4 dos objetos novos,
 * 11/11/2026): a mesinha de cabeceira. De cima aparece o TAMPO de madeira com
 * a moldura da beira e, em cima dele, a VELA ACESA no pires de latão de argola
 * (a cera que escorreu, o toco, a chama pintada e um halo quente, pequeno, só
 * no tampo) e um LIVRO FECHADO, com o filete na capa e o fitilho saindo das
 * folhas. Na beira da frente, o puxador da gaveta.
 *
 * A chama é só pintura: não anima nem tem botão de aceso e apagado (decisão do
 * mestre). A luz de verdade é uma linha do integrador, no ponto
 * `CHAMA_DO_CRIADO_MUDO`, que é a mesma conta que põe a vela no desenho. A
 * chama é redonda, como se vê de cima: o móvel gira no mapa, e uma chama em
 * gota apontaria para o lado ou para baixo.
 *
 * NA 3/4 A FRENTE MOSTRA A GAVETA. A frente que a 3/4 varre sozinha é madeira
 * lisa; aqui ela é desenhada de frente (a beira do tampo, a gaveta com a
 * almofada, o nicho aberto com dois livros deitados, a tábua de baixo e os
 * dois pés com o vão escuro entre eles) e fica GUARDADA debaixo do tampo na
 * vista de cima, onde nada dela aparece. O que a põe no lugar é a regra de
 * sempre da 3/4 (`tresQuartos.ts`): cada peça sobe a altura da estrutura que
 * contém o meio da caixa dela. A frente tem a sua FRESTA, um tampo no ar de um
 * quarto de px colado na frente da pegada, e a caixa de pintura de cada peça é
 * espelhada em volta dela (`guardada`): a frente inteira sobe junta, meio px.
 * É a ideia da estante de livros e do guarda-roupa, com uma faixa só (a frente
 * é mais baixa que a profundidade). O PUXADOR é uma peça só, com a fresta
 * dela: de cima fica na beira da frente e na 3/4 sobe para o meio da gaveta.
 *
 * O perfil da 3/4 tem de ser derivado com espessura 0: a frente começa rente
 * ao chão, e com a beirada padrão dos tampos soltos a da fresta cairia no
 * chão, como uma tira de madeira na frente dos pés.
 *
 * A vela, o livro e o puxador têm medida própria (não esticam com o tampo);
 * só encolhem juntos se o mestre fizer o criado-mudo menor que o de partida.
 * A 25% de zoom sobram o quadrado de madeira, o disco de latão com o ponto
 * claro da chama e o retângulo do livro. Materiais: `madeira` e `puxadores`;
 * o latão do pires, a cera, a chama e o livro são fixos.
 */
import { anel, caixa, capsula, dentroDe, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { QUARTO, materialDaPeca, type MontarMovel } from './contexto'

type Rgb3 = readonly [number, number, number]

/** Altura do criado-mudo em casas (a sombra; na 3/4, a frente). */
const ALTURA = 0.5
/** O lado de partida, em casas: abaixo dele o que está em cima do tampo encolhe junto. */
const LADO_DE_PARTIDA = 0.6

/**
 * Onde fica a CHAMA, em fração da largura (x) e da altura (y) do objeto, a
 * partir do canto de cima à esquerda dele sem giro. É também o meio da vela e
 * do pires. Na 3/4 a chama sobe com o tampo: `ALTURA` casas na tela.
 */
export const CHAMA_DO_CRIADO_MUDO = { x: 0.32, y: 0.33 } as const
/** A altura do tampo em casas, para quem liga a luz subir o ponto dela na 3/4. */
export const ALTURA_DO_CRIADO_MUDO = ALTURA

// ---------- a frente guardada ----------

/** A fresta da frente e a do puxador (px do protótipo): finas, para o corpo acabar a meio px da frente da pegada. */
const FRESTA = 0.25
/** Quanto a frente guardada sobe na 3/4 (px do protótipo): o mínimo para a fresta dela valer como estrutura. */
const SUBIDA_DA_FRENTE = 0.5
/** A frente guardada fica a esta distância do fundo da pegada, no mínimo (px do protótipo). */
const FOLGA_DO_GUARDADO = 2.5
/** A fresta acaba este tanto antes de cada ponta: girado na 3/4, o corpo é pintado depois dela e cobre a frente guardada. */
const RECUO_DA_FRESTA = 0.5

/**
 * A peça desenhada DE FRENTE (x como na pegada, y = 0 no chão e negativo para
 * cima) no lugar em que fica guardada na vista de cima: descida `desce` px,
 * para debaixo do tampo, com a caixa de pintura espelhada em volta de `meio`
 * (o meio da fresta). O desenho não muda, porque fora da forma nada pinta; o
 * meio da caixa, que é o que a 3/4 lê para saber em que estrutura a peça
 * está, cai na fresta.
 */
function guardada(forma: Forma, desce: number, meio: number): Forma {
  const alcance = Math.max(Math.abs(forma.b[1] + desce - meio), Math.abs(forma.b[3] + desce - meio))
  return { b: [forma.b[0], meio - alcance, forma.b[2], meio + alcance], d: (x, y) => forma.d(x, y - desce) }
}

/** Põe uma peça na frente: a forma em coordenadas de frente (y = 0 no chão, negativo para cima). */
type PorNaFrente = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca) => void

/** A beira do tampo vista de frente e a largura de cada pé (px do protótipo). */
const BEIRA_DO_TAMPO = 2.4
const PE = 3.2
/** A lateral do corpo que sobra de cada lado da frente (px do protótipo). */
const LATERAL = 0.6
/** As alturas da frente, em fração da altura do móvel: o vão dos pés, a tábua de baixo e a gaveta. */
const VAO_DOS_PES = 0.14
const TABUA_DE_BAIXO = 0.065
const GAVETA = 0.32
/** A madeira vista de frente pega menos luz que o tampo: o corpo, a face da gaveta, a almofada e a beira do tampo. */
const TOM_DO_CORPO = 0.8
const TOM_DA_GAVETA = 0.92
const TOM_DA_ALMOFADA = 1
const TOM_DA_BEIRA = 0.98
/** O fundo do nicho e o vão dos pés: a própria madeira com menos luz, e a sombra que a gaveta e a lateral fazem no nicho. */
const TOM_DO_NICHO = 0.6
const SOMBRA_NO_NICHO = { k: 3.6, forca: 0.38 }
const TOM_DO_VAO = 0.48
/** A sombra que a beira do tampo faz na gaveta: o escuro quente da nogueira, meio transparente. */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x21, 0x18] }
const ALTO_DA_SOMBRA_DO_TAMPO = 2
/** Raio do puxador (px do protótipo): 3 pixels a 1x. */
const RAIO_DO_PUXADOR = 1.6

/** As capas dos livros (o azul-petróleo e o couro da estante de livros), as folhas e o filete dourado. */
const PETROLEO: MaterialDaPeca = { classe: 'liso', rgb: [0x4e, 0x6a, 0x6c] }
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x8c, 0x5e, 0x42] }
const FOLHAS: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xca, 0xae] }
const FILETE: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xbd, 0x84] }
const FITILHO = materialDaPeca('vinho')
const SEM_BORDA: OpcoesDaPeca = { bisel: 0, contorno: 0 }

/**
 * A frente inteira, de frente: o corpo com os dois pés, o vão escuro entre
 * eles, o nicho com dois livros deitados, a tábua de baixo, a gaveta, a sombra
 * do tampo e a beira dele por cima. Devolve a altura do meio da gaveta, onde
 * fica o puxador.
 */
function desenharFrente(por: PorNaFrente, hw: number, H: number, mad: MaterialDaPeca): number {
  const vao = H * VAO_DOS_PES
  const tabua = vao + H * TABUA_DE_BAIXO
  const topoDoCorpo = H - BEIRA_DO_TAMPO
  const topoDaGaveta = topoDoCorpo - 0.8
  const peDaGaveta = topoDaGaveta - H * GAVETA
  const topoDoNicho = peDaGaveta - 0.9
  const dentro = hw - LATERAL - PE

  por(caixa(-hw + LATERAL, -topoDoCorpo - 0.4, hw - LATERAL, 0, 0.5), mad, { eixo: QUARTO, tabua: 0, bisel: 0.7, tom: TOM_DO_CORPO, semente: 620 })
  // O vão dos pés não tem beira embaixo: acaba no chão.
  por(caixa(-dentro, -vao, dentro, 0), mad, { tabua: 0, bisel: 0, contorno: 0, tom: TOM_DO_VAO, recesso: { k: 1.6, forca: 0.3 }, semente: 621 })
  por(caixa(-dentro, -topoDoNicho, dentro, -tabua + 0.4), mad, { tabua: 0, bisel: 0, contorno: 0, tom: TOM_DO_NICHO, recesso: SOMBRA_NO_NICHO, semente: 622 })
  // Dois livros deitados no nicho, de lombada para fora: o de baixo mais comprido.
  const livros: readonly (readonly [number, number, number, MaterialDaPeca])[] = [
    [-dentro * 0.72, dentro * 0.34, 2.5, PETROLEO],
    [-dentro * 0.6, dentro * 0.18, 2, COURO],
  ]
  let apoio = tabua
  livros.forEach(([x0, x1, grossura, capa], i) => {
    por(caixa(x0, -apoio - grossura, x1, -apoio, 0.45), capa, { bisel: 0.7, contorno: 0.24, tom: 0.9, semente: 623 + i, projeta: { dist: 0.7, forca: 0.24, suave: 0.5 } })
    for (const f of [0.16, 0.84]) {
      const x = x0 + (x1 - x0) * f
      por(caixa(x - 0.35, -apoio - grossura + 0.4, x + 0.35, -apoio - 0.4), FILETE, SEM_BORDA)
    }
    apoio += grossura
  })
  por(caixa(-dentro - 0.4, -tabua, dentro + 0.4, -vao, 0.3), mad, { tabua: 0, bisel: 0.8, tom: TOM_DA_GAVETA, semente: 626 })
  // A gaveta: a face, e a almofada em relevo no meio dela.
  const xGaveta = hw - LATERAL - 1.4
  por(caixa(-xGaveta, -topoDaGaveta, xGaveta, -peDaGaveta, 0.7), mad, { tabua: 0, bisel: 1, tom: TOM_DA_GAVETA, semente: 627 })
  por(caixa(-xGaveta + 1.8, -topoDaGaveta + 1.8, xGaveta - 1.8, -peDaGaveta - 1.8, 0.6), mad, { tabua: 0, bisel: 1.1, tom: TOM_DA_ALMOFADA, contorno: 0.24, semente: 628 })
  por(caixa(-hw + 1, -topoDoCorpo - 0.3, hw - 1, -topoDoCorpo + ALTO_DA_SOMBRA_DO_TAMPO), SOMBRA, { bisel: 0, contorno: 0, alfa: 0.3, suave: 1.4 })
  por(caixa(-hw, -H, hw, -topoDoCorpo, 0.8), mad, { tabua: 0, bisel: 1.1, tom: TOM_DA_BEIRA, semente: 629 })
  return (topoDaGaveta + peDaGaveta) / 2
}

// ---------- em cima do tampo ----------

/** A moldura da beira do tampo: o miolo dele afunda um pouco a esta distância da beira (px do protótipo). */
const MOLDURA_DO_TAMPO = 2.3

/** Retângulo girado `ang` radianos em volta do meio (cx, cy), de meias medidas `mx` e `my`, deslocado (dx, dy) no eixo dele. */
function girado(cx: number, cy: number, mx: number, my: number, ang: number, dx = 0, dy = 0): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const canto = (x: number, y: number): Ponto => [cx + (x + dx) * co - (y + dy) * si, cy + (x + dx) * si + (y + dy) * co]
  return poligono([canto(-mx, -my), canto(mx, -my), canto(mx, my), canto(-mx, my)])
}

/** O livro fechado: onde fica (fração da largura e da altura a partir do meio), as meias medidas (px do protótipo) e o giro. */
const LIVRO = { x: 0.2, y: 0.215, meioComprimento: 6.5, meiaLargura: 4.7, giro: -0.21 }

/**
 * O livro fechado, de capa para cima: as folhas na beira da direita e de
 * baixo, a capa com a lombada mais escura, o quadro de filete dourado, a
 * etiqueta do título e o fitilho saindo das folhas.
 */
function livroFechado(L: Peca[], P: CriarPeca, cx: number, cy: number, k: number): void {
  const mx = LIVRO.meioComprimento * k
  const my = LIVRO.meiaLargura * k
  const ang = LIVRO.giro
  const no = (dx: number, dy: number): Ponto => [cx + dx * Math.cos(ang) - dy * Math.sin(ang), cy + dx * Math.sin(ang) + dy * Math.cos(ang)]
  const [fx0, fy0] = no(mx * 0.3, my - 0.4 * k)
  const [fx1, fy1] = no(mx * 0.36, my + 2.3 * k)
  L.push(P(capsula(fx0, fy0, fx1, fy1, 0.5 * k), FITILHO, { bisel: 0.3 * k, contorno: 0.2, semente: 640 }))
  L.push(P(girado(cx, cy, mx, my, ang, 0.6 * k, 0.65 * k), FOLHAS, { bisel: 0.3, contorno: 0.2, semente: 641, projeta: { dist: 1.1 * k, forca: 0.3 } }))
  L.push(P(girado(cx, cy, mx, my, ang), PETROLEO, { bisel: 0.8 * k, contorno: 0.26, semente: 642 }))
  L.push(P(girado(cx, cy, 0.9 * k, my - 0.3 * k, ang, -mx + 1.1 * k, 0), PETROLEO, { bisel: 0, contorno: 0, tom: 0.8, semente: 643 }))
  // O quadro e a etiqueta ficam um pouco para a direita: a lombada toma a ponta da esquerda da capa.
  const quadro = menos(girado(cx, cy, mx - 2.9 * k, my - 1.2 * k, ang, k, 0), girado(cx, cy, mx - 3.3 * k, my - 1.6 * k, ang, k, 0))
  L.push(P(quadro, FILETE, { ...SEM_BORDA, alfa: 0.8 }))
  L.push(P(girado(cx, cy, mx * 0.36, my * 0.2, ang, k, -my * 0.22), FILETE, SEM_BORDA))
}

const LATAO = materialDaPeca('latao')
/** A cera da vela (o creme do altar) e a poça derretida no alto dela, quente por causa da chama. */
const CERA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xd7, 0xbc] }
const COR_DA_CERA_QUENTE: Rgb3 = [0xee, 0xc4, 0x7a]
/** A parte da cor da poça de cera que não pega luz nem sombra: a chama a acende por dentro. */
const EMISSAO_DA_CERA = 0.5
/** A chama: do miolo quase branco, pelo amarelo do meio, ao laranja calmo da beira. */
const MIOLO_DA_CHAMA: Rgb3 = [0xff, 0xf4, 0xc0]
const MEIO_DA_CHAMA: Rgb3 = [0xfc, 0xc8, 0x5c]
const BEIRA_DA_CHAMA: Rgb3 = [0xe6, 0x86, 0x3c]
/** O brilho colado na chama e o halo que ela põe no tampo: a cor e o alfa no centro de cada um. */
const COR_DO_BRILHO: Rgb3 = [0xff, 0xcf, 0x82]
const ALFA_DO_BRILHO = 0.3
const COR_DO_HALO: Rgb3 = [0xf4, 0xbc, 0x70]
const ALFA_DO_HALO = 0.44
const LUME: MaterialDaPeca = { classe: 'liso', rgb: COR_DO_HALO }
/**
 * As medidas da vela, em px do protótipo: o raio do pires, o da chama, o do
 * brilho e o do halo. A chama é REDONDA, como se vê de cima: o criado-mudo gira
 * no mapa, e uma chama em gota apontaria para o lado ou para baixo.
 */
const RAIO_DO_PIRES = 5.6
const RAIO_DA_CHAMA = 1.75
const RAIO_DO_BRILHO = 5
const RAIO_DO_HALO = 14.5

/** Luz que cai do centro (cx, cy) até o raio `r`: a cor inteira é emissão, o alfa some na beira. */
function texLume(cor: Rgb3, alfa: number, cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = Math.min(1, ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (r * r))
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = 1
    s[5] = alfa * (1 - q) * (1 - q)
  }
}

/** A chama vista de cima, em volta de (cx, cy): quase branca no miolo, amarela no meio, laranja na beira; toda emissão. */
function texChama(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = Math.min(1, ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (r * r))
    // Duas metades: do miolo ao meio, do meio à beira.
    const quente = t >= 0.5
    const de = quente ? MEIO_DA_CHAMA : MIOLO_DA_CHAMA
    const ate = quente ? BEIRA_DA_CHAMA : MEIO_DA_CHAMA
    const f = quente ? t * 2 - 1 : t * 2
    s[0] = de[0] + (ate[0] - de[0]) * f
    s[1] = de[1] + (ate[1] - de[1]) * f
    s[2] = de[2] + (ate[2] - de[2]) * f
    s[4] = 1
  }
}

/** A poça de cera derretida: a cor quente, em parte emissão. */
function texCeraQuente(): Textura {
  return (_u, _v, _x, _y, _p, s) => {
    s[0] = COR_DA_CERA_QUENTE[0]
    s[1] = COR_DA_CERA_QUENTE[1]
    s[2] = COR_DA_CERA_QUENTE[2]
    s[4] = EMISSAO_DA_CERA
  }
}

/**
 * A vela acesa no pires de latão, com o meio em (cx, cy): a argola de pegar,
 * o pires com o fundo rebaixado, a cera que escorreu, o toco com a poça
 * derretida em volta do pavio, o halo no tampo (só dentro de `tampo`), o
 * brilho e a chama, redonda, no meio da poça.
 */
function velaAcesa(L: Peca[], P: CriarPeca, cx: number, cy: number, k: number, tampo: Forma): void {
  const r = RAIO_DO_PIRES * k
  const xArgola = cx - 0.8 * (r + 0.7 * k)
  const yArgola = cy + 0.6 * (r + 0.7 * k)
  L.push(P(anel(xArgola, yArgola, r * 0.4, r * 0.4, r * 0.2, r * 0.2), LATAO, { bisel: r * 0.1, contorno: 0.3, semente: 650, projeta: { dist: 0.8, forca: 0.3 } }))
  L.push(P(elipse(cx, cy, r, r), LATAO, { bisel: r * 0.3, contorno: 0.3, semente: 651, projeta: { dist: 1.5, forca: 0.34 } }))
  L.push(P(elipse(cx, cy, r * 0.76, r * 0.76), LATAO, { bisel: 0, tom: 0.82, contorno: 0.1, recesso: { k: 1.1, forca: 0.32 }, semente: 652 }))
  L.push(P(elipse(cx + r * 0.3, cy + r * 0.27, r * 0.4, r * 0.33), CERA, { bisel: r * 0.14, tom: 0.92, contorno: 0.14, semente: 653 }))
  L.push(P(elipse(cx, cy, r * 0.52, r * 0.52), CERA, { bisel: r * 0.16, contorno: 0.24, semente: 654, projeta: { dist: 1, forca: 0.3, suave: 0.6 } }))
  L.push(P(elipse(cx, cy, r * 0.4, r * 0.4), CERA, { bisel: 0, contorno: 0, textura: texCeraQuente(), semente: 655 }))
  const halo = RAIO_DO_HALO * k
  L.push(P(dentroDe(elipse(cx, cy, halo, halo), tampo), LUME, { ...SEM_BORDA, suave: 0.6, textura: texLume(COR_DO_HALO, ALFA_DO_HALO, cx, cy, halo), semente: 656 }))
  const brilho = RAIO_DO_BRILHO * k
  L.push(P(elipse(cx, cy, brilho, brilho), LUME, { ...SEM_BORDA, textura: texLume(COR_DO_BRILHO, ALFA_DO_BRILHO, cx, cy, brilho), semente: 657 }))
  const chama = RAIO_DA_CHAMA * k
  L.push(P(elipse(cx, cy, chama, chama), LUME, { ...SEM_BORDA, suave: 0.6, textura: texChama(cx, cy, chama), semente: 658 }))
}

export const montarCriadoMudo: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const mad = c.m.madeira
  // A frente guardada tem de caber debaixo do tampo: o criado-mudo mais raso que a altura dele fica mais baixo.
  const H = Math.min(g * ALTURA, h - FOLGA_DO_GUARDADO - 2 * FRESTA)
  /** Onde o corpo acaba e as duas frestas começam: a da frente e, na beira, a do puxador. */
  const frente = hh - 2 * FRESTA
  const meioDaFresta = frente + FRESTA / 2
  const yDoPuxador = hh - FRESTA / 2
  const L = cena.partes

  // A frente, guardada debaixo do tampo.
  const desce = frente + SUBIDA_DA_FRENTE
  const alturaDoPuxador = desenharFrente((forma, mat, o) => L.push(P(guardada(forma, desce, meioDaFresta), mat, o)), hw, H, mad)

  // O corpo dá a sombra e a altura do tampo; as frestas não fazem sombra, só dizem à 3/4 quanto cada uma sobe.
  cena.sombras.push(
    { forma: caixa(-hw, -hh, hw, frente, 1.2), z: H },
    contato(caixa(-hw, -hh, hw, hh, 1.2)),
    { forma: caixa(-hw + RECUO_DA_FRESTA, frente, hw - RECUO_DA_FRESTA, frente + FRESTA), z: SUBIDA_DA_FRENTE, solta: true, forca: 0 },
    { forma: caixa(-0.15, hh - FRESTA, 0.15, hh), z: alturaDoPuxador + (yDoPuxador - frente), solta: true, forca: 0 },
  )

  // O tampo, com a moldura da beira.
  const moldura = Math.min(MOLDURA_DO_TAMPO, 0.1 * Math.min(w, h))
  const tampo = caixa(-hw, -hh, hw, hh, 1.6)
  L.push(P(tampo, mad, { tabua: 0, bisel: 1.8, semente: 610 }))
  L.push(P(caixa(-hw + moldura, -hh + moldura, hw - moldura, hh - moldura, 1), mad, { tabua: 0, bisel: 0.5, tom: 0.94, contorno: 0.1, recesso: { k: 1.2, forca: 0.2 }, semente: 611 }))

  // O livro e a vela: medida própria, encolhendo só no criado-mudo menor que o de partida.
  const k = Math.min(1, w / (g * LADO_DE_PARTIDA), h / (g * LADO_DE_PARTIDA))
  livroFechado(L, P, LIVRO.x * w, LIVRO.y * h, k)
  velaAcesa(L, P, -hw + CHAMA_DO_CRIADO_MUDO.x * w, -hh + CHAMA_DO_CRIADO_MUDO.y * h, k, tampo)

  L.push(P(elipse(0, yDoPuxador, RAIO_DO_PUXADOR, RAIO_DO_PUXADOR), c.m.puxadores, { bisel: 1.5, contorno: 0.16, semente: 612, projeta: { dist: 0.9, forca: 0.3 } }))
}
