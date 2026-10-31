import { useEffect, useRef, type CSSProperties, type MouseEvent } from 'react'
import { ImagemOuIniciais } from '../FichaPecas'
import type { DadosDaCarta, RecursoNaCarta } from './dadosDaFaixa'
import { movimentoReduzido } from './dadosDoMenu'
import './batalha.css'

/**
 * Uma carta da ordem dos turnos (o `.carta` do protótipo aprovado): retrato
 * com o anel da cor da equipe, nome, posição, HP/SP (com número só para quem
 * pode ver), "Vida oculta" para quem não pode, as fitas VEZ e A SEGUIR e as
 * marcas do mestre (d20 do desempate, empate) e da carta extra.
 *
 * F3: a forma ligada pelo menu dá o contorno roxo e o nome da forma
 * ("PUNHO NEGRO"), com um brilho de 600 ms quando liga; os selos ficam numa
 * fileira sob as barras ("ATORDOADO 2"; sem número quando é até tirar). No
 * mestre, o selo leva `data-selo`: a faixa abre editar e tirar no clique.
 *
 * Só desenha. Clicável (`onClique`) vira `<button>`; senão é texto. O arrasto
 * do mestre mora na faixa (`FaixaDaOrdem`), que ouve a lista inteira.
 */

/** O brilho da carta quando a forma liga: `brightness` 1,8 → 1 em 600 ms. */
const BRILHO_DA_FORMA_MS = 600

export interface CartaDaOrdemProps {
  carta: DadosDaCarta
  /** 1 em diante. */
  posicao: number
  vez: boolean
  proxima: boolean
  /** Só o mestre vê d20 e empate; a faixa não passa os dois ao jogador de qualquer jeito. */
  doMestre: boolean
  /** O que o clique faz, para o leitor de tela ("Abrir o menu", "Ver o perfil"). Ausente = a carta não é clicável. */
  rotuloDoClique?: string
  onClique?: (evento: MouseEvent<HTMLButtonElement>) => void
  onMenuDeContexto?: (evento: MouseEvent<HTMLButtonElement>) => void
  /** O menu desta carta está aberto. */
  menuAberto?: boolean
}

const numero = new Intl.NumberFormat('pt-BR')

function Barra({ recurso }: { recurso: RecursoNaCarta }) {
  const proporcao = recurso.maximo > 0 ? Math.max(0, Math.min(1, recurso.atual / recurso.maximo)) : 0
  const escala = { transform: `scaleX(${proporcao.toFixed(4)})` }
  return (
    <>
      <span className="bt-carta__linha">
        <b data-tom={recurso.tom}>{recurso.rotulo}</b>
        <span className="bt-carta__num">
          {numero.format(recurso.atual)}/{numero.format(recurso.maximo)}
        </span>
      </span>
      <span className="bt-barra" data-tom={recurso.tom} aria-hidden="true">
        <b style={escala} />
        <i style={escala} />
      </span>
    </>
  )
}

/** O que o leitor de tela diz da carta: posição, nome, vez, vida e marcas, numa frase. */
export function descricaoDaCarta(carta: DadosDaCarta, posicao: number, vez: boolean, proxima: boolean, doMestre: boolean): string {
  const partes = [`${posicao}º ${carta.nome}`]
  if (carta.equipe !== null) partes.push(`equipe ${carta.equipe}`)
  if (vez) partes.push('é a vez')
  else if (proxima) partes.push('a seguir')
  if (carta.extra !== null) partes.push(carta.extra === 'rodada' ? 'carta extra só nesta rodada' : 'carta extra em todas as rodadas')
  if (carta.vida === 'numeros') for (const recurso of carta.recursos) partes.push(`${recurso.rotulo} ${recurso.atual} de ${recurso.maximo}`)
  if (carta.vida === 'oculta') partes.push('vida oculta')
  if ((carta.carga ?? 0) > 0) partes.push(`concentração ${carta.carga}`)
  if (carta.forma) partes.push(`em ${carta.forma}`)
  for (const selo of carta.selos ?? []) partes.push(selo.turnos === null ? `${selo.nome} até tirar` : `${selo.nome} por ${selo.turnos} ${selo.turnos === 1 ? 'turno' : 'turnos'}`)
  if (carta.caiu) partes.push('caiu')
  if (doMestre && carta.d20 !== null) partes.push(`desempate d20 ${carta.d20}`)
  if (doMestre && carta.empate !== null) partes.push('empatado na Agilidade')
  return partes.join(', ')
}

export function CartaDaOrdem({ carta, posicao, vez, proxima, doMestre, rotuloDoClique, onClique, onMenuDeContexto, menuAberto }: CartaDaOrdemProps) {
  const estilo = carta.cor === null ? undefined : ({ '--lado': carta.cor } as CSSProperties)
  const descricao = descricaoDaCarta(carta, posicao, vez, proxima, doMestre)
  const forma = carta.forma ?? null
  const selos = carta.selos ?? []

  // A forma ligou (não na montagem): a carta acende e apaga. Movimento reduzido: só o contorno.
  const corpo = useRef<HTMLElement | null>(null)
  const formaAntes = useRef(forma)
  useEffect(() => {
    const antes = formaAntes.current
    formaAntes.current = forma
    if (forma === null || forma === antes || movimentoReduzido()) return
    corpo.current?.animate([{ filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], { duration: BRILHO_DA_FORMA_MS, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' })
  }, [forma])
  const guardarCorpo = (elemento: HTMLElement | null) => {
    corpo.current = elemento
  }

  const miolo = (
    <>
      {vez ? (
        <span className="bt-carta__fita bt-carta__fita--vez" aria-hidden="true">
          VEZ
        </span>
      ) : (
        proxima && (
          <span className="bt-carta__fita bt-carta__fita--seguir" aria-hidden="true">
            A SEGUIR
          </span>
        )
      )}
      <span className="bt-carta__topo">
        <span className="bt-carta__retrato">
          <ImagemOuIniciais imagem={carta.imagem} nome={carta.nome} />
        </span>
        <span className="bt-carta__nome" title={carta.nome}>
          {carta.nome}
        </span>
        <span className="bt-carta__pos">{posicao}</span>
      </span>
      {forma !== null && (
        <span className="bt-carta__forma" title={forma}>
          {forma}
        </span>
      )}
      {carta.vida === 'numeros' && carta.recursos.map((recurso) => <Barra key={recurso.id} recurso={recurso} />)}
      {carta.vida === 'oculta' && <span className="bt-carta__oculta">Vida oculta</span>}
      {carta.vida === 'sem' && <span className="bt-carta__oculta">{carta.personagemId === null ? 'Sem ficha ligada' : 'Sem vida na ficha'}</span>}
      {selos.length > 0 && (
        <span className="bt-carta__selos" aria-hidden="true">
          {selos.map((selo, i) => (
            <span
              key={selo.id ?? `${i}:${selo.texto}`}
              className="bt-selo"
              data-selo={doMestre && selo.id !== null ? selo.id : undefined}
              title={doMestre && selo.id !== null ? `${selo.texto}: clique para editar ou tirar` : selo.turnos === null ? `${selo.nome}: até o mestre tirar` : selo.texto}
            >
              {selo.texto}
            </span>
          ))}
        </span>
      )}
      <span className="bt-carta__marcas" aria-hidden="true">
        {carta.equipe !== null && <span className="bt-marca bt-marca--equipe">{carta.equipe}</span>}
        {carta.extra !== null && <span className="bt-marca bt-marca--extra">{carta.extra === 'rodada' ? 'EXTRA · só nesta rodada' : 'EXTRA'}</span>}
        {doMestre && carta.d20 !== null && (
          <span className="bt-marca bt-marca--dado" title="Desempate de Agilidade">
            d20 {carta.d20}
          </span>
        )}
        {doMestre && carta.empate !== null && (
          <span className="bt-marca bt-marca--empate" title="Empatou na Agilidade: arraste para decidir">
            empate
          </span>
        )}
        {(carta.carga ?? 0) > 0 && (
          <span className="bt-marca bt-marca--carga" title="Concentração guardada para o próximo golpe">
            CONC {carta.carga}
          </span>
        )}
        {carta.caiu && <span className="bt-marca">caiu</span>}
      </span>
    </>
  )
  return (
    <li
      className="bt-carta"
      data-id={carta.id}
      data-vez={vez ? 'sim' : 'nao'}
      data-proxima={proxima ? 'sim' : 'nao'}
      data-caiu={carta.caiu ? 'sim' : 'nao'}
      data-forma={forma === null ? undefined : 'sim'}
      style={estilo}
    >
      {onClique === undefined ? (
        <div ref={guardarCorpo} className="bt-carta__corpo" aria-label={descricao} role="group">
          {miolo}
        </div>
      ) : (
        <button
          ref={guardarCorpo}
          type="button"
          className="bt-carta__corpo"
          aria-label={`${descricao}. ${rotuloDoClique ?? ''}`.trim()}
          aria-haspopup={menuAberto === undefined ? undefined : 'menu'}
          aria-expanded={menuAberto}
          onClick={onClique}
          onContextMenu={onMenuDeContexto}
        >
          {miolo}
        </button>
      )}
    </li>
  )
}
