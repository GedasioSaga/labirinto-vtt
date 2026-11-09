import { useRef, useState, type KeyboardEvent } from 'react'
import { idNovo } from '../../lib/preparo/enciclopedia'
import { dadosDaSessao, eventoDoAcontecimento } from '../../lib/preparo/sessoes'
import type { Acontecimento, DadosDaSessao, Verbete } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'

/**
 * "O QUE ACONTECEU" (F4): depois do jogo, uma linha por acontecimento. Um
 * clique leva a linha para a lista de eventos da linha do tempo
 * (`preparo/tempo.json`), com o mesmo id; "Tirar" desfaz. A linha que está na
 * linha do tempo não muda por aqui: a edição dela será da linha do tempo (F7).
 */

interface LinhaProps {
  acontecimento: Acontecimento
  naLinhaDoTempo: boolean
  editavel: boolean
  /** Por que a linha do tempo não aceita mudança agora; `null` = aceita. */
  parado: string | null
  aoMudar: (texto: string) => void
  aoApagar: () => void
  aoLevar: () => Promise<void>
  aoTirar: () => Promise<void>
}

function Linha({ acontecimento, naLinhaDoTempo, editavel, parado, aoMudar, aoApagar, aoLevar, aoTirar }: LinhaProps) {
  const [gravando, setGravando] = useState(false)
  const vazio = acontecimento.texto.trim() === ''
  const agir = (acao: () => Promise<void>) => {
    setGravando(true)
    void acao().finally(() => setGravando(false))
  }
  if (naLinhaDoTempo) {
    return (
      <li className="pr-aconteceu__linha pr-aconteceu__linha--evento">
        <span className="pr-aconteceu__texto">{acontecimento.texto}</span>
        <span className="pr-aconteceu__selo">Na linha do tempo</span>
        {editavel && (
          <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" disabled={gravando || parado !== null} title={parado ?? 'Tira o evento da linha do tempo; a linha volta a poder mudar.'} onClick={() => agir(aoTirar)}>
            Tirar
          </button>
        )}
      </li>
    )
  }
  return (
    <li className="pr-aconteceu__linha">
      <input
        className="pr-aconteceu__campo"
        value={acontecimento.texto}
        aria-label="Acontecimento"
        readOnly={!editavel}
        onChange={(evento) => aoMudar(evento.target.value)}
      />
      {editavel && (
        <>
          <button type="button" className="gr-bt gr-bt--p gr-bt--latao" disabled={vazio || gravando || parado !== null} title={parado ?? (vazio ? 'Escreva o acontecimento antes.' : undefined)} onClick={() => agir(aoLevar)}>
            Para a linha do tempo
          </button>
          <button type="button" className="pr-hoje__tirar" aria-label="Apagar esta linha" title="Apagar esta linha" onClick={aoApagar}>
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M6 6l8 8M14 6l-8 8" />
            </svg>
          </button>
        </>
      )}
    </li>
  )
}

export function OQueAconteceu({ sessao, editavel }: { sessao: Verbete; editavel: boolean }) {
  const mudarVerbete = usePreludio((estado) => estado.mudarVerbete)
  const tempo = usePreludio((estado) => estado.tempo)
  const aviso = usePreludio((estado) => estado.avisoDoTempo)
  const dispensarAviso = usePreludio((estado) => estado.dispensarAvisoDoTempo)
  const registrarEvento = usePreludio((estado) => estado.registrarEvento)
  const tirarEvento = usePreludio((estado) => estado.tirarEvento)
  const [nova, setNova] = useState('')
  const campoNovo = useRef<HTMLInputElement>(null)
  const dados = dadosDaSessao(sessao)
  const eventos = new Set((tempo.tempo?.eventos ?? []).map((evento) => evento.id))
  const parado = tempo.tempo === null ? (tempo.soLeitura ?? 'A linha do tempo ainda não abriu.') : tempo.soLeitura

  const mudarDados = (mudar: (dados: DadosDaSessao) => DadosDaSessao) => mudarVerbete(sessao.id, (atual) => ({ ...atual, sessao: mudar(dadosDaSessao(atual)) }))
  const mudarLinha = (id: string, mudar: (linha: Acontecimento) => Acontecimento | null) =>
    mudarDados((atual) => ({ ...atual, aconteceu: atual.aconteceu.flatMap((linha) => (linha.id === id ? [mudar(linha)].filter((uma): uma is Acontecimento => uma !== null) : [linha])) }))

  const acrescentar = () => {
    const texto = nova.trim()
    if (texto === '') return
    mudarDados((atual) => ({ ...atual, aconteceu: [...atual.aconteceu, { id: idNovo('ev'), texto }] }))
    setNova('')
    campoNovo.current?.focus()
  }
  const aoTeclarNova = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key !== 'Enter') return
    evento.preventDefault()
    acrescentar()
  }
  const levados = dados.aconteceu.filter((linha) => eventos.has(linha.id)).length

  return (
    <section className="pr-aconteceu" aria-labelledby="pr-aconteceu-titulo">
      <header className="pr-aconteceu__cabeca">
        <h3 id="pr-aconteceu-titulo" className="pr-sessao__subtitulo">
          O que aconteceu
        </h3>
        {dados.aconteceu.length > 0 && (
          <span className="pr-aconteceu__conta">
            {levados === 0 ? 'Nenhum na linha do tempo' : levados === 1 ? '1 na linha do tempo' : `${levados} na linha do tempo`}
          </span>
        )}
      </header>
      {editavel && <p className="pr-quieto">Depois do jogo, uma linha por acontecimento. Cada uma vira evento da linha do tempo com um clique, ainda sem data: a era e o ano entram quando a linha do tempo chegar.</p>}
      {parado !== null && editavel && (
        <p className="pr-aviso" role="note">
          {parado}
        </p>
      )}
      {dados.aconteceu.length > 0 && (
        <ol className="pr-aconteceu__lista">
          {dados.aconteceu.map((linha) => (
            <Linha
              key={linha.id}
              acontecimento={linha}
              naLinhaDoTempo={eventos.has(linha.id)}
              editavel={editavel}
              parado={parado}
              aoMudar={(texto) => mudarLinha(linha.id, (atual) => ({ ...atual, texto }))}
              aoApagar={() => mudarLinha(linha.id, () => null)}
              aoLevar={() => registrarEvento(eventoDoAcontecimento(linha, sessao))}
              aoTirar={() => tirarEvento(linha.id)}
            />
          ))}
        </ol>
      )}
      {editavel && (
        <div className="pr-aconteceu__nova">
          <input
            ref={campoNovo}
            className="pr-campo__entrada"
            value={nova}
            aria-label="Novo acontecimento"
            placeholder="O que aconteceu? Enter põe na lista"
            onChange={(evento) => setNova(evento.target.value)}
            onKeyDown={aoTeclarNova}
          />
          <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" disabled={nova.trim() === ''} onClick={acrescentar}>
            Pôr na lista
          </button>
        </div>
      )}
      {aviso !== null && (
        <p className="pr-aviso pr-revelar__aviso" role="alert">
          <span>{aviso}</span>
          <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={dispensarAviso}>
            Entendi
          </button>
        </p>
      )}
    </section>
  )
}
