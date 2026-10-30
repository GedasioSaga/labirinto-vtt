import type { CSSProperties, MouseEvent } from 'react'
import { ImagemOuIniciais } from '../FichaPecas'
import type { DadosDaCarta, RecursoNaCarta } from './dadosDaFaixa'
import './batalha.css'

/**
 * Uma carta da ordem dos turnos (o `.carta` do protótipo aprovado): retrato
 * com o anel da cor da equipe, nome, posição, HP/SP (com número só para quem
 * pode ver), "Vida oculta" para quem não pode, as fitas VEZ e A SEGUIR e as
 * marcas do mestre (d20 do desempate, empate) e da carta extra.
 *
 * Só desenha. Clicável (`onClique`) vira `<button>`; senão é texto. O arrasto
 * do mestre mora na faixa (`FaixaDaOrdem`), que ouve a lista inteira.
 */

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
  if (carta.caiu) partes.push('caiu')
  if (doMestre && carta.d20 !== null) partes.push(`desempate d20 ${carta.d20}`)
  if (doMestre && carta.empate !== null) partes.push('empatado na Agilidade')
  return partes.join(', ')
}

export function CartaDaOrdem({ carta, posicao, vez, proxima, doMestre, rotuloDoClique, onClique, onMenuDeContexto, menuAberto }: CartaDaOrdemProps) {
  const estilo = carta.cor === null ? undefined : ({ '--lado': carta.cor } as CSSProperties)
  const descricao = descricaoDaCarta(carta, posicao, vez, proxima, doMestre)
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
      {carta.vida === 'numeros' && carta.recursos.map((recurso) => <Barra key={recurso.id} recurso={recurso} />)}
      {carta.vida === 'oculta' && <span className="bt-carta__oculta">Vida oculta</span>}
      {carta.vida === 'sem' && <span className="bt-carta__oculta">{carta.personagemId === null ? 'Sem ficha ligada' : 'Sem vida na ficha'}</span>}
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
    <li className="bt-carta" data-id={carta.id} data-vez={vez ? 'sim' : 'nao'} data-proxima={proxima ? 'sim' : 'nao'} data-caiu={carta.caiu ? 'sim' : 'nao'} style={estilo}>
      {onClique === undefined ? (
        <div className="bt-carta__corpo" aria-label={descricao} role="group">
          {miolo}
        </div>
      ) : (
        <button
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
