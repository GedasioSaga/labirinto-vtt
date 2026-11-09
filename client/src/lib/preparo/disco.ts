import { exists, readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { FEATURES, type FeatureFlags } from '../features'
import { ensureDir, writeTextFileSafely } from '../mapFileIO'
import { preparoLigado } from './chave'
import { ehRegistro } from './molde'
import { ARQUIVO_DO_INDICE, ARQUIVO_DO_REVELADO, ARQUIVO_DO_VERBETE, type ArquivoDoPreparo, type IndiceDoPreparo, type Revelado, type Verbete } from './tipos'

/**
 * O DISCO DO PRELÚDIO: ler e gravar os arquivos de `<appData>/preparo/`
 * (docs/planos/preludio-2026-11-08.md §2).
 *
 * - Com a chave desligada (`lib/preparo/chave.ts`), nada aqui toca no disco.
 * - Gravar passa por `writeTextFileSafely` e guarda antes a cópia `.anterior`,
 *   como `lib/pastasDeMapas.ts`. Uma gravação por arquivo de cada vez.
 * - Chave desconhecida vai para `extras` e volta igual no próximo salvar (`molde.ts`).
 * - Arquivo de `formato` mais novo que esta versão abre só para leitura, com
 *   aviso, e nunca é regravado: quem confere é a própria gravação, olhando o
 *   que está no disco, e não quem chamou.
 * - Arquivo danificado (não é JSON, sem `formato`) volta pela cópia `.anterior`.
 */

const PASTA_DO_PREPARO = 'preparo'
const SUFIXO_ANTERIOR = '.anterior'
const DESLIGADO = 'O Prelúdio está desligado: nada é lido nem gravado.'

export type DocumentoLido<T> =
  /** O arquivo ainda não existe. */
  | { estado: 'novo' }
  /** `aviso` diz quando o conteúdo veio da cópia anterior. */
  | { estado: 'ok'; valor: T; aviso: string | null }
  /** Formato mais novo, ou conteúdo que esta versão não entende: mostrar, nunca gravar por cima. `valor` = o que deu para ler. */
  | { estado: 'somenteLeitura'; valor: T | null; aviso: string }
  /** Disco recusou, chave desligada, ou arquivo danificado sem cópia que sirva. */
  | { estado: 'falhou'; aviso: string }

// ─── Caminhos ────────────────────────────────────────────────────────────────

/** Um nome dentro de preparo/: o id vem de arquivo e pode ter sido mexido à mão. Sem ponto no meio, sem barra. */
const ID_NO_DISCO = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/
/** CON, NUL, COM1… não servem de nome de arquivo no Windows, nem com extensão. */
const NOME_RESERVADO_NO_WINDOWS = /^(con|prn|aux|nul|com\d|lpt\d)$/i
const EXTENSAO = '.json'

/** O id serve de nome de arquivo em preparo/? (O importador usa para decidir se mantém o id do Grimório.) */
export function idDoPreparoValido(id: unknown): id is string {
  return typeof id === 'string' && ID_NO_DISCO.test(id) && !NOME_RESERVADO_NO_WINDOWS.test(id)
}

function parteValida(parte: string): boolean {
  return idDoPreparoValido(parte.endsWith(EXTENSAO) ? parte.slice(0, -EXTENSAO.length) : parte)
}

/** As pastas de preparo/ com 1 arquivo por item (o nome do arquivo é o id). */
const PASTAS_DE_ITENS = {
  verbetes: ['verbetes'],
  quadros: ['quadros'],
  chats: ['chats'],
  lixeiraDoGrimorio: ['lixeira', 'do-grimorio'],
} as const

export type PastaDeItens = keyof typeof PASTAS_DE_ITENS

/** Onde mora cada arquivo, em partes relativas a preparo/. */
export const LUGARES = {
  indice: (): string[] => [`preparo${EXTENSAO}`],
  verbete: (id: string): string[] => ['verbetes', `${id}${EXTENSAO}`],
  ligacoes: (): string[] => [`ligacoes${EXTENSAO}`],
  tempo: (): string[] => [`tempo${EXTENSAO}`],
  quadro: (id: string): string[] => ['quadros', `${id}${EXTENSAO}`],
  atlas: (id: string): string[] => ['atlas', `${id}${EXTENSAO}`],
  revelado: (campanhaId: string): string[] => ['revelado', `${campanhaId}${EXTENSAO}`],
  chats: (donoId: string): string[] => [...PASTAS_DE_ITENS.chats, `${donoId}${EXTENSAO}`],
  teia: (): string[] => [`teia${EXTENSAO}`],
  lixeiraDoGrimorio: (id: string): string[] => [...PASTAS_DE_ITENS.lixeiraDoGrimorio, `${id}${EXTENSAO}`],
  vindosDoGrimorio: (): string[] => ['importacoes', `vindos-do-grimorio${EXTENSAO}`],
}

/** Para os avisos: "preparo/verbetes/x.json". */
function rotuloDe(partes: readonly string[]): string {
  return [PASTA_DO_PREPARO, ...partes].join('/')
}

async function caminhoNoPreparo(partes: readonly string[]): Promise<{ pasta: string; arquivo: string }> {
  const nome = partes[partes.length - 1]
  if (nome === undefined || !partes.every(parteValida)) throw new Error(`"${rotuloDe(partes)}" não serve de caminho dentro do Prelúdio`)
  const pasta = await join(await appDataDir(), PASTA_DO_PREPARO, ...partes.slice(0, -1))
  return { pasta, arquivo: await join(pasta, nome) }
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

function motivo(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

async function lerSeExiste(caminho: string): Promise<string | null> {
  if (!(await exists(caminho))) return null
  return readTextFile(caminho)
}

type Interpretado<T> =
  | { tipo: 'danificado'; motivo: string }
  | { tipo: 'maisNovo'; formato: number; valor: T | null }
  | { tipo: 'naoEntendido'; motivo: string }
  | { tipo: 'ok'; valor: T }

/** O `formato` do arquivo, ou `null` quando nem isso dá para saber (não é JSON, não é objeto, formato inválido). */
function formatoDoBruto(bruto: unknown): number | null {
  if (!ehRegistro(bruto)) return null
  const { formato } = bruto
  return typeof formato === 'number' && Number.isInteger(formato) && formato >= 1 ? formato : null
}

function lerJson(texto: string): unknown {
  try {
    return JSON.parse(texto)
  } catch {
    return undefined
  }
}

function interpretar<T extends { formato: number }>(arquivo: ArquivoDoPreparo<T>, texto: string): Interpretado<T> {
  const bruto = lerJson(texto)
  const formato = formatoDoBruto(bruto)
  if (formato === null) return { tipo: 'danificado', motivo: ehRegistro(bruto) ? 'sem o campo formato' : 'não é um objeto JSON' }
  const lido = arquivo.molde.ler(bruto, '')
  // Formato mais velho que o atual não existe ainda (todos começam no 1); quando existir, a migração entra aqui.
  if (formato > arquivo.formato) return { tipo: 'maisNovo', formato, valor: lido.ok ? lido.valor : null }
  if (!lido.ok) return { tipo: 'naoEntendido', motivo: lido.motivo }
  return { tipo: 'ok', valor: lido.valor }
}

function documentoDe<T extends { formato: number }>(
  arquivo: ArquivoDoPreparo<T>,
  lido: Exclude<Interpretado<T>, { tipo: 'danificado' }>,
  rotulo: string,
  daCopia: boolean,
): DocumentoLido<T> {
  const origem = daCopia ? `O arquivo ${rotulo} estava danificado: voltou a cópia anterior.` : null
  const comOrigem = (aviso: string) => (origem === null ? aviso : `${origem} ${aviso}`)
  switch (lido.tipo) {
    case 'ok':
      return { estado: 'ok', valor: lido.valor, aviso: origem }
    case 'maisNovo':
      return {
        estado: 'somenteLeitura',
        valor: lido.valor,
        aviso: comOrigem(`O arquivo ${rotulo} é de uma versão mais nova do Labirinto (formato ${lido.formato}; esta vai até o ${arquivo.formato}). Ele abre só para leitura e não é regravado.`),
      }
    case 'naoEntendido':
      return { estado: 'somenteLeitura', valor: null, aviso: comOrigem(`O arquivo ${rotulo} tem algo que esta versão não entende (${lido.motivo}). Ele abre só para leitura.`) }
  }
}

/** Lê um arquivo de preparo/. Nunca lança: o que deu errado vem em `aviso`. */
export async function lerDoPreparo<T extends { formato: number }>(
  arquivo: ArquivoDoPreparo<T>,
  partes: readonly string[],
  flags: Readonly<FeatureFlags> = FEATURES,
): Promise<DocumentoLido<T>> {
  if (!preparoLigado(flags)) return { estado: 'falhou', aviso: DESLIGADO }
  const rotulo = rotuloDe(partes)
  try {
    const { arquivo: caminho } = await caminhoNoPreparo(partes)
    const texto = await lerSeExiste(caminho)
    if (texto === null) return { estado: 'novo' }
    const principal = interpretar(arquivo, texto)
    if (principal.tipo !== 'danificado') return documentoDe(arquivo, principal, rotulo, false)
    const anterior = await lerSeExiste(`${caminho}${SUFIXO_ANTERIOR}`)
    const daCopia = anterior === null ? null : interpretar(arquivo, anterior)
    if (daCopia === null || daCopia.tipo === 'danificado') {
      return { estado: 'falhou', aviso: `O arquivo ${rotulo} está danificado (${principal.motivo}) e não há cópia anterior que sirva.` }
    }
    return documentoDe(arquivo, daCopia, rotulo, true)
  } catch (erro) {
    return { estado: 'falhou', aviso: `Não deu para ler ${rotulo}: ${motivo(erro)}.` }
  }
}

// ─── Gravação ────────────────────────────────────────────────────────────────

/** Uma cadeia por arquivo: a próxima gravação só começa quando a anterior terminou (deu certo ou não). */
const filas = new Map<string, Promise<unknown>>()

function naFila(caminho: string, passo: () => Promise<void>): Promise<void> {
  const resultado = (filas.get(caminho) ?? Promise.resolve()).then(passo)
  const fim = resultado.catch(() => undefined)
  filas.set(caminho, fim)
  // A cadeia que terminou e ninguém seguiu sai do mapa (não acumula uma por arquivo gravado na vida do app).
  void fim.then(() => {
    if (filas.get(caminho) === fim) filas.delete(caminho)
  })
  return resultado
}

/**
 * O texto que vai para o disco, com o `formato` desta versão. Só sai o que esta
 * mesma versão consegue ler de volta: um campo obrigatório faltando ou um
 * número inválido viraria um arquivo que abre "só para leitura" para sempre.
 */
function textoParaGravar<T extends { formato: number }>(arquivo: ArquivoDoPreparo<T>, valor: T, rotulo: string): string {
  const texto = JSON.stringify(arquivo.molde.gravar({ ...valor, formato: arquivo.formato }), null, 2)
  const deVolta = arquivo.molde.ler(lerJson(texto), '')
  if (!deVolta.ok) throw new Error(`Não gravei ${rotulo}: ${deVolta.motivo}.`)
  return texto
}

/** Cópia do que estava no disco antes de gravar por cima. Melhor esforço: sem ela, a gravação segue. */
async function guardarAnterior(caminho: string, conteudo: string): Promise<void> {
  try {
    await writeTextFile(`${caminho}${SUFIXO_ANTERIOR}`, conteudo)
  } catch {
    // Sem cópia desta vez; a gravação em si continua valendo.
  }
}

/** Grava um arquivo de preparo/. Lança com a razão em português. */
export async function gravarNoPreparo<T extends { formato: number }>(
  arquivo: ArquivoDoPreparo<T>,
  partes: readonly string[],
  valor: T,
  flags: Readonly<FeatureFlags> = FEATURES,
): Promise<void> {
  await gravarNoPreparoSeMudou(arquivo, partes, valor, flags)
}

/**
 * O mesmo `gravarNoPreparo`, dizendo se o disco mudou: `false` = o arquivo já
 * tinha exatamente este texto e nada foi escrito (a importação conta as mudanças por aqui).
 */
export async function gravarNoPreparoSeMudou<T extends { formato: number }>(
  arquivo: ArquivoDoPreparo<T>,
  partes: readonly string[],
  valor: T,
  flags: Readonly<FeatureFlags> = FEATURES,
): Promise<boolean> {
  if (!preparoLigado(flags)) throw new Error(DESLIGADO)
  const rotulo = rotuloDe(partes)
  const texto = textoParaGravar(arquivo, valor, rotulo)
  const { pasta, arquivo: caminho } = await caminhoNoPreparo(partes)
  let mudou = false
  await naFila(caminho, async () => {
    try {
      const atual = await lerSeExiste(caminho)
      if (atual !== null) {
        const formato = formatoDoBruto(lerJson(atual))
        if (formato !== null && formato > arquivo.formato) {
          throw new Error(`ele é de uma versão mais nova do Labirinto (formato ${formato}), e esta não grava por cima`)
        }
        if (atual === texto) return
      }
      await ensureDir(pasta)
      if (atual !== null) await guardarAnterior(caminho, atual)
      await writeTextFileSafely(caminho, texto)
      mudou = true
    } catch (erro) {
      throw new Error(`Não deu para gravar ${rotulo}: ${motivo(erro)}.`)
    }
  })
  return mudou
}

/**
 * O caminho de `<appData>/preparo/`, para quem grava o que não é JSON com
 * molde (a mídia e a pasta da importação: `importar/copiarArquivos.ts`).
 */
export async function pastaDoPreparo(flags: Readonly<FeatureFlags> = FEATURES): Promise<string> {
  if (!preparoLigado(flags)) throw new Error(DESLIGADO)
  return join(await appDataDir(), PASTA_DO_PREPARO)
}

// ─── Listar ──────────────────────────────────────────────────────────────────

/**
 * Os ids de uma pasta de itens (`verbetes/`, `quadros/`…), pelo nome dos
 * arquivos `<id>.json`. A cópia `.anterior`, o `.tmp` de uma gravação pela
 * metade e o nome que não serve de id ficam de fora. Pasta que não existe = nenhum.
 */
export async function listarNoPreparo(pasta: PastaDeItens, flags: Readonly<FeatureFlags> = FEATURES): Promise<string[]> {
  if (!preparoLigado(flags)) throw new Error(DESLIGADO)
  const caminho = await join(await appDataDir(), PASTA_DO_PREPARO, ...PASTAS_DE_ITENS[pasta])
  if (!(await exists(caminho))) return []
  const entradas = await readDir(caminho)
  return entradas
    .filter((entrada) => entrada.isFile && entrada.name.endsWith(EXTENSAO))
    .map((entrada) => entrada.name.slice(0, -EXTENSAO.length))
    .filter(idDoPreparoValido)
    .sort()
}

// ─── Os de todo dia ──────────────────────────────────────────────────────────

export function lerIndiceDoPreparo(flags: Readonly<FeatureFlags> = FEATURES): Promise<DocumentoLido<IndiceDoPreparo>> {
  return lerDoPreparo(ARQUIVO_DO_INDICE, LUGARES.indice(), flags)
}

export function gravarIndiceDoPreparo(indice: IndiceDoPreparo, flags: Readonly<FeatureFlags> = FEATURES): Promise<void> {
  return gravarNoPreparo(ARQUIVO_DO_INDICE, LUGARES.indice(), indice, flags)
}

export function lerVerbete(id: string, flags: Readonly<FeatureFlags> = FEATURES): Promise<DocumentoLido<Verbete>> {
  return lerDoPreparo(ARQUIVO_DO_VERBETE, LUGARES.verbete(id), flags)
}

export function gravarVerbete(verbete: Verbete, flags: Readonly<FeatureFlags> = FEATURES): Promise<void> {
  return gravarNoPreparo(ARQUIVO_DO_VERBETE, LUGARES.verbete(verbete.id), verbete, flags)
}

export function lerRevelado(campanhaId: string, flags: Readonly<FeatureFlags> = FEATURES): Promise<DocumentoLido<Revelado>> {
  return lerDoPreparo(ARQUIVO_DO_REVELADO, LUGARES.revelado(campanhaId), flags)
}

export function gravarRevelado(campanhaId: string, revelado: Revelado, flags: Readonly<FeatureFlags> = FEATURES): Promise<void> {
  return gravarNoPreparo(ARQUIVO_DO_REVELADO, LUGARES.revelado(campanhaId), revelado, flags)
}
