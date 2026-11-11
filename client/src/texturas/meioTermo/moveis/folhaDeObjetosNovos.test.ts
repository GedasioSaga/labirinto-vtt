import { it, vi } from 'vitest'
import { criarMovel, ehMovelDoChao, ROTULO_MOBILIA } from '../../../lib/mobilia'
import { chaveDoMovel, SEMENTES } from '../../../pixi/rasterDosMoveis'
import { LADO_DO_PEDACO } from '../chaoNoMundo'
import { chaoDe, pintarRegiao, type Regiao } from '../chaoNoMundo.testkit'
import { G, materialDaPeca, type MontarMovel } from './contexto'
import { colar, emPng, escrever, novaTela, type Tela } from './folhaDeContato.testkit'
import { lerPedido, TERMINA_EM_PNG, type ItemDoPedido, type ItemNovo } from './folhaDeObjetosNovos.testkit'
import { escalaDoNivel, GRADE_DE_REFERENCIA, montarCena, type TipoComTextura } from './index'
import { ALFA_DE_PECA, digitalDosPixels, medirImagem } from './medidas.testkit'
import { criarPecas, pintarCena, PISO_DE_LUZ, type Cena, type LimitesDaImagem, type MaterialDaPeca } from './motor'
import { cenaEmTresQuartos, perfilDoTresQuartos } from './tresQuartos'

/**
 * FOLHA DE CONTATO DOS OBJETOS NOVOS (lote 0 dos 95 objetos, 11/11/2026): a
 * ferramenta com que o desenhista olha o próprio objeto ANTES de ele entrar no
 * catálogo e com que o integrador gera a folha do lote. Sem navegador: pinta
 * com o motor (`pintarCena`), cola numa tela em memória e grava o PNG.
 *
 * Cada item sai sobre TERRA e sobre LAJOTAS CLARAS (o chão de verdade do app,
 * `chaoNoMundo.ts`, sem as manchas): à esquerda, de cima e em 3/4 no zoom do
 * item (4x o tamanho de mesa; menos, de meio em meio, quando o maior lado
 * passaria de 500 px); à direita, os dois no tamanho de mesa (1x, 50 px por
 * casa). Embaixo, o nome, a pegada, o perfil da 3/4 e as medidas do portão;
 * em vermelho, o que está fora do limite.
 *
 * O PORTÃO é o corpo do teste da 3/4 (`tresQuartos.test.ts:85-108`) repetido
 * aqui, para o desenhista saber antes da integração: de cima e 3/4 nos níveis
 * 1 e 3, a 3/4 duas vezes (mesma entrada, mesma imagem), saturação p95,
 * contorno, piso de luz, e o tampo que sobe (ou a sombra de baixo, no objeto
 * em pé). O tempo impresso é o desse corpo, o que o teto de 5 s por tipo mede.
 * Nada disso reprova a folha: ela é para olhar; o que está fora sai escrito.
 *
 * COMO RODAR, de `C:/dev/labirinto/client` (o caminho do pedido vai na
 * variável `FOLHA_DE_OBJETOS`, absoluto ou a partir de `client/`):
 *
 *   FOLHA_DE_OBJETOS=../tmp/objetos-2026-11-11/lote-00/pedido.json rtk proxy npx vitest run src/texturas/meioTermo/moveis/folhaDeObjetosNovos.test.ts
 *
 * (no PowerShell: `$env:FOLHA_DE_OBJETOS='../tmp/...'; rtk proxy npx vitest run src/...`).
 * Sem a variável o teste é pulado e o arquivo não faz nada. As medidas saem no
 * console e num `.txt` ao lado do PNG, com o mesmo nome: o vitest 4 esconde o
 * console do teste que passa (como anota `chaoNoMundo.testkit.ts`), então quem
 * roda por agente lê o `.txt`.
 *
 * O PEDIDO (JSON, conferido em `folhaDeObjetosNovos.testkit.ts`). A `saida` é
 * a partir da pasta do pedido. Item do catálogo: só `tipo`. Montador ainda sem
 * registro: `arquivo` (o módulo ao lado deste teste) e `exporta`, mais `nome`,
 * `largura` e `altura` em casas; opcionais: `perfil` da 3/4 ("DERIVADO", o
 * padrão, "EM_PE", ou o objeto com os ajustes de `tresQuartos.ts`, as medidas
 * em casas), `materiais` (os lugares que o desenho lê em `c.m`) e `chao`.
 *
 *   {
 *     "saida": "folha.png",
 *     "itens": [
 *       { "tipo": "barril" },
 *       { "arquivo": "./pilar", "exporta": "montarPilar", "nome": "Pilar", "largura": 1, "altura": 1 },
 *       { "arquivo": "./banco", "exporta": "montarBanco", "nome": "Banco de praça", "largura": 2, "altura": 0.75,
 *         "perfil": { "modo": "derivado", "espessuraEmCasas": 0.1 }, "materiais": { "madeira": "nogueira" } },
 *       { "arquivo": "./circulo", "exporta": "montarCirculo", "nome": "Círculo mágico", "largura": 3, "altura": 3, "chao": true }
 *     ]
 *   }
 *
 * Ajustes do perfil: `alturaSoltaEmCasas`, `espessuraEmCasas` (maior que a
 * altura = a beirada desce até o chão, o `Infinity` da sebe), `posteEmCasas`,
 * `sombrasSobem` e `forcaDaSombraDeBaixo`.
 */

const PEDIDO: unknown = import.meta.env.FOLHA_DE_OBJETOS
const PEDIDA = typeof PEDIDO === 'string' && PEDIDO !== ''
/** A folha de 10 objetos grandes passa dos 5 s do padrão do vitest: o teto aqui é o da folha inteira. */
const TETO_DA_FOLHA_MS = 10 * 60_000

/** Os números do portão da 3/4 (`tresQuartos.test.ts:85-108`): se mudarem lá, mudam aqui. */
const TETO_DO_PORTAO_MS = 5000
const TETO_DA_SATURACAO = 0.62
const CONTORNO_MINIMO = 0.06
const FOLGA_DO_PISO_DE_LUZ = 0.002
const FOLGA_DA_SOMBRA_DE_BAIXO = 1.02
const SUBIDA_MINIMA_DO_TAMPO = 1
const NIVEL_DE_MESA = 1
const NIVEL_DE_PERTO = 3

/** A janela grande: 4x o tamanho de mesa, enquanto o maior lado do objeto couber em `LADO_MAXIMO_DO_GRANDE` px. */
const ZOOM_GRANDE = 4
const LADO_MAXIMO_DO_GRANDE = 500
/** As larguras de fileira que a folha tenta, em vezes o cartão mais largo (`emFileiras` fica com a mais quadrada). */
const FILEIRAS_A_TENTAR: readonly number[] = [1, 1.25, 1.5, 2, 2.5, 3]

type Rgb = readonly [number, number, number]
const FUNDO: Rgb = [0x2a, 0x24, 0x20]
const TINTA: Rgb = [0xee, 0xe4, 0xd8]
const APAGADA: Rgb = [0xb0, 0xa4, 0x96]
const ALERTA: Rgb = [0xf2, 0x7d, 0x5c]
const MARGEM = 24
/** Entre os cartões e entre os dois chãos de um cartão. */
const VAO = 16
/** O chão que sobra em volta de cada imagem dentro da janela. */
const RESPIRO = 14
/** Entre a janela grande e a de mesa do mesmo chão. */
const FRESTA = 6
const ESCALA_DO_NOME = 3
const ESCALA_DA_LETRA = 2
/** A fonte de `folhaDeContato.testkit.ts`: 5 x 7 pontos, mais 1 de espaço entre as letras. */
const ALTURA_DA_LETRA = 7
const PASSO_DA_LETRA = 6
const LINHA_DO_NOME = ALTURA_DA_LETRA * ESCALA_DO_NOME + 8
const LINHA = ALTURA_DA_LETRA * ESCALA_DA_LETRA + 8
const CABECALHO = 'EM CADA CHAO, A ESQUERDA DE CIMA E 3/4 NO ZOOM DO ITEM, A DIREITA OS DOIS NO TAMANHO DE MESA'

/** Os dois chãos da folha, do catálogo de texturas: a Terra e as Lajotas de pedra claras. */
const CHAOS: readonly { readonly id: string; readonly nome: string }[] = [
  { id: 'terra', nome: 'TERRA' },
  { id: 'lajotas', nome: 'LAJOTAS CLARAS' },
]
/** O mapa do chão: o tamanho do mapa de prova dos testes do chão, na grade em que os objetos são desenhados. */
const MAPA_DA_FOLHA = { width: 30, height: 20, grid: GRADE_DE_REFERENCIA }
/** Mais chão que isto não é pintado: a janela maior que 4 pedaços repete o chão (só um objeto gigante chega lá). */
const PEDACOS_MAXIMOS_DO_CHAO = 4

/**
 * O pedaço do Node que a folha usa, pelo `vi.importActual` (o molde de
 * `pacoteCompilado.test.ts`): o projeto não tem `@types/node`, então só estas
 * assinaturas são descritas.
 */
async function nodeDaFolha() {
  const fs = await vi.importActual<{
    readFileSync(caminho: string, codificacao: 'utf8'): string
    writeFileSync(caminho: string, dados: Uint8Array): void
    mkdirSync(caminho: string, opcoes: { recursive: true }): string | undefined
  }>('node:fs')
  const path = await vi.importActual<{ dirname(caminho: string): string; resolve(...partes: string[]): string }>('node:path')
  return { fs, path }
}

/** Os módulos de `moveis/` que podem trazer um montador: os desenhos, sem os testes nem os ajudantes de teste. */
const MODULOS = import.meta.glob<Readonly<Record<string, unknown>>>(['./*.ts', '!./*.test.ts', '!./*.testkit.ts', '!./*.d.ts'])

// ---------- o objeto: do catálogo ou ainda sem registro ----------

type Vista = 'de-cima' | 'tres-quartos'

interface ObjetoDaFolha {
  readonly nome: string
  /** Pegada em casas. */
  readonly casasW: number
  readonly casasH: number
  /** Em pé na 3/4 (só ganha a sombra de baixo) ou derivado (o tampo sobe): escolhe a regra do portão. */
  readonly emPe: boolean
  readonly chao: boolean
  /** A cena da vista, montada de novo a cada chamada (como o app: uma cena por imagem). */
  cena(vista: Vista): Cena
}

/** O tipo do catálogo como o APP o pede: o tamanho, os materiais e a semente de partida (`chaveDoMovel`). */
function objetoRegistrado(tipo: TipoComTextura): ObjetoDaFolha {
  const prop = criarMovel(tipo, { x: 0, y: 0 }, GRADE_DE_REFERENCIA, `folha-${tipo}`)
  const deCima = chaveDoMovel(prop, 1, 1)
  const tres = chaveDoMovel(prop, 1, 1, 'tres-quartos')
  if (deCima === null || tres === null) throw new Error(`${tipo}: sem desenho com textura`)
  return {
    nome: ROTULO_MOBILIA[tipo],
    casasW: deCima.desenho.casasW,
    casasH: deCima.desenho.casasH,
    emPe: perfilDoTresQuartos(tipo, deCima.desenho.lado).modo === 'em-pe',
    chao: ehMovelDoChao(tipo),
    cena: (vista) => montarCena(vista === 'tres-quartos' ? tres.desenho : deCima.desenho),
  }
}

/**
 * O que o módulo exporta com esse nome serve de montador? Em tempo de
 * execução só dá para conferir que é uma função; a assinatura quem garante é
 * o `tsc` no arquivo do desenho (`export const montarX: MontarMovel`).
 */
function ehMontador(valor: unknown): valor is MontarMovel {
  return typeof valor === 'function'
}

async function montadorDoItem(item: ItemNovo): Promise<MontarMovel> {
  if (!Object.hasOwn(MODULOS, item.modulo)) throw new Error(`${item.modulo}: não há esse arquivo em moveis/ (o "arquivo" do pedido é o módulo ao lado deste teste, como "./pilar")`)
  const modulo = await MODULOS[item.modulo]()
  const montar = modulo[item.exporta]
  if (!ehMontador(montar)) throw new Error(`${item.modulo} não exporta a função "${item.exporta}" (exporta: ${Object.keys(modulo).join(', ')})`)
  return montar
}

/**
 * A semente do veio do objeto ainda sem registro: sai do nome do montador,
 * inteira e pequena como a do app. Depois de registrado a semente é a da chave
 * da imagem (`rasterDosMoveis.ts`): o veio muda de lugar, o desenho não.
 */
function sementeDoNome(nome: string): number {
  let semente = 0
  for (let i = 0; i < nome.length; i += 1) semente = (semente * 31 + nome.charCodeAt(i)) % SEMENTES
  return semente
}

/**
 * O montador sem registro, pintado como `montarCena` (`index.ts`) pinta os do
 * catálogo: o mesmo contexto (de frente, sem forma, curva, variante nem giro)
 * e a mesma passagem para a 3/4, com o perfil do pedido no lugar de `PERFIS`.
 */
function objetoNovo(item: ItemNovo, montar: MontarMovel): ObjetoDaFolha {
  const w = item.largura * G
  const h = item.altura * G
  const m: Record<string, MaterialDaPeca> = {}
  for (const [lugar, id] of Object.entries(item.materiais)) m[lugar] = materialDaPeca(id)
  const semente = sementeDoNome(item.exporta)
  return {
    nome: item.nome,
    casasW: item.largura,
    casasH: item.altura,
    emPe: item.perfil.modo === 'em-pe',
    chao: item.chao,
    cena(vista) {
      const cena: Cena = { partes: [], sombras: [] }
      const peca = criarPecas(semente)
      try {
        montar({ w, h, hw: w / 2, hh: h / 2, g: G, lado: 'frente', m, peca, forma: 'retangular', curva: 0, variante: 0, giro: 0 }, cena)
      } catch (erro) {
        const lugares = Object.keys(m).join(', ') || 'nenhum'
        throw new Error(`${item.exporta} falhou ao montar a cena. Se o desenho lê c.m.<lugar>, o lugar tem de estar em "materiais" do pedido (declarados: ${lugares}).`, { cause: erro })
      }
      return vista === 'tres-quartos' ? cenaEmTresQuartos(cena, item.perfil, peca) : cena
    },
  }
}

async function objetoDoItem(item: ItemDoPedido): Promise<ObjetoDaFolha> {
  return item.registrado ? objetoRegistrado(item.tipo) : objetoNovo(item, await montadorDoItem(item))
}

// ---------- pintar e medir ----------

interface Pintada {
  readonly px: Uint8ClampedArray
  /** Onde a imagem fica em volta do centro do objeto (px do protótipo) e o tamanho dela (pixels). */
  readonly limites: LimitesDaImagem
  /** Pixels da imagem por px do protótipo. */
  readonly S: number
  /** O canto da imagem em relação ao centro do objeto, em pixels da imagem. */
  readonly x0: number
  readonly y0: number
}

function pintar(cena: Cena, S: number): Pintada {
  const { limites, pixels } = pintarCena(cena, S)
  return { px: pixels, limites, S, x0: Math.round(limites.x0 * S), y0: Math.round(limites.y0 * S) }
}

/** O y (px do protótipo, em volta do centro) da linha mais alta com pixel de peça: a conta de `tresQuartos.test.ts`. */
function topoDasPecas(p: Pintada): number {
  const { W, H, y0 } = p.limites
  for (let j = 0; j < H; j += 1) for (let i = 0; i < W; i += 1) if (p.px[(j * W + i) * 4 + 3] >= ALFA_DE_PECA) return y0 + j / p.S
  return Infinity
}

/** Soma do alfa da sombra no chão (pixels que não são de peça): a conta de `tresQuartos.test.ts`. */
function alfaDaSombra(p: Pintada): number {
  let soma = 0
  for (let k = 3; k < p.px.length; k += 4) if (p.px[k] < ALFA_DE_PECA) soma += p.px[k]
  return soma
}

interface MedidaDoNivel {
  readonly deCima: Pintada
  readonly tres: Pintada
  readonly difere: boolean
  readonly repete: boolean
  readonly saturacaoP95: number
  readonly contornoMinimo: number
  readonly luzMinima: number
}

function medirNoNivel(o: ObjetoDaFolha, nivel: number): MedidaDoNivel {
  const S = escalaDoNivel(nivel)
  const deCima = pintar(o.cena('de-cima'), S)
  const tres = pintar(o.cena('tres-quartos'), S)
  const digital = digitalDosPixels(tres.px)
  const m = medirImagem(tres.px, tres.limites.W, tres.limites.H, o.casasW * o.casasH * G * G * S * S)
  return {
    deCima,
    tres,
    difere: digital !== digitalDosPixels(deCima.px),
    repete: digitalDosPixels(pintar(o.cena('tres-quartos'), S).px) === digital,
    saturacaoP95: m.saturacaoP95,
    contornoMinimo: m.contornoMinimo,
    luzMinima: m.luminanciaLinearMinima,
  }
}

interface Portao {
  /** O tempo do corpo do teste da 3/4 para este objeto (o que o teto de 5 s por tipo mede). */
  readonly ms: number
  readonly saturacaoP95: number
  readonly contornoMinimo: number
  readonly luzMinima: number
  /** A 3/4 é outra imagem que a de cima. */
  readonly difere: boolean
  /** A mesma entrada deu a mesma imagem. */
  readonly repete: boolean
  /** O tampo sobe (derivado) ou a sombra de baixo aparece (em pé). */
  readonly assenta: boolean
  /** De cima e 3/4 no nível 1, o tamanho de mesa: a folha mostra estas em vez de pintar de novo. */
  readonly naMesa: readonly [Pintada, Pintada]
}

function passarNoPortao(o: ObjetoDaFolha): Portao {
  const inicio = performance.now()
  const mesa = medirNoNivel(o, NIVEL_DE_MESA)
  const perto = medirNoNivel(o, NIVEL_DE_PERTO)
  const assenta = o.emPe
    ? alfaDaSombra(perto.tres) > alfaDaSombra(perto.deCima) * FOLGA_DA_SOMBRA_DE_BAIXO
    : topoDasPecas(perto.tres) <= topoDasPecas(perto.deCima) - SUBIDA_MINIMA_DO_TAMPO
  return {
    ms: performance.now() - inicio,
    saturacaoP95: Math.max(mesa.saturacaoP95, perto.saturacaoP95),
    contornoMinimo: Math.min(mesa.contornoMinimo, perto.contornoMinimo),
    luzMinima: Math.min(mesa.luzMinima, perto.luzMinima),
    difere: mesa.difere && perto.difere,
    repete: mesa.repete && perto.repete,
    assenta,
    naMesa: [mesa.deCima, mesa.tres],
  }
}

/**
 * O que está fora do portão. No objeto de chão a 3/4 igual à de cima e o
 * tampo que não sobe são o esperado (o fogo e o campinho têm essa exceção
 * escrita no teste; o integrador escreve a do objeto novo).
 */
function foraDoPortao(o: ObjetoDaFolha, p: Portao): string[] {
  const fora: string[] = []
  if (p.ms > TETO_DO_PORTAO_MS) fora.push('tempo')
  if (p.saturacaoP95 > TETO_DA_SATURACAO) fora.push('saturação')
  if (p.contornoMinimo < CONTORNO_MINIMO) fora.push('contorno')
  if (p.luzMinima < PISO_DE_LUZ - FOLGA_DO_PISO_DE_LUZ) fora.push('piso de luz')
  if (!p.repete) fora.push('a mesma entrada deu outra imagem')
  if (!o.chao && !p.difere) fora.push('3/4 igual à de cima')
  if (!o.chao && !p.assenta) fora.push(o.emPe ? 'sem sombra de baixo' : 'o tampo não sobe')
  return fora
}

// ---------- a folha ----------

interface Janela {
  /** Quantas vezes o tamanho de mesa. */
  readonly zoom: number
  readonly largura: number
  readonly altura: number
  /** Cada imagem e o canto dela dentro da janela. */
  readonly imagens: readonly { readonly pintada: Pintada; readonly x: number; readonly y: number }[]
}

/** As vistas lado a lado, com os centros na mesma linha (a 3/4 sobe acima da de cima). */
function janelaLadoALado(zoom: number, pintadas: readonly Pintada[]): Janela {
  const acima = Math.max(...pintadas.map((p) => -p.y0))
  const abaixo = Math.max(...pintadas.map((p) => p.limites.H + p.y0))
  let x = RESPIRO
  const imagens = pintadas.map((pintada) => {
    const canto = { pintada, x, y: RESPIRO + acima + pintada.y0 }
    x += pintada.limites.W + RESPIRO
    return canto
  })
  return { zoom, largura: x, altura: RESPIRO + acima + abaixo + RESPIRO, imagens }
}

/** As vistas empilhadas, com os centros na mesma coluna: o tamanho de mesa cabe numa coluna estreita. */
function janelaEmPilha(zoom: number, pintadas: readonly Pintada[]): Janela {
  const esquerda = Math.max(...pintadas.map((p) => -p.x0))
  const direita = Math.max(...pintadas.map((p) => p.limites.W + p.x0))
  let y = RESPIRO
  const imagens = pintadas.map((pintada) => {
    const canto = { pintada, x: RESPIRO + esquerda + pintada.x0, y }
    y += pintada.limites.H + RESPIRO
    return canto
  })
  return { zoom, largura: RESPIRO + esquerda + direita + RESPIRO, altura: y, imagens }
}

/** A fonte da folha só tem maiúsculas sem acento, dígitos e `, / +`: o resto sairia em branco. */
function emLetrasDaFolha(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()
}

function larguraDoTexto(texto: string, escala: number): number {
  return texto.length * PASSO_DA_LETRA * escala
}

function comVirgula(valor: number, decimais: number): string {
  return valor.toFixed(decimais).replace('.', ',')
}

/** Número curto, com vírgula e sem zeros à direita: 1, 1,25, 3,5. */
function curto(valor: number): string {
  return String(Number(valor.toFixed(2))).replace('.', ',')
}

/** 4x, ou menos (de meio em meio) quando o maior lado do objeto passaria de `LADO_MAXIMO_DO_GRANDE`; nunca menos que o de mesa. */
function zoomDoItem(o: ObjetoDaFolha): number {
  const cabe = LADO_MAXIMO_DO_GRANDE / (Math.max(o.casasW, o.casasH) * GRADE_DE_REFERENCIA)
  return Math.max(NIVEL_DE_MESA, Math.min(ZOOM_GRANDE, Math.floor(cabe * 2) / 2))
}

interface Cartao {
  readonly objeto: ObjetoDaFolha
  readonly portao: Portao
  readonly fora: readonly string[]
  /** O tempo de pintar as duas vistas da janela grande. */
  readonly msDaJanelaGrande: number
  readonly grande: Janela
  readonly mesa: Janela
  readonly alturaDasJanelas: number
  /** As duas linhas pequenas da legenda, embaixo do nome. */
  readonly detalhes: string
  readonly medidas: string
  readonly largura: number
  readonly altura: number
}

function montarCartao(objeto: ObjetoDaFolha): Cartao {
  const portao = passarNoPortao(objeto)
  const fora = foraDoPortao(objeto, portao)
  const zoom = zoomDoItem(objeto)
  const S = escalaDoNivel(zoom)
  const inicio = performance.now()
  const grande = janelaLadoALado(zoom, [pintar(objeto.cena('de-cima'), S), pintar(objeto.cena('tres-quartos'), S)])
  const msDaJanelaGrande = performance.now() - inicio
  const mesa = janelaEmPilha(NIVEL_DE_MESA, portao.naMesa)
  const alturaDasJanelas = Math.max(grande.altura, mesa.altura)
  const detalhes = emLetrasDaFolha(`${curto(objeto.casasW)} x ${curto(objeto.casasH)} casas, 3/4 ${objeto.emPe ? 'em pé' : 'derivado'}${objeto.chao ? ', objeto de chão' : ''}`)
  const medidas = emLetrasDaFolha(
    `sat ${comVirgula(portao.saturacaoP95, 2)}, contorno ${comVirgula(portao.contornoMinimo, 2)}, portão ${Math.round(portao.ms)} ms${fora.length > 0 ? `, fora ${fora.join(' + ')}` : ''}`,
  )
  const larguraDosChaos = CHAOS.length * (grande.largura + FRESTA + mesa.largura) + (CHAOS.length - 1) * VAO
  return {
    objeto,
    portao,
    fora,
    msDaJanelaGrande,
    grande,
    mesa,
    alturaDasJanelas,
    detalhes,
    medidas,
    largura: Math.max(larguraDosChaos, larguraDoTexto(objeto.nome, ESCALA_DO_NOME), larguraDoTexto(detalhes, ESCALA_DA_LETRA), larguraDoTexto(medidas, ESCALA_DA_LETRA)),
    altura: LINHA + alturaDasJanelas + RESPIRO + LINHA_DO_NOME + LINHA * 2,
  }
}

/** A linha do item no console e no `.txt`: o que o portão mediu, com o limite ao lado. */
function relatoDoCartao(c: Cartao): string {
  const { objeto: o, portao: p } = c
  const simOuNao = (sim: boolean): string => (sim ? 'sim' : 'não')
  return [
    `${o.nome} (${curto(o.casasW)} x ${curto(o.casasH)} casas, 3/4 ${o.emPe ? 'em pé' : 'derivado'}${o.chao ? ', objeto de chão' : ''}): portão da 3/4 ${Math.round(p.ms)} ms de ${TETO_DO_PORTAO_MS}`,
    `janela grande a ${curto(c.grande.zoom)}x ${Math.round(c.msDaJanelaGrande)} ms`,
    `saturação p95 ${comVirgula(p.saturacaoP95, 3)} (teto ${comVirgula(TETO_DA_SATURACAO, 2)})`,
    `contorno ${comVirgula(p.contornoMinimo, 3)} (mínimo ${comVirgula(CONTORNO_MINIMO, 2)})`,
    `luz mínima ${comVirgula(p.luzMinima, 3)} (piso ${comVirgula(PISO_DE_LUZ - FOLGA_DO_PISO_DE_LUZ, 3)})`,
    `3/4 difere da de cima: ${simOuNao(p.difere)}`,
    `repete igual: ${simOuNao(p.repete)}`,
    `${o.emPe ? 'sombra de baixo' : 'o tampo sobe'}: ${simOuNao(p.assenta)}`,
    c.fora.length > 0 ? `FORA DO PORTÃO: ${c.fora.join(' + ')}` : 'dentro do portão',
  ].join(' | ')
}

interface ChaoDaFolha {
  readonly nome: string
  readonly regiao: Regiao
}

/** Os dois chãos, pintados uma vez no tamanho da maior janela (em px do mundo: a janela grande vê menos chão). */
function pintarChaos(cartoes: readonly Cartao[]): ChaoDaFolha[] {
  let largura = 1
  let altura = 1
  for (const c of cartoes) {
    for (const janela of [c.grande, c.mesa]) {
      largura = Math.max(largura, janela.largura / janela.zoom)
      altura = Math.max(altura, c.alturaDasJanelas / janela.zoom)
    }
  }
  const colunas = Math.min(PEDACOS_MAXIMOS_DO_CHAO, Math.ceil(largura / LADO_DO_PEDACO))
  const linhas = Math.min(PEDACOS_MAXIMOS_DO_CHAO, Math.ceil(altura / LADO_DO_PEDACO))
  // Sem as manchas: é o padrão do mapa (`MapData.manchasDoChao` ausente).
  return CHAOS.map(({ id, nome }) => ({ nome, regiao: pintarRegiao({ ...chaoDe(id, MAPA_DA_FOLHA), manchas: false }, 0, 0, colunas, linhas) }))
}

/**
 * Enche o retângulo com o chão visto no `zoom`: cada pixel lê o chão em
 * (i, j) / zoom, entre os 4 vizinhos (o filtro linear da tela ao aproximar o
 * mapa). Passando da região, o chão dá a volta.
 */
function estenderChao(tela: Tela, chao: Regiao, x: number, y: number, largura: number, altura: number, zoom: number): void {
  for (let j = 0; j < altura; j += 1) {
    const v = j / zoom
    const v0 = Math.floor(v)
    const fv = v - v0
    const linha0 = (v0 % chao.altura) * chao.largura
    const linha1 = ((v0 + 1) % chao.altura) * chao.largura
    for (let i = 0; i < largura; i += 1) {
      const u = i / zoom
      const u0 = Math.floor(u)
      const fu = u - u0
      const coluna0 = u0 % chao.largura
      const coluna1 = (u0 + 1) % chao.largura
      const destino = ((y + j) * tela.largura + x + i) * 3
      for (let k = 0; k < 3; k += 1) {
        const cima = chao.rgba[(linha0 + coluna0) * 4 + k] * (1 - fu) + chao.rgba[(linha0 + coluna1) * 4 + k] * fu
        const baixo = chao.rgba[(linha1 + coluna0) * 4 + k] * (1 - fu) + chao.rgba[(linha1 + coluna1) * 4 + k] * fu
        tela.rgb[destino + k] = Math.round(cima * (1 - fv) + baixo * fv)
      }
    }
  }
}

function desenharJanela(tela: Tela, janela: Janela, x: number, y: number, altura: number, chao: Regiao): void {
  estenderChao(tela, chao, x, y, janela.largura, altura, janela.zoom)
  const folga = Math.floor((altura - janela.altura) / 2)
  for (const { pintada, x: dx, y: dy } of janela.imagens) colar(tela, pintada.px, pintada.limites.W, pintada.limites.H, x + dx, y + folga + dy)
}

function desenharCartao(tela: Tela, c: Cartao, x: number, y: number, chaos: readonly ChaoDaFolha[]): void {
  chaos.forEach((chao, k) => {
    const xDoChao = x + k * (c.grande.largura + FRESTA + c.mesa.largura + VAO)
    const xDaMesa = xDoChao + c.grande.largura + FRESTA
    escrever(tela, `${chao.nome} ${curto(c.grande.zoom)}X`, xDoChao, y, ESCALA_DA_LETRA, APAGADA)
    escrever(tela, 'MESA', xDaMesa, y, ESCALA_DA_LETRA, APAGADA)
    desenharJanela(tela, c.grande, xDoChao, y + LINHA, c.alturaDasJanelas, chao.regiao)
    desenharJanela(tela, c.mesa, xDaMesa, y + LINHA, c.alturaDasJanelas, chao.regiao)
  })
  const yDoNome = y + LINHA + c.alturaDasJanelas + RESPIRO
  escrever(tela, emLetrasDaFolha(c.objeto.nome), x, yDoNome, ESCALA_DO_NOME, TINTA)
  escrever(tela, c.detalhes, x, yDoNome + LINHA_DO_NOME, ESCALA_DA_LETRA, APAGADA)
  escrever(tela, c.medidas, x, yDoNome + LINHA_DO_NOME + LINHA, ESCALA_DA_LETRA, c.fora.length > 0 ? ALERTA : APAGADA)
}

/** Os cartões em fileiras, na ordem do pedido: a fileira quebra quando o próximo não cabe em `limite`. */
function quebrarEmFileiras(cartoes: readonly Cartao[], limite: number): Cartao[][] {
  const fileiras: Cartao[][] = []
  let fileira: Cartao[] = []
  let largura = 0
  for (const cartao of cartoes) {
    const comEste = fileira.length === 0 ? cartao.largura : largura + VAO + cartao.largura
    if (fileira.length > 0 && comEste > limite) {
      fileiras.push(fileira)
      fileira = [cartao]
      largura = cartao.largura
    } else {
      fileira.push(cartao)
      largura = comEste
    }
  }
  if (fileira.length > 0) fileiras.push(fileira)
  return fileiras
}

function larguraDaFileira(fileira: readonly Cartao[]): number {
  return fileira.reduce((soma, c) => soma + c.largura, 0) + (fileira.length - 1) * VAO
}

function alturaDaFileira(fileira: readonly Cartao[]): number {
  return Math.max(...fileira.map((c) => c.altura))
}

/**
 * As fileiras que deixam a folha mais perto de quadrada (o menor lado maior):
 * quem lê a folha por ferramenta recebe a imagem reduzida, e a folha comprida
 * numa coluna só perde nitidez à toa. Tenta fileiras da largura do cartão mais
 * largo até 3 vezes ela.
 */
function emFileiras(cartoes: readonly Cartao[]): Cartao[][] {
  const maisLargo = Math.max(...cartoes.map((c) => c.largura))
  let melhores: Cartao[][] = []
  let menorLado = Infinity
  for (const vezes of FILEIRAS_A_TENTAR) {
    const fileiras = quebrarEmFileiras(cartoes, maisLargo * vezes)
    const largura = Math.max(...fileiras.map(larguraDaFileira))
    const altura = fileiras.reduce((soma, fileira) => soma + VAO + alturaDaFileira(fileira), 0)
    if (Math.max(largura, altura) < menorLado) {
      melhores = fileiras
      menorLado = Math.max(largura, altura)
    }
  }
  return melhores
}

function montarFolha(cartoes: readonly Cartao[]): Tela {
  const fileiras = emFileiras(cartoes)
  const alturas = fileiras.map(alturaDaFileira)
  const largura = MARGEM * 2 + Math.max(...fileiras.map(larguraDaFileira), larguraDoTexto(CABECALHO, ESCALA_DA_LETRA))
  const altura = MARGEM * 2 + LINHA + alturas.reduce((soma, a) => soma + VAO + a, 0)
  const tela = novaTela(largura, altura, FUNDO)
  escrever(tela, CABECALHO, MARGEM, MARGEM, ESCALA_DA_LETRA, APAGADA)
  const chaos = pintarChaos(cartoes)
  let y = MARGEM + LINHA + VAO
  fileiras.forEach((fileira, f) => {
    let x = MARGEM
    for (const cartao of fileira) {
      desenharCartao(tela, cartao, x, y, chaos)
      x += cartao.largura + VAO
    }
    y += alturas[f] + VAO
  })
  return tela
}

it.skipIf(!PEDIDA)('gera a folha de contato dos objetos novos do pedido', { timeout: TETO_DA_FOLHA_MS }, async () => {
  if (typeof PEDIDO !== 'string') return
  const inicio = performance.now()
  const node = await nodeDaFolha()
  const caminhoDoPedido = node.path.resolve(PEDIDO)
  const pedido = lerPedido(node.fs.readFileSync(caminhoDoPedido, 'utf8'))
  const saida = node.path.resolve(node.path.dirname(caminhoDoPedido), pedido.saida)
  // Um objeto por vez: o tempo de cada um é medido sem outro pintando junto.
  const cartoes: Cartao[] = []
  for (const item of pedido.itens) cartoes.push(montarCartao(await objetoDoItem(item)))
  const tela = montarFolha(cartoes)
  node.fs.mkdirSync(node.path.dirname(saida), { recursive: true })
  node.fs.writeFileSync(saida, emPng(tela))
  const relato = [
    ...cartoes.map((c, i) => `${i + 1}. ${relatoDoCartao(c)}`),
    `folha: ${saida} (${tela.largura} x ${tela.altura} px, ${cartoes.length} itens, ${Math.round(performance.now() - inicio)} ms no total)`,
  ]
  node.fs.writeFileSync(saida.replace(TERMINA_EM_PNG, '.txt'), new TextEncoder().encode(`${relato.join('\n')}\n`))
  for (const linha of relato) console.log(linha)
})
