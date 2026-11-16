import { useId, useState } from 'react'
import type { AlvoNaMesa } from '../../lib/preparo/sessoes'
import type { LigaCena, Verbete } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'
import { mesmaCena, useCenaAbertaNaMesa } from '../janela/mesaNaJanela'
import { useEstadoDoLink } from '../mesa/catalogo'
import { EscolherNaMesa } from '../mesa/EscolherNaMesa'
import { abrirNaMesaPeloPreludio, podeAbrirNaMesa } from '../mesa/ponte'

/**
 * A SESSÃO EM JOGO (P2 do estudo de 15/11): "Jogar esta sessão" marca a
 * sessão que está na mesa agora (uma de cada vez, no índice do Prelúdio), e o
 * Roteiro do Livro do mestre passa a segui-la. "Cenas desta sessão" são as
 * cenas que ela usa (`liga.cenas` do verbete da sessão): cada uma abre na mesa
 * pela mesma porta dos links do roteiro.
 */

export function JogarEstaSessao({ sessao, editavel }: { sessao: Verbete; editavel: boolean }) {
  const emJogo = usePreludio((estado) => estado.emJogo)
  const verbetes = usePreludio((estado) => estado.verbetes)
  const [gravando, setGravando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const ativa = emJogo === sessao.id
  const outra = emJogo === null || ativa ? undefined : verbetes.get(emJogo)
  const jogar = async (sessaoId: string | null) => {
    setGravando(true)
    const motivo = await usePreludio.getState().jogarSessao(sessaoId)
    setGravando(false)
    setAviso(motivo)
  }
  return (
    <div className="pr-em-jogo" role="group" aria-label="Sessão em jogo">
      {ativa ? (
        <>
          <span className="pr-em-jogo__selo">
            <i aria-hidden="true" />
            Em jogo
          </span>
          <span className="pr-quieto">O Roteiro do Livro do mestre, na janela do mapa, segue esta sessão.</span>
          <button type="button" className="gr-bt gr-bt--fantasma gr-bt--p" disabled={gravando || !editavel} onClick={() => void jogar(null)}>
            Parar de jogar
          </button>
        </>
      ) : (
        <>
          <button type="button" className="gr-bt gr-bt--primario gr-bt--p" disabled={gravando || !editavel} onClick={() => void jogar(sessao.id)}>
            Jogar esta sessão
          </button>
          {outra !== undefined && <span className="pr-quieto">Em jogo agora: {outra.titulo || 'Sessão sem nome'}.</span>}
        </>
      )}
      {aviso !== null && (
        <p className="pr-aviso" role="alert">
          {aviso}
        </p>
      )}
    </div>
  )
}

function LinhaDaCena({ cena, aberta, editavel, aoTirar }: { cena: LigaCena; aberta: boolean; editavel: boolean; aoTirar: () => void }) {
  const alvo: AlvoNaMesa = { tipo: 'cena', ...cena }
  const link = useEstadoDoLink(alvo)
  const nome = link.t === 'ok' ? link.nome : link.t === 'lendo' ? 'Lendo a cena…' : 'Cena que não existe mais'
  const onde = link.t === 'ok' ? link.onde : link.t === 'quebrado' ? link.aviso : ''
  return (
    <li className={`pr-cenas-da-sessao__item${aberta ? ' e-aberta' : ''}`}>
      <span className="pr-cenas-da-sessao__nome">
        {nome}
        {onde !== '' && onde !== nome && <small>{onde}</small>}
        {aberta && <small>Aberta na mesa</small>}
      </span>
      {!aberta && (
        <button type="button" className="gr-bt gr-bt--latao gr-bt--p" disabled={link.t === 'quebrado' || !podeAbrirNaMesa()} onClick={() => abrirNaMesaPeloPreludio(cena)}>
          Abrir na mesa
        </button>
      )}
      {editavel && (
        <button type="button" className="gr-bt gr-bt--fantasma gr-bt--p" aria-label={`Tirar ${nome} das cenas desta sessão`} title="Tirar das cenas desta sessão" onClick={aoTirar}>
          ×
        </button>
      )}
    </li>
  )
}

export function CenasDaSessao({ sessao, editavel }: { sessao: Verbete; editavel: boolean }) {
  const titulo = useId()
  const mudarVerbete = usePreludio((estado) => estado.mudarVerbete)
  const aberta = useCenaAbertaNaMesa()
  const [escolhendo, setEscolhendo] = useState(false)
  const cenas = sessao.liga?.cenas ?? []
  const mudarCenas = (fazer: (atuais: readonly LigaCena[]) => LigaCena[]) =>
    mudarVerbete(sessao.id, (atual) => ({ ...atual, liga: { ...(atual.liga ?? { fichas: [], cenas: [] }), cenas: fazer(atual.liga?.cenas ?? []) } }))
  const ligar = (cena: LigaCena) => mudarCenas((atuais) => (atuais.some((uma) => mesmaCena(uma, cena) && uma.pinoId === cena.pinoId) ? [...atuais] : [...atuais, cena]))
  const abertaJaLigada = aberta !== null && cenas.some((cena) => mesmaCena(cena, aberta.alvo))
  return (
    <section className="pr-trilho__bloco pr-cenas-da-sessao" aria-labelledby={titulo}>
      <h3 id={titulo} className="pr-trilho__titulo">
        Cenas desta sessão
      </h3>
      {cenas.length === 0 ? (
        <p className="pr-quieto">Nenhuma cena ligada. Ligue as cenas que esta sessão usa: cada uma abre na mesa com um clique.</p>
      ) : (
        <ol className="pr-cenas-da-sessao__lista">
          {cenas.map((cena, indice) => (
            <LinhaDaCena
              key={`${cena.chave}\n${cena.sceneId}\n${cena.pinoId ?? ''}\n${indice}`}
              cena={cena}
              aberta={aberta !== null && mesmaCena(cena, aberta.alvo) && cena.pinoId === undefined}
              editavel={editavel}
              aoTirar={() => mudarCenas((atuais) => atuais.filter((_, outro) => outro !== indice))}
            />
          ))}
        </ol>
      )}
      {editavel && (
        <div className="pr-cenas-da-sessao__acoes">
          {aberta !== null && !abertaJaLigada && (
            <button type="button" className="gr-bt gr-bt--latao gr-bt--p" onClick={() => ligar(aberta.alvo)}>
              + Ligar a cena aberta ({aberta.nome})
            </button>
          )}
          <button type="button" className="gr-bt gr-bt--fantasma gr-bt--p" onClick={() => setEscolhendo(true)}>
            + Escolher cena…
          </button>
        </div>
      )}
      {escolhendo && (
        <EscolherNaMesa
          aoFechar={() => setEscolhendo(false)}
          aoEscolher={(alvo) => {
            setEscolhendo(false)
            // A ficha do Livro não é cena: a escolha de ficha não entra nesta lista.
            if (alvo.tipo !== 'cena') return
            ligar(alvo.pinoId === undefined ? { chave: alvo.chave, sceneId: alvo.sceneId } : { chave: alvo.chave, sceneId: alvo.sceneId, pinoId: alvo.pinoId })
          }}
        />
      )}
    </section>
  )
}
