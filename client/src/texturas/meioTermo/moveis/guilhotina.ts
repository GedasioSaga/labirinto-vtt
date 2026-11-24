/**
 * GUILHOTINA (lote L03 de 24/11/2026, Tortura e fogo; desenho ORIGINAL, só a
 * ideia do objeto dos mapas de referência), vista do lado em que a cabeça cai:
 * as duas COLUNAS altas com a TRAVE no alto, a LÂMINA de aço de fio INCLINADO
 * presa ao CEPO DE PESO (o carneiro), suspensa lá em cima pela corda que passa
 * na roldana e desce até o cunho da coluna da direita; embaixo, a LUNETA (as
 * duas tábuas com a MEIA-LUA de cada uma fechando o furo do pescoço), a ponta
 * da prancha atrás dela e, na frente, o CESTO de vime. Tudo num estrado baixo,
 * com duas mãos-francesas escorando as colunas.
 *
 * VAZIA e limpa: sem corpo. A única marca é uma sombra de vinho velho, quase
 * apagada, na tábua de baixo da luneta (regra da lista: vinho velho, nunca
 * vermelho vivo). A madeira é VELHA de masmorra (a escolhida, escurecida, de
 * veio fechado, com a umidade subindo do pé de cada coluna). A lâmina é aço
 * fosco com oxidação leve: só o gume inclinado é claro.
 *
 * Figura em pé, desenhada de frente nas duas vistas, como a armadura e a
 * estátua de cavalo: de cima e na 3/4 é a mesma imagem, e a 3/4 só põe a
 * sombra de baixo (`EM_PE` em `tresQuartos.ts`); o quarto de volta deita a
 * figura. A sombra projetada tem a altura inteira do desenho: as duas colunas,
 * a trave e a lâmina caem compridas para baixo à direita. Desenho em px de uma
 * pegada de 1 x 2 casas (56 x 112, y cresce para baixo, o chão embaixo).
 *
 * A 25% de zoom sobram as duas colunas finas, o trapézio da lâmina no alto
 * entre elas e o cesto no pé: é o que diz "guilhotina", e não forca (um poste
 * e um braço), portão ou tear. Materiais: `madeira` e `ferragens`. O aço da
 * lâmina, a corda, o vime e o vinho são fixos.
 */
import { limitar01, type Rgb } from '../../ruido'
import { anel, barra, cadeia, caixa, capsula, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { G, QUARTO, type MontarMovel } from './contexto'

/** A pegada em que o desenho foi medido (px do protótipo): 1 x 2 casas. */
const LARGURA = G
const ALTURA = 2 * G

/** O estrado: a meia largura da frente e a do fundo, o fundo do tampo, a quina da frente e o chão. */
const ESTRADO = { meia: 26.5, meiaDoFundo: 24, fundo: 39.5, topo: 44, pe: 50.5 }
/** As colunas: o x do meio, a meia largura, o alto e o pé (no tampo do estrado). */
const COLUNA = { x: 13.6, meia: 2.5, topo: -49, pe: 41.5 }
/** A trave do alto: a meia largura, o alto e o pé. */
const TRAVE = { meia: 19, topo: -54.5, pe: -48 }
/** O carneiro (o cepo de peso) e a lâmina debaixo dele: a meia largura entre as colunas e os y. */
const CARNEIRO = { meia: 10.8, topo: -43, pe: -36.5 }
const LAMINA = { peDoLadoAlto: -29, peDoLadoBaixo: -21 }
/** O gume: a largura da faixa clara ao longo do fio inclinado (px do desenho). */
const LARGURA_DO_GUME = 1.2
/** A luneta: a meia largura, o alto, o corte entre as duas tábuas, o pé e o raio do furo. */
const LUNETA = { meia: 10.8, topo: 11, corte: 21, pe: 31, furo: 5 }
/** A prancha atrás da luneta, vista de topo. */
const PRANCHA = { meia: 8.4, topo: 31, pe: 40.5 }
/** As mãos-francesas: da coluna (y) até a ponta do estrado. */
const ESCORA = { alto: 16, largura: 3 }
/** O cesto de vime na frente: o meio, os raios da boca e o pé. */
const CESTO = { x: -1, boca: 37.5, rx: 9.4, ry: 3.3, pe: 52.5, meiaDoPe: 7.4 }
/** O cunho da corda, na coluna da direita. */
const CUNHO_Y = 6

/**
 * A sombra no chão: a figura em pé tem a altura inteira do desenho (a conta dos outros em pé, como a armadura). As
 * colunas, a trave e a lâmina caem compridas para baixo à direita.
 */
const ALTURA_DA_SOMBRA = ESTRADO.pe - TRAVE.topo
const FORCA_DA_SOMBRA = 0.22

/** A madeira de masmorra: a escolhida, escurecida (o carvalho cai perto de #6e5238). */
const TOM_DA_MADEIRA_VELHA = 0.75
/** A umidade que sobe do pé de cada peça: até onde (px do desenho) e o quanto escurece. */
const UMIDADE = { sobe: 16, forca: 0.25 }
const TOM_DE_FRENTE = 0.74
const TOM_DA_ESCORA = 0.8
const TOM_DO_REBITE = 1.32
const BRILHO_DO_FERRO = 0.34
const ESCURO_DA_MADEIRA: Rgb = [0x4f, 0x3b, 0x2c]

/** A corda de cânhamo: parda, com a torção num castanho do próprio tom. */
const CANHAMO: MaterialDaPeca = { classe: 'liso', rgb: [0xa0, 0x8a, 0x68] }
const TORCAO_DO_CANHAMO: Rgb = [0x7a, 0x66, 0x48]
/** O vime do cesto: a palha trançada, mais escura e parda que a do chapéu. */
const VIME: MaterialDaPeca = { classe: 'palha', rgb: [0x8a, 0x74, 0x50] }
/** O aço fosco do corpo da lâmina, a oxidação que o mancha e o gume amolado (só a faixa do fio). */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0x8f, 0x94, 0x98] }
const OXIDO: Rgb = [0x6e, 0x6a, 0x64]
const ALFA_DO_OXIDO = 0.2
const FIO: MaterialDaPeca = { classe: 'liso', rgb: [0xcd, 0xd0, 0xcf] }
/** O escuro do furo, do vão das corrediças e de dentro do cesto. */
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x35, 0x2b, 0x26] }
/** O vinho velho, quase apagado. */
const VINHO: MaterialDaPeca = { classe: 'liso', rgb: [0x5e, 0x36, 0x36] }

const DA_MADEIRA = texturaDaClasse('madeira')
const DO_METAL = texturaDaClasse('metal')

/**
 * A madeira velha: o veio da madeira com um veio FINO E FECHADO por cima, manchas escuras de idade e, a partir do pé
 * da peça (`pe`, o y do chão dela; `null` = sem pé no chão), a umidade que sobe `sobe` px, de beira irregular.
 */
function texMadeiraVelha(pe: number | null, sobe: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DA_MADEIRA !== null) DA_MADEIRA(u, v, x, y, p, s, escala)
    s[3] += ruido(u * 0.035 + p.su, v * 1.5 + p.sv) * 0.09 - limitar01(ruido(x * 0.1 + p.su, y * 0.1 + p.sv) * 2.4 - 0.2) * 0.12
    if (pe === null) return
    const altura = (pe - y) / sobe + ruido(x * 0.28 + p.su, y * 0.1 + 31) * 0.8
    s[3] -= UMIDADE.forca * limitar01(1.15 - altura)
  }
}

/** O cânhamo: a torção em faixas de través, num castanho mais escuro do próprio tom. */
const texCanhamo: Textura = (u, v, _x, _y, _p, s) => {
  const t = limitar01((Math.sin((u * 0.75 + v * 1.25) * 0.95) - 0.3) / 0.7)
  s[0] += (TORCAO_DO_CANHAMO[0] - s[0]) * t
  s[1] += (TORCAO_DO_CANHAMO[1] - s[1]) * t
  s[2] += (TORCAO_DO_CANHAMO[2] - s[2]) * t
  s[3] += ruido(u * 0.6, v * 0.6) * 0.04 + 0.04
}

/** O aço da lâmina: o metal, as riscas de pé da pedra de amolar e a oxidação leve, em manchas. */
const texLamina: Textura = (u, v, x, y, p, s, escala) => {
  if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
  s[3] += ruido(x * 1.3 + p.su, y * 0.07 + p.sv) * 0.05
  const t = ALFA_DO_OXIDO * limitar01(0.35 + ruido(x * 0.3 + p.su, y * 0.3 + p.sv) * 2.8)
  s[0] += (OXIDO[0] - s[0]) * t
  s[1] += (OXIDO[1] - s[1]) * t
  s[2] += (OXIDO[2] - s[2]) * t
}

export const montarGuilhotina: MontarMovel = (c, cena) => {
  const e = Math.min(c.w / LARGURA, c.h / ALTURA)
  const na = (f: Forma): Forma => (e === 1 ? f : { b: [f.b[0] * e, f.b[1] * e, f.b[2] * e, f.b[3] * e], d: (x, y) => f.d(x / e, y / e) * e })
  const por = (f: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    cena.partes.push(c.peca(na(f), mat, { ...o, bisel: (o.bisel ?? 1) * e, suave: (o.suave ?? 0) * e }))
  }
  const escolhida = c.m.madeira
  const madeira: MaterialDaPeca = { ...escolhida, rgb: [escolhida.rgb[0] * TOM_DA_MADEIRA_VELHA, escolhida.rgb[1] * TOM_DA_MADEIRA_VELHA, escolhida.rgb[2] * TOM_DA_MADEIRA_VELHA] }
  const ferro = c.m.ferragens
  /** A madeira velha de uma peça com o pé em `pe` (px do desenho; sem ele, só o veio e as manchas). */
  const daMadeira = (semente: number, pe: number | null, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: 1, contorno: 0.3, semente, textura: texMadeiraVelha(pe === null ? null : pe * e, UMIDADE.sobe * e), ...mais })
  const doFerro = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: 0.7, contorno: 0.3, metal: BRILHO_DO_FERRO, semente, ...mais })
  const daCorda = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, eixo: QUARTO, bisel: 0.8, contorno: 0.26, textura: texCanhamo, semente, ...mais })
  const sombraMiuda = { dist: 0.9 * e, forca: 0.3 }
  cena.corDoPiso = ESCURO_DA_MADEIRA

  // ---------- as sombras: o estrado e o cesto no chão; as colunas, a luneta, a trave e a lâmina, caindo compridas para baixo à direita ----------
  const frenteDoEstrado = caixa(-ESTRADO.meia, ESTRADO.topo, ESTRADO.meia, ESTRADO.pe, 0.8)
  const noChao = (meia: number, x = 0): Forma => na(caixa(x - meia, ESTRADO.topo + 1, x + meia, ESTRADO.pe - 2, 0.8))
  cena.sombras.push(contato(na(uniao(frenteDoEstrado, caixa(-ESTRADO.meiaDoFundo, ESTRADO.fundo, ESTRADO.meiaDoFundo, ESTRADO.topo))), 0.34))
  cena.sombras.push({ forma: na(caixa(-ESTRADO.meia, ESTRADO.topo, ESTRADO.meia, ESTRADO.pe, 1)), z: (ESTRADO.pe - ESTRADO.fundo) * e, forca: 0.26 })
  for (const lado of [-1, 1]) {
    cena.sombras.push({ forma: noChao(COLUNA.meia, lado * COLUNA.x), z: (ESTRADO.pe - COLUNA.topo) * e, forca: FORCA_DA_SOMBRA })
  }
  cena.sombras.push({ forma: noChao(LUNETA.meia), z: (ESTRADO.pe - LUNETA.topo) * e, forca: FORCA_DA_SOMBRA })
  cena.sombras.push({ forma: noChao(TRAVE.meia), z: (ALTURA_DA_SOMBRA - 3) * e, solta: true, forca: 0.2 })
  // A lâmina e o carneiro, suspensos: duas fatias da altura deles, para a mancha ter corpo.
  for (const y of [CARNEIRO.topo + 2, LAMINA.peDoLadoAlto - 2]) {
    cena.sombras.push({ forma: noChao(CARNEIRO.meia), z: (ESTRADO.pe - y) * e, solta: true, forca: 0.2 })
  }
  cena.sombras.push(contato(na(caixa(CESTO.x - CESTO.meiaDoPe, CESTO.pe - 2, CESTO.x + CESTO.meiaDoPe, CESTO.pe, 1)), 0.32))

  // ---------- o estrado (a frente e o tampo) e as mãos-francesas ----------
  por(frenteDoEstrado, madeira, daMadeira(24601, ESTRADO.pe + 6, { tabua: 6.5, eixo: QUARTO, tom: TOM_DE_FRENTE }))
  por(poligono([[-ESTRADO.meiaDoFundo, ESTRADO.fundo], [ESTRADO.meiaDoFundo, ESTRADO.fundo], [ESTRADO.meia, ESTRADO.topo], [-ESTRADO.meia, ESTRADO.topo]]), madeira, daMadeira(24602, null, { tabua: 7, eixo: QUARTO, tom: 1, bisel: 0.5 }))
  for (const lado of [-1, 1]) {
    por(barra(lado * (COLUNA.x + COLUNA.meia - 0.4), ESCORA.alto, lado * (ESTRADO.meiaDoFundo - 1.6), ESTRADO.fundo + 2, ESCORA.largura), madeira, daMadeira(24603 + lado, ESTRADO.fundo + 4, { eixo: QUARTO, tom: TOM_DA_ESCORA }))
  }

  // ---------- a prancha atrás da luneta (de topo) e a luneta com o furo ----------
  por(caixa(-PRANCHA.meia, PRANCHA.topo, PRANCHA.meia, PRANCHA.pe, 0.6), madeira, daMadeira(24610, null, { tom: 0.68, polar: { cx: 0, cy: 60, r: 30 } }))
  const furo = elipse(0, LUNETA.corte, LUNETA.furo, LUNETA.furo)
  const luneta = caixa(-LUNETA.meia, LUNETA.topo, LUNETA.meia, LUNETA.pe, 0.5)
  por(furo, VAO, { bisel: 0, contorno: 0, semente: 24611 })
  por(menos(luneta, furo), madeira, daMadeira(24612, LUNETA.pe + 8, { bisel: 1.1, tom: 0.98, projeta: { dist: 1.3 * e, forca: 0.3 } }))
  // O corte entre as duas tábuas, a beira gasta do furo e a sombra de vinho velho debaixo dele.
  por(uniao(capsula(-LUNETA.meia + 0.8, LUNETA.corte, -LUNETA.furo - 0.4, LUNETA.corte, 0.3), capsula(LUNETA.furo + 0.4, LUNETA.corte, LUNETA.meia - 0.8, LUNETA.corte, 0.3)), VAO, { bisel: 0, contorno: 0, alfa: 0.55, semente: 24613 })
  por(menos(elipse(0, LUNETA.corte + 3.6, 5.4, 6.6), elipse(0, LUNETA.corte, LUNETA.furo, LUNETA.furo)), VINHO, { bisel: 0, contorno: 0, alfa: 0.26, suave: 1.6, semente: 24614 })
  // O trinco de ferro que fecha a tábua de cima.
  por(caixa(LUNETA.meia - 4.4, LUNETA.corte - 3.4, LUNETA.meia - 1.6, LUNETA.corte + 3.4, 0.5), ferro, doFerro(24615, { projeta: sombraMiuda }))
  por(elipse(LUNETA.meia - 3, LUNETA.corte - 2, 0.7, 0.7), ferro, doFerro(24616, { bisel: 0.6, tom: TOM_DO_REBITE, contorno: 0.2 }))

  // ---------- a lâmina (o aço fosco, a oxidação e só o gume claro) e o carneiro, suspensos entre as colunas ----------
  const lamina = poligono([[-CARNEIRO.meia + 0.6, CARNEIRO.pe - 0.6], [CARNEIRO.meia - 0.6, CARNEIRO.pe - 0.6], [CARNEIRO.meia - 0.6, LAMINA.peDoLadoAlto], [-CARNEIRO.meia + 0.6, LAMINA.peDoLadoBaixo]])
  por(lamina, ACO, { tabua: 0, eixo: QUARTO, bisel: 0.6, contorno: 0.28, metal: 0.16, tom: 0.92, textura: texLamina, semente: 24620, projeta: { dist: 1.4 * e, forca: 0.26 } })
  const meioGume = LARGURA_DO_GUME / 2
  por(barra(-CARNEIRO.meia + 0.9, LAMINA.peDoLadoBaixo - meioGume - 0.2, CARNEIRO.meia - 0.9, LAMINA.peDoLadoAlto - meioGume - 0.2, LARGURA_DO_GUME), FIO, { bisel: 0, contorno: 0, alfa: 0.8, semente: 24621 })
  por(caixa(-CARNEIRO.meia, CARNEIRO.topo, CARNEIRO.meia, CARNEIRO.pe, 0.8), madeira, daMadeira(24622, null, { bisel: 1.2, tom: 0.78, projeta: sombraMiuda }))
  for (const x of [-7, 0, 7]) por(elipse(x, CARNEIRO.pe - 1.6, 0.85, 0.85), ferro, doFerro(24623 + x, { bisel: 0.8, tom: TOM_DO_REBITE, metal: 0.5, contorno: 0.2 }))
  por(anel(0, CARNEIRO.topo - 1.2, 1.9, 1.9, 0.9, 0.9), ferro, doFerro(24627, { bisel: 0.5 }))

  // ---------- as colunas (com a corrediça escura por dentro e a umidade no pé) e a trave com a roldana ----------
  for (const lado of [-1, 1]) {
    const x = lado * COLUNA.x
    por(caixa(x - COLUNA.meia, COLUNA.topo, x + COLUNA.meia, COLUNA.pe, 0.6), madeira, daMadeira(24630 + lado, COLUNA.pe, { eixo: QUARTO, bisel: 1.1, tom: 1.02, projeta: { dist: 1.2 * e, forca: 0.26 } }))
    por(capsula(x - lado * (COLUNA.meia - 0.7), COLUNA.topo + 3, x - lado * (COLUNA.meia - 0.7), LUNETA.topo - 2, 0.32), VAO, { bisel: 0, contorno: 0, alfa: 0.5, semente: 24633 + lado })
  }
  por(caixa(-TRAVE.meia, TRAVE.topo, TRAVE.meia, TRAVE.pe, 0.8), madeira, daMadeira(24640, null, { bisel: 1.3, tom: 0.96, projeta: { dist: 1.4 * e, forca: 0.3 } }))
  for (const lado of [-1, 1]) por(elipse(lado * COLUNA.x, (TRAVE.topo + TRAVE.pe) / 2, 0.95, 0.95), ferro, doFerro(24641 + lado, { bisel: 0.8, tom: TOM_DO_REBITE, metal: 0.5, contorno: 0.2 }))

  // ---------- a corda de cânhamo: da argola do carneiro à roldana, por cima da trave e descendo a coluna da direita até o cunho ----------
  const descida = COLUNA.x + COLUNA.meia + 1.6
  const corda: readonly Ponto[] = [[0, CARNEIRO.topo - 2.4], [0, TRAVE.pe - 0.4]]
  const volta: readonly Ponto[] = [[1.2, TRAVE.topo + 0.4], [descida - 3, TRAVE.topo - 1], [descida, TRAVE.topo + 2.4], [descida + 0.2, -20], [descida - 0.6, CUNHO_Y - 1]]
  por(cadeia(corda, 0.8), CANHAMO, daCorda(24650))
  por(cadeia(volta, 0.8), CANHAMO, daCorda(24651, { projeta: sombraMiuda }))
  por(elipse(0, TRAVE.pe - 0.2, 2.1, 2.1), ferro, doFerro(24652, { bisel: 1.2, tom: 1.05, projeta: sombraMiuda }))
  // O cunho: a barra de ferro com as voltas da corda e a ponta solta.
  por(capsula(descida - 2.6, CUNHO_Y, descida + 1.8, CUNHO_Y, 0.9), ferro, doFerro(24653, { bisel: 0.8, projeta: sombraMiuda }))
  por(caixa(descida - 1.5, CUNHO_Y - 1.5, descida + 0.6, CUNHO_Y + 1.5, 0.7), CANHAMO, daCorda(24654, { eixo: 0, tom: 1.03 }))
  por(cadeia([[descida - 0.4, CUNHO_Y + 1.2], [descida + 0.9, CUNHO_Y + 5.5], [descida + 0.3, CUNHO_Y + 10]], 0.7), CANHAMO, daCorda(24655, { bisel: 0.7, tom: 0.95, projeta: sombraMiuda }))

  // ---------- o cesto de vime na frente: o corpo trançado, a boca escura e a borda ----------
  const corpoDoCesto = poligono([[CESTO.x - CESTO.rx, CESTO.boca], [CESTO.x + CESTO.rx, CESTO.boca], [CESTO.x + CESTO.meiaDoPe, CESTO.pe], [CESTO.x - CESTO.meiaDoPe, CESTO.pe]])
  por(uniao(corpoDoCesto, elipse(CESTO.x, CESTO.pe - 0.6, CESTO.meiaDoPe, 1.8)), VIME, { bisel: 2.2, contorno: 0.3, tom: 0.9, semente: 24660 })
  por(elipse(CESTO.x, CESTO.boca, CESTO.rx - 1.3, CESTO.ry - 1.1), VAO, { bisel: 0, contorno: 0, semente: 24661 })
  por(anel(CESTO.x, CESTO.boca, CESTO.rx, CESTO.ry, CESTO.rx - 1.6, CESTO.ry - 1.3), VIME, { bisel: 0.8, contorno: 0.3, tom: 1.06, semente: 24662, projeta: sombraMiuda })
}
