import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { contasDoTexto, contasVazias, serializarContas, type ArquivoDeContas } from './contasDosJogadores'
import { ensureDir, writeTextFileSafely } from './mapFileIO'

/**
 * CONTAS DOS JOGADORES no disco (`lib/contasDosJogadores.ts`). Mesmo molde do
 * acervo de itens (`lib/acervoDeItens.ts`): do APP, em `appDataDir()/contas`,
 * gravação segura (`writeTextFileSafely`), uma por vez, com a cópia do de antes.
 *
 *   <appData>/contas/contas.json            as contas (só hashes: nunca PIN nem segredo de aparelho)
 *   <appData>/contas/contas.json.anterior   a versão de antes da última gravação
 *   <appData>/contas/contas.json.invalido   o arquivo ilegível que a leitura achou
 */

const PASTA_DAS_CONTAS = 'contas'
const ARQUIVO_DAS_CONTAS = 'contas.json'
const ARQUIVO_ANTERIOR = 'contas.json.anterior'
const ARQUIVO_INVALIDO = 'contas.json.invalido'
const AVISO = 'Não foi possível ler as contas dos jogadores'

export interface ContasLidasDoDisco {
  arquivo: ArquivoDeContas
  aviso: string | null
  /** `false` = a leitura falhou: gravar agora passaria por cima do que está lá. */
  lido: boolean
}

async function pastaDasContas(): Promise<string> {
  return join(await appDataDir(), PASTA_DAS_CONTAS)
}

function motivo(causa: unknown): string {
  const texto = causa instanceof Error ? causa.message : String(causa)
  return /os error 5|denied|negado/i.test(texto) ? 'o Windows negou o acesso ao arquivo (outro programa pode estar com ele aberto)' : texto
}

/** Lê as contas. Nunca lança: o erro vira `aviso`, e `lido: false` barra quem grava. */
export async function lerContas(): Promise<ContasLidasDoDisco> {
  let texto: string
  try {
    const caminho = await join(await pastaDasContas(), ARQUIVO_DAS_CONTAS)
    if (!(await exists(caminho))) return { arquivo: contasVazias(), aviso: null, lido: true }
    texto = await readTextFile(caminho)
  } catch (erro) {
    return { arquivo: contasVazias(), aviso: `${AVISO}: ${motivo(erro)}.`, lido: false }
  }
  const lidas = contasDoTexto(texto)
  if (lidas === 'futuro') {
    return { arquivo: contasVazias(), aviso: `${AVISO}: o arquivo é de uma versão mais nova do Labirinto. Atualize o app.`, lido: false }
  }
  if (lidas !== null) return { arquivo: lidas, aviso: null, lido: true }
  try {
    await writeTextFile(await join(await pastaDasContas(), ARQUIVO_INVALIDO), texto)
  } catch {
    // Sem a cópia, as contas NÃO recomeçam: gravar agora passaria por cima do único exemplar.
    return { arquivo: contasVazias(), aviso: `${AVISO}: o arquivo estava ilegível e não deu para guardar uma cópia dele.`, lido: false }
  }
  return {
    arquivo: contasVazias(),
    aviso: `${AVISO}: o arquivo estava ilegível. As contas começam vazias, e o arquivo antigo ficou guardado como ${ARQUIVO_INVALIDO}, na mesma pasta.`,
    lido: true,
  }
}

let filaDasContas: Promise<void> = Promise.resolve()

/** Uma gravação depois da outra: duas seguidas nunca passam uma por cima da outra. */
function naFila<T>(operacao: () => Promise<T>): Promise<T> {
  const resultado = filaDasContas.then(operacao)
  filaDasContas = resultado.then(
    () => undefined,
    () => undefined,
  )
  return resultado
}

/** Grava o arquivo INTEIRO. Lança com a frase pronta. */
export function gravarContas(arquivo: ArquivoDeContas): Promise<void> {
  return naFila(async () => {
    try {
      const pasta = await pastaDasContas()
      const caminho = await join(pasta, ARQUIVO_DAS_CONTAS)
      await ensureDir(pasta)
      // Cópia do de antes: melhor esforço — sem ela a gravação segue.
      try {
        if (await exists(caminho)) await writeTextFile(await join(pasta, ARQUIVO_ANTERIOR), await readTextFile(caminho))
      } catch {
        // A cópia é a segunda linha de defesa; a primeira é a gravação segura logo abaixo.
      }
      await writeTextFileSafely(caminho, serializarContas(arquivo))
    } catch (erro) {
      throw new Error(`Não foi possível gravar as contas dos jogadores: ${motivo(erro)}.`)
    }
  })
}
