import { exists, readDir, readTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { ensureDir, writeTextFileSafely } from './mapFileIO'
import { lerSistemaDoTexto, serializarSistema, type SistemaDeRpg } from './sistemaDeRpg'
import { SISTEMAS_EMBUTIDOS } from './sistemaOnePiece'

/**
 * BIBLIOTECA DE SISTEMAS DE RPG — a grade de cartões com o "+" (decisão do
 * usuário: os sistemas são do APP, não da aventura; a aventura guarda só o id
 * do que escolheu).
 *
 * Mesmo molde do acervo de tokens (`lib/tokenLibrary.ts`): pasta irmã de
 * `maps` dentro de `appDataDir()`, gravação por `writeTextFileSafely` e
 * leitura que nunca derruba a tela. Um arquivo por sistema, e não um índice
 * só: o arquivo importado estragado à mão perde só ele, e o editor da entrega
 * 6 grava um sistema sem reescrever os outros.
 *
 *   <appData>/sistemas/<id>.json   o sistema, no formato de `lib/sistemaDeRpg.ts`
 *
 * Os embutidos (One Piece) não moram no disco: vêm do código, estão sempre na
 * grade e não dá para sobrescrevê-los por arquivo.
 */

const PASTA_DOS_SISTEMAS = 'sistemas'

/** O que a grade mostra: embutidos primeiro, depois os da pasta; e o que não deu para ler. */
export interface BibliotecaLida {
  sistemas: SistemaDeRpg[]
  avisos: string[]
}

export async function pastaDosSistemas(): Promise<string> {
  return join(await appDataDir(), PASTA_DOS_SISTEMAS)
}

function motivo(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/**
 * Lê a biblioteca. NUNCA lança: pasta que ainda não existe é só os embutidos
 * (primeira execução); arquivo ilegível fica de fora com um aviso que diz qual.
 */
export async function listarSistemas(): Promise<BibliotecaLida> {
  const sistemas: SistemaDeRpg[] = [...SISTEMAS_EMBUTIDOS]
  const avisos: string[] = []
  let pasta: string
  let nomes: string[]
  try {
    pasta = await pastaDosSistemas()
    if (!(await exists(pasta))) return { sistemas, avisos }
    nomes = (await readDir(pasta))
      .filter((entrada) => entrada.isFile && entrada.name.toLowerCase().endsWith('.json'))
      .map((entrada) => entrada.name)
      .sort((a, b) => a.localeCompare(b))
  } catch (erro) {
    return { sistemas, avisos: [`Não deu para ler a pasta de sistemas: ${motivo(erro)}.`] }
  }
  for (const nome of nomes) {
    let texto: string
    try {
      texto = await readTextFile(await join(pasta, nome))
    } catch (erro) {
      avisos.push(`${nome}: ${motivo(erro)}.`)
      continue
    }
    const lido = lerSistemaDoTexto(texto)
    if (!lido.ok) {
      avisos.push(`${nome}: ${lido.erro}.`)
      continue
    }
    // Id repetido (dois arquivos do mesmo sistema): o primeiro vence, e o embutido vence sempre.
    if (sistemas.some((sistema) => sistema.id === lido.sistema.id)) continue
    sistemas.push(lido.sistema)
  }
  return { sistemas, avisos }
}

/**
 * Como o sistema do arquivo entra na biblioteca. Id de um embutido não
 * sobrescreve o embutido: vira `<id>-importado` (e "(importado)" no nome) —
 * reimportar o mesmo arquivo depois cai no mesmo id e ATUALIZA a cópia, em vez
 * de empilhar outra. Id de um importado também atualiza: é o mesmo sistema,
 * versão mais nova.
 */
export function sistemaParaGravar(sistema: SistemaDeRpg, idsEmbutidos: ReadonlySet<string>): SistemaDeRpg {
  if (!idsEmbutidos.has(sistema.id)) return sistema
  return { ...sistema, id: `${sistema.id}-importado`, nome: `${sistema.nome} (importado)` }
}

/**
 * O "+" da grade: lê o texto do arquivo, valida e grava na biblioteca.
 * Devolve o sistema como ficou gravado. Lança com a razão em português
 * (arquivo que não é sistema, pasta sem permissão) para o aviso da grade.
 */
export async function importarSistema(texto: string): Promise<SistemaDeRpg> {
  const lido = lerSistemaDoTexto(texto)
  if (!lido.ok) throw new Error(`Esse arquivo não é um sistema de RPG: ${lido.erro}.`)
  const sistema = sistemaParaGravar(lido.sistema, new Set(SISTEMAS_EMBUTIDOS.map((embutido) => embutido.id)))
  try {
    const pasta = await pastaDosSistemas()
    await ensureDir(pasta)
    await writeTextFileSafely(await join(pasta, `${sistema.id}.json`), serializarSistema(sistema))
  } catch (erro) {
    throw new Error(`Não deu para guardar o sistema na biblioteca: ${motivo(erro)}.`)
  }
  return sistema
}
