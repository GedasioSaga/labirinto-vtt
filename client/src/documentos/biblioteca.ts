import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { ensureDir, writeTextFileSafely } from '../lib/mapFileIO'
import { lerDocumento } from './leitor'
import { extrasPadrao, PAPEL_PADRAO, VERSAO_DO_DOCUMENTO } from './tipos'
import type { Documento, IndiceDaBiblioteca } from './tipos'

/**
 * A BIBLIOTECA "DOCUMENTOS" (plano §1.1 e §1.5): o texto de cada documento
 * mora no APP, fora da campanha e fora do acervo, como "Meus puzzles"
 * (`puzzles/meusPuzzles.ts`):
 *
 *   <appData>/documentos/documentos.json   índice: a versão e os documentos
 *
 * O mapa guarda só o papel no chão (`MapData.documentos`) e a ficha só a
 * lista (`Personagem.documentos`), os dois pelo `Documento.id`. Por isso uma
 * correção do mestre aqui vale também para quem já leu.
 *
 * As defesas são as do acervo, pelos mesmos motivos: índice ilegível é posto
 * de lado (`.invalido`) antes de a lista recomeçar vazia; leitura que falha
 * por I/O não deixa gravar por cima (`lido`); cada gravação tira cópia do
 * índice (`.anterior`) e passa pela fila, uma depois da outra.
 */

const PASTA_DOS_DOCUMENTOS = 'documentos'
const ARQUIVO_DO_INDICE = 'documentos.json'
const ARQUIVO_INVALIDO = 'documentos.json.invalido'
const ARQUIVO_ANTERIOR = 'documentos.json.anterior'
/** 1 (20/11/2026): a primeira. Quando houver a 2, o passo de 1 para 2 entra em `bibliotecaDoTexto`. */
const VERSAO_DO_INDICE: IndiceDaBiblioteca['versao'] = 1

export interface BibliotecaLida {
  documentos: Documento[]
  /** Frase pronta para a tela quando a leitura deu errado; `null` = tudo certo. */
  aviso: string | null
  /** O índice foi LIDO (ou não existia ainda)? `false` = gravar seria passar por cima do que não se leu. */
  lido: boolean
}

const AVISO = 'Não foi possível ler os seus documentos'
export const BIBLIOTECA_NAO_LIDA = `${AVISO}, então nada foi gravado para não apagar o que está lá. Feche e abra o app de novo.`
export const BIBLIOTECA_DE_VERSAO_NOVA = 'Os seus documentos foram gravados por uma versão mais nova do app. Dá para ler e pôr no mapa, mas não para mudá-los: atualize o app.'

export function novoIdDeDocumento(): string {
  return `doc_${crypto.randomUUID()}`
}

/** Instante gravado (ms desde 1970); torto = `padrao`. */
function instanteValido(valor: number, padrao: number): number {
  return Number.isSafeInteger(valor) && valor >= 0 ? valor : padrao
}

/**
 * O documento como fica guardado: passado pelo mesmo leitor do disco, para
 * que o da memória seja igual ao que volta depois de fechar e abrir o app
 * (título aparado, texto no teto, imagem só `midia:`). O JSON no meio corta
 * qualquer referência ao objeto do editor. `null` = o id não serve.
 */
export function documentoGuardado(documento: Documento): Documento | null {
  return lerDocumento(JSON.parse(JSON.stringify(documento)))
}

/** "Novo documento": uma página em branco, o papel padrão e os extras padrão, como no protótipo. */
export function documentoNovo(agora: number, id: string = novoIdDeDocumento()): Documento {
  const criadoEm = instanteValido(agora, 0)
  return {
    id,
    versao: VERSAO_DO_DOCUMENTO,
    titulo: 'Documento novo',
    papel: PAPEL_PADRAO,
    imagemDoPapel: null,
    paginas: [{ texto: '', imagem: null }],
    dicaDe: null,
    extras: extrasPadrao(),
    trechos: {},
    criadoEm,
    mudadoEm: criadoEm,
  }
}

/**
 * "SEPARAR NUM DOCUMENTO NOVO" (bug de 20/11/2026: dois papéis no mapa eram o
 * MESMO documento, e mudar um mudava o outro): o mesmo texto, papel e extras
 * com id e datas novos, o título marcado como cópia. A dica de puzzle fica com
 * o original. `null` = o id não serve.
 */
export function documentoCopiado(base: Documento, agora: number, id: string = novoIdDeDocumento()): Documento | null {
  const criadoEm = instanteValido(agora, 0)
  const titulo = base.titulo.trim() === '' ? 'Cópia' : `${base.titulo.trim()} (cópia)`
  return documentoGuardado({ ...base, id, titulo, dicaDe: null, criadoEm, mudadoEm: criadoEm })
}

/** O documento que o editor mudou, com a hora da mudança. A criação e o id não mudam. */
export function documentoMudado(antes: Documento, depois: Documento, agora: number): Documento {
  return { ...depois, id: antes.id, criadoEm: antes.criadoEm, mudadoEm: Math.max(instanteValido(agora, antes.mudadoEm), antes.criadoEm) }
}

/** O índice como texto. `null` = não é JSON da biblioteca (o arquivo vai para `.invalido`). */
export function bibliotecaDoTexto(texto: string): { documentos: Documento[]; versao: number } | null {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return null
  }
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) return null
  const lista: unknown = Reflect.get(bruto, 'documentos')
  if (!Array.isArray(lista)) return null
  const vistos = new Set<string>()
  const documentos: Documento[] = []
  for (const valor of lista) {
    const documento = lerDocumento(valor)
    if (documento === null || vistos.has(documento.id)) continue
    vistos.add(documento.id)
    documentos.push(documento)
  }
  const versaoCrua: unknown = Reflect.get(bruto, 'versao')
  const versao = typeof versaoCrua === 'number' && Number.isSafeInteger(versaoCrua) ? versaoCrua : VERSAO_DO_INDICE
  return { documentos, versao }
}

export function serializarBiblioteca(documentos: readonly Documento[]): string {
  const indice: IndiceDaBiblioteca = { versao: VERSAO_DO_INDICE, documentos: [...documentos] }
  return `${JSON.stringify(indice, null, 2)}\n`
}

// ------------------------------------------------------------------ o disco

async function pastaDosDocumentos(): Promise<string> {
  return join(await appDataDir(), PASTA_DOS_DOCUMENTOS)
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
export async function lerBiblioteca(): Promise<BibliotecaLida> {
  let texto: string
  try {
    const caminho = await join(await pastaDosDocumentos(), ARQUIVO_DO_INDICE)
    if (!(await exists(caminho))) return { documentos: [], aviso: null, lido: true }
    texto = await readTextFile(caminho)
  } catch (erro) {
    return { documentos: [], aviso: `${AVISO}: ${motivo(erro)}.`, lido: false }
  }
  const indice = bibliotecaDoTexto(texto)
  if (indice !== null) {
    return indice.versao > VERSAO_DO_INDICE
      ? { documentos: indice.documentos, aviso: BIBLIOTECA_DE_VERSAO_NOVA, lido: false }
      : { documentos: indice.documentos, aviso: null, lido: true }
  }
  try {
    await writeTextFile(await join(await pastaDosDocumentos(), ARQUIVO_INVALIDO), texto)
  } catch {
    // Sem a cópia, a lista NÃO recomeça: gravar agora passaria por cima do único exemplar.
    return { documentos: [], aviso: `${AVISO}: o arquivo estava ilegível e não deu para guardar uma cópia dele.`, lido: false }
  }
  return {
    documentos: [],
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
export function gravarBiblioteca(documentos: readonly Documento[]): Promise<void> {
  return naFila(async () => {
    try {
      const pasta = await pastaDosDocumentos()
      const caminho = await join(pasta, ARQUIVO_DO_INDICE)
      await ensureDir(pasta)
      // Cópia do de antes: melhor esforço — sem ela a gravação segue.
      try {
        if (await exists(caminho)) await writeTextFile(await join(pasta, ARQUIVO_ANTERIOR), await readTextFile(caminho))
      } catch {
        // A cópia é a segunda linha de defesa; a primeira é a gravação segura logo abaixo.
      }
      await writeTextFileSafely(caminho, serializarBiblioteca(documentos))
    } catch (erro) {
      throw new Error(`Não foi possível gravar os seus documentos: ${motivo(erro)}.`)
    }
  })
}
