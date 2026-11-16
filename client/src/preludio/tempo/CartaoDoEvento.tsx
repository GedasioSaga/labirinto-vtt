import type { KeyboardEvent, PointerEvent } from 'react'
import { rotuloDoQuando } from '../../lib/preparo/linhaDoTempo'
import type { Evento, Verbete } from '../../lib/preparo/tipos'

/**
 * UM EVENTO NA LINHA DO TEMPO (E3c): a alça de arrastar (Alt+↑/↓ pelo
 * teclado, fora da bandeja), o título com o resumo (o clique abre a edição no
 * lugar), e os chips da sessão de onde veio e dos verbetes ligados, que levam
 * até eles. Na bandeja, "Dar data".
 */

const ICONE_DA_ALCA = (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <circle cx="7.5" cy="5" r="1" />
    <circle cx="12.5" cy="5" r="1" />
    <circle cx="7.5" cy="10" r="1" />
    <circle cx="12.5" cy="10" r="1" />
    <circle cx="7.5" cy="15" r="1" />
    <circle cx="12.5" cy="15" r="1" />
  </svg>
)

const ICONE_DA_SESSAO = (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <rect x="3.5" y="3" width="13" height="14" rx="1.5" />
    <path d="M7 7h6M7 10h6M7 13h4" />
  </svg>
)

const ICONE_DO_LUGAR = (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="M2.5 5l5-2 5 2 5-2v12l-5 2-5-2-5 2z" />
    <path d="M7.5 3v12M12.5 5v12" />
  </svg>
)

export interface CartaoDoEventoProps {
  evento: Evento
  naBandeja: boolean
  editavel: boolean
  /** Acabou de chegar aqui (soltou, salvou): acende uma vez. */
  chegou: boolean
  /** Por que "Dar data" não dá agora (nenhuma era); `null` = dá. */
  semEra: string | null
  verbetes: ReadonlyMap<string, Verbete>
  aoAbrir: (eventoId: string) => void
  aoDarData: (eventoId: string) => void
  aoApertarAlca: (eventoId: string, naBandeja: boolean, evento: PointerEvent<HTMLElement>) => void
  aoTeclarAlca: (eventoId: string, evento: KeyboardEvent<HTMLButtonElement>) => void
  aoIr: (verbete: Verbete) => void
  aoAcenderAcabar: () => void
}

function Chips({ evento, verbetes, aoIr }: Pick<CartaoDoEventoProps, 'evento' | 'verbetes' | 'aoIr'>) {
  const sessao = evento.sessaoId === undefined ? undefined : verbetes.get(evento.sessaoId)
  if (evento.sessaoId === undefined && evento.verbetes.length === 0 && !evento.segredo) return null
  return (
    <span className="lt-ev__fichas">
      {evento.sessaoId !== undefined &&
        (sessao === undefined ? (
          <span className="lt-chip lt-chip--sessao lt-chip--sumiu">{ICONE_DA_SESSAO}Sessão que não existe mais</span>
        ) : (
          <button type="button" className="lt-chip lt-chip--sessao lt-chip--bt" title="Abrir a sessão de onde o evento veio" onClick={() => aoIr(sessao)}>
            {ICONE_DA_SESSAO}
            {sessao.titulo || 'Sessão sem nome'}
          </button>
        ))}
      {evento.verbetes.map((id) => {
        const verbete = verbetes.get(id)
        if (verbete === undefined)
          return (
            <span key={id} className="lt-chip lt-chip--sumiu">
              Verbete que não existe mais
            </span>
          )
        return (
          <button key={id} type="button" className="lt-chip lt-chip--bt" title={`Abrir ${verbete.titulo || 'o verbete'}`} onClick={() => aoIr(verbete)}>
            {verbete.tipo === 'lugar' && ICONE_DO_LUGAR}
            {verbete.titulo || 'Sem nome'}
          </button>
        )
      })}
      {evento.segredo && <span className="lt-chip lt-chip--segredo">Segredo</span>}
    </span>
  )
}

export function CartaoDoEvento({ evento, naBandeja, editavel, chegou, semEra, verbetes, aoAbrir, aoDarData, aoApertarAlca, aoTeclarAlca, aoIr, aoAcenderAcabar }: CartaoDoEventoProps) {
  const titulo = evento.titulo || 'Evento sem título'
  const quando = rotuloDoQuando(evento.quando, !naBandeja)
  const texto = (
    <>
      <span className="lt-ev__linha1">
        <span className="lt-ev__tit">{titulo}</span>
        {quando !== '' && <span className="lt-ev__quando">{quando}</span>}
      </span>
      {evento.resumo !== '' && <span className="lt-ev__resumo">{evento.resumo}</span>}
    </>
  )
  return (
    <li className={`lt-ev${evento.segredo ? ' lt-ev--segredo' : ''}${chegou ? ' lt-ev--chegou' : ''}`} data-evento={evento.id} onAnimationEnd={chegou ? aoAcenderAcabar : undefined}>
      <div className="lt-ev__cartao">
        {editavel ? (
          <button
            type="button"
            className="lt-alca"
            data-alca={evento.id}
            aria-label={naBandeja ? `Mover ${titulo} (arraste até um ano)` : `Mover ${titulo} (arraste, ou Alt com seta para cima e para baixo)`}
            title={naBandeja ? 'Arraste até um ano' : 'Arraste, ou Alt+↑/↓'}
            onPointerDown={(pressao) => aoApertarAlca(evento.id, naBandeja, pressao)}
            onKeyDown={(tecla) => aoTeclarAlca(evento.id, tecla)}
          >
            {ICONE_DA_ALCA}
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        <div className="lt-ev__meio">
          {editavel ? (
            <button type="button" className="lt-ev__abrir" data-abrir={evento.id} title="Editar o evento" onClick={() => aoAbrir(evento.id)}>
              {texto}
            </button>
          ) : (
            <div className="lt-ev__abrir">{texto}</div>
          )}
          <Chips evento={evento} verbetes={verbetes} aoIr={aoIr} />
        </div>
        <div className="lt-ev__direita">
          {naBandeja && editavel && (
            <button type="button" className="gr-bt gr-bt--p gr-bt--latao" disabled={semEra !== null} title={semEra ?? undefined} onClick={() => aoDarData(evento.id)}>
              Dar data
            </button>
          )}
        </div>
      </div>
    </li>
  )
}
