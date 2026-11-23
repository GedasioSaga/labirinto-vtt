import { useMemo } from 'react'
import { alcanceDoCartao } from '../../../lib/batalha/alcanceDoCartao'
import { corDoAlcance } from '../../../lib/batalha/alcance/cor'
import { descreverAlcance, type FormaDoAlcance } from '../../../lib/batalha/alcance/forma'
import { danoDaTecnica } from '../../../lib/batalha/leituraDaTecnica'
import type { CartaoDaFicha, Personagem } from '../../../lib/personagem'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { CampoDoAlcance } from './CampoDoAlcance'

/**
 * O ALCANCE DO CARTÃO SÓ DE TEXTO (fase F, ALCANCE.md §3.2 e §8): a técnica e a arma da ficha
 * sem mecânica montada gravam a forma no campo `alcance`. A ordem de `alcanceDoCartao` manda:
 * a regra à mão da tabela vence o campo, e então o editor só diz de onde vem.
 */

interface AlcanceDoCartaoDeTextoProps {
  cartao: CartaoDaFicha
  personagem: Personagem
  sistema: SistemaDeRpg
  /** A arma vai pelo Atacar: as casas são sempre azuis. */
  naArma: boolean
  /** `false` = só mostra (a arma do livro muda no livro; quem não edita a ficha só lê). */
  podeMudar: boolean
  /** Por que só mostra, quando a arma vem do livro. */
  nota?: string
  onChange: (cartao: CartaoDaFicha) => void
}

export function AlcanceDoCartaoDeTexto({ cartao, personagem, sistema, naArma, podeMudar, nota, onChange }: AlcanceDoCartaoDeTextoProps) {
  const lido = alcanceDoCartao(cartao)
  const cor = useMemo(() => (naArma ? corDoAlcance({ tipo: 'atacar' }) : corDoAlcance({ tipo: 'cartao', dano: danoDaTecnica(cartao, { personagem, sistema, arma: null }) })), [naArma, cartao, personagem, sistema])
  if (lido?.origem === 'tabela') {
    return (
      <div className="lb-field">
        <span className="lb-label">Alcance</span>
        <p className="lb-field__hint">{`${descreverAlcance(lido.forma)} (vem da regra à mão desta técnica).`}</p>
      </div>
    )
  }
  const trocar = (forma: FormaDoAlcance | null) => {
    const { alcance: _antes, ...sem } = cartao
    onChange(forma === null ? sem : { ...sem, alcance: forma })
  }
  return (
    <div className="lb-field">
      <span className="lb-label">Alcance</span>
      <CampoDoAlcance valor={lido?.forma ?? null} torto={cartao.alcance !== undefined && lido === null} cor={cor} soLeitura={!podeMudar} onChange={trocar} />
      {nota !== undefined && <p className="lb-field__hint">{nota}</p>}
    </div>
  )
}
