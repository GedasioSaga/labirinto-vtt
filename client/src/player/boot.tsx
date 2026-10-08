import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { tableCodeFromSearch, tableKeyFromSearch } from '../lib/tableScreen'
import { PlayerApp } from './main'
import { TableApp } from './TableScreen'

// Ponto de entrada de `player.html`. Mora fora de `main.tsx` para que importar
// a tela do jogador não desenhe a página inteira: a janela da Visão de jogador
// (`visaoDeTeste/entrada.tsx`) monta o mesmo `Session` sem o formulário de entrada.

const root = document.getElementById('root')
if (!root) throw new Error('player.html sem #root')
// `?mesa` no endereço = TELA DA MESA (TV, projetor): espectador sem ficha, ver `TableScreen.tsx`.
const tableCode = tableCodeFromSearch(location.search)
createRoot(root).render(<StrictMode>{tableCode === null ? <PlayerApp /> : <TableApp initialCode={tableCode} tableKey={tableKeyFromSearch(location.search)} />}</StrictMode>)
