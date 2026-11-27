import { useId, type ReactNode } from 'react'
import type { MecanicaV1 } from '../../../../lib/batalha/mecanica/modelo'
import { motivoDasPecasComOUso, type PecaDa, type PecaDaMecanica } from '../../../../lib/batalha/mecanica/pecas'
import { useVariavelCss } from './controlesDaPeca'
import { Glifo } from './glifos'
import '../editor.css'
import './pecas.css'

/**
 * A MOLDURA DE UMA PEÇA (rework do editor de habilidades, E4; `renderPeca` do protótipo aprovado): a
 * peça que se encaixa na técnica, com o fio e o dente da cor da família, o medalhão com o ícone, o nome,
 * a frase do que faz e os botões de subir, descer e tirar. A cor nunca anda sozinha: o ícone e o nome
 * vão junto. O corpo é o componente do registro (`REGISTRO_DAS_PECAS`).
 *
 * Movimento: a peça nova entra subindo 6 px em 200 ms (`@starting-style`, só opacity e transform); com
 * movimento reduzido, só aparece. Os botões são de toque raro: sem animação além do aperto.
 */

interface MolduraDaPecaProps {
  /** Nome, frase, ícone e cor: a entrada do registro. */
  entrada: { nome: string; faz: string; icone: string; cor: string }
  /** Por que a peça não roda com a Ação de agora (`avisoDaPeca`); `null` ou ausente = roda. */
  aviso?: string | null
  /** Ausente = sem o botão (a primeira não sobe, a última não desce). */
  onSubir?: () => void
  onDescer?: () => void
  /** Tirar a peça (o editor oferece o Desfazer). */
  onTirar?: () => void
  /** O id da seção (o papel do cartão leva até ela pelo `#`). */
  id?: string
  /**
   * A peça acabou de entrar pelo "Pôr peça": só ela anima a entrada. Abrir o editor com as peças
   * que já existem não anima nada (todas de uma vez seria movimento sem motivo).
   */
  nova?: boolean
  children: ReactNode
}

export function MolduraDaPeca({ entrada, aviso, onSubir, onDescer, onTirar, id, nova = false, children }: MolduraDaPecaProps) {
  const tituloId = useId()
  const avisoId = useId()
  const comAviso = aviso !== null && aviso !== undefined
  const pintar = useVariavelCss('--cor-peca', entrada.cor)
  return (
    <section ref={pintar} className="lb-pc" id={id} data-nova={nova ? '' : undefined} aria-labelledby={tituloId} aria-describedby={comAviso ? avisoId : undefined}>
      <div className="lb-pc__cab">
        <span className="lb-pc__med" aria-hidden="true">
          <Glifo nome={entrada.icone} />
        </span>
        <div className="lb-pc__nomes">
          <h3 className="lb-pc__tit" id={tituloId}>
            {entrada.nome}
          </h3>
          <p className="lb-pc__faz">{entrada.faz}</p>
        </div>
        <div className="lb-pc__acoes">
          {onSubir !== undefined || onDescer !== undefined ? (
            <>
              <BotaoDaMoldura rotulo={`Subir ${entrada.nome}`} icone="cima" onClick={onSubir} />
              <BotaoDaMoldura rotulo={`Descer ${entrada.nome}`} icone="baixo" onClick={onDescer} />
            </>
          ) : null}
          {onTirar !== undefined && <BotaoDaMoldura rotulo={`Tirar ${entrada.nome}`} icone="x" onClick={onTirar} />}
        </div>
      </div>
      {comAviso && (
        <p className="lb-pc__aviso" id={avisoId} role="note">
          <Glifo nome="aviso" />
          {aviso}
        </p>
      )}
      <div className="lb-pc__corpo">{children}</div>
    </section>
  )
}

function BotaoDaMoldura({ rotulo, icone, onClick }: { rotulo: string; icone: string; onClick: (() => void) | undefined }) {
  return (
    <button type="button" className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p lb-ed__bt--ic" aria-label={rotulo} title={rotulo} disabled={onClick === undefined} onClick={onClick}>
      <Glifo nome={icone} />
    </button>
  )
}

/**
 * Por que esta peça não roda com o jeito de usar de agora (a Ação do topo), em português simples, ou
 * `null`. A mesma regra que o leitor aplica (`motivoDasPecasComOUso`): mostrar na peça evita que o
 * mestre descubra só ao salvar.
 */
export function avisoDaPeca(peca: PecaDaMecanica, mecanica: Pick<MecanicaV1, 'uso' | 'limite' | 'alvo'>): string | null {
  const motivo = motivoDasPecasComOUso([peca], { uso: mecanica.uso, overload: mecanica.limite.overload === true })
  if (motivo !== null) return `${motivo.charAt(0).toLocaleUpperCase('pt-BR')}${motivo.slice(1)}: troque a Ação no topo.`
  return peca.tipo === 'status' ? avisoDoStatusNoDono(peca, mecanica) : null
}

/**
 * Decisão do rework (pendência da E4/E6, do Claude): no dono, numa técnica que mira outro, o "Muda atributo" vira UM
 * selo em quem usa (o motor guarda um só, `seloEmQuemUsa`); dois tempos diferentes dariam dois e a mecânica não salva
 * ("mais de um selo em quem usa"). O editor limita a um tempo e diz antes do Salvar. "Para sempre" não conta (é lembrete).
 */
function avisoDoStatusNoDono(peca: PecaDa<'status'>, mecanica: Pick<MecanicaV1, 'alvo'>): string | null {
  if (peca.quem !== 'si' || mecanica.alvo.quem === 'si') return null
  const tempos = new Set(peca.itens.filter((item) => item.dura !== 'permanente').map((item) => (item.dura === 'batalha' ? 'batalha' : `turnos:${item.turnos}`)))
  return tempos.size > 1 ? 'No dono, numa técnica que mira outro, todas as linhas precisam do mesmo tempo (a batalha guarda um selo só em quem usa): iguale os tempos para salvar.' : null
}
