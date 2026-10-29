import { exists, readDir, readTextFile, stat, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { ensureDir, writeTextFileSafely } from '../mapFileIO'
import { guardarAudioNaPasta, PASTA_DE_MIDIA_DA_AVENTURA } from '../midiaDaPasta'
import { ARQUIVO_DE_SONS, bibliotecaDeSonsVazia, bibliotecaDoTexto, serializarBiblioteca, SONS_JSON_MAX_BYTES, type BibliotecaDeSons, type FonteDeArquivo } from './biblioteca'

/**
 * A BIBLIOTECA DE SONS NO DISCO, GLOBAL DO APP (29/10/2026): uma só para
 * todas as aventuras, em `<appData>/sons/sons.json`, e os áudios dela em
 * `<appData>/sons/midia/`. Antes, cada aventura tinha a sua em
 * `<pasta da aventura>/sons.json`; a migração (`migracaoDosSons.ts`) traz
 * essas para cá uma vez, sem apagar o `sons.json` de lá.
 *
 * O áudio da biblioteca NÃO mora em `<appData>/midia` (fechamento (b) da F5,
 * 23/10/2026): aquela pasta a sala serve em `/media/{id}` sem chave, e o som
 * só sai pela rota com chave (`/sons/{id}`), que lê `<appData>/sons/midia`
 * (`net_sons_aventura` aceita a pasta global, `desktop/src-tauri/src/net/sons.rs`,
 * `PASTA_DA_BIBLIOTECA_DE_SONS`).
 *
 * Sem `sons.json` global: biblioteca vazia, sem aviso. O app antigo não olha
 * esta pasta: segue lendo o `sons.json` da aventura dele.
 */

export { ARQUIVO_DE_SONS, SONS_JSON_MAX_BYTES }

/** Nome da pasta da biblioteca dentro de `appDataDir()` — o mesmo `PASTA_DA_BIBLIOTECA_DE_SONS` do Rust. */
export const PASTA_DA_BIBLIOTECA_DE_SONS = 'sons'

const NAO_LEU = 'Não foi possível ler a biblioteca de sons'

export async function pastaDaBibliotecaGlobal(): Promise<string> {
  return join(await appDataDir(), PASTA_DA_BIBLIOTECA_DE_SONS)
}

/** `<appData>/sons/midia`: os áudios da biblioteca, que `/sons/{id}` serve com chave. */
export async function pastaDaMidiaDaBiblioteca(): Promise<string> {
  return join(await pastaDaBibliotecaGlobal(), PASTA_DE_MIDIA_DA_AVENTURA)
}

/** Cria a pasta da biblioteca (a sala só aceita servir de uma pasta que existe) e devolve o caminho. Lança se o disco recusar. */
export async function prepararPastaDaBiblioteca(): Promise<string> {
  const pasta = await pastaDaBibliotecaGlobal()
  await ensureDir(pasta)
  return pasta
}

function doisDigitos(numero: number): string {
  return String(numero).padStart(2, '0')
}

/**
 * Onde fica a cópia do `sons.json` que não deu para ler, antes de a
 * biblioteca recomeçar vazia: `sons.invalido-AAAAMMDD-HHMMSS.json`, na hora
 * local. Nome novo a cada vez: a cópia de uma abertura nunca apaga a de outra.
 */
export function nomeDaCopiaDoSonsIlegivel(quando: Date): string {
  const dia = `${quando.getFullYear()}${doisDigitos(quando.getMonth() + 1)}${doisDigitos(quando.getDate())}`
  const hora = `${doisDigitos(quando.getHours())}${doisDigitos(quando.getMinutes())}${doisDigitos(quando.getSeconds())}`
  return `sons.invalido-${dia}-${hora}.json`
}

export interface BibliotecaLida {
  biblioteca: BibliotecaDeSons
  /** Frase pronta para a tela quando a leitura deu errado; `null` = tudo certo (ou não havia `sons.json`). */
  aviso: string | null
  /** `false` = há um `sons.json` que não foi lido; gravar agora passaria por cima dele. */
  podeGravar: boolean
}

/**
 * O erro do disco em frase para a tela. A mensagem crua do `plugin-fs` traz
 * o caminho absoluto (com o nome de usuário do Windows) e não vai para o
 * aviso: só o código do sistema, que serve para procurar o problema.
 */
function motivo(causa: unknown): string {
  const texto = causa instanceof Error ? causa.message : String(causa)
  if (/os error 5\b|denied|negado/i.test(texto)) return 'o Windows negou o acesso ao arquivo (outro programa pode estar com ele aberto)'
  if (/forbidden path|not allowed/i.test(texto)) return 'o app não tem permissão de usar essa pasta'
  const codigo = /os error (\d+)/i.exec(texto)
  return codigo === null ? 'o disco recusou a operação' : `o disco recusou a operação (os error ${codigo[1]})`
}

/**
 * Guarda o texto ilegível numa cópia nova; devolve o nome dela, ou `null` sem
 * cópia. A cópia nunca passa por cima de arquivo que já existe (`createNew`)
 * nem escreve por um atalho, que poderia apontar para fora da pasta. Atalho se
 * vê na listagem da pasta: o `lstat` não está entre as permissões do app.
 */
async function guardarCopiaDoIlegivel(pasta: string, texto: string): Promise<string | null> {
  const nome = nomeDaCopiaDoSonsIlegivel(new Date())
  try {
    const entradas = await readDir(pasta)
    if (entradas.some((entrada) => entrada.name === nome && entrada.isSymlink)) return null
    await writeTextFile(await join(pasta, nome), texto, { createNew: true })
    return nome
  } catch {
    return null
  }
}

let filaDoDisco: Promise<void> = Promise.resolve()

/**
 * Uma operação no `sons.json` depois da outra: a gravação mais nova nunca é
 * passada para trás por uma mais velha que terminou depois, e a leitura vê a
 * gravação pedida antes dela.
 */
function naFila<T>(operacao: () => Promise<T>): Promise<T> {
  const resultado = filaDoDisco.then(operacao)
  filaDoDisco = resultado.then(
    () => undefined,
    () => undefined,
  )
  return resultado
}

/** Lê o `sons.json` global. Nunca lança: o erro vira `aviso`, e `podeGravar: false` barra quem grava. */
export function lerBibliotecaGlobal(): Promise<BibliotecaLida> {
  return naFila(async () => {
    let pasta: string
    try {
      pasta = await pastaDaBibliotecaGlobal()
    } catch (erro) {
      return { biblioteca: bibliotecaDeSonsVazia(), aviso: `${NAO_LEU}: ${motivo(erro)}.`, podeGravar: false }
    }
    return lerBibliotecaDaPasta(pasta)
  })
}

async function lerBibliotecaDaPasta(pasta: string): Promise<BibliotecaLida> {
  let texto: string
  try {
    const caminho = await join(pasta, ARQUIVO_DE_SONS)
    // Primeira vez do app com a biblioteca global: vazia, sem aviso (a migração enche).
    if (!(await exists(caminho))) return { biblioteca: bibliotecaDeSonsVazia(), aviso: null, podeGravar: true }
    // O tamanho antes do texto: o arquivo enorme não entra na memória.
    if ((await stat(caminho)).size > SONS_JSON_MAX_BYTES) {
      return {
        biblioteca: bibliotecaDeSonsVazia(),
        aviso: `${NAO_LEU}: sons.json grande demais (passa de ${SONS_JSON_MAX_BYTES / (1024 * 1024)} MB). Até ele ser trocado, nada novo é guardado, para não apagar o que está lá.`,
        podeGravar: false,
      }
    }
    texto = await readTextFile(caminho)
  } catch (erro) {
    return { biblioteca: bibliotecaDeSonsVazia(), aviso: `${NAO_LEU}: ${motivo(erro)}.`, podeGravar: false }
  }
  const lido = bibliotecaDoTexto(texto)
  if (lido.ok) return { biblioteca: lido.biblioteca, aviso: null, podeGravar: true }
  if (lido.motivo === 'versao-mais-nova') {
    return {
      biblioteca: bibliotecaDeSonsVazia(),
      aviso: 'A biblioteca de sons foi gravada por uma versão mais nova do app: atualize para usá-la. Até lá, nada novo é guardado, para não apagar o que está lá.',
      podeGravar: false,
    }
  }
  const copia = await guardarCopiaDoIlegivel(pasta, texto)
  if (copia === null) {
    // Sem a cópia, a biblioteca NÃO recomeça: gravar agora passaria por cima do único exemplar.
    return { biblioteca: bibliotecaDeSonsVazia(), aviso: `${NAO_LEU}: o arquivo estava ilegível e não deu para guardar uma cópia dele.`, podeGravar: false }
  }
  return {
    biblioteca: bibliotecaDeSonsVazia(),
    aviso: `${NAO_LEU}: o arquivo estava ilegível. A biblioteca começa vazia, e o arquivo antigo ficou guardado como ${copia}, na pasta sons do app.`,
    podeGravar: true,
  }
}

/**
 * Grava a biblioteca INTEIRA em `<appData>/sons/sons.json`, pela gravação
 * segura (os áudios já estão na `midia` dela desde a importação). `depois`
 * roda na mesma fila, só quando o `sons.json` gravou: é onde a migração anota
 * as aventuras que já trouxe. Lança com a frase pronta.
 */
export function gravarBibliotecaGlobal(biblioteca: BibliotecaDeSons, depois?: () => Promise<void>): Promise<void> {
  return naFila(async () => {
    try {
      const pasta = await prepararPastaDaBiblioteca()
      await writeTextFileSafely(await join(pasta, ARQUIVO_DE_SONS), serializarBiblioteca(biblioteca))
    } catch (erro) {
      throw new Error(`Não foi possível gravar a biblioteca de sons: ${motivo(erro)}.`)
    }
    if (depois !== undefined) await depois()
  })
}

/**
 * O arquivo de áudio escolhido pelo mestre, pronto para virar a fonte de um
 * efeito: gravado em `<appData>/sons/midia` (`guardarAudioNaPasta`), fora da
 * pasta que `/media` serve sem chave. Lança com a frase pronta:
 * `AUDIO_GRANDE_DEMAIS` acima de 15 MB, `AUDIO_NAO_E_AUDIO` quando a
 * assinatura dos bytes não é de MP3, OGG, WAV nem M4A (o nome não conta).
 */
export async function guardarArquivoDeSom(bytes: Uint8Array): Promise<FonteDeArquivo> {
  const ref = await guardarAudioNaPasta(await pastaDaMidiaDaBiblioteca(), bytes)
  return { tipo: 'arquivo', ref, bytes: bytes.length }
}
