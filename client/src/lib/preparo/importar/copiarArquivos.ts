import { join } from '@tauri-apps/api/path'
import { exists, readDir, remove, rename, writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { hashHex } from '../../midia'
import { ensureDir, writeTextFileSafely } from '../../mapFileIO'
import { extensaoDe, type LeitorDoCofre } from './cofre'
import type { ArquivoNoRelatorio, PlanoDaImportacao } from './relatorio'

/**
 * O QUE O "APLICAR" COPIA SEM MOLDE (plano §4, passos 4 e 10): as imagens para
 * `midia/<sha256>.<ext>` e, em `importacoes/<data>/`, o relatório e a pasta
 * `original/` com todos os JSON do cofre (sem imagens). O cofre só é lido, pelo
 * mesmo `LeitorDoCofre` da simulação, que não sabe gravar.
 */

const PASTA_DA_MIDIA = 'midia'
const PASTA_DAS_IMPORTACOES = 'importacoes'
const PASTA_DOS_ORIGINAIS = 'original'
const ARQUIVO_DO_RELATORIO = 'relatorio.json'
const SUFIXO_TEMPORARIO = '.tmp'
const LOTE = 4

/** `midia/<sha256>.<ext>`, como a simulação nomeia (`simular.ts`, `lerImagem`). */
const NOME_DA_MIDIA = /^midia\/([0-9a-f]{64})\.([a-z0-9]{1,8})$/
/** O que não pode aparecer num nome de arquivo do Windows (e a barra, que separa pastas). */
const PROIBIDO_NO_NOME = /[<>:"/\\|?*\u0000-\u001f]/

export type Andar = (feitos: number, total: number) => void

function motivoDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

async function emLotes<T>(itens: readonly T[], aoAndar: Andar, passo: (item: T) => Promise<void>): Promise<void> {
  for (let inicio = 0; inicio < itens.length; inicio += LOTE) {
    await Promise.all(itens.slice(inicio, inicio + LOTE).map(passo))
    aoAndar(Math.min(inicio + LOTE, itens.length), itens.length)
  }
}

/** Grava pelo arquivo temporário e troca de nome: quem ler no meio nunca vê uma imagem pela metade. */
async function gravarBytes(destino: string, bytes: Uint8Array): Promise<void> {
  const temporario = `${destino}${SUFIXO_TEMPORARIO}`
  try {
    await writeFile(temporario, bytes)
    await rename(temporario, destino)
  } catch (erro) {
    await remove(temporario).catch(() => undefined)
    throw erro
  }
}

// ─── Mídia ───────────────────────────────────────────────────────────────────

/**
 * As imagens que já estão em `midia/`, com o nome que o plano usa
 * (`midia/<sha256>.<ext>`): o `copiarMidias` não copia de novo, então elas não
 * contam no espaço. O `.tmp` de uma cópia pela metade e o que não tem nome de
 * mídia ficam de fora. Pasta que não existe = nenhuma.
 */
export async function midiasNoPreludio(raiz: string): Promise<Set<string>> {
  const pasta = await join(raiz, PASTA_DA_MIDIA)
  if (!(await exists(pasta))) return new Set()
  const nomes = (await readDir(pasta)).filter((entrada) => entrada.isFile).map((entrada) => `${PASTA_DA_MIDIA}/${entrada.name}`)
  return new Set(nomes.filter((nome) => NOME_DA_MIDIA.test(nome)))
}

/**
 * Cada imagem nova vai para `midia/` uma vez só; a que já está lá (de outra
 * importação ou repetida no cofre) nem é lida. O SHA-256 é conferido de novo:
 * se a imagem mudou no cofre depois da simulação, o nome não bate e a
 * importação para antes de gravar qualquer verbete.
 * Devolve quantas foram copiadas agora.
 */
export async function copiarMidias(leitor: LeitorDoCofre, raiz: string, midias: PlanoDaImportacao['midias'], aoAndar: Andar): Promise<number> {
  const pasta = await join(raiz, PASTA_DA_MIDIA)
  await ensureDir(pasta)
  let copiadas = 0
  await emLotes(midias, aoAndar, async (midia) => {
    const nome = NOME_DA_MIDIA.exec(midia.midia)
    if (nome === null) throw new Error(`a imagem ${midia.caminho} ganhou um nome que não serve (${midia.midia})`)
    const [, sha, extensao] = nome
    const destino = await join(pasta, `${sha}.${extensao}`)
    if (await exists(destino)) return
    const bytes = await leitor.lerBytes(midia.caminho)
    if ((await hashHex(bytes)) !== sha) throw new Error(`a imagem ${midia.caminho} mudou no cofre depois da simulação. Simule de novo`)
    await gravarBytes(destino, bytes)
    copiadas += 1
  })
  return copiadas
}

// ─── A pasta da importação ───────────────────────────────────────────────────

/** `2026-11-08T21-30-05Z`: serve de nome de pasta no Windows e ordena por data. */
export function carimboDe(quando: Date): string {
  return quando.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-')
}

const TENTATIVAS_DE_NOME = 100

/** `importacoes/<data>/`, nova: duas importações no mesmo segundo ganham `-2`, `-3`… Devolve o caminho e o nome relativo a preparo/. */
export async function criarPastaDaImportacao(raiz: string, quando: Date): Promise<{ absoluta: string; relativa: string }> {
  const carimbo = carimboDe(quando)
  for (let vez = 1; vez <= TENTATIVAS_DE_NOME; vez += 1) {
    const nome = vez === 1 ? carimbo : `${carimbo}-${vez}`
    const absoluta = await join(raiz, PASTA_DAS_IMPORTACOES, nome)
    if (await exists(absoluta)) continue
    await ensureDir(absoluta)
    return { absoluta, relativa: `${PASTA_DAS_IMPORTACOES}/${nome}` }
  }
  throw new Error(`já existem ${TENTATIVAS_DE_NOME} importações com a data ${carimbo}`)
}

/** Os arquivos do cofre que vão para `original/`: todos os JSON e o que ficou "só no original"; imagem nunca. */
export function vaoParaOOriginal(arquivos: readonly ArquivoNoRelatorio[]): ArquivoNoRelatorio[] {
  return arquivos.filter((arquivo) => arquivo.destino !== 'falha' && arquivo.destino !== 'midia' && (extensaoDe(arquivo.caminho) === 'json' || arquivo.destino === 'soOriginal'))
}

function partesSeguras(caminho: string): string[] | null {
  const partes = caminho.split('/')
  const servem = partes.every((parte) => parte !== '' && parte !== '.' && parte !== '..' && !PROIBIDO_NO_NOME.test(parte))
  return servem ? partes : null
}

/**
 * Copia para `original/` cada arquivo, no mesmo caminho que tinha no cofre.
 * Caminho que não serve (não acontece com nome vindo do disco) fica de fora,
 * com aviso. Devolve os avisos.
 */
export async function guardarOriginais(leitor: LeitorDoCofre, pastaDaImportacao: string, arquivos: readonly ArquivoNoRelatorio[], aoAndar: Andar): Promise<string[]> {
  const avisos: string[] = []
  const base = await join(pastaDaImportacao, PASTA_DOS_ORIGINAIS)
  const criadas = new Set<string>()
  await emLotes(arquivos, aoAndar, async (arquivo) => {
    const partes = partesSeguras(arquivo.caminho)
    if (partes === null) {
      avisos.push(`${arquivo.caminho}: o caminho não serve de nome no disco, então ficou fora de original/.`)
      return
    }
    const pasta = await join(base, ...partes.slice(0, -1))
    if (!criadas.has(pasta)) {
      await ensureDir(pasta)
      criadas.add(pasta)
    }
    const destino = await join(pasta, partes[partes.length - 1])
    try {
      if (extensaoDe(arquivo.caminho) === 'json') await writeTextFile(destino, await leitor.lerTexto(arquivo.caminho))
      else await writeFile(destino, await leitor.lerBytes(arquivo.caminho))
    } catch (erro) {
      avisos.push(`${arquivo.caminho}: não deu para guardar em original/ (${motivoDe(erro)}).`)
    }
  })
  return avisos
}

/** O `relatorio.json` da importação aplicada. */
export async function gravarRelatorio(pastaDaImportacao: string, conteudo: unknown): Promise<void> {
  await writeTextFileSafely(await join(pastaDaImportacao, ARQUIVO_DO_RELATORIO), JSON.stringify(conteudo, null, 2))
}
