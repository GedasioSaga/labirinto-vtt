import {
  CARTAO_SEM_NOME,
  novoIdDeCartao,
  novoIdDePersonagem,
  type CampoExtra,
  type CartaoDaFicha,
  type Modificador,
  type Personagem,
  type TipoDePersonagem,
} from './personagem'
import { abaDoSistema, type AbaDoSistema, type SistemaDeRpg } from './sistemaDeRpg'
import { isTokenPhotoData } from './tokenPhoto'

/**
 * "Importar personagens" do projeto-rpg-v2 (C:/dev/projeto-rpg-v2): lê o
 * arquivo do Exportar de lá — um ARRAY de `FichaExportada`
 * (src-tauri/src/domain/modelos.rs:283-354, db/portabilidade.rs) — e devolve
 * personagens do Labirinto.
 *
 * O casamento é pela CHAVE: cada atributo, recurso, lista, aba e campo do
 * sistema da aventura é procurado com o mesmo nome na ficha de lá (`forca`,
 * `hp`, `raca`, `habilidades`, `acao`...). O One Piece embutido usa os nomes
 * de coluna do projeto-rpg-v2 de propósito; outro sistema importa só o que
 * casar.
 *
 * Regras herdadas de lá: arquivo de `versao` desconhecida é recusado ficha a
 * ficha; nome repetido não sobrescreve — entra "Nome (2)", e a colisão é por
 * (nome, tipo), como `nome_livre` (portabilidade.rs:112-135).
 * Regra nova: só JOGADOR entra por padrão (pedido do usuário); NPC é contado
 * e deixado de fora.
 */

export const VERSAO_DA_FICHA_EXPORTADA = 1

export interface OpcoesDaImportacao {
  /** `true` importa também os NPCs. Padrão: só jogadores. */
  incluirNpcs?: boolean
  /**
   * Reduz a imagem embutida (o retrato de lá vem inteiro, às vezes com 1 MB) à
   * cópia pequena da ficha. No app é `buildTokenPhotoData`; separado para o
   * teste não precisar de canvas.
   */
  reduzirImagem: (imagem: Blob) => Promise<string>
}

export interface ResultadoDaImportacao {
  personagens: Personagem[]
  /** NPCs do arquivo deixados de fora. */
  npcsIgnorados: number
  /** Uma frase por ficha recusada ou imagem que não entrou. */
  avisos: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function texto(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function lista(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** "Percepção" → "percepcao": compara rótulo escrito à mão com id e nome do sistema. */
function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Atributos de uma perícia: lá é CSV de slugs ("percepcao,intuicao"), mas a
 * ficha importada da versão antiga traz texto livre ("(Intuição/Percepção)",
 * "Força e/ou Percepção" — domain/pericias.rs:44-72). Cada pedaço é casado com
 * o id, o nome ou a abreviação do atributo; o que não casar fica de fora.
 */
export function atributosDoTexto(valor: string, sistema: SistemaDeRpg): string[] {
  const pedacos = valor
    .replace(/[()]/g, ' ')
    .split(/[,;/]|\s+e\/ou\s+|\s+e\s+|\s+ou\s+/)
    .map(normalizar)
    .filter((pedaco) => pedaco.length > 0)
  const achados: string[] = []
  for (const pedaco of pedacos) {
    const atributo = sistema.atributos.find(
      (candidato) => candidato.id === pedaco || normalizar(candidato.nome) === pedaco || normalizar(candidato.abreviacao) === pedaco,
    )
    if (atributo !== undefined && !achados.includes(atributo.id)) achados.push(atributo.id)
  }
  return achados
}

/** Os formatos que a foto embutida aceita (`isTokenPhotoData`); `jpg` de lá vira `jpeg`. */
const TIPOS_DE_IMAGEM: Record<string, string> = { png: 'png', jpg: 'jpeg', jpeg: 'jpeg', webp: 'webp', gif: 'gif' }

/** `{ base64, formato }` de lá → bytes da imagem; `null` quando não é imagem que dê para ler. */
function blobDoRetrato(retrato: unknown): Blob | null {
  if (!isRecord(retrato) || typeof retrato.base64 !== 'string') return null
  const tipo = TIPOS_DE_IMAGEM[normalizar(texto(retrato.formato))]
  if (tipo === undefined) return null
  let binario: string
  try {
    binario = atob(retrato.base64)
  } catch {
    return null
  }
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
  return new Blob([bytes], { type: `image/${tipo}` })
}

/** Nome livre: "Smoker" ocupado vira "Smoker (2)", depois "(3)"... Mesmo teto de lá (999). */
function nomeLivre(nome: string, tipo: TipoDePersonagem, ocupados: Set<string>): string {
  const chave = (candidato: string) => `${tipo}\u0000${candidato}`
  let escolhido = nome
  for (let n = 2; ocupados.has(chave(escolhido)) && n < 1000; n += 1) escolhido = `${nome} (${n})`
  ocupados.add(chave(escolhido))
  return escolhido
}

/** O que cada ficha precisa para ler as imagens e registrar o que não entrou. */
interface Contexto {
  sistema: SistemaDeRpg
  reduzirImagem: (imagem: Blob) => Promise<string>
  avisos: string[]
}

async function imagemPequena(retrato: unknown, onde: string, ctx: Contexto): Promise<string | null> {
  if (retrato === null || retrato === undefined) return null
  const blob = blobDoRetrato(retrato)
  if (blob === null) {
    ctx.avisos.push(`${onde}: a imagem não está num formato que o Labirinto lê, ficou sem ela.`)
    return null
  }
  try {
    const reduzida = await ctx.reduzirImagem(blob)
    if (isTokenPhotoData(reduzida)) return reduzida
    ctx.avisos.push(`${onde}: a imagem não coube na ficha, ficou sem ela.`)
  } catch (erro) {
    ctx.avisos.push(`${onde}: a imagem não entrou (${erro instanceof Error ? erro.message : String(erro)}).`)
  }
  return null
}

function extrasDe(value: unknown): CampoExtra[] {
  return lista(value)
    .filter(isRecord)
    .map((extra) => ({ nome: texto(extra.nome), valor: texto(extra.valor) }))
}

function modificadoresDe(value: unknown): Modificador[] {
  return lista(value)
    .filter(isRecord)
    .flatMap((mod) => (typeof mod.atributo === 'string' && typeof mod.delta === 'number' && Number.isFinite(mod.delta) ? [{ atributo: mod.atributo, delta: mod.delta }] : []))
}

async function cartaoDoProjeto(item: unknown, aba: AbaDoSistema, onde: string, ctx: Contexto): Promise<CartaoDaFicha | null> {
  if (!isRecord(item)) return null
  const nome = texto(item.nome).trim() || CARTAO_SEM_NOME
  const campos: Record<string, string> = {}
  for (const campo of aba.campos) {
    const valor = texto(item[campo.id])
    if (valor.trim().length > 0) campos[campo.id] = valor
  }
  const subAba = aba.subcartoes === undefined ? undefined : abaDoSistema(ctx.sistema, aba.subcartoes.aba)
  const subcartoes: CartaoDaFicha[] = []
  if (subAba !== undefined) {
    for (const sub of lista(item[subAba.id])) {
      const cartao = await cartaoDoProjeto(sub, subAba, `${onde} › ${nome}`, ctx)
      if (cartao !== null) subcartoes.push(cartao)
    }
  }
  return {
    id: novoIdDeCartao(),
    nome,
    campos,
    extras: aba.extras === true ? extrasDe(item.campos_extras) : [],
    atributos: aba.atributos === true ? atributosDoTexto(texto(item.atributo), ctx.sistema) : [],
    imagem: aba.imagem === true ? await imagemPequena(item.retrato, `${onde} › ${nome}`, ctx) : null,
    modificadores: aba.modificadores === true ? modificadoresDe(item.modificadores) : [],
    subcartoes,
  }
}

function numerosDe(ficha: Record<string, unknown>, ids: readonly string[]): Record<string, number> {
  return Object.fromEntries(
    ids.map((id) => {
      const valor = ficha[id]
      return [id, typeof valor === 'number' && Number.isFinite(valor) ? valor : 0]
    }),
  )
}

async function personagemDoProjeto(ficha: Record<string, unknown>, tipo: TipoDePersonagem, nome: string, ctx: Contexto): Promise<Personagem> {
  const escolhas: Record<string, string> = {}
  for (const escolha of ctx.sistema.escolhas) {
    const valor = texto(ficha[escolha.id]).trim()
    if (valor.length > 0) escolhas[escolha.id] = valor
  }
  const abas: Record<string, CartaoDaFicha[]> = {}
  for (const aba of ctx.sistema.abas) {
    const cartoes: CartaoDaFicha[] = []
    for (const item of lista(ficha[aba.id])) {
      const cartao = await cartaoDoProjeto(item, aba, nome, ctx)
      if (cartao !== null) cartoes.push(cartao)
    }
    abas[aba.id] = cartoes
  }
  return {
    id: novoIdDePersonagem(),
    tipo,
    nome,
    descricao: texto(ficha.descricao),
    retrato: await imagemPequena(ficha.retrato, nome, ctx),
    escolhas,
    etiquetas: lista(ficha.etiquetas).filter((etiqueta): etiqueta is string => typeof etiqueta === 'string'),
    recursos: numerosDe(ficha, ctx.sistema.recursos.map((recurso) => recurso.id)),
    atributos: numerosDe(ficha, ctx.sistema.atributos.map((atributo) => atributo.id)),
    abas,
  }
}

/**
 * Lê o arquivo e devolve os personagens novos (ids novos, nome livre contra
 * `existentes`). Lança só quando o arquivo inteiro não serve (não é JSON, não
 * é lista de fichas); ficha a ficha, o que não serve vira aviso.
 */
export async function importarFichasDoProjetoRpg(
  json: string,
  sistema: SistemaDeRpg,
  existentes: readonly Personagem[],
  opcoes: OpcoesDaImportacao,
): Promise<ResultadoDaImportacao> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (erro) {
    throw new Error(`o arquivo não é JSON válido (${erro instanceof Error ? erro.message : String(erro)})`)
  }
  // O Exportar de lá grava sempre uma lista; uma ficha solta (editada à mão) também serve.
  const fichas = Array.isArray(parsed) ? parsed : isRecord(parsed) ? [parsed] : null
  if (fichas === null) throw new Error('o arquivo não é uma lista de fichas do projeto-rpg-v2')

  const ctx: Contexto = { sistema, reduzirImagem: opcoes.reduzirImagem, avisos: [] }
  const ocupados = new Set(existentes.map((personagem) => `${personagem.tipo}\u0000${personagem.nome}`))
  const personagens: Personagem[] = []
  let npcsIgnorados = 0
  for (const [indice, ficha] of fichas.entries()) {
    const rotulo = isRecord(ficha) && texto(ficha.nome).trim().length > 0 ? texto(ficha.nome).trim() : `Ficha ${indice + 1}`
    if (!isRecord(ficha)) {
      ctx.avisos.push(`${rotulo}: não é uma ficha.`)
      continue
    }
    if (ficha.versao !== VERSAO_DA_FICHA_EXPORTADA) {
      ctx.avisos.push(`${rotulo}: versão ${String(ficha.versao)} da ficha não é conhecida (esperada ${VERSAO_DA_FICHA_EXPORTADA}).`)
      continue
    }
    if (ficha.tipo !== 'jogador' && ficha.tipo !== 'npc') {
      ctx.avisos.push(`${rotulo}: tipo "${String(ficha.tipo)}" não é jogador nem NPC.`)
      continue
    }
    const nome = texto(ficha.nome).trim()
    if (nome.length === 0) {
      ctx.avisos.push(`${rotulo}: ficha sem nome.`)
      continue
    }
    if (ficha.tipo === 'npc' && opcoes.incluirNpcs !== true) {
      npcsIgnorados += 1
      continue
    }
    personagens.push(await personagemDoProjeto(ficha, ficha.tipo, nomeLivre(nome, ficha.tipo, ocupados), ctx))
  }
  return { personagens, npcsIgnorados, avisos: ctx.avisos }
}
