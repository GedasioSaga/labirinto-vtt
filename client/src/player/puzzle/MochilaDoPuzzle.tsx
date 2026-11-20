/**
 * A GAVETA DA MOCHILA no puzzle (o `htmlMochilaPz` do protótipo v2): a grade
 * da mochila dele, as peças de puzzle primeiro, o detalhe da peça na mão e os
 * PV (o castigo fica à vista). Escolher é tocar; arrastar começa no
 * `onPointerDown` e o resto do gesto mora em `arrastoDaPeca.ts`.
 */
import type { PointerEvent as PointerDoReact } from 'react'
import { useImagemDaMesa } from '../../components/ImagemDaMesa'
import type { VagaNaVista } from '../../puzzles/tipos'
import type { DesenhoDaPeca } from './arrastoDaPeca'
import { NOTA_DA_MOCHILA } from './textos'
import type { PvNaTela } from './tipos'

/** A grade nunca fica com menos vagas que o v2 (duas fileiras de 4). */
const VAGAS_MIN = 8
const COLUNAS = 4

interface PropsDaMochila {
  vagas: readonly VagaNaVista[]
  escolhida: string | null
  /** Vagas que chegaram durante o puzzle e ainda não foram tocadas (o ponto de latão do v2). */
  novas: ReadonlySet<string>
  pv: PvNaTela | null
  onEscolher: (vagaId: string, peloTeclado: boolean) => void
  onApertar: (evento: PointerDoReact<HTMLButtonElement>, vagaId: string, desenho: DesenhoDaPeca) => void
}

/** As peças de puzzle primeiro, na ordem da mochila; depois o resto. */
export function vagasEmOrdem(vagas: readonly VagaNaVista[]): VagaNaVista[] {
  return [...vagas.filter((vaga) => vaga.peca), ...vagas.filter((vaga) => !vaga.peca)]
}

export function inicialDoNome(nome: string): string {
  return Array.from(nome.trim())[0]?.toUpperCase() ?? '?'
}

export function MochilaDoPuzzle({ vagas, escolhida, novas, pv, onEscolher, onApertar }: PropsDaMochila) {
  const resolver = useImagemDaMesa()
  const naMao = escolhida === null ? null : (vagas.find((vaga) => vaga.vagaId === escolhida) ?? null)
  const vazias = Math.max(VAGAS_MIN, Math.ceil(vagas.length / COLUNAS) * COLUNAS) - vagas.length

  return (
    <aside className="tpz-mochila" aria-label="Mochila">
      <div className="tpz-mochila__cab">
        <h2>Mochila</h2>
        <span>Peças de puzzle</span>
      </div>
      <p className="tpz-mochila__nota">{NOTA_DA_MOCHILA}</p>
      <div className="tpz-mochila__grade" role="group" aria-label="Itens da mochila">
        {vagas.map((vaga) => {
          const src = resolver(vaga.imagem)
          const desenho: DesenhoDaPeca = { src, inicial: inicialDoNome(vaga.nome) }
          return (
            <div key={vaga.vagaId} className="tpz-vaga">
              <button
                type="button"
                className={`tpz-item${novas.has(vaga.vagaId) ? ' is-novo' : ''}${vaga.peca ? '' : ' tpz-item--outro'}`}
                data-vaga={vaga.vagaId}
                aria-pressed={escolhida === vaga.vagaId}
                aria-label={vaga.quantidade > 1 ? `${vaga.nome}, ${vaga.quantidade}` : vaga.nome}
                onPointerDown={(evento) => onApertar(evento, vaga.vagaId, desenho)}
                // `detail` 0 = Enter ou Espaço: aí o foco segue para o primeiro encaixe que aceita.
                onClick={(evento) => onEscolher(vaga.vagaId, evento.detail === 0)}
              >
                {src !== null ? <img src={src} alt="" draggable={false} /> : <span className="tpz-item__inicial">{desenho.inicial}</span>}
                <span className="tpz-item__nome">{vaga.nome}</span>
                {vaga.quantidade > 1 && <span className="tpz-item__qtd">{vaga.quantidade}</span>}
              </button>
            </div>
          )
        })}
        {Array.from({ length: vazias }, (_, i) => (
          <div key={`vazia-${i}`} className="tpz-vaga tpz-vaga--vazia" aria-hidden="true" />
        ))}
      </div>
      <div className="tpz-mochila__detalhe" aria-live="polite">
        {naMao === null ? (
          <>
            <h3>Nada na mão</h3>
            <p>Escolha uma peça. As peças de puzzle vêm primeiro.</p>
          </>
        ) : (
          <>
            <h3>{naMao.nome}</h3>
            <p>
              Toque num encaixe ou arraste até ele. <kbd>Esc</kbd> solta.
            </p>
          </>
        )}
      </div>
      {pv !== null && pv.max > 0 && (
        <div className="tpz-pv">
          <span>PV</span>
          <span className="tpz-pv__barra" aria-hidden="true">
            <i style={{ transform: `scaleX(${Math.min(1, Math.max(0, pv.atual / pv.max))})` }} />
          </span>
          <span>
            {pv.atual}/{pv.max}
          </span>
        </div>
      )}
    </aside>
  )
}
