import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { nomePadraoDoDesafio } from '../lib/desafios'
import { ensureDir, writeTextFileSafely } from '../lib/mapFileIO'
import type { Desafio, LugarDoDesafio } from '../types/map'
import { lerPuzzle } from './leitor'
import { pecasPostas, progressoInicial } from './motor'
import { VERSAO_DO_PUZZLE } from './tipos'
import type { IndiceDeMeusPuzzles, MinigamePuzzle, ModeloDePuzzle, PecaPosta, ProgressoDoPuzzle, Puzzle } from './tipos'

/**
 * "MEUS PUZZLES" (plano dos puzzles, §1.3; protótipo aprovado
 * `docs/design/puzzles/prototipo-v2.html`, aba "Meus puzzles"): os puzzles
 * que o mestre salva como modelo e põe em qualquer mapa, de qualquer
 * campanha. É do APP, como o acervo de itens (`lib/acervoDeItens.ts`):
 *
 *   <appData>/puzzles/puzzles.json   índice: a versão e os modelos
 *
 * Cada lugar recebe uma CÓPIA (`copiaDoModelo`), que mora no mapa
 * (`Desafio.minigame`) e não divide objeto com o modelo. Por isso, como no
 * protótipo: salvar o modelo não muda as cópias que já estão nos lugares;
 * editar a cópia não muda o modelo; e salvar a cópia recomeça o puzzle
 * daquele lugar (`copiaSalva`).
 *
 * As defesas são as do acervo, pelos mesmos motivos: índice ilegível é posto
 * de lado (`.invalido`) antes de a lista recomeçar vazia; leitura que falha
 * por I/O não deixa gravar por cima (`lido`); cada gravação tira cópia do
 * índice (`.anterior`) e passa pela fila, uma depois da outra.
 */

const PASTA_DOS_PUZZLES = 'puzzles'
const ARQUIVO_DO_INDICE = 'puzzles.json'
const ARQUIVO_INVALIDO = 'puzzles.json.invalido'
const ARQUIVO_ANTERIOR = 'puzzles.json.anterior'
/** 1 (19/11/2026): a primeira. Quando houver a 2, o passo de 1 para 2 entra em `indiceDoTexto`. */
const VERSAO_DO_INDICE: IndiceDeMeusPuzzles['versao'] = 1

/**
 * O id do modelo: o MESMO critério de `idLido` em `puzzles/leitor.ts`, que lê
 * o `modeloId` da cópia no mapa. Um id que só um dos dois aceitasse deixaria
 * a cópia órfã ("feita aqui") ao reabrir o mapa.
 */
const FORMA_DO_ID = /^[A-Za-z0-9_-]{1,80}$/
const IDS_PROIBIDOS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])

export interface MeusPuzzlesLidos {
  modelos: ModeloDePuzzle[]
  /** Frase pronta para a tela quando a leitura deu errado; `null` = tudo certo. */
  aviso: string | null
  /** O índice foi LIDO (ou não existia ainda)? `false` = gravar seria passar por cima do que não se leu. */
  lido: boolean
}

const AVISO = 'Não foi possível ler os seus puzzles'
export const MEUS_PUZZLES_NAO_LIDOS = `${AVISO}, então nada foi gravado para não apagar o que está lá. Feche e abra o app de novo.`
export const MEUS_PUZZLES_DE_VERSAO_NOVA = 'Os seus puzzles foram gravados por uma versão mais nova do app. Dá para ver e pôr nos lugares, mas não para mudá-los: atualize o app.'

export function novoIdDeModelo(): string {
  return `modelo_${crypto.randomUUID()}`
}

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function ehIdDeModelo(valor: unknown): valor is string {
  return typeof valor === 'string' && FORMA_DO_ID.test(valor) && !IDS_PROIBIDOS.has(valor)
}

/** Instante gravado (ms desde 1970); torto = `padrao`. */
function instanteLido(valor: unknown, padrao: number): number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0 ? valor : padrao
}

/**
 * O puzzle como fica guardado: passado pelo mesmo leitor do disco, para que
 * o modelo na memória seja igual ao que volta depois de fechar e abrir o app
 * (texto aparado, número na faixa, imagem só `midia:`). O JSON no meio corta
 * qualquer referência ao objeto do editor.
 */
export function puzzleGuardado(puzzle: Puzzle): Puzzle {
  return lerPuzzle(JSON.parse(JSON.stringify(puzzle)))
}

/** Um modelo do índice. Sem id ele sai (a cópia e o "Pôr aqui" o acham pelo id); o puzzle torto vira o padrão, campo a campo. */
export function modeloLido(valor: unknown): ModeloDePuzzle | null {
  if (!isRecord(valor) || !ehIdDeModelo(valor.id)) return null
  const criadoEm = instanteLido(valor.criadoEm, 0)
  return { id: valor.id, criadoEm, mudadoEm: instanteLido(valor.mudadoEm, criadoEm), puzzle: lerPuzzle(valor.puzzle) }
}

/** O índice como texto. `null` = não é JSON de "Meus puzzles" (o arquivo vai para `.invalido`). */
function indiceDoTexto(texto: string): { modelos: ModeloDePuzzle[]; versao: number } | null {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return null
  }
  if (!isRecord(bruto) || !Array.isArray(bruto.modelos)) return null
  const vistos = new Set<string>()
  const modelos: ModeloDePuzzle[] = []
  for (const valor of bruto.modelos) {
    const modelo = modeloLido(valor)
    if (modelo === null || vistos.has(modelo.id)) continue
    vistos.add(modelo.id)
    modelos.push(modelo)
  }
  const versao = typeof bruto.versao === 'number' && Number.isSafeInteger(bruto.versao) ? bruto.versao : VERSAO_DO_INDICE
  return { modelos, versao }
}

export function serializarMeusPuzzles(modelos: readonly ModeloDePuzzle[]): string {
  const indice: IndiceDeMeusPuzzles = { versao: VERSAO_DO_INDICE, modelos: [...modelos] }
  return `${JSON.stringify(indice, null, 2)}\n`
}

// ------------------------------------------------------------------ o modelo e a cópia (puros)

/** "Salvar nos meus puzzles" / "Salvar como novo": o modelo novo com o puzzle do editor. */
export function modeloNovo(puzzle: Puzzle, agora: number, id: string = novoIdDeModelo()): ModeloDePuzzle {
  return { id, criadoEm: agora, mudadoEm: agora, puzzle: puzzleGuardado(puzzle) }
}

/** "Salvar no modelo": o mesmo modelo com o puzzle do editor. Só o modelo muda: as cópias moram nos mapas. */
export function modeloMudado(modelo: ModeloDePuzzle, puzzle: Puzzle, agora: number): ModeloDePuzzle {
  return { ...modelo, mudadoEm: Math.max(agora, modelo.criadoEm), puzzle: puzzleGuardado(puzzle) }
}

/** "Pôr aqui": a cópia do modelo que vai para o lugar. Cópia funda: mexer nela não mexe no modelo. */
export function copiaDoModelo(modelo: ModeloDePuzzle): MinigamePuzzle {
  return { jogo: 'puzzle', versao: VERSAO_DO_PUZZLE, npc: '', modeloId: modelo.id, puzzle: structuredClone(modelo.puzzle) }
}

/** O desafio novo com a cópia, com o nome do puzzle. Sem lugar, o mestre marca depois ("Marcar no mapa" da página Jogos). */
export function desafioDoModelo(modelo: ModeloDePuzzle, id: string, lugar: LugarDoDesafio = { tipo: 'nenhum' }): Desafio {
  const minigame = copiaDoModelo(modelo)
  return { id, nome: nomePadraoDoDesafio(minigame, modelo.puzzle.nome), lugar, minigame }
}

/** JSON com as chaves em ordem: o mesmo puzzle montado pelo editor e pelo leitor, em ordens diferentes, compara igual. */
function jsonCanonico(valor: unknown): string {
  return JSON.stringify(valor, (_chave, campo: unknown) => (isRecord(campo) ? Object.fromEntries(Object.entries(campo).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : campo))
}

export function mesmoPuzzle(a: Puzzle, b: Puzzle): boolean {
  return jsonCanonico(a) === jsonCanonico(b)
}

export interface CopiaSalva {
  /** A configuração nova do desafio; `mudadaAqui` quando o puzzle mudou de fato e veio de um modelo. */
  minigame: MinigamePuzzle
  /** O progresso recomeçado. O `rev` sobe, para que toda tela aberta antes seja recusada (`velho`). */
  progresso: ProgressoDoPuzzle
  /** As peças que estavam postas (inclusive as gastas e as pedras da bandeja), para voltar a quem pôs. */
  devolver: PecaPosta[]
}

/**
 * "Salvar a cópia deste lugar". Como no protótipo, salvar a cópia zera o
 * progresso dela, e o modelo não muda (nem é lido: a cópia é do mapa).
 * Pura: quem grava põe `minigame` pelo patch do desafio, `progresso` pelo
 * caminho do progresso (`mapaComProgressoDoPuzzle`, fora do Ctrl+Z) e
 * devolve `devolver` na ficha de cada um, como o "Zerar progresso".
 */
export function copiaSalva(atual: MinigamePuzzle, puzzle: Puzzle, progresso: ProgressoDoPuzzle | undefined): CopiaSalva {
  const guardado = puzzleGuardado(puzzle)
  const mudou = atual.mudadaAqui === true || (atual.modeloId !== null && !mesmoPuzzle(atual.puzzle, guardado))
  const { mudadaAqui: _antes, ...semMarca } = atual
  const minigame: MinigamePuzzle = mudou ? { ...semMarca, puzzle: guardado, mudadaAqui: true } : { ...semMarca, puzzle: guardado }
  // Progresso ausente é o puzzle que ninguém tocou: começa do rev 0, e o recomeçado fica no 1.
  const revAntes = progresso === undefined ? 0 : progresso.rev
  return {
    minigame,
    progresso: { ...progressoInicial(guardado), rev: revAntes + 1 },
    devolver: progresso === undefined ? [] : pecasPostas(progresso),
  }
}

/**
 * Como a cópia está em relação ao modelo, para a lista "Nos lugares":
 * `feitaAqui` (não veio de modelo), `modeloApagado` (a cópia continua),
 * `igual`, `mudadaAqui` (o mestre editou esta cópia) ou `modeloMudou` (o
 * modelo foi salvo depois, e esta cópia ficou como era).
 */
export type SituacaoDaCopia = 'feitaAqui' | 'modeloApagado' | 'igual' | 'mudadaAqui' | 'modeloMudou'

export function situacaoDaCopia(copia: Pick<MinigamePuzzle, 'modeloId' | 'mudadaAqui' | 'puzzle'>, modelos: readonly ModeloDePuzzle[]): SituacaoDaCopia {
  if (copia.modeloId === null) return 'feitaAqui'
  const modelo = modelos.find((candidato) => candidato.id === copia.modeloId)
  if (modelo === undefined) return 'modeloApagado'
  if (copia.mudadaAqui === true) return 'mudadaAqui'
  return mesmoPuzzle(copia.puzzle, modelo.puzzle) ? 'igual' : 'modeloMudou'
}

// ------------------------------------------------------------------ o disco

async function pastaDosPuzzles(): Promise<string> {
  return join(await appDataDir(), PASTA_DOS_PUZZLES)
}

function motivo(causa: unknown): string {
  const texto = causa instanceof Error ? causa.message : String(causa)
  return /os error 5|denied|negado/i.test(texto) ? 'o Windows negou o acesso ao arquivo (outro programa pode estar com ele aberto)' : texto
}

/**
 * Lê o índice. Nunca lança: o erro vira `aviso`, e `lido: false` barra quem
 * grava. Índice de uma versão mais nova do app também barra: gravá-lo com a
 * versão de agora apagaria o que esta versão não sabe ler.
 */
export async function lerMeusPuzzles(): Promise<MeusPuzzlesLidos> {
  let texto: string
  try {
    const caminho = await join(await pastaDosPuzzles(), ARQUIVO_DO_INDICE)
    if (!(await exists(caminho))) return { modelos: [], aviso: null, lido: true }
    texto = await readTextFile(caminho)
  } catch (erro) {
    return { modelos: [], aviso: `${AVISO}: ${motivo(erro)}.`, lido: false }
  }
  const indice = indiceDoTexto(texto)
  if (indice !== null) {
    return indice.versao > VERSAO_DO_INDICE ? { modelos: indice.modelos, aviso: MEUS_PUZZLES_DE_VERSAO_NOVA, lido: false } : { modelos: indice.modelos, aviso: null, lido: true }
  }
  try {
    await writeTextFile(await join(await pastaDosPuzzles(), ARQUIVO_INVALIDO), texto)
  } catch {
    // Sem a cópia, a lista NÃO recomeça: gravar agora passaria por cima do único exemplar.
    return { modelos: [], aviso: `${AVISO}: o arquivo estava ilegível e não deu para guardar uma cópia dele.`, lido: false }
  }
  return {
    modelos: [],
    aviso: `${AVISO}: o arquivo estava ilegível. A lista começa vazia, e o arquivo antigo ficou guardado como ${ARQUIVO_INVALIDO}, na mesma pasta.`,
    lido: true,
  }
}

let filaDoIndice: Promise<void> = Promise.resolve()

/** Uma gravação depois da outra: duas seguidas nunca leem a mesma lista e passam uma por cima da outra. */
function naFila<T>(operacao: () => Promise<T>): Promise<T> {
  const resultado = filaDoIndice.then(operacao)
  filaDoIndice = resultado.then(
    () => undefined,
    () => undefined,
  )
  return resultado
}

/** Grava a lista INTEIRA. Lança com a frase pronta. */
export function gravarMeusPuzzles(modelos: readonly ModeloDePuzzle[]): Promise<void> {
  return naFila(async () => {
    try {
      const pasta = await pastaDosPuzzles()
      const caminho = await join(pasta, ARQUIVO_DO_INDICE)
      await ensureDir(pasta)
      // Cópia do de antes: melhor esforço — sem ela a gravação segue.
      try {
        if (await exists(caminho)) await writeTextFile(await join(pasta, ARQUIVO_ANTERIOR), await readTextFile(caminho))
      } catch {
        // A cópia é a segunda linha de defesa; a primeira é a gravação segura logo abaixo.
      }
      await writeTextFileSafely(caminho, serializarMeusPuzzles(modelos))
    } catch (erro) {
      throw new Error(`Não foi possível gravar os seus puzzles: ${motivo(erro)}.`)
    }
  })
}
