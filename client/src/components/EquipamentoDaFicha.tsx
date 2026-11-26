import { useMemo } from 'react'
import { ESCOLHA_DAS_ARMAS, LIMITE_DE_ARMAS_MAX, limiteDeArmas } from '../lib/batalha/leituraDaFicha'
import { quantidadeDe } from '../lib/items'
import { acervoDaMochila } from '../lib/mochila/acervoDaMochila'
import { armasEquipadas, penteDaArma, tipoDaVaga } from '../lib/mochila/armaNaMochila'
import type { TipoDoItem } from '../lib/itens/modelo'
import type { Personagem } from '../lib/personagem'
import { useAcervoDeItensStore } from '../stores/acervoDeItensStore'
import type { CarriedItem } from '../types/map'
import './EquipamentoDaFicha.css'

/** Os tipos que contam como arma no "Armas por batalha" (a roupa não conta, decisão 5). */
const TIPOS_DE_ARMA: ReadonlySet<TipoDoItem> = new Set(['corpo', 'fogo', 'hibrida', 'arremesso'])

/** O texto da escolha "Armas por batalha", igual às opções do sistema ("1 arma", "2 armas"). */
export function textoDoLimite(limite: number): string {
  return limite === 1 ? '1 arma' : `${limite} armas`
}

/** A ficha com o "Armas por batalha" novo; `null` = sem limite (a escolha sai). */
export function comLimiteDeArmas(personagem: Personagem, limite: number | null): Personagem {
  const { [ESCOLHA_DAS_ARMAS]: _antes, ...outras } = personagem.escolhas
  return { ...personagem, escolhas: limite === null ? outras : { ...outras, [ESCOLHA_DAS_ARMAS]: textoDoLimite(limite) } }
}

export interface EquipamentoDaFichaProps {
  personagem: Personagem
  /** A mochila do dono, a mesma que a grade embaixo mostra. */
  itens: readonly CarriedItem[]
  /** Muda o "Armas por batalha" (o mestre, na hora; na edição, o rascunho). Ausente = só lê. */
  onLimite?: (limite: number | null) => void
}

/**
 * O ALTO DA ABA "MOCHILA E EQUIPAMENTO" (itens refeitos, E4b; tela G do protótipo aprovado): o
 * "Armas por batalha" com − e + (só a arma equipada ataca), e o que está em uso: as armas
 * equipadas, as vagas de arma livres e a roupa vestida. A grade da mochila vem embaixo (`FichaAbas`),
 * com o Equipar, o Guardar e o Recarregar de cada vaga (`MochilaDoMestre`).
 */
export function EquipamentoDaFicha({ personagem, itens, onLimite }: EquipamentoDaFichaProps) {
  const doAcervo = useAcervoDeItensStore((state) => state.itens)
  const acervo = useMemo(() => acervoDaMochila(doAcervo), [doAcervo])
  const limite = limiteDeArmas(personagem)
  const equipadas = armasEquipadas(itens, acervo)
  const emUso = itens.filter((vaga) => vaga.equipado === true)
  const armas = emUso.filter((vaga) => {
    const tipo = tipoDaVaga(vaga, acervo)
    return tipo !== undefined && TIPOS_DE_ARMA.has(tipo)
  })
  const roupa = emUso.filter((vaga) => !armas.includes(vaga))
  const livres = limite === null ? 0 : Math.max(0, limite - armas.length)
  const menos = limite === null || limite <= 1 ? null : limite - 1
  const mais = limite === null ? Math.max(1, equipadas) : limite >= LIMITE_DE_ARMAS_MAX ? null : limite + 1

  return (
    <div className="eq-ficha">
      <div className="eq-ficha__limite">
        <span className="eq-ficha__rot" id={`eq-lim-${personagem.id}`}>
          Armas por batalha
        </span>
        {onLimite !== undefined ? (
          <div className="eq-ficha__passo" role="group" aria-labelledby={`eq-lim-${personagem.id}`}>
            <button type="button" aria-label="Uma arma a menos" disabled={menos === null} onClick={() => menos !== null && onLimite(menos)}>
              −
            </button>
            <output className="eq-ficha__valor" aria-live="polite">
              {limite === null ? 'Sem limite' : limite}
            </output>
            <button type="button" aria-label="Uma arma a mais" disabled={mais === null} onClick={() => mais !== null && onLimite(mais)}>
              +
            </button>
          </div>
        ) : (
          <span className="eq-ficha__valor">{limite === null ? 'Sem limite' : limite}</span>
        )}
        <p className="eq-ficha__nota">
          Só a arma equipada ataca. {limite === null ? `${equipadas} equipada${equipadas === 1 ? '' : 's'}` : `${equipadas} de ${limite} equipada${limite === 1 ? '' : 's'}`}. Trocar de arma é
          guardar uma e equipar outra.
        </p>
      </div>
      <h4 className="eq-ficha__subtit">Equipado</h4>
      <ul className="eq-ficha__vagas" aria-label="Armas e roupa em uso">
        {armas.map((vaga) => (
          <li key={vaga.id} className="eq-vaga">
            <span className="eq-vaga__parte">Arma</span>
            <strong className="eq-vaga__nome">{vaga.nome}</strong>
            <span className="eq-vaga__det">{detalheDaArma(vaga, acervo)}</span>
          </li>
        ))}
        {Array.from({ length: livres }, (_, i) => (
          <li key={`livre-${i}`} className="eq-vaga eq-vaga--livre">
            <span className="eq-vaga__parte">Arma</span>
            <span className="eq-vaga__nome">Vaga de arma livre</span>
          </li>
        ))}
        {roupa.map((vaga) => (
          <li key={vaga.id} className="eq-vaga">
            <span className="eq-vaga__parte">Equipamento</span>
            <strong className="eq-vaga__nome">{vaga.nome}</strong>
          </li>
        ))}
        {roupa.length === 0 && (
          <li className="eq-vaga eq-vaga--livre">
            <span className="eq-vaga__parte">Corpo</span>
            <span className="eq-vaga__nome">Nada vestido</span>
          </li>
        )}
      </ul>
    </div>
  )
}

/** "Pente 4 de 6", "x2" (a pilha de granadas) ou nada. */
function detalheDaArma(vaga: CarriedItem, acervo: ReturnType<typeof acervoDaMochila>): string {
  const pente = penteDaArma(vaga, acervo)
  if (pente !== null) return `Pente ${vaga.pente?.n ?? 0} de ${pente.capacidade}`
  const quantos = quantidadeDe(vaga)
  return quantos > 1 ? `x${quantos}` : ''
}
