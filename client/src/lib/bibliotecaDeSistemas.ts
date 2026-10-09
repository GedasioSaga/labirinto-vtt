import { exists, readDir, readTextFile, remove } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { ensureDir, writeTextFileSafely } from './mapFileIO'
import { idValido, lerSistemaDoTexto, serializarSistema, type SistemaDeRpg } from './sistemaDeRpg'
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
 * grade e não dá para sobrescrevê-los nem apagá-los — o editor edita uma cópia.
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

const IDS_EMBUTIDOS: ReadonlySet<string> = new Set(SISTEMAS_EMBUTIDOS.map((embutido) => embutido.id))

/** O sistema vem com o app (One Piece): não tem arquivo, não muda e não sai da grade. */
export function ehEmbutido(sistemaId: string): boolean {
  return IDS_EMBUTIDOS.has(sistemaId)
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
 * Grava o sistema na pasta da biblioteca (`<id>.json`), novo ou por cima do
 * que já estava: o "Salvar" do editor, o "Duplicar" e o "+". Recusa o
 * embutido (ele não tem arquivo). Lança com a razão em português.
 */
export async function gravarSistema(sistema: SistemaDeRpg): Promise<void> {
  if (ehEmbutido(sistema.id)) throw new Error(`O ${sistema.nome} vem com o Labirinto e não muda: edite uma cópia.`)
  // O id vira nome de arquivo: o leitor já garante, mas o caminho não depende disso.
  if (!idValido(sistema.id)) throw new Error(`O id "${sistema.id}" não serve de nome de arquivo.`)
  try {
    const pasta = await pastaDosSistemas()
    await ensureDir(pasta)
    await writeTextFileSafely(await join(pasta, `${sistema.id}.json`), serializarSistema(sistema))
  } catch (erro) {
    throw new Error(`Não deu para guardar o sistema na biblioteca: ${motivo(erro)}.`)
  }
}

/**
 * O "+" da grade: lê o texto do arquivo, valida e grava na biblioteca.
 * Devolve o sistema como ficou gravado. Lança com a razão em português
 * (arquivo que não é sistema, pasta sem permissão) para o aviso da grade.
 */
export async function importarSistema(texto: string): Promise<SistemaDeRpg> {
  const lido = lerSistemaDoTexto(texto)
  if (!lido.ok) throw new Error(`Esse arquivo não é um sistema de RPG: ${lido.erro}.`)
  const sistema = sistemaParaGravar(lido.sistema, IDS_EMBUTIDOS)
  await gravarSistema(sistema)
  return sistema
}

/**
 * Tira o sistema da biblioteca: o `<id>.json` e qualquer outro arquivo da
 * pasta com o MESMO id (posto à mão com outro nome) — senão ele voltaria na
 * próxima leitura. Recusa o embutido. Quem confirma e quem barra o sistema em
 * uso é a grade; aqui só sai do disco.
 */
export async function apagarSistema(sistemaId: string): Promise<void> {
  if (ehEmbutido(sistemaId)) throw new Error('O sistema que vem com o Labirinto não pode ser apagado.')
  if (!idValido(sistemaId)) throw new Error(`O id "${sistemaId}" não serve de nome de arquivo.`)
  try {
    const pasta = await pastaDosSistemas()
    if (!(await exists(pasta))) return
    const nomes = (await readDir(pasta)).filter((entrada) => entrada.isFile && entrada.name.toLowerCase().endsWith('.json')).map((entrada) => entrada.name)
    for (const nome of nomes) {
      const caminho = await join(pasta, nome)
      const doSistema = nome.toLowerCase() === `${sistemaId.toLowerCase()}.json` || (await idDoArquivo(caminho)) === sistemaId
      if (doSistema) await remove(caminho)
    }
  } catch (erro) {
    throw new Error(`Não deu para apagar o sistema da biblioteca: ${motivo(erro)}.`)
  }
}

/**
 * O id do sistema gravado no arquivo; `null` quando ele não é um sistema
 * legível — fica onde está, e um arquivo estragado não impede de apagar o resto.
 */
async function idDoArquivo(caminho: string): Promise<string | null> {
  let texto: string
  try {
    texto = await readTextFile(caminho)
  } catch {
    return null
  }
  const lido = lerSistemaDoTexto(texto)
  return lido.ok ? lido.sistema.id : null
}
