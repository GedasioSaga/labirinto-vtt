import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { themeCss } from '../theme'
import { JanelaDaBatalha } from './JanelaDaBatalha'
import { PAGINA_DA_JANELA, SESSAO_VALIDA } from './protocolo'
import '../main.css'

/**
 * A página da JANELA DA BATALHA (`client/batalha.html`), aberta pelo Rust
 * (`desktop/src-tauri/src/janela_batalha.rs`, que põe a sessão em
 * `window.__LB_BATALHA__`) ou, no navegador, pelo popup da principal (a sessão
 * no endereço). Sem sessão válida não há com quem falar: a página só diz isso.
 */

const themeStyle = document.createElement('style')
themeStyle.id = 'lb-theme'
themeStyle.textContent = themeCss()
document.head.prepend(themeStyle)

function sessaoDaJanela(): string | null {
  const doRust: unknown = Reflect.get(window, '__LB_BATALHA__')
  const daPagina = window.location.pathname.endsWith(PAGINA_DA_JANELA) ? new URLSearchParams(window.location.search).get('sessao') : null
  const valor = typeof doRust === 'string' ? doRust : daPagina
  return valor !== null && SESSAO_VALIDA.test(valor) ? valor : null
}

const sessao = sessaoDaJanela()
const raiz = createRoot(document.getElementById('root') as HTMLElement)

raiz.render(
  <StrictMode>
    {sessao === null ? (
      <p role="alert" style={{ padding: 'var(--lb-space-6)' }}>
        Esta janela da batalha abriu sem a mesa. Feche e abra pelo botão "Em janela" da página Batalha do livro do mestre.
      </p>
    ) : (
      <JanelaDaBatalha sessao={sessao} />
    )}
  </StrictMode>,
)
