import { useMemo } from 'react'
import { catalogoDeCondicoes } from '../../lib/condicoes/catalogo'
import { condicoesDe } from '../../lib/condicoes/naFicha'
import type { Personagem } from '../../lib/personagem'
import { TOKEN_CONDITION_LABELS, TOKEN_CONDITION_SYMBOLS } from '../../lib/tokenConditions'
import { simboloDaCondicaoPropria } from '../../lib/condicoesProprias'
import { porCondicaoNasFichas, tirarCondicaoDasFichas } from '../../stores/condicoesDoMestre'
import { useCondicoesPropriasStore } from '../../stores/condicoesPropriasStore'
import type { CondicaoPropria, TokenCondition } from '../../types/map'
import { PastilhaDeCondicao } from '../PastilhaDeCondicao'
import { abrirEditorDaCondicao } from './editor/EditorDaCondicao'
import { ChipsDaFicha, FormDePorCondicao } from './PorCondicao'
import './condicoes.css'

export interface CondicoesDaFichaProps {
  /** A ficha ligada ao token (no NPC, a cópia daquele token). */
  personagem: Personagem
  /** O que ainda está gravado no próprio token, de antes (a passagem até a E7): aparece para dar para tirar. */
  antigas?: readonly TokenCondition[]
  antigasProprias?: readonly CondicaoPropria[]
  onTirarAntiga?: (condicao: TokenCondition) => void
  onTirarAntigaPropria?: (condicao: CondicaoPropria) => void
}

/**
 * AS CONDIÇÕES DO TOKEN COM FICHA (itens refeitos, PLANO §1.5; etapa E4b): moram na FICHA, não no
 * token. O painel mostra as postas (com o prazo e o ✕) e o "Pôr condição" com o catálogo inteiro (as 35
 * de fábrica e as criadas) e a duração; "Criar condição…" abre o editor único (rework, D13). Grava pela ficha (`stores/condicoesDoMestre.ts`), com Desfazer no aviso. O que ainda
 * estava no token, de antes, aparece embaixo só para tirar: nada some sem o mestre ver.
 */
export function CondicoesDaFicha({ personagem, antigas = [], antigasProprias = [], onTirarAntiga, onTirarAntigaPropria }: CondicoesDaFichaProps) {
  const criadas = useCondicoesPropriasStore((state) => state.catalogo)
  const catalogo = useMemo(() => catalogoDeCondicoes(criadas), [criadas])
  const nome = personagem.nome.trim() || 'esta ficha'
  const temAntigas = antigas.length > 0 || antigasProprias.length > 0
  return (
    <div className="cd-da-ficha">
      <ChipsDaFicha
        condicoes={condicoesDe(personagem)}
        criadas={criadas}
        onTirar={(condicao, nomeDaCondicao) => tirarCondicaoDasFichas([personagem.id], condicao.id, nomeDaCondicao)}
      />
      <FormDePorCondicao alvos={[{ id: personagem.id, nome }]} catalogo={catalogo} onPor={porCondicaoNasFichas} onCriar={() => abrirEditorDaCondicao({ abertura: { tipo: 'nova' } })} />
      <p className="cd-nota">Mora na ficha de {nome}: aparece igual no mapa, na batalha e na tela do jogador.</p>
      {temAntigas && (
        <div className="cd-da-ficha__antigas">
          <p className="cd-nota">No token, de antes (a batalha ou uma armadilha marcou aqui):</p>
          <ul className="cd-chips">
            {antigas.map((condicao) => (
              <li key={condicao}>
                <span className="cd-chip">
                  <PastilhaDeCondicao symbol={TOKEN_CONDITION_SYMBOLS[condicao]} tamanho={16} />
                  <span className="cd-chip__nome">{TOKEN_CONDITION_LABELS[condicao]}</span>
                  {onTirarAntiga !== undefined && <BotaoDeTirar nome={TOKEN_CONDITION_LABELS[condicao]} onTirar={() => onTirarAntiga(condicao)} />}
                </span>
              </li>
            ))}
            {antigasProprias.map((condicao) => (
              <li key={condicao.id}>
                <span className="cd-chip">
                  <PastilhaDeCondicao symbol={simboloDaCondicaoPropria(condicao)} tamanho={16} />
                  <span className="cd-chip__nome">{condicao.nome}</span>
                  {onTirarAntigaPropria !== undefined && <BotaoDeTirar nome={condicao.nome} onTirar={() => onTirarAntigaPropria(condicao)} />}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function BotaoDeTirar({ nome, onTirar }: { nome: string; onTirar: () => void }) {
  return (
    <button type="button" className="cd-chip__x" aria-label={`Tirar ${nome} do token`} onClick={onTirar}>
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
      </svg>
    </button>
  )
}
