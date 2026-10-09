import { useEffect } from 'react'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { herdaDaPasta, sistemaAtivo, useAdventureStore } from '../stores/adventureStore'
import { trocarModoDoMapa } from '../stores/rpgDaPasta'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import { useToastStore } from '../stores/toastStore'
import { iniciais } from './FichaPecas'
import './FichaDePersonagem.css'

/** PASTAS DE MAPAS: a pasta do mapa aberto, como esta seção a explica. */
export interface PastaDoSistema {
  nome: string
  /** A pasta tem "Sistema universal"; sem ele ela só organiza. */
  temSistema: boolean
  /** O mapa usa o da pasta (e não "Configurar só neste mapa"). */
  herda: boolean
}

export interface SistemaDeRpgControlsProps {
  /** O sistema escolhido; `undefined` quando não há (ou ele não está neste computador). */
  sistema: SistemaDeRpg | undefined
  /** O id gravado, para dizer qual sistema falta. */
  sistemaId: string | undefined
  /** Abre a grade de sistemas (escolher, ou importar com o "+"). */
  onAbrirSistemas: () => void
  /** A pasta de mapas do mapa; ausente = fora das pastas (a seção fica como sempre foi). */
  pasta?: PastaDoSistema
  /** "Configurar só neste mapa" (`true`) e "Usar o da pasta" (`false`). */
  onTrocarModo?: (proprio: boolean) => void
}

/**
 * O bloco da pasta: de quem são o sistema e os personagens que o mapa usa, e
 * a troca. A frase diz o que acontece com os personagens de cada lado ANTES
 * do clique — nenhum dos dois botões apaga lista nenhuma.
 */
function BlocoDaPasta({ pasta, onTrocarModo }: { pasta: PastaDoSistema; onTrocarModo?: (proprio: boolean) => void }) {
  if (!pasta.temSistema) {
    return <p className="lb-field__hint">A pasta &quot;{pasta.nome}&quot; não tem sistema universal: este mapa usa o próprio. O sistema da pasta se escolhe no Carregar Mapa.</p>
  }
  if (pasta.herda) {
    return (
      <>
        <p className="lb-field__hint">
          Este mapa usa o sistema e os jogadores da pasta &quot;{pasta.nome}&quot; — a mesma ficha em todos os mapas dela. Trocar o sistema aqui troca o da pasta.
        </p>
        {onTrocarModo !== undefined && (
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" onClick={() => onTrocarModo(true)}>
            Configurar só neste mapa
          </button>
        )}
      </>
    )
  }
  return (
    <>
      <p className="lb-field__hint">
        Este mapa usa o próprio sistema e personagens, não os da pasta &quot;{pasta.nome}&quot;. Voltar para a pasta não apaga nada: os personagens deste mapa ficam
        guardados nele e reaparecem se você escolher &quot;Configurar só neste mapa&quot; de novo.
      </p>
      {onTrocarModo !== undefined && (
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" onClick={() => onTrocarModo(false)}>
          Usar o da pasta
        </button>
      )}
    </>
  )
}

/**
 * "Sistema de RPG" da janela Configurações do mapa: a capa e o nome do sistema
 * em uso e o botão da grade. Mora aqui (e não no painel) porque vale para a
 * mesa inteira e se mexe pouco — como a grade e a medição. Aparece também no
 * mapa solto: escolher ali pergunta antes se o mapa vira aventura (`RpgDialogs`),
 * a não ser que o mapa use o sistema da pasta de mapas dele.
 */
export function SistemaDeRpgControls({ sistema, sistemaId, onAbrirSistemas, pasta, onTrocarModo }: SistemaDeRpgControlsProps) {
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
        {sistema === undefined ? 'Escolher sistema…' : pasta?.herda === true ? 'Trocar sistema da pasta…' : 'Trocar sistema…'}
      </button>
      {pasta !== undefined && <BlocoDaPasta pasta={pasta} onTrocarModo={onTrocarModo} />}
      <p className="lb-field__hint">As fichas dos personagens seguem o sistema. Livro de regras e Personagens ficam na aba Jogo.</p>
    </section>
  )
}

/** A seção ligada às stores: o sistema EM USO (o da pasta de mapas quando o mapa herda; nenhum no mapa solto) e a grade do `rpgStore`. */
export function SistemaDeRpgDoMapa() {
  const sistemaId = useAdventureStore(sistemaAtivo)
  const pastaAberta = useAdventureStore((state) => state.pasta)
  const herda = useAdventureStore(herdaDaPasta)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const carregarBiblioteca = useRpgStore((state) => state.carregarBiblioteca)
  // Sistema importado só se acha depois de ler a pasta: lida uma vez, na primeira vez que a seção aparece.
  useEffect(() => {
    void carregarBiblioteca()
  }, [carregarBiblioteca])
  const pasta = pastaAberta === null ? undefined : { nome: pastaAberta.nome, temSistema: pastaAberta.sistemaDeRpg !== undefined, herda }
  const trocarModo = (proprio: boolean) => {
    trocarModoDoMapa(proprio).catch((erro: unknown) => {
      useToastStore.getState().push('error', `Não deu para trocar: ${erro instanceof Error ? erro.message : String(erro)}`)
    })
  }
  return (
    <SistemaDeRpgControls
      sistema={sistemaPorId(biblioteca, sistemaId)}
      sistemaId={sistemaId}
      onAbrirSistemas={() => useRpgStore.getState().abrirSistemas()}
      pasta={pasta}
      onTrocarModo={trocarModo}
    />
  )
}
