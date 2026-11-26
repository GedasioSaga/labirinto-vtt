import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { themeCss } from '../theme'
import { JanelaDosSons } from './JanelaDosSons'
import { SESSAO_VALIDA } from './protocolo'
import '../main.css'
import '../components/grimorio/grimorio.css'
import '../components/livro/livro.css'

/**
 * A página da JANELA DOS SONS (`client/sons.html`), aberta pelo Rust
 * (`desktop/src-tauri/src/janela_sons.rs`, que põe a sessão em
 * `window.__LB_SONS__`). Só existe no app: o navegador não tem o botão. Sem
 * sessão válida não há com quem falar: a página só diz isso.
 */

const themeStyle = document.createElement('style')
themeStyle.id = 'lb-theme'
themeStyle.textContent = themeCss()
document.head.prepend(themeStyle)

function sessaoDaJanela(): string | null {
  const doRust: unknown = Reflect.get(window, '__LB_SONS__')
  return typeof doRust === 'string' && SESSAO_VALIDA.test(doRust) ? doRust : null
}

const sessao = sessaoDaJanela()
const elemento = document.getElementById('root')

if (elemento !== null) {
  createRoot(elemento).render(
    <StrictMode>
      {sessao === null ? (
        <p role="alert" style={{ padding: 'var(--lb-space-6)' }}>
          Esta janela dos sons abriu sem o app. Feche e abra pelo botão "Abrir em janela" da página Sons do livro.
        </p>
      ) : (
        <JanelaDosSons sessao={sessao} />
      )}
    </StrictMode>,
  )
}
