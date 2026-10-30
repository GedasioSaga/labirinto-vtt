import { exists, readDir, readTextFile, stat, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { ensureDir, writeTextFileSafely } from '../mapFileIO'
import { bibliotecaDeRegrasDoTexto, bibliotecaDeRegrasVazia, serializarBibliotecaDeRegras, type BibliotecaDeRegras } from './regrasDoCampo'

/**
 * A BIBLIOTECA DE REGRAS DO CAMPO NO DISCO, GLOBAL DO APP (decisão 7 da
 * batalha One Piece): uma só para todas as aventuras, em
 * `<appData>/batalha/regras-do-campo.json`. Molde de `lib/sons/bibliotecaNoDisco.ts`:
 * arquivo ilegível vira uma cópia `regras-do-campo.invalido-AAAAMMDD-HHMMSS.json`
 * e a biblioteca recomeça vazia; sem conseguir a cópia (ou com o arquivo de
 * um app mais novo), nada é gravado por cima. O escopo do fs já cobre
 * `$APPDATA/**` (`desktop/src-tauri/capabilities/default.json`): nada de Rust.
 */

export const PASTA_DA_BATALHA = 'batalha'
export const ARQUIVO_DAS_REGRAS = 'regras-do-campo.json'
/** 100 regras de 4000 caracteres cabem com folga; acima disto o arquivo não entra na memória. */
export const REGRAS_JSON_MAX_BYTES = 1024 * 1024

const NAO_LEU = 'Não foi possível ler a biblioteca de regras do campo'

export interface BibliotecaDeRegrasLida {
  biblioteca: BibliotecaDeRegras
  /** Frase pronta para a tela quando a leitura deu errado; `null` = tudo certo (ou não havia arquivo). */
  aviso: string | null
  /** `false` = há um arquivo que não foi lido; gravar agora passaria por cima dele. */
  podeGravar: boolean
}

async function pastaDasRegras(): Promise<string> {
  return join(await appDataDir(), PASTA_DA_BATALHA)
}

function doisDigitos(numero: number): string {
  return String(numero).padStart(2, '0')
}

/** Nome novo a cada vez (hora local): a cópia de uma abertura nunca apaga a de outra. */
export function nomeDaCopiaDasRegrasIlegiveis(quando: Date): string {
  const dia = `${quando.getFullYear()}${doisDigitos(quando.getMonth() + 1)}${doisDigitos(quando.getDate())}`
  const hora = `${doisDigitos(quando.getHours())}${doisDigitos(quando.getMinutes())}${doisDigitos(quando.getSeconds())}`
  return `regras-do-campo.invalido-${dia}-${hora}.json`
}

/** O erro do disco em frase, sem o caminho absoluto (que traz o nome de usuário do Windows). */
function motivo(causa: unknown): string {
  const texto = causa instanceof Error ? causa.message : String(causa)
  if (/os error 5\b|denied|negado/i.test(texto)) return 'o Windows negou o acesso ao arquivo (outro programa pode estar com ele aberto)'
  if (/forbidden path|not allowed/i.test(texto)) return 'o app não tem permissão de usar essa pasta'
  const codigo = /os error (\d+)/i.exec(texto)
  return codigo === null ? 'o disco recusou a operação' : `o disco recusou a operação (os error ${codigo[1]})`
}

/** A cópia do ilegível: nunca por cima de arquivo que existe (`createNew`) nem por um atalho. `null` = sem cópia. */
async function guardarCopiaDoIlegivel(pasta: string, texto: string): Promise<string | null> {
  const nome = nomeDaCopiaDasRegrasIlegiveis(new Date())
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

/** Uma operação no arquivo depois da outra: a gravação mais nova nunca é passada para trás por uma mais velha. */
function naFila<T>(operacao: () => Promise<T>): Promise<T> {
  const resultado = filaDoDisco.then(operacao)
  filaDoDisco = resultado.then(
    () => undefined,
    () => undefined,
  )
  return resultado
}

/** Lê a biblioteca. Nunca lança: o erro vira `aviso`, e `podeGravar: false` barra quem grava. */
export function lerBibliotecaDeRegras(): Promise<BibliotecaDeRegrasLida> {
  return naFila(async () => {
    let pasta: string
    let texto: string
    try {
      pasta = await pastaDasRegras()
      const caminho = await join(pasta, ARQUIVO_DAS_REGRAS)
      if (!(await exists(caminho))) return { biblioteca: bibliotecaDeRegrasVazia(), aviso: null, podeGravar: true }
      if ((await stat(caminho)).size > REGRAS_JSON_MAX_BYTES) {
        return { biblioteca: bibliotecaDeRegrasVazia(), aviso: `${NAO_LEU}: o arquivo é grande demais. Até ele ser trocado, nada novo é guardado.`, podeGravar: false }
      }
      texto = await readTextFile(caminho)
    } catch (erro) {
      return { biblioteca: bibliotecaDeRegrasVazia(), aviso: `${NAO_LEU}: ${motivo(erro)}.`, podeGravar: false }
    }
    const lido = bibliotecaDeRegrasDoTexto(texto)
    if (lido.ok) return { biblioteca: lido.biblioteca, aviso: null, podeGravar: true }
    if (lido.motivo === 'versao-mais-nova') {
      return { biblioteca: bibliotecaDeRegrasVazia(), aviso: 'As regras do campo foram gravadas por uma versão mais nova do app: atualize para usá-las.', podeGravar: false }
    }
    const copia = await guardarCopiaDoIlegivel(pasta, texto)
    if (copia === null) {
      // Sem a cópia, não recomeça: gravar agora passaria por cima do único exemplar.
      return { biblioteca: bibliotecaDeRegrasVazia(), aviso: `${NAO_LEU}: o arquivo estava ilegível e não deu para guardar uma cópia dele.`, podeGravar: false }
    }
    return { biblioteca: bibliotecaDeRegrasVazia(), aviso: `${NAO_LEU}: o arquivo estava ilegível. A biblioteca começa vazia, e o antigo ficou guardado como ${copia}.`, podeGravar: true }
  })
}

/** Grava a biblioteca inteira pela gravação segura. Lança com a frase pronta. */
export function gravarBibliotecaDeRegras(biblioteca: BibliotecaDeRegras): Promise<void> {
  return naFila(async () => {
    try {
      const pasta = await pastaDasRegras()
      await ensureDir(pasta)
      await writeTextFileSafely(await join(pasta, ARQUIVO_DAS_REGRAS), serializarBibliotecaDeRegras(biblioteca))
    } catch (erro) {
      throw new Error(`Não foi possível gravar as regras do campo: ${motivo(erro)}.`)
    }
  })
}
