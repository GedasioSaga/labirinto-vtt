import { ensinaOQueFazer } from './erroQueEnsina'

/**
 * SALVAR FORA DO APP (achado 1 do passeio de 20/09/2026).
 *
 * Com a página aberta no navegador comum, sem o app desktop, todo gesto de
 * arquivo (Salvar, Exportar, Abrir…) chama `invoke` de `@tauri-apps/api/core`,
 * que lê `window.__TAURI_INTERNALS__.invoke` — e essa ponte não existe ali. O
 * aviso mostrava o `TypeError` cru: "Cannot read properties of undefined
 * (reading 'invoke')". Quem lê isso não sabe se perdeu o mapa nem o que fazer.
 *
 * POR QUE A PONTE E NÃO `isTauri()`: `isTauri()` lê a marca `window.isTauri`,
 * e as jornadas que simulam o disco (`e2e/helpers/tauriFsStub.ts`) instalam só
 * a ponte, sem a marca — lá o Salvar FUNCIONA. O que decide se um arquivo pode
 * ser gravado é a ponte existir, então é ela que se confere.
 */

/** Mesma redação de `IMAGE_PICKER_UNAVAILABLE_MESSAGE` (`lib/imageImport.ts`), para o gesto de arquivo. */
export const ARQUIVO_SO_NO_APP_MESSAGE =
  'salvar e abrir arquivos só funciona no aplicativo instalado do Labirinto — no navegador a página não tem acesso aos arquivos do computador'

/** A ponte do app desktop está nesta página? */
export function temPonteDoApp(janela: object = globalThis): boolean {
  return '__TAURI_INTERNALS__' in janela
}

/**
 * O pedaço do aviso que diz POR QUE o gesto de arquivo falhou.
 *
 * - Erro que ensina (`ErroQueEnsina`) fala primeiro: ele pede uma ação que a
 *   pessoa ainda pode fazer, e trocá-lo esconderia a instrução.
 * - Sem a ponte do app, a razão é sempre a mesma e é essa que se explica — a
 *   mensagem do erro ali é só o sintoma técnico da ponte ausente.
 * - Dentro do app, a mensagem real do erro continua indo para a tela: é ela
 *   que diz qual arquivo, qual permissão.
 */
export function motivoDaFalhaDeArquivo(err: unknown, temPonte: boolean): string {
  if (!ensinaOQueFazer(err) && !temPonte) return ARQUIVO_SO_NO_APP_MESSAGE
  return err instanceof Error ? err.message : String(err)
}
