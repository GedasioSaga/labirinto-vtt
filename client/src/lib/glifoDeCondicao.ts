import { caracteresDoSimbolo } from './condicoesProprias'

/**
 * O SÍMBOLO DIGITADO da condição criada (letra, número ou emoji), pintado numa
 * tela quadrada transparente. UMA pintura para as duas telas: o mapa a usa como
 * textura (`pixi/drawTokenConditions.ts`) e o painel como imagem
 * (`components/PastilhaDeCondicao.tsx`) — o que o mestre vê no botão é o que
 * sai em cima da ficha, para ele e para quem joga.
 *
 * O texto é encaixado pela caixa da TINTA (o que o glifo realmente pinta), e
 * não pela caixa da fonte: "A", "9" e "🔥" ficam centrados no disco, cada um
 * do tamanho que cabe. A letra sai na tinta que contrasta com a cor da
 * pastilha; o emoji tem cor própria, então ganha um halo nessa tinta, que o
 * separa de uma pastilha da mesma cor.
 */

/** Lado da tela, em px: sobra para o zoom de perto; de longe, o mapa usa os mipmaps. */
const LADO = 128
/** Tamanho de fonte da primeira medida; o encaixe escala a partir dele. */
const FONTE_DE_MEDIDA = 64
/** Teto da fonte: um ponto final não vira uma bola do tamanho da pastilha. */
const FONTE_MAX = LADO * 1.1
/** A caixa onde a tinta tem de caber, em fração do lado: um caractere ocupa o quadrado inscrito no disco. */
const CAIXA_DE_UM = { largura: 0.8, altura: 0.8 }
/** Dois caracteres dividem a largura e ficam mais baixos, para os cantos não saírem do disco. */
const CAIXA_DE_DOIS = { largura: 0.92, altura: 0.6 }
/** Desfoque do halo do emoji, em fração do lado. */
const HALO = 0.05
/** Passadas do halo: uma só fica fraca demais na pastilha de 20 px. */
const PASSADAS_DO_HALO = 2
/** Guardadas por (tinta, texto). O teto é folga: são no máximo 40 condições na lista, em duas tintas. */
const GUARDADAS_MAX = 256

/** Emoji tem cor própria: pictograma, bandeira (indicador regional) ou tecla (`⃣`). */
const TEM_COR_PROPRIA = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u

const FAMILIA = '"Segoe UI", system-ui, -apple-system, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'

function fonte(px: number): string {
  return `700 ${px}px ${FAMILIA}`
}

const telas = new Map<string, HTMLCanvasElement | null>()
const imagens = new Map<string, string | null>()

function guardar<T>(mapa: Map<string, T>, chave: string, valor: T): T {
  if (mapa.size >= GUARDADAS_MAX) {
    const maisVelha = mapa.keys().next()
    if (maisVelha.done !== true) mapa.delete(maisVelha.value)
  }
  mapa.set(chave, valor)
  return valor
}

function pintar(texto: string, tinta: string): HTMLCanvasElement | null {
  // Sem DOM (teste em Node) não há tela; quem chama desenha a pastilha sem o símbolo.
  if (typeof document === 'undefined') return null
  const tela = document.createElement('canvas')
  tela.width = LADO
  tela.height = LADO
  const ctx = tela.getContext('2d')
  if (ctx === null) return null

  ctx.font = fonte(FONTE_DE_MEDIDA)
  const medida = ctx.measureText(texto)
  const largura = medida.actualBoundingBoxLeft + medida.actualBoundingBoxRight
  const altura = medida.actualBoundingBoxAscent + medida.actualBoundingBoxDescent
  // Glifo que a fonte não tem (ou que não pinta nada): sem símbolo, em vez de dividir por zero.
  if (!(largura > 0) || !(altura > 0)) return null

  const caixa = caracteresDoSimbolo(texto) > 1 ? CAIXA_DE_DOIS : CAIXA_DE_UM
  const escala = Math.min((LADO * caixa.largura) / largura, (LADO * caixa.altura) / altura)
  ctx.font = fonte(Math.min(FONTE_DE_MEDIDA * escala, FONTE_MAX))
  const final = ctx.measureText(texto)
  // Centro da TINTA no centro da tela, nos dois eixos.
  const x = (LADO - (final.actualBoundingBoxLeft + final.actualBoundingBoxRight)) / 2 + final.actualBoundingBoxLeft
  const y = (LADO + final.actualBoundingBoxAscent - final.actualBoundingBoxDescent) / 2

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = tinta
  if (TEM_COR_PROPRIA.test(texto)) {
    ctx.shadowColor = tinta
    ctx.shadowBlur = LADO * HALO
    for (let passada = 0; passada < PASSADAS_DO_HALO; passada += 1) ctx.fillText(texto, x, y)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
  }
  ctx.fillText(texto, x, y)
  return tela
}

/** A tela com o símbolo pintado em `tinta` (`#rrggbb`); `null` = não há como pintar (sem DOM, sem glifo). A mesma tela a cada pedido igual. */
export function telaDoGlifo(texto: string, tinta: string): HTMLCanvasElement | null {
  const chave = `${tinta}|${texto}`
  const guardada = telas.get(chave)
  return guardada !== undefined ? guardada : guardar(telas, chave, pintar(texto, tinta))
}

/** A mesma pintura como endereço de imagem (`data:image/png`), para o SVG do painel; `null` como em `telaDoGlifo`. */
export function imagemDoGlifo(texto: string, tinta: string): string | null {
  const chave = `${tinta}|${texto}`
  const guardada = imagens.get(chave)
  if (guardada !== undefined) return guardada
  const tela = telaDoGlifo(texto, tinta)
  return guardar(imagens, chave, tela === null ? null : tela.toDataURL('image/png'))
}
