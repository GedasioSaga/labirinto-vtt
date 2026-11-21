import { useState } from 'react'
import { conviteDo, entradaDoDesafio } from '../../../lib/desafios'
import { recorteDoMinigame, REGISTRO_DE_MINIGAMES } from '../../../minigames/registro'
import { textosDoJogoDoSelo } from '../../../minigames/textosDoCartao'
import type { Desafio } from '../../../types/map'
import { IconeDoJogo } from '../IconeDoJogo'
import { RetratoDeQuemChama } from './BlocoDoConvite'

/**
 * A PRÉVIA "O JOGADOR VÊ" (editor de desafio de 21/11/2026, decisão 11):
 * enquanto a ficha está aberta, 1) o cartão ao encostar no selo e 2) o
 * convite. Muda a cada tecla. Mora DENTRO da coluna do livro, grudada no pé
 * da folha e recolhível: por cima do mapa ela cobria o selo que a ficha
 * aberta deixa mover, girar e apagar (auditoria de 21/11). O cartão sai das MESMAS funções do
 * recorte do jogador (`recorteDoMinigame`, com o selo legível) e dos mesmos
 * textos do cartão (`minigames/textosDoCartao.ts`): a prévia não inventa o
 * que o jogador lê. O convite é o resumo do que a tela do jogo mostra (quem
 * chama, o verbo, a fala, o lugar); a tela de verdade depende da partida ao
 * vivo e não monta aqui.
 */

/** O gesto do cartão quando o jogador começa sozinho no selo. */
const GESTO_DO_SELO: Partial<Record<Desafio['minigame']['jogo'], string>> = {
  pesca: 'Pescar',
  tiro: 'Atirar',
  fogo: 'Apagar o fogo',
  bolha: 'Apagar com bolhas',
  alavanca: 'Girar a alavanca',
  puzzle: 'Examinar',
}

/** O verbo do convite para o jogador ("desafia você para uma dança"), pelo verbo do registro. */
function verboParaOJogador(verbo: string): string {
  return verbo
    .replace(/^desafia para /, 'desafia você para ')
    .replace(/^convida para /, 'convida você para ')
    .replace(/^chama para /, 'chama você para ')
    .replace(/^pede ajuda$/, 'pede a sua ajuda')
}

function CartaoDoSelo({ desafio }: { desafio: Desafio }) {
  if (desafio.lugar.tipo === 'nenhum') {
    return (
      <p className="mg-previa__vazio">
        {REGISTRO_DE_MINIGAMES[desafio.minigame.jogo].lugares.includes('nenhum')
          ? 'Fora do mapa não há selo nem cartão. O jogador só vê o convite quando você chamar.'
          : 'Sem lugar no mapa, o jogador não tem onde encostar: este puzzle ainda não existe para ele.'}
      </p>
    )
  }
  const visivel = recorteDoMinigame(desafio.minigame, true)
  const textos = textosDoJogoDoSelo(visivel)
  const entrada = entradaDoDesafio(desafio)
  const descricao = desafio.eraPino?.description.trim() ?? ''
  const gesto = GESTO_DO_SELO[desafio.minigame.jogo]
  return (
    <div className="mg-pc">
      <div className="mg-pc__cab">
        <span className="mg-pc__selo">
          <IconeDoJogo jogo={desafio.minigame.jogo} />
        </span>
        {textos.titulo}
      </div>
      {descricao !== '' ? <p className="mg-pc__txt">{descricao}</p> : visivel.fala === undefined && <p className="mg-pc__txt">{textos.vazio}</p>}
      {visivel.fala !== undefined && (
        <figure className="mg-pc__fala">
          <blockquote>“{visivel.fala}”</blockquote>
          {visivel.npc !== undefined && <figcaption>{visivel.npc}</figcaption>}
        </figure>
      )}
      {entrada === 'pino' && gesto !== undefined ? <span className="mg-pc__bt">{gesto}</span> : <p className="mg-pc__locked">{textos.doMestre}</p>}
    </div>
  )
}

function ConviteDoJogador({ desafio }: { desafio: Desafio }) {
  const minigame = desafio.minigame
  if (minigame.jogo === 'puzzle') return <p className="mg-previa__vazio">O puzzle não tem convite: o jogador toca em Examinar e a tela do puzzle abre.</p>
  const convite = conviteDo(minigame)
  const textos = textosDoJogoDoSelo(recorteDoMinigame(minigame, true))
  const lugar = convite.lugar === null ? '' : convite.lugar.trim()
  const narra = convite.npc.trim() === ''
  return (
    <div className="mg-cj">
      <p className="mg-cj__onde">{lugar === '' ? textos.titulo : `${textos.titulo} · ${lugar}`}</p>
      <div className="mg-cj__quem">
        {!narra && <RetratoDeQuemChama nome={convite.npc} />}
        <div>
          <b>{narra ? textos.titulo : convite.npc}</b>
          {!narra && <span>{verboParaOJogador(REGISTRO_DE_MINIGAMES[minigame.jogo].verbo)}</span>}
        </div>
      </div>
      {convite.fala.trim() !== '' && <p className={`mg-cj__fala${narra ? ' mg-cj__fala--narra' : ''}`}>{narra ? convite.fala : `“${convite.fala}”`}</p>}
    </div>
  )
}

/** Aberta ou recolhida vale para todas as fichas e para a próxima vez que o app abrir. */
const CHAVE_DA_PREVIA = 'lb-previa-do-jogador'

/** localStorage pode não existir ou lançar (janela privada, dado bloqueado): sem ele, abre. */
function lerAberta(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_DA_PREVIA) !== 'recolhida'
  } catch {
    return true
  }
}

function guardarAberta(aberta: boolean): void {
  try {
    if (aberta) window.localStorage.removeItem(CHAVE_DA_PREVIA)
    else window.localStorage.setItem(CHAVE_DA_PREVIA, 'recolhida')
  } catch {
    // Sem armazenamento, vale até fechar o app.
  }
}

export function PreviaDoJogador({ desafio }: { desafio: Desafio }) {
  const [aberta, setAberta] = useState(lerAberta)
  return (
    <details
      className="mg-previa"
      open={aberta}
      onToggle={(evento) => {
        const agora = evento.currentTarget.open
        if (agora === aberta) return
        setAberta(agora)
        guardarAberta(agora)
      }}
    >
      <summary className="mg-previa__t">
        <span>O jogador vê</span>
        <small>prévia ao vivo</small>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M6 15l6-6 6 6" />
        </svg>
      </summary>
      <div className="mg-previa__corpo">
        <p className="mg-nota">Os botões daqui são do jogador, não clicam.</p>
        <section>
          <p className="mg-previa__passo">1. Ao encostar no selo</p>
          <div inert>
            <CartaoDoSelo desafio={desafio} />
          </div>
        </section>
        <section>
          <p className="mg-previa__passo">2. O convite, quando o jogo começa</p>
          <div inert>
            <ConviteDoJogador desafio={desafio} />
          </div>
        </section>
      </div>
    </details>
  )
}
