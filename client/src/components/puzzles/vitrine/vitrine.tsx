import { createRoot } from 'react-dom/client'
import { ImagemDaMesa } from '../../ImagemDaMesa'
import { resolverComBase, URL_DA_MIDIA_NA_SALA, type ResolverDeImagem } from '../../../lib/midia'
import { giratoriasPadrao } from '../../../puzzles/giratorias/giratorias'
import { interruptoresPadrao } from '../../../puzzles/interruptores/interruptores'
import { cooperacaoPadrao } from '../../../puzzles/cooperacao/cooperacao'
import { puzzleDoModelo } from '../../../puzzles/padroes'
import { puzzleDoRelevo, visualDoRelevo } from '../../../puzzles/relevo/relevo'
import { CENAS_DO_RELEVO, METAIS_DO_RELEVO } from '../../../puzzles/tipos'
import { themeCss } from '../../../theme'
import { EditorDoPuzzleNaTela } from '../EditorDoPuzzle'
import { useEditorDoPuzzleStore } from '../editorDoPuzzleStore'

/**
 * VITRINE DO EDITOR DO PUZZLE — só para desenvolvimento e provas, fora do build
 * (não está nas entradas do vite.config.ts). Abre o editor num rascunho de
 * Painel em relevo, sem mapa nem disco: fora do app, as placas não gravam no
 * acervo (a lista mostra "indo para o acervo…").
 *
 *   npm run dev  ->  http://localhost:1420/src/components/puzzles/vitrine/vitrine.html
 *   ?cena=dragao (padrão) | cavaleiro | navio | leao | serpente | solELua   &metal=bronze | ferro | prata
 *   ?modelo=giratorias  o medalhão das peças giratórias (&desenho=simbolos)
 *   ?modelo=interruptores  o painel de lampiões (&ligacao=propria mostra a grade de quem vira quem)
 *   ?modelo=cooperacao  os dois pontos da cooperação (a Cripta e a Ponte)
 */

const parametros = new URLSearchParams(location.search)

const estilo = document.createElement('style')
estilo.textContent = `${themeCss()}\nbody { font-family: var(--lb-font-sans); color: var(--lb-color-parchment); }`
document.head.append(estilo)

const daSala = resolverComBase(URL_DA_MIDIA_NA_SALA)
const resolverDaVitrine: ResolverDeImagem = (valor) => (typeof valor === 'string' && valor.startsWith('data:image/') ? valor : daSala(valor))

const cena = CENAS_DO_RELEVO.find((candidata) => candidata === parametros.get('cena')) ?? 'dragao'
const metal = METAIS_DO_RELEVO.find((candidato) => candidato === parametros.get('metal')) ?? 'bronze'
// ?modelo=fonte abre a Fonte, para comparar a abertura do editor sem o painel.
const puzzle = parametros.get('modelo') === 'fonte' ? puzzleDoModelo('fonte') : parametros.get('modelo') === 'giratorias' ? medalhao() : parametros.get('modelo') === 'interruptores' ? lampioes() : parametros.get('modelo') === 'cooperacao' ? doisLugares() : puzzleDoRelevo(visualDoRelevo(cena, metal), 4)

function medalhao() {
  const base = puzzleDoModelo('fonte')
  return { ...base, nomePublico: 'Medalhão do Dragão', encaixes: [], futuro: { ...giratoriasPadrao(424242), ...(parametros.get('desenho') === 'simbolos' ? { desenho: 'simbolos' as const } : {}) } }
}
function lampioes() {
  const base = puzzleDoModelo('fonte')
  const ligacao = parametros.get('ligacao') === 'propria' ? ('propria' as const) : ('vizinhos' as const)
  return { ...base, nomePublico: 'Lampiões da Cripta', encaixes: [], futuro: { ...interruptoresPadrao(777), ligacao, objetivo: 'desenho' as const, desenho: [true, false, true, false, true, false], ligados: [[1], [], [], [], [], []] } }
}
function doisLugares() {
  const base = puzzleDoModelo('fonte')
  return { ...base, nomePublico: 'Portão das Duas Salas', encaixes: [], futuro: { ...cooperacaoPadrao(), pontos: [{ arte: 'alavanca' as const, rotulo: 'Cripta' }, { arte: 'placa' as const, rotulo: 'Ponte' }] } }
}
useEditorDoPuzzleStore.getState().abrir({ tipo: 'rascunho', puzzle })

const raiz = document.getElementById('raiz')
if (raiz !== null) {
  // Sem exports, o Fast Refresh recarrega a página inteira em vez de montar uma segunda raiz.
  if (Reflect.get(window, '__vitrineDoEditorMontada') === true) location.reload()
  else {
    Reflect.set(window, '__vitrineDoEditorMontada', true)
    createRoot(raiz).render(
      <ImagemDaMesa.Provider value={resolverDaVitrine}>
        <EditorDoPuzzleNaTela />
      </ImagemDaMesa.Provider>,
    )
  }
}
