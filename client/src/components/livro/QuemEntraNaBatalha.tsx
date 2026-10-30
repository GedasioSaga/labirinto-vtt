import type { CandidatoDaBatalha, EscolhaDaBatalha } from '../../lib/livros/combate'
import type { Personagem } from '../../lib/personagem'

/**
 * "QUEM ENTRA NA BATALHA?" (M1, docs/planos/livros-de-regras-plano.md): a
 * caixa do Iniciar batalha, depois da abertura, quando a cena tem token sem
 * ficha de combate (`precisaPerguntar(quemPodeEntrar(...))`). Com ficha de
 * combate: marcados. Sem ficha, ou "Só no cenário": desmarcados, cada um com
 * "Ficha mínima (HP 300, golpe 80)" (marcada) ou "Como <modelo>".
 *
 * CONTRATO DA FASE 0: só as props, para o ControleDaBatalha montar. O corpo
 * é do escritor das montagens (fase 1); até lá a caixa confirma na hora com
 * quem já tem ficha de combate, que é o Iniciar de antes.
 */
export interface QuemEntraNaBatalhaProps {
  /** Os tokens da cena, na ordem do mapa (`quemPodeEntrar`). */
  candidatos: readonly CandidatoDaBatalha[]
  /** Os NPCs que podem servir de modelo ("Como Recruta da Marinha"): os de combate que não são variação. */
  modelos: readonly Personagem[]
  /** Só os MARCADOS. Quem chama cria as fichas, liga os tokens e chama `combatentesIniciais` com `incluir`. */
  onConfirmar: (escolhas: EscolhaDaBatalha[]) => void
  /** Esc ou "Cancelar": a batalha não começa. */
  onCancelar: () => void
}

export function QuemEntraNaBatalha({ candidatos, onConfirmar, onCancelar }: QuemEntraNaBatalhaProps) {
  const comFicha = candidatos.filter((candidato) => candidato.situacao === 'combate').map((candidato): EscolhaDaBatalha => ({ tokenId: candidato.tokenId, como: { tipo: 'propria' } }))
  return (
    <div role="dialog" aria-label="Quem entra na batalha?">
      <button type="button" className="lb-btn" onClick={() => onConfirmar(comFicha)}>
        Iniciar
      </button>
      <button type="button" className="lb-btn lb-btn--ghost" onClick={onCancelar}>
        Cancelar
      </button>
    </div>
  )
}
