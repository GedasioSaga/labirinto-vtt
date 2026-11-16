import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { sessaoDaJanelaDoPreludio } from '../../lib/janelaDoPreludio'
import { themeCss } from '../../theme'
import { JanelaDoPreludio } from './JanelaDoPreludio'
import '../../main.css'

/**
 * A página da JANELA DO PRELÚDIO (`client/preludio.html`), aberta pelo Rust
 * (`desktop/src-tauri/src/janela_preludio.rs`) ou, no navegador, pelo popup da
 * principal. Sem sessão válida não há com quem falar: a página só diz isso.
 */

const themeStyle = document.createElement('style')
themeStyle.id = 'lb-theme'
themeStyle.textContent = themeCss()
document.head.prepend(themeStyle)

// Arquivo solto fora do quadro (que aceita imagem) não pode abrir na janela no lugar do Prelúdio (o mesmo de `main.tsx`).
for (const tipo of ['dragover', 'drop'] as const) {
  window.addEventListener(tipo, (event) => {
    if (event.defaultPrevented || !event.dataTransfer?.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'none'
  })
}

const sessao = sessaoDaJanelaDoPreludio()
const raiz = createRoot(document.getElementById('root') as HTMLElement)

raiz.render(
  <StrictMode>
    {sessao === null ? (
      <p className="pr-quieto" role="alert" style={{ padding: 'var(--lb-space-6)' }}>
        Esta janela do Prelúdio abriu sem a mesa. Feche e abra pelo botão "Abrir o Prelúdio" do Livro do mestre.
      </p>
    ) : (
      <JanelaDoPreludio sessao={sessao} />
    )}
  </StrictMode>,
)
