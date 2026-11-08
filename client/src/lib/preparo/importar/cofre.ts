import { hashHex } from '../../midia'

/**
 * O COFRE DO GRIMÓRIO, SÓ PARA LER (docs/planos/preludio-2026-11-08.md §4,
 * passo 1). O importador enxerga o cofre só por esta interface, e ela não tem
 * nenhum método que grave: a simulação não tem como mexer no cofre.
 *
 * Caminhos são relativos à raiz do cofre, separados por '/'; '' é a raiz.
 */

/**
 * `atalho` é link simbólico ou junção: o inventário não segue (poderia sair da
 * pasta escolhida) e não descarta calado; ele entra na lista como falha.
 */
export type TipoDaEntrada = 'arquivo' | 'pasta' | 'atalho'

export interface EntradaDoCofre {
  readonly nome: string
  readonly tipo: TipoDaEntrada
}

export interface InfoDoArquivo {
  readonly bytes: number
  /** Os atributos do arquivo no Windows (`FILE_ATTRIBUTE_*`); `null` fora do Windows. */
  readonly atributos: number | null
}

export interface LeitorDoCofre {
  listar(caminho: string): Promise<readonly EntradaDoCofre[]>
  /** Tamanho e atributos SEM abrir o conteúdo: não faz o OneDrive baixar nada. */
  info(caminho: string): Promise<InfoDoArquivo>
  lerTexto(caminho: string): Promise<string>
  lerBytes(caminho: string): Promise<Uint8Array>
}

// File Attribute Constants do Windows (learn.microsoft.com/windows/win32/fileio/file-attribute-constants).
const FILE_ATTRIBUTE_OFFLINE = 0x1000
const FILE_ATTRIBUTE_RECALL_ON_OPEN = 0x40000
const FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS = 0x400000
const SO_NA_NUVEM = FILE_ATTRIBUTE_OFFLINE | FILE_ATTRIBUTE_RECALL_ON_OPEN | FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS

/** O arquivo está só na nuvem do OneDrive: ler o conteúdo faria baixar, então ele não é lido. */
export function soNaNuvem(atributos: number | null): boolean {
  return atributos !== null && (atributos & SO_NA_NUVEM) !== 0
}

export function juntar(pasta: string, nome: string): string {
  return pasta === '' ? nome : `${pasta}/${nome}`
}

/** A pasta de um caminho ('' na raiz). */
export function pastaDe(caminho: string): string {
  const corte = caminho.lastIndexOf('/')
  return corte < 0 ? '' : caminho.slice(0, corte)
}

export function nomeDe(caminho: string): string {
  return caminho.slice(caminho.lastIndexOf('/') + 1)
}

/** Chave para comparar caminhos: no Windows "Imagens" e "imagens" são a mesma pasta. */
export function chaveDoCaminho(caminho: string): string {
  return caminho.normalize('NFC').replace(/\\/g, '/').toLowerCase()
}

/** Extensão em minúsculas, sem o ponto ('' sem extensão). */
export function extensaoDe(caminho: string): string {
  const nome = nomeDe(caminho)
  const ponto = nome.lastIndexOf('.')
  return ponto <= 0 ? '' : nome.slice(ponto + 1).toLowerCase()
}

/** Ordem fixa (por unidade de código, sem depender do idioma da máquina): mesmo cofre, mesma lista. */
export function compararCaminhos(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function hashDoTexto(texto: string): Promise<string> {
  return hashHex(new TextEncoder().encode(texto))
}

const PREFIXO_DO_ID_FIXO = 'grim-'
const DIGITOS_DO_ID_FIXO = 32

/**
 * Id fixo para o que chega do Grimório sem id: sai do caminho do arquivo, então
 * reimportar o mesmo arquivo dá o mesmo id (o Grimório sortearia um novo a cada
 * leitura, `vaultRepo.ts:74,120`, e cada reimportação criaria uma cópia).
 */
export async function idFixoDoCaminho(caminho: string): Promise<string> {
  const hash = await hashDoTexto(chaveDoCaminho(caminho))
  return `${PREFIXO_DO_ID_FIXO}${hash.slice(0, DIGITOS_DO_ID_FIXO)}`
}
