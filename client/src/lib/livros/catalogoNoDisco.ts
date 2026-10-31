import { exists, readTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { ensureDir, writeTextFileSafely } from '../mapFileIO'
import { idValido } from '../sistemaDeRpg'
import { catalogoDoArquivo, serializarCatalogo, type ItemDoCatalogo } from './catalogo'

/**
 * O CATÁLOGO NO DISCO (M3 do mundo do livro de regras), um por sistema:
 *
 *   <appData>/livros/<sistemaId>/catalogo.json   { formato: 1, itens }
 *
 * Mesmo padrão de `jogadoresVistos.ts` (leitura que nunca lança, gravação em
 * fila), com uma diferença: o catálogo é trabalho do mestre, então arquivo
 * ilegível NÃO é tratado como vazio — `lido: false` e quem chama não grava
 * por cima (como o acervo de itens).
 */

const PASTA_DOS_LIVROS = 'livros'
const ARQUIVO_DO_CATALOGO = 'catalogo.json'

export interface CatalogoLido {
  itens: ItemDoCatalogo[]
  aviso: string | null
  /** O disco foi lido (ou o arquivo ainda não existe): só então gravar é seguro. */
  lido: boolean
}

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** O id do sistema vira nome de pasta: só o formato de `idValido` (sem `..`, sem barra). */
async function caminhoDoCatalogo(sistemaId: string): Promise<{ pasta: string; arquivo: string }> {
  if (!idValido(sistemaId)) throw new Error('o id do sistema não serve de nome de pasta')
  const pasta = await join(await appDataDir(), PASTA_DOS_LIVROS, sistemaId)
  return { pasta, arquivo: await join(pasta, ARQUIVO_DO_CATALOGO) }
}

/** Lê o catálogo do sistema. Nunca lança: o erro vira `aviso`, a lista começa vazia e `lido` fica falso. */
export async function lerCatalogo(sistemaId: string): Promise<CatalogoLido> {
  try {
    const { arquivo } = await caminhoDoCatalogo(sistemaId)
    if (!(await exists(arquivo))) return { itens: [], aviso: null, lido: true }
    return { itens: catalogoDoArquivo(JSON.parse(await readTextFile(arquivo))), aviso: null, lido: true }
  } catch (erro) {
    return { itens: [], aviso: `Não foi possível ler o catálogo do livro: ${mensagemDoErro(erro)}.`, lido: false }
  }
}

let filaDoCatalogo: Promise<void> = Promise.resolve()

/** Grava o catálogo INTEIRO do sistema, uma gravação depois da outra. Lança com a frase pronta. */
export function gravarCatalogo(sistemaId: string, itens: readonly ItemDoCatalogo[]): Promise<void> {
  const resultado = filaDoCatalogo.then(async () => {
    try {
      const { pasta, arquivo } = await caminhoDoCatalogo(sistemaId)
      await ensureDir(pasta)
      await writeTextFileSafely(arquivo, serializarCatalogo(itens))
    } catch (erro) {
      throw new Error(`Não foi possível gravar o catálogo do livro: ${mensagemDoErro(erro)}.`)
    }
  })
  filaDoCatalogo = resultado.then(
    () => undefined,
    () => undefined,
  )
  return resultado
}
