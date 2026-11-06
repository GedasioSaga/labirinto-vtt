import { exists, mkdir, readDir, readTextFile, remove, rename, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import type { ArquivoDeTexto } from '../../lib/nuvem/fila'

/**
 * O DISCO DO LOBBY NO APP (docs/planos/lobby-jogadores-2026-11-05.md §4.4,
 * fatia A5): `<appData>/nuvem/<campanhaId>/` com `fila.jsonl`,
 * `diario-AAAA-MM.jsonl`, `estado.json`, `base.json` e `negadas.jsonl`.
 *
 * - o que só cresce (fila, diário, negadas) é ACRESCENTADO (append): a queda
 *   no meio corta só a última linha;
 * - o que é trocado inteiro (estado, base, a fila compactada) vai pela troca
 *   segura: grava ao lado e renomeia por cima (o rename da D1);
 * - uma cadeia de promessas por arquivo: uma gravação por vez, na ordem pedida.
 *
 * As primitivas são injetadas: no app, o plugin-fs do Tauri; nos testes, o
 * `node:fs` numa pasta temporária (a primeira execução fora da memória, 8.1.1 item 5).
 */

/** O que o disco sabe fazer, por caminho completo. */
export interface PrimitivasDoDisco {
  juntar(pasta: string, nome: string): Promise<string>
  /** O texto inteiro; `null` = o arquivo não existe. */
  lerTexto(caminho: string): Promise<string | null>
  /** Cria se não existe; `acrescentar` = append. */
  escreverTexto(caminho: string, texto: string, acrescentar: boolean): Promise<void>
  /** Troca o destino pelo de origem, de uma vez (o rename do sistema substitui o que existe). */
  renomear(de: string, para: string): Promise<void>
  apagarSeExiste(caminho: string): Promise<void>
  /** Os nomes dos arquivos da pasta; `[]` = a pasta não existe. */
  listarArquivos(pasta: string): Promise<string[]>
  garantirPasta(pasta: string): Promise<void>
}

/** Uma pasta da nuvem, por nome de arquivo. */
export interface PastaNoDisco {
  readonly caminho: string
  ler(nome: string): Promise<string | null>
  acrescentar(nome: string, texto: string): Promise<void>
  /** Troca segura: grava em `<nome>.gravando` e renomeia por cima. */
  reescrever(nome: string, texto: string): Promise<void>
  listar(): Promise<string[]>
}

/** Sufixo do arquivo novo antes do rename. */
export const SUFIXO_GRAVANDO = '.gravando'

/** Nome de arquivo da nuvem: só o que o app gera (nunca barra, nunca `..`). */
const NOME_DE_ARQUIVO = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,120}$/

function conferirNome(nome: string): void {
  if (!NOME_DE_ARQUIVO.test(nome) || nome.includes('..')) throw new Error(`Nome de arquivo da nuvem fora do formato: ${nome}`)
}

export function pastaNoDisco(primitivas: PrimitivasDoDisco, caminho: string): PastaNoDisco {
  const cadeias = new Map<string, Promise<unknown>>()
  let pastaPronta: Promise<void> | null = null
  /** A pasta é criada uma vez, na primeira gravação; se falhar, a próxima tenta de novo. */
  function garantir(): Promise<void> {
    if (pastaPronta === null) {
      pastaPronta = primitivas.garantirPasta(caminho).catch((erro: unknown) => {
        pastaPronta = null
        throw erro
      })
    }
    return pastaPronta
  }
  function emOrdem<T>(nome: string, passo: () => Promise<T>): Promise<T> {
    conferirNome(nome)
    const resultado = (cadeias.get(nome) ?? Promise.resolve()).then(passo)
    cadeias.set(
      nome,
      resultado.catch(() => undefined),
    )
    return resultado
  }
  const completo = (nome: string): Promise<string> => primitivas.juntar(caminho, nome)
  return {
    caminho,
    ler: (nome) => emOrdem(nome, async () => primitivas.lerTexto(await completo(nome))),
    acrescentar: (nome, texto) =>
      emOrdem(nome, async () => {
        await garantir()
        await primitivas.escreverTexto(await completo(nome), texto, true)
      }),
    reescrever: (nome, texto) =>
      emOrdem(nome, async () => {
        await garantir()
        const destino = await completo(nome)
        const temporario = await completo(`${nome}${SUFIXO_GRAVANDO}`)
        try {
          await primitivas.escreverTexto(temporario, texto, false)
          await primitivas.renomear(temporario, destino)
        } catch (erro) {
          // O meio-gravado nunca fica: o arquivo de antes continua inteiro.
          await primitivas.apagarSeExiste(temporario).catch(() => undefined)
          throw erro
        }
      }),
    listar: () => primitivas.listarArquivos(caminho),
  }
}

/** O `fila.jsonl` como a fila do núcleo o quer (`armazenamentoEmTexto`). */
export function arquivoDaFila(pasta: PastaNoDisco, nome = 'fila.jsonl'): ArquivoDeTexto {
  return {
    ler: () => pasta.ler(nome),
    acrescentar: (texto) => pasta.acrescentar(nome, texto),
    reescrever: (texto) => pasta.reescrever(nome, texto),
  }
}

// ── No app (Tauri) ──────────────────────────────────────────────────────────

/** `<appData>/nuvem`: a lista das campanhas e uma pasta por campanha. */
export const PASTA_DA_NUVEM = 'nuvem'

export const primitivasDoTauri: PrimitivasDoDisco = {
  juntar: (pasta, nome) => join(pasta, nome),
  async lerTexto(caminho) {
    if (!(await exists(caminho))) return null
    return readTextFile(caminho)
  },
  escreverTexto: (caminho, texto, acrescentar) => writeTextFile(caminho, texto, { append: acrescentar }),
  renomear: (de, para) => rename(de, para),
  async apagarSeExiste(caminho) {
    if (await exists(caminho)) await remove(caminho)
  },
  async listarArquivos(pasta) {
    if (!(await exists(pasta))) return []
    const entradas = await readDir(pasta)
    return entradas.filter((entrada) => entrada.isFile).map((entrada) => entrada.name)
  },
  garantirPasta: (pasta) => mkdir(pasta, { recursive: true }),
}

export async function pastaDaNuvemNoApp(): Promise<string> {
  return join(await appDataDir(), PASTA_DA_NUVEM)
}
