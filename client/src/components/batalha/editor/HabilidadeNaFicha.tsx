import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { lerMecanica } from '../../../lib/batalha/mecanica/modelo'
import type { FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import { frasesDosRequisitos } from '../../../lib/batalha/requisitos/frases'
import { lerRequisitos } from '../../../lib/batalha/requisitos/ler'
import type { CartaoDaFicha } from '../../../lib/personagem'
import { ResumoDaMecanica } from '../MecanicaDaTecnica'
import type { QuemEditaNoEditor } from './gravarNoCartao'
import '../MecanicaDaTecnica.css'

const EditorDaHabilidade = lazy(() => import('./EditorDaHabilidade').then((modulo) => ({ default: modulo.EditorDaHabilidade })))

interface HabilidadeNaFichaProps {
  cartao: CartaoDaFicha
  ficha: FichaDaPrevia
  quemEdita: QuemEditaNoEditor
  tecnicas: readonly CartaoDaFicha[]
  podeOcultar: boolean
  onChange: (cartao: CartaoDaFicha) => void
}

/**
 * A TÉCNICA NO CARTÃO DA FICHA (ED5): o resumo do que ela faz e pede, e o botão que abre o editor da
 * habilidade (EDITOR.md §5). O editor carrega só ao abrir. A arma e o item seguem com a fachada
 * `MecanicaDaTecnica` até a ED7.
 */
export function HabilidadeNaFicha({ cartao, ficha, quemEdita, tecnicas, podeOcultar, onChange }: HabilidadeNaFichaProps) {
  const [aberto, setAberto] = useState(false)
  const fechar = useCallback(() => setAberto(false), [])
  const valendo = lerMecanica(cartao.mecanica)
  const proposta = cartao.mecanicaProposta === undefined ? null : lerMecanica(cartao.mecanicaProposta)
  const requisitos = useMemo(() => {
    const lidos = lerRequisitos(cartao.requisitos)
    return lidos.bloco === null ? [] : frasesDosRequisitos(lidos.bloco)
  }, [cartao.requisitos])
  const futura = valendo.tipo === 'futura' || (quemEdita === 'dono' && proposta?.tipo === 'futura')
  const montada = valendo.tipo === 'pecas'
  return (
    <section className="lb-mec" aria-label="Mecânica e requisitos">
      <div className="lb-mec__cab">
        <h5 className="lb-label lb-mec__titulo">Mecânica</h5>
        {!montada && <span className="lb-mec__cab-dica">Só texto: o app lê o Custo, a Ação e o Dano escritos.</span>}
      </div>
      {valendo.tipo === 'pecas' && <ResumoDaMecanica mecanica={valendo.mecanica} ficha={ficha} titulo={proposta !== null ? 'Vale agora' : undefined} />}
      {(valendo.tipo === 'invalida' || valendo.tipo === 'futura') && (
        <p className="lb-mec__aviso" role="note">
          {valendo.tipo === 'futura' ? 'Mecânica de um app mais novo: atualize o app para editar.' : `Mecânica que não se lê: ${valendo.motivo}. O editor troca por um modelo.`}
        </p>
      )}
      {proposta !== null && (
        <p className="lb-mec__aviso" role="status">
          {quemEdita === 'mestre' ? 'O dono da ficha propôs uma mecânica: abra o editor para aceitar ou recusar.' : 'Sua proposta espera o mestre. Até ele aceitar, vale o que está acima.'}
        </p>
      )}
      {requisitos.map((secao) => (
        <p key={secao.titulo} className="lb-field__hint">
          <b>{secao.titulo}:</b> {secao.linhas.join('; ')}.
        </p>
      ))}
      <div className="lb-mec__acoes">
        <button type="button" className="lb-btn lb-btn--compact" disabled={futura} title={futura ? 'Feita num app mais novo: atualize o app para editar' : undefined} onClick={() => setAberto(true)}>
          {quemEdita === 'dono' ? 'Abrir o editor (vai ao mestre)' : 'Abrir o editor'}
        </button>
      </div>
      {aberto && (
        <Suspense fallback={null}>
          <EditorDaHabilidade cartao={cartao} ficha={ficha} quemEdita={quemEdita} tecnicas={tecnicas} podeOcultar={podeOcultar} onChange={onChange} onFechar={fechar} />
        </Suspense>
      )}
    </section>
  )
}
