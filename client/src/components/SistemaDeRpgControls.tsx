import { useEffect } from 'react'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { useAdventureStore } from '../stores/adventureStore'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import { iniciais } from './FichaPecas'
import './FichaDePersonagem.css'

export interface SistemaDeRpgControlsProps {
  /** O sistema escolhido; `undefined` quando não há (ou ele não está neste computador). */
  sistema: SistemaDeRpg | undefined
  /** O id gravado, para dizer qual sistema falta. */
  sistemaId: string | undefined
  /** Abre a grade de sistemas (escolher, ou importar com o "+"). */
  onAbrirSistemas: () => void
}

/**
 * "Sistema de RPG" da janela Configurações do mapa: a capa e o nome do sistema
 * em uso e o botão da grade. Mora aqui (e não no painel) porque vale para a
 * mesa inteira e se mexe pouco — como a grade e a medição. Aparece também no
 * mapa solto: escolher ali pergunta antes se o mapa vira aventura (`RpgDialogs`).
 */
export function SistemaDeRpgControls({ sistema, sistemaId, onAbrirSistemas }: SistemaDeRpgControlsProps) {
  const nome = sistema?.nome ?? (sistemaId === undefined ? 'Nenhum sistema escolhido' : `${sistemaId} (não está neste computador)`)
  return (
    <section className="lb-section lb-rpg-config">
      <h2 className="lb-eyebrow">Sistema de RPG</h2>
      <div className="lb-rpg-config__linha">
        {/* Sem sistema, a capa vazia guarda o lugar: a linha não pula quando ele chega. */}
        <span className="lb-rpg-config__capa" style={sistema === undefined ? undefined : { backgroundColor: sistema.cor }} aria-hidden="true">
          {sistema === undefined ? '' : iniciais(sistema.nome)}
        </span>
        <span className="lb-rpg-config__nome">{nome}</span>
      </div>
      <button type="button" className="lb-btn lb-btn--block" onClick={onAbrirSistemas}>
        {sistema === undefined ? 'Escolher sistema…' : 'Trocar sistema…'}
      </button>
      <p className="lb-field__hint">As fichas dos personagens seguem o sistema. Livro de regras e Personagens ficam na aba Jogo.</p>
    </section>
  )
}

/** A seção ligada às stores: o sistema da aventura aberta (nenhum no mapa solto) e a grade do `rpgStore`. */
export function SistemaDeRpgDoMapa() {
  const sistemaId = useAdventureStore((state) => state.adventure?.sistemaDeRpg)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const carregarBiblioteca = useRpgStore((state) => state.carregarBiblioteca)
  // Sistema importado só se acha depois de ler a pasta: lida uma vez, na primeira vez que a seção aparece.
  useEffect(() => {
    void carregarBiblioteca()
  }, [carregarBiblioteca])
  return <SistemaDeRpgControls sistema={sistemaPorId(biblioteca, sistemaId)} sistemaId={sistemaId} onAbrirSistemas={() => useRpgStore.getState().abrirSistemas()} />
}
