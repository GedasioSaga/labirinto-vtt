import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { instalarDicasDoPainel } from './lib/dicaDoPainel'
import { instalarEndireitarComAlt } from './lib/endireitarComAlt'
import { themeCss } from './theme'
import './main.css'

// Os tokens de `theme.ts` viram custom properties aqui, antes do primeiro
// render, para `main.css` ter os `var(--lb-*)` já resolvidos no primeiro paint.
const themeStyle = document.createElement('style')
themeStyle.id = 'lb-theme'
themeStyle.textContent = themeCss()
document.head.prepend(themeStyle)

// A frase de cada controle do painel vira balão sob demanda: ligado antes do
// primeiro render, para a coluna já nascer sem as frases no fluxo.
instalarDicasDoPainel(document)

// Alt tocado endireita a linha selecionada (pedido 5). Também antes do primeiro
// render: dos ouvintes de captura da janela, o primeiro a ser ligado é o
// primeiro a ouvir, e nenhum outro esconde do detector a tecla ou o clique que
// fazem do Alt um modificador (Alt+arrastar, Alt+setas).
instalarEndireitarComAlt(window)

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
