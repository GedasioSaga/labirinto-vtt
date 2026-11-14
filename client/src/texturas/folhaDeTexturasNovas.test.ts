import { it, vi } from 'vitest'
import { TEXTURAS_EMBUTIDAS } from './embutidas'
import { pixelsDoLadrilho, type CorDaTextura } from './ladrilhos'
import { colar, emPng, escrever, novaTela, type Tela } from './meioTermo/moveis/folhaDeContato.testkit'

/**
 * FOLHA DAS TEXTURAS NOVAS (pedido de 14/11/2026: "texturas novas de madeira,
 * pedra, base militar"): a ferramenta com que o desenhista olha a própria
 * textura de chão ANTES de ela entrar na biblioteca (`embutidas.ts`) e com que
 * o integrador confere o lote. Sem navegador: pinta o ladrilho com a mesma
 * conta do app (`pixelsDoLadrilho`), cola numa tela em memória e grava o PNG.
 * NÃO é teste: sem a variável `FOLHA_DE_TEXTURAS` é pulado e não faz nada.
 *
 * Cada item sai em três janelas:
 * - 3 X 3: o ladrilho repetido 3 por 3, cada um a 256 px (marcas fora da
 *   imagem nas emendas), para enxergar a emenda e o padrão que se repete;
 * - MESA: 12 x 8 casas a 50 px por casa (o tamanho de mesa dos objetos);
 * - PERTO: as 2 x 2 casas em volta do canto do ladrilho, onde as quatro
 *   cópias se encontram, na resolução de verdade dele.
 *
 * As MEDIDAS saem num `.txt` ao lado do PNG (o vitest 4 esconde o console do
 * teste que passa), com a mesma conta e os mesmos limites do portão da
 * biblioteca (`embutidas.test.ts`: emenda, listra fina, branco, croma, luz),
 * mais a saturação p95, a cor média (a `amostra` do painel do Chão) e o hash
 * SHA-256 do ladrilho inteiro (o que `embutidas.hash.test.ts` registra). Em
 * vermelho na folha e com FORA no `.txt`, o que passa do limite.
 *
 * COMO RODAR, de `C:/dev/labirinto/client` (caminho absoluto ou a partir de `client/`):
 *
 *   FOLHA_DE_TEXTURAS=../tmp/objetos-2026-11-14/texturas/<pasta>/pedido.json rtk proxy npx vitest run src/texturas/folhaDeTexturasNovas.test.ts
 *
 * O PEDIDO (JSON; campo desconhecido é erro). A `saida` é a partir da pasta do
 * pedido. Textura da biblioteca: só `id`. Textura ainda sem registro: `arquivo`
 * (o módulo a partir de `texturas/`, como `./chaos/assoalhoClaro`), `exporta`
 * (a função `(u, v) => 0xRRGGBB`), `nome`, `casas` (lado do ladrilho em casas)
 * e `lado` (px do ladrilho: 256, 512 ou 1024). `regua: true` mede também
 * todas as texturas da biblioteca, para comparar com as de hoje.
 *
 *   {
 *     "saida": "folha.png",
 *     "regua": false,
 *     "itens": [
 *       { "id": "conves" },
 *       { "arquivo": "./chaos/assoalhoClaro", "exporta": "assoalhoClaro", "nome": "Assoalho claro", "casas": 8, "lado": 1024 }
 *     ]
 *   }
 */

const PEDIDO: unknown = import.meta.env.FOLHA_DE_TEXTURAS
const PEDIDA = typeof PEDIDO === 'string' && PEDIDO !== ''
const TETO_DA_FOLHA_MS = 10 * 60_000

/** Os limites do portão da biblioteca (`embutidas.test.ts:99-126`): se mudarem lá, mudam aqui. */
const LIMITE = {
  emendaVezes: 1.6,
  emendaFolga: 0.004,
  vizinho: 0.035,
  vizinhoEmCasas: 0.0175,
  maiorCanal: 245,
  cromaMaxima: 0.5,
  cromaMedia: 0.42,
  desvioDaLuz: 0.09,
  faixaDaLuz: 0.4,
} as const
/** O ladrilho de 256 px é o padrão da biblioteca (`LADO_DO_LADRILHO`); o portão mede na metade do lado. */
const LADOS_ACEITOS: readonly number[] = [256, 512, 1024]
const CASAS_MAXIMAS = 16
const P95 = 0.95

/** Cada cópia do 3 X 3 e a janela de perto, em px da folha. */
const LADO_DA_COPIA = 256
const COPIAS = 3
/** O tamanho de mesa: 50 px por casa, o mesmo da folha dos objetos. */
const PX_POR_CASA_NA_MESA = 50
const MESA_EM_CASAS = { largura: 12, altura: 8 } as const
const PERTO_EM_CASAS = 2

type Rgb = readonly [number, number, number]
const FUNDO: Rgb = [0x2a, 0x24, 0x20]
const TINTA: Rgb = [0xee, 0xe4, 0xd8]
const APAGADA: Rgb = [0xb0, 0xa4, 0x96]
const ALERTA: Rgb = [0xf2, 0x7d, 0x5c]
const MARGEM = 24
const VAO = 16
const MARCA = 6
const ESCALA_DO_NOME = 3
const ESCALA_DA_LETRA = 2
const ALTURA_DA_LETRA = 7
const LINHA_DO_NOME = ALTURA_DA_LETRA * ESCALA_DO_NOME + 10
const LINHA = ALTURA_DA_LETRA * ESCALA_DA_LETRA + 8

/** O pedaço do Node que a folha usa (o molde de `folhaDeObjetosNovos.test.ts`: o projeto não tem `@types/node`). */
async function nodeDaFolha() {
  const fs = await vi.importActual<{
    readFileSync(caminho: string, codificacao: 'utf8'): string
    writeFileSync(caminho: string, dados: Uint8Array): void
    mkdirSync(caminho: string, opcoes: { recursive: true }): string | undefined
  }>('node:fs')
  const path = await vi.importActual<{ dirname(caminho: string): string; resolve(...partes: string[]): string }>('node:path')
  return { fs, path }
}

/** Os módulos que podem trazer a cor de uma textura nova: os de `texturas/` e de `texturas/chaos/`, sem teste nem worker. */
const MODULOS = import.meta.glob<Readonly<Record<string, unknown>>>(['./*.ts', './chaos/*.ts', '!./**/*.test.ts', '!./**/*.testkit.ts', '!./*.worker.ts'])

// ---------- o pedido ----------

interface TexturaDaFolha {
  readonly nome: string
  readonly casas: number
  readonly lado: number
  readonly cor: CorDaTextura
}

interface Pedido {
  readonly saida: string
  readonly regua: boolean
  readonly itens: readonly Readonly<Record<string, unknown>>[]
}

const ARQUIVO = /^\.\/(chaos\/)?[A-Za-z0-9]+$/
const CAMPOS_DO_PEDIDO = ['saida', 'regua', 'itens']
const CAMPOS_DO_NOVO = ['arquivo', 'exporta', 'nome', 'casas', 'lado']

function ehObjeto(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function soCampos(obj: Readonly<Record<string, unknown>>, aceitos: readonly string[], onde: string): void {
  const estranho = Object.keys(obj).find((k) => !aceitos.includes(k))
  if (estranho !== undefined) throw new Error(`${onde}: campo desconhecido "${estranho}" (aceitos: ${aceitos.join(', ')})`)
}

function lerPedido(texto: string): Pedido {
  const bruto: unknown = JSON.parse(texto)
  if (!ehObjeto(bruto)) throw new Error('pedido: tem de ser um objeto JSON')
  soCampos(bruto, CAMPOS_DO_PEDIDO, 'pedido')
  const { saida, regua, itens } = bruto
  if (typeof saida !== 'string' || !/\.png$/i.test(saida)) throw new Error('pedido.saida: o caminho de um .png')
  if (regua !== undefined && typeof regua !== 'boolean') throw new Error('pedido.regua: true ou false')
  if (!Array.isArray(itens) || itens.length === 0) throw new Error('pedido.itens: lista com ao menos um item')
  const lidos = itens.map((item: unknown, i) => {
    if (!ehObjeto(item)) throw new Error(`itens[${i}]: tem de ser um objeto`)
    return item
  })
  return { saida, regua: regua === true, itens: lidos }
}

async function texturaDoItem(item: Readonly<Record<string, unknown>>, i: number): Promise<TexturaDaFolha> {
  const onde = `itens[${i}]`
  if ('id' in item) {
    soCampos(item, ['id'], onde)
    const t = TEXTURAS_EMBUTIDAS.find((x) => x.id === item.id)
    if (t === undefined) throw new Error(`${onde}: "${String(item.id)}" não está na biblioteca (embutidas.ts)`)
    if (t.casas === undefined) throw new Error(`${onde}: "${t.id}" é medida pela escala, não em casas; a folha só compara chãos em casas`)
    return { nome: t.forma === undefined ? t.nome : `${t.nome} ${t.forma.nome}`, casas: t.casas, lado: t.lado ?? LADOS_ACEITOS[0], cor: t.cor }
  }
  soCampos(item, CAMPOS_DO_NOVO, onde)
  const { arquivo, exporta, nome, casas, lado } = item
  if (typeof arquivo !== 'string' || !ARQUIVO.test(arquivo)) throw new Error(`${onde}.arquivo: "./<modulo>" ou "./chaos/<modulo>", sem .ts`)
  if (typeof exporta !== 'string' || exporta === '') throw new Error(`${onde}.exporta: o nome da função de cor`)
  if (typeof nome !== 'string' || nome.trim() === '') throw new Error(`${onde}.nome: o nome da textura`)
  if (typeof casas !== 'number' || !Number.isInteger(casas) || casas < 1 || casas > CASAS_MAXIMAS) throw new Error(`${onde}.casas: inteiro de 1 a ${CASAS_MAXIMAS}`)
  if (typeof lado !== 'number' || !LADOS_ACEITOS.includes(lado)) throw new Error(`${onde}.lado: ${LADOS_ACEITOS.join(', ')}`)
  const carregar = MODULOS[`${arquivo}.ts`]
  if (carregar === undefined) throw new Error(`${onde}.arquivo: não achei client/src/texturas/${arquivo.slice(2)}.ts`)
  const modulo = await carregar()
  const cor = modulo[exporta]
  if (typeof cor !== 'function') throw new Error(`${onde}.exporta: ${arquivo} não exporta a função "${exporta}"`)
  return { nome, casas, lado, cor: (u, v) => Number(Reflect.apply(cor, undefined, [u, v])) }
}

// ---------- as medidas (a conta de `embutidas.test.ts`) ----------

interface Medidas {
  emendaX: number
  emendaY: number
  vizinhoX: number
  vizinhoY: number
  maiorCanal: number
  cromaMedia: number
  cromaMaxima: number
  cromaP95: number
  desvioDaLuz: number
  faixaDaLuz: number
}

function luzDe(d: Uint8ClampedArray, i: number): number {
  return (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
}

function medir(d: Uint8ClampedArray, lado: number): Medidas {
  const L = (x: number, y: number) => luzDe(d, (y * lado + x) * 4)
  let emendaX = 0
  let emendaY = 0
  let vizinhoX = 0
  let vizinhoY = 0
  for (let k = 0; k < lado; k += 1) {
    emendaX += Math.abs(L(lado - 1, k) - L(0, k))
    emendaY += Math.abs(L(k, lado - 1) - L(k, 0))
  }
  for (let y = 0; y < lado; y += 1) {
    for (let x = 0; x < lado - 1; x += 1) {
      vizinhoX += Math.abs(L(x + 1, y) - L(x, y))
      vizinhoY += Math.abs(L(y, x + 1) - L(y, x))
    }
  }
  const luzes: number[] = []
  const cromas: number[] = []
  let maiorCanal = 0
  for (let i = 0; i < d.length; i += 4) {
    maiorCanal = Math.max(maiorCanal, d[i], d[i + 1], d[i + 2])
    cromas.push((Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])) / 255)
    luzes.push(luzDe(d, i))
  }
  const media = luzes.reduce((a, b) => a + b, 0) / luzes.length
  const desvio = Math.sqrt(luzes.reduce((a, b) => a + (b - media) ** 2, 0) / luzes.length)
  const ordem = [...luzes].sort((a, b) => a - b)
  const cromasEmOrdem = [...cromas].sort((a, b) => a - b)
  return {
    emendaX: emendaX / lado,
    emendaY: emendaY / lado,
    vizinhoX: vizinhoX / (lado * (lado - 1)),
    vizinhoY: vizinhoY / (lado * (lado - 1)),
    maiorCanal,
    cromaMedia: cromas.reduce((a, b) => a + b, 0) / cromas.length,
    cromaMaxima: cromasEmOrdem[cromasEmOrdem.length - 1],
    cromaP95: cromasEmOrdem[Math.floor(cromasEmOrdem.length * P95)],
    desvioDaLuz: desvio,
    faixaDaLuz: ordem[Math.floor(ordem.length * 0.99)] - ordem[Math.floor(ordem.length * 0.01)],
  }
}

/** O que passou do limite do portão, pelo nome curto (vazio = tudo dentro). */
function foraDoLimite(m: Medidas): string[] {
  const fora: string[] = []
  if (m.emendaX > m.vizinhoX * LIMITE.emendaVezes + LIMITE.emendaFolga || m.emendaY > m.vizinhoY * LIMITE.emendaVezes + LIMITE.emendaFolga) fora.push('EMENDA')
  // Toda textura nova é medida em casas: vale a régua da junta macia (metade da das outras).
  if (Math.max(m.vizinhoX, m.vizinhoY) > LIMITE.vizinhoEmCasas) fora.push('LISTRA')
  if (m.maiorCanal > LIMITE.maiorCanal) fora.push('BRANCO')
  if (m.cromaMaxima > LIMITE.cromaMaxima || m.cromaMedia > LIMITE.cromaMedia) fora.push('CROMA')
  if (m.desvioDaLuz > LIMITE.desvioDaLuz || m.faixaDaLuz > LIMITE.faixaDaLuz) fora.push('LUZ')
  return fora
}

const n3 = (x: number) => x.toFixed(3)
const n4 = (x: number) => x.toFixed(4)

function relatoDasMedidas(m: Medidas): string {
  return [
    `emenda ${n4(m.emendaX)}/${n4(m.emendaY)} (teto ${n4(m.vizinhoX * LIMITE.emendaVezes + LIMITE.emendaFolga)}/${n4(m.vizinhoY * LIMITE.emendaVezes + LIMITE.emendaFolga)})`,
    `listra ${n4(m.vizinhoX)}/${n4(m.vizinhoY)} (teto ${LIMITE.vizinhoEmCasas})`,
    `maior canal ${m.maiorCanal} (teto ${LIMITE.maiorCanal})`,
    `croma media ${n3(m.cromaMedia)} (teto ${LIMITE.cromaMedia}) max ${n3(m.cromaMaxima)} (teto ${LIMITE.cromaMaxima}) p95 ${n3(m.cromaP95)}`,
    `luz desvio ${n3(m.desvioDaLuz)} (teto ${LIMITE.desvioDaLuz}) faixa ${n3(m.faixaDaLuz)} (teto ${LIMITE.faixaDaLuz})`,
  ].join('; ')
}

async function sha256(bytes: Uint8ClampedArray): Promise<string> {
  const resumo = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return [...new Uint8Array(resumo)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function corMedia(d: Uint8ClampedArray): string {
  const soma = [0, 0, 0]
  for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c += 1) soma[c] += d[i + c]
  return `#${soma.map((s) => Math.round(s / (d.length / 4)).toString(16).padStart(2, '0')).join('')}`
}

// ---------- as janelas ----------

/**
 * Uma janela `largura` x `altura` do chão repetido, com o ladrilho ocupando
 * `ladoNaSaida` px, a partir do texel (`x0`, `y0`) dele: cada pixel é a média
 * dos texels que cobre (o ladrilho maior que a janela é reduzido sem serrilha;
 * o menor, ampliado sem borrão).
 */
function janela(ladrilho: Uint8ClampedArray, lado: number, ladoNaSaida: number, largura: number, altura: number, x0 = 0, y0 = 0): Uint8ClampedArray {
  const saida = new Uint8ClampedArray(largura * altura * 4)
  const f = lado / ladoNaSaida
  for (let y = 0; y < altura; y += 1) {
    const ya = Math.floor(y0 + y * f)
    const yb = Math.max(ya + 1, Math.floor(y0 + (y + 1) * f))
    for (let x = 0; x < largura; x += 1) {
      const xa = Math.floor(x0 + x * f)
      const xb = Math.max(xa + 1, Math.floor(x0 + (x + 1) * f))
      let r = 0
      let g = 0
      let b = 0
      for (let ty = ya; ty < yb; ty += 1) {
        const linha = (((ty % lado) + lado) % lado) * lado
        for (let tx = xa; tx < xb; tx += 1) {
          const i = (linha + (((tx % lado) + lado) % lado)) * 4
          r += ladrilho[i]
          g += ladrilho[i + 1]
          b += ladrilho[i + 2]
        }
      }
      const n = (yb - ya) * (xb - xa)
      const o = (y * largura + x) * 4
      saida[o] = r / n
      saida[o + 1] = g / n
      saida[o + 2] = b / n
      saida[o + 3] = 255
    }
  }
  return saida
}

interface Cartao {
  readonly textura: TexturaDaFolha
  readonly medidas: Medidas
  readonly fora: readonly string[]
  readonly ms: number
  readonly hash: string
  readonly media: string
  readonly grande: Uint8ClampedArray
  readonly mesa: Uint8ClampedArray
  readonly perto: Uint8ClampedArray
}

const LADO_DO_GRANDE = LADO_DA_COPIA * COPIAS
const MESA_L = MESA_EM_CASAS.largura * PX_POR_CASA_NA_MESA
const MESA_A = MESA_EM_CASAS.altura * PX_POR_CASA_NA_MESA
const ALTURA_DO_CARTAO = LINHA_DO_NOME + MARCA + LADO_DO_GRANDE + MARCA + LINHA * 2
const LARGURA_DO_CARTAO = MARCA + LADO_DO_GRANDE + MARCA + VAO + MESA_L

async function montarCartao(textura: TexturaDaFolha): Promise<Cartao> {
  const inicio = performance.now()
  const ladrilho = pixelsDoLadrilho(textura.cor, textura.lado)
  const ms = performance.now() - inicio
  // O portão mede na metade do lado: os mesmos pixels da régua da biblioteca.
  const medidas = medir(pixelsDoLadrilho(textura.cor, textura.lado / 2), textura.lado / 2)
  const pxPorCasa = textura.lado / textura.casas
  const perto = Math.round(PERTO_EM_CASAS * pxPorCasa)
  return {
    textura,
    medidas,
    fora: foraDoLimite(medidas),
    ms,
    hash: await sha256(ladrilho),
    media: corMedia(ladrilho),
    grande: janela(ladrilho, textura.lado, LADO_DA_COPIA, LADO_DO_GRANDE, LADO_DO_GRANDE),
    mesa: janela(ladrilho, textura.lado, textura.casas * PX_POR_CASA_NA_MESA, MESA_L, MESA_A),
    // O canto do ladrilho no meio da janela: as quatro cópias se encontram ali.
    perto: janela(ladrilho, textura.lado, (LADO_DA_COPIA * textura.casas) / PERTO_EM_CASAS, LADO_DA_COPIA, LADO_DA_COPIA, textura.lado - perto / 2, textura.lado - perto / 2),
  }
}

function retangulo(tela: Tela, x: number, y: number, l: number, a: number, cor: Rgb): void {
  const px = new Uint8ClampedArray(l * a * 4)
  for (let i = 0; i < px.length; i += 4) {
    px[i] = cor[0]
    px[i + 1] = cor[1]
    px[i + 2] = cor[2]
    px[i + 3] = 255
  }
  colar(tela, px, l, a, x, y)
}

/** As marcas que o NFD separa da letra (acento agudo, til, cedilha...). */
const MARCAS_DE_ACENTO = { de: 0x300, ate: 0x36f } as const

/** Sem acento: a fonte 5 x 7 da folha só tem as maiúsculas sem acento, os dígitos e , / +. */
function semAcento(texto: string): string {
  const letras = [...texto.normalize('NFD')].filter((letra) => {
    const codigo = letra.codePointAt(0) ?? 0
    return codigo < MARCAS_DE_ACENTO.de || codigo > MARCAS_DE_ACENTO.ate
  })
  return letras.join('').toUpperCase()
}

function desenharCartao(tela: Tela, c: Cartao, x: number, y: number): void {
  escrever(tela, semAcento(`${c.textura.nome}  ${c.textura.casas} CASAS, ${c.textura.lado} PX`), x, y, ESCALA_DO_NOME, TINTA)
  const gy = y + LINHA_DO_NOME + MARCA
  const gx = x + MARCA
  colar(tela, c.grande, LADO_DO_GRANDE, LADO_DO_GRANDE, gx, gy)
  // As marcas das emendas ficam FORA da imagem: dentro, esconderiam a emenda que a janela existe para mostrar.
  for (let k = 1; k < COPIAS; k += 1) {
    const p = k * LADO_DA_COPIA
    retangulo(tela, gx + p - 1, gy - MARCA, 2, MARCA - 1, APAGADA)
    retangulo(tela, gx + p - 1, gy + LADO_DO_GRANDE + 1, 2, MARCA - 1, APAGADA)
    retangulo(tela, gx - MARCA, gy + p - 1, MARCA - 1, 2, APAGADA)
    retangulo(tela, gx + LADO_DO_GRANDE + 1, gy + p - 1, MARCA - 1, 2, APAGADA)
  }
  escrever(tela, '3 X 3 LADRILHOS, MARCAS NAS EMENDAS', gx, gy + LADO_DO_GRANDE + MARCA + 4, ESCALA_DA_LETRA, APAGADA)
  const mx = gx + LADO_DO_GRANDE + MARCA + VAO
  colar(tela, c.mesa, MESA_L, MESA_A, mx, gy)
  escrever(tela, `MESA, ${PX_POR_CASA_NA_MESA} PX POR CASA`, mx, gy + MESA_A + 4, ESCALA_DA_LETRA, APAGADA)
  const py = gy + MESA_A + LINHA + 4
  colar(tela, c.perto, LADO_DA_COPIA, LADO_DA_COPIA, mx, py)
  escrever(tela, 'PERTO, 2 CASAS NO CANTO', mx + LADO_DA_COPIA + VAO, py, ESCALA_DA_LETRA, APAGADA)
  escrever(tela, 'DO LADRILHO', mx + LADO_DA_COPIA + VAO, py + LINHA, ESCALA_DA_LETRA, APAGADA)
  const veredito = c.fora.length === 0 ? 'MEDIDAS DENTRO DO PORTAO' : `FORA ${c.fora.join(',')}`
  escrever(tela, veredito, gx, gy + LADO_DO_GRANDE + MARCA + 4 + LINHA, ESCALA_DA_LETRA, c.fora.length === 0 ? TINTA : ALERTA)
}

function montarFolha(cartoes: readonly Cartao[]): Tela {
  const largura = MARGEM * 2 + LARGURA_DO_CARTAO
  const altura = MARGEM * 2 + cartoes.length * (ALTURA_DO_CARTAO + VAO)
  const tela = novaTela(largura, altura, FUNDO)
  cartoes.forEach((c, i) => desenharCartao(tela, c, MARGEM, MARGEM + i * (ALTURA_DO_CARTAO + VAO)))
  return tela
}

/** A régua de hoje: as medidas de cada textura da biblioteca, na mesma conta, para a nova comparar. */
function regua(): string[] {
  const linhas = ['', 'REGUA (biblioteca de hoje, medida na metade do lado como o portao):']
  let maiorP95 = { id: '', valor: 0 }
  let maiorP95EmCasas = { id: '', valor: 0 }
  for (const t of TEXTURAS_EMBUTIDAS) {
    const lado = (t.lado ?? LADOS_ACEITOS[0]) / 2
    const m = medir(pixelsDoLadrilho(t.cor, lado), lado)
    linhas.push(`- ${t.id}${t.casas === undefined ? '' : ` (${t.casas} casas)`}: croma p95 ${n3(m.cromaP95)}, media ${n3(m.cromaMedia)}, max ${n3(m.cromaMaxima)}; listra ${n4(Math.max(m.vizinhoX, m.vizinhoY))}; luz desvio ${n3(m.desvioDaLuz)} faixa ${n3(m.faixaDaLuz)}`)
    if (m.cromaP95 > maiorP95.valor) maiorP95 = { id: t.id, valor: m.cromaP95 }
    if (t.casas !== undefined && m.cromaP95 > maiorP95EmCasas.valor) maiorP95EmCasas = { id: t.id, valor: m.cromaP95 }
  }
  linhas.push(`maior croma p95 da biblioteca: ${n3(maiorP95.valor)} (${maiorP95.id}); dos chaos em casas: ${n3(maiorP95EmCasas.valor)} (${maiorP95EmCasas.id})`)
  return linhas
}

it.skipIf(!PEDIDA)('gera a folha das texturas novas do pedido', { timeout: TETO_DA_FOLHA_MS }, async () => {
  if (typeof PEDIDO !== 'string') return
  const inicio = performance.now()
  const node = await nodeDaFolha()
  const caminhoDoPedido = node.path.resolve(PEDIDO)
  const pedido = lerPedido(node.fs.readFileSync(caminhoDoPedido, 'utf8'))
  const saida = node.path.resolve(node.path.dirname(caminhoDoPedido), pedido.saida)
  // Uma textura por vez: o tempo de cada ladrilho é medido sem outro pintando junto.
  const cartoes: Cartao[] = []
  for (const [i, item] of pedido.itens.entries()) cartoes.push(await montarCartao(await texturaDoItem(item, i)))
  const tela = montarFolha(cartoes)
  node.fs.mkdirSync(node.path.dirname(saida), { recursive: true })
  node.fs.writeFileSync(saida, emPng(tela))
  const relato = cartoes.map(
    (c, i) =>
      `${i + 1}. ${c.textura.nome} (${c.textura.casas} casas, ladrilho ${c.textura.lado} px): ${c.fora.length === 0 ? 'DENTRO' : `FORA ${c.fora.join(', ')}`}; ` +
      `ladrilho em ${Math.round(c.ms)} ms; ${relatoDasMedidas(c.medidas)}; cor media ${c.media}; sha256 ${c.hash}`,
  )
  if (pedido.regua) relato.push(...regua())
  relato.push(`folha: ${saida} (${tela.largura} x ${tela.altura} px, ${cartoes.length} itens, ${Math.round(performance.now() - inicio)} ms no total)`)
  node.fs.writeFileSync(saida.replace(/\.png$/i, '.txt'), new TextEncoder().encode(`${relato.join('\n')}\n`))
  for (const linha of relato) console.log(linha)
})
