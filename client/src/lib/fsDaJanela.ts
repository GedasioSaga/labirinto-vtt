import { invoke, type InvokeArgs, type InvokeOptions } from '@tauri-apps/api/core'
import * as fs from '@tauri-apps/plugin-fs'
import { ehJanelaDoPreludio } from './janelaDoPreludio'

/**
 * O DISCO DE QUALQUER JANELA DO APP, com a cara do `@tauri-apps/plugin-fs`.
 *
 * - Na janela principal (e nos testes) cada função é o próprio plugin, com os
 *   mesmos argumentos: nada muda para quem já usava.
 * - Na janela do Prelúdio o plugin não existe (o escopo dele é global no
 *   Tauri 2 e daria à janela o `<appData>` inteiro). Lá cada função vira um
 *   comando de `desktop/src-tauri/src/preludio/disco_da_janela.rs`, que só grava
 *   em `preparo/` e só lê `preparo/`, `maps/` e `pastas/`.
 *
 * Só as funções que o Prelúdio usa (direto ou pelo `mapFileIO`/`pastasDeMapas`)
 * estão aqui. Opção que o comando da janela não sabe cumprir lança, em vez de
 * fazer outra coisa calada.
 */

type Caminho = string | URL

function emTexto(caminho: Caminho): string {
  if (typeof caminho !== 'string') throw new Error('A janela do Prelúdio só abre caminho escrito como texto.')
  return caminho
}

/** O erro do Rust chega como `{codigo, mensagem}`; quem chama lê `erro.message`. */
function comoErro(erro: unknown): Error {
  if (erro instanceof Error) return erro
  if (typeof erro === 'object' && erro !== null) {
    const mensagem: unknown = Reflect.get(erro, 'mensagem')
    if (typeof mensagem === 'string') return new Error(mensagem)
  }
  return new Error(String(erro))
}

async function pedir<T>(comando: string, args?: InvokeArgs, opcoes?: InvokeOptions): Promise<T> {
  try {
    return await invoke<T>(comando, args, opcoes)
  } catch (erro) {
    throw comoErro(erro)
  }
}

/** Cabeçalho só leva ASCII, e o caminho tem o nome de usuário do Windows (com acento, às vezes). */
export function emHex(texto: string): string {
  let hex = ''
  for (const byte of new TextEncoder().encode(texto)) hex += byte.toString(16).padStart(2, '0')
  return hex
}

function semOpcao(nome: string): never {
  throw new Error(`A janela do Prelúdio não grava com a opção "${nome}".`)
}

export async function exists(...args: Parameters<typeof fs.exists>): Promise<boolean> {
  if (!ehJanelaDoPreludio()) return fs.exists(...args)
  return pedir<boolean>('preludio_disco_existe', { caminho: emTexto(args[0]) })
}

export async function readTextFile(...args: Parameters<typeof fs.readTextFile>): Promise<string> {
  if (!ehJanelaDoPreludio()) return fs.readTextFile(...args)
  const lido = await pedir<ArrayBuffer | number[]>('preludio_disco_ler', { caminho: emTexto(args[0]) })
  return new TextDecoder().decode(lido instanceof ArrayBuffer ? lido : Uint8Array.from(lido))
}

export async function readDir(...args: Parameters<typeof fs.readDir>): Promise<fs.DirEntry[]> {
  if (!ehJanelaDoPreludio()) return fs.readDir(...args)
  return pedir<fs.DirEntry[]>('preludio_disco_listar', { caminho: emTexto(args[0]) })
}

interface InfoDaJanela {
  isFile: boolean
  isDirectory: boolean
  isSymlink: boolean
  size: number
  mtime: number | null
}

export async function stat(...args: Parameters<typeof fs.stat>): Promise<fs.FileInfo> {
  if (!ehJanelaDoPreludio()) return fs.stat(...args)
  const info = await pedir<InfoDaJanela>('preludio_disco_info', { caminho: emTexto(args[0]) })
  return {
    isFile: info.isFile,
    isDirectory: info.isDirectory,
    isSymlink: info.isSymlink,
    size: info.size,
    mtime: info.mtime === null ? null : new Date(info.mtime),
    atime: null,
    birthtime: null,
    readonly: false,
    fileAttributes: null,
    dev: null,
    ino: null,
    mode: null,
    nlink: null,
    uid: null,
    gid: null,
    rdev: null,
    blksize: null,
    blocks: null,
  }
}

export async function writeTextFile(...args: Parameters<typeof fs.writeTextFile>): Promise<void> {
  if (!ehJanelaDoPreludio()) return fs.writeTextFile(...args)
  const [caminho, texto, opcoes] = args
  if (opcoes?.append === true) semOpcao('append')
  await pedir<null>('preludio_disco_gravar_texto', { caminho: emTexto(caminho), texto })
}

export async function writeFile(...args: Parameters<typeof fs.writeFile>): Promise<void> {
  if (!ehJanelaDoPreludio()) return fs.writeFile(...args)
  const [caminho, dados, opcoes] = args
  if (opcoes?.append === true) semOpcao('append')
  if (!(dados instanceof Uint8Array)) throw new Error('A janela do Prelúdio só grava bytes já prontos.')
  await pedir<null>('preludio_disco_gravar_bytes', dados, { headers: { caminho: emHex(emTexto(caminho)) } })
}

/** Na janela do Prelúdio, sempre cria as pastas de cima (o `recursive: true` de quem chama). */
export async function mkdir(...args: Parameters<typeof fs.mkdir>): Promise<void> {
  if (!ehJanelaDoPreludio()) return fs.mkdir(...args)
  await pedir<null>('preludio_disco_criar_pasta', { caminho: emTexto(args[0]) })
}

/** Na janela do Prelúdio, apaga arquivo ou pasta vazia: pasta com conteúdo, nunca. */
export async function remove(...args: Parameters<typeof fs.remove>): Promise<void> {
  if (!ehJanelaDoPreludio()) return fs.remove(...args)
  if (args[1]?.recursive === true) semOpcao('recursive')
  await pedir<null>('preludio_disco_apagar', { caminho: emTexto(args[0]) })
}

export async function rename(...args: Parameters<typeof fs.rename>): Promise<void> {
  if (!ehJanelaDoPreludio()) return fs.rename(...args)
  await pedir<null>('preludio_disco_renomear', { de: emTexto(args[0]), para: emTexto(args[1]) })
}
