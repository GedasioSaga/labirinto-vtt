/**
 * A CHAVE do editor novo (ED3): até a ED5 trocar a fachada `MecanicaDaTecnica`,
 * o editor novo só abre com `localStorage['lb-editor:novo'] = '1'` neste
 * navegador (ou nesta janela do app). Sem a chave, nada muda para o dono.
 */
export const CHAVE_DO_EDITOR_NOVO = 'lb-editor:novo'

export function editorNovoLigado(): boolean {
  try {
    return localStorage.getItem(CHAVE_DO_EDITOR_NOVO) === '1'
  } catch {
    // Armazenamento bloqueado (modo privado, política do sistema): o editor de hoje segue.
    return false
  }
}
