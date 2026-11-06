import { useState } from 'react'
import type { EntradaDaFila } from '../../lib/nuvem/fila'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { decidirNoLobby } from '../../net/nuvem/nuvemNoApp'
import type { EscolhaDaDecisao } from '../../net/nuvem/sincronizador'
import type { CampanhaNoApp } from '../../stores/nuvemStore'
import { AvisoDeConflito, type AvisoDeConflitoProps } from './AvisoDeConflito'
import { haQuanto, oQueAOpQueria, rotuloDoCaminho, textoDoMotivo, tituloDoConflito, valorEmTexto } from './textosDoLobby'

/**
 * "MUDANÇAS PARA DECIDIR" no app (docs/planos/lobby-jogadores-2026-11-05.md
 * §5.2 e §5.6, fatia A6): cada mudança do mestre que o servidor não aceitou
 * fica aqui, guardada na `fila.jsonl`, até ele escolher. Nada some sozinho.
 */

const classeDoBotao = (principal: boolean): string => (principal ? 'lb-btn lb-btn--primary lb-btn--compact' : 'lb-btn lb-btn--ghost lb-btn--compact')

interface AvisoMontado {
  props: Omit<AvisoDeConflitoProps, 'ocupado' | 'erro' | 'classeDoBotao' | 'escolhas'>
  escolhas: { rotulo: string; escolha: EscolhaDaDecisao; principal?: boolean }[]
}

function montarAviso(entrada: EntradaDaFila, ficha: Personagem | undefined, sistema: SistemaDeRpg | undefined, agora: number): AvisoMontado | null {
  const { op, situacao } = entrada
  const onde = ficha?.nome ?? 'Ficha que não está mais nesta pasta'
  const campo = rotuloDoCaminho(op.caminho, ficha, sistema)
  if (situacao.t === 'conflito') {
    const { conflito } = situacao
    const doOutro = conflito.fichaApagada === true ? 'Deixar apagada' : `Ficar com ${valorEmTexto(conflito.valorAtual)}`
    return {
      props: {
        tom: 'conflito',
        onde,
        titulo: tituloDoConflito(conflito, op, campo),
        detalhe: 'Ficar com a do outro não manda nada ao servidor. Usar a sua grava por cima, e fica no histórico.',
        quando: haQuanto(conflito.quando, agora),
      },
      escolhas: [
        { rotulo: doOutro, escolha: 'ficar-com-a-do-outro', principal: true },
        { rotulo: op.acao === 'somar' ? `Somar ${oQueAOpQueria(op)} mesmo assim` : `Usar ${oQueAOpQueria(op)}`, escolha: 'usar-a-minha' },
      ],
    }
  }
  if (situacao.t === 'negado') {
    return {
      props: {
        tom: 'negado',
        onde,
        titulo: `${campo}: o servidor não aceitou ${oQueAOpQueria(op)}, porque ${textoDoMotivo(situacao.motivo, situacao.detalhe)}.`,
        detalhe: 'Desfazer aqui volta o campo ao valor do servidor. Guardar como nota tira o aviso e guarda a mudança num arquivo à parte, sem apagar.',
        quando: haQuanto(op.quandoCliente, agora),
      },
      escolhas: [
        { rotulo: 'Desfazer aqui', escolha: 'desfazer-aqui', principal: true },
        { rotulo: 'Guardar como nota', escolha: 'guardar-como-nota' },
      ],
    }
  }
  return null
}

export interface MudancasParaDecidirProps {
  campanha: CampanhaNoApp
  /** As fichas da pasta, para dar nome à ficha e ao campo. */
  fichas: readonly Personagem[]
  sistema: SistemaDeRpg | undefined
}

export function MudancasParaDecidir({ campanha, fichas, sistema }: MudancasParaDecidirProps) {
  const [ocupada, setOcupada] = useState<string | null>(null)
  const [erros, setErros] = useState<Readonly<Record<string, string>>>({})
  if (campanha.paraDecidir.length === 0) return null
  const agora = Date.now()
  const porId = new Map(fichas.map((ficha): [string, Personagem] => [ficha.id, ficha]))

  const decidir = async (opId: string, escolha: EscolhaDaDecisao) => {
    setOcupada(opId)
    setErros(({ [opId]: _antigo, ...resto }) => resto)
    try {
      const resultado = await decidirNoLobby(campanha.campanhaId, opId, escolha)
      if (!resultado.ok) setErros((antes) => ({ ...antes, [opId]: resultado.problemas.map((problema) => problema.detalhe).join(' ') || 'A escolha não foi gravada.' }))
    } catch (erro) {
      setErros((antes) => ({ ...antes, [opId]: erro instanceof Error ? erro.message : String(erro) }))
    } finally {
      setOcupada(null)
    }
  }

  return (
    <section className="lby-decidir" aria-labelledby={`decidir-${campanha.campanhaId}`}>
      <div className="lby-cab">
        <h4 className="lby-cab__t" id={`decidir-${campanha.campanhaId}`}>
          Mudanças para decidir
        </h4>
        <span className="lby-cab__n">{campanha.paraDecidir.length}</span>
      </div>
      <p className="lby-dica">Mudanças suas que o servidor não aceitou. A mesa não para: enquanto você não escolhe, a ficha no app fica com o seu valor.</p>
      <ul className="lby-decidir__lista">
        {campanha.paraDecidir.map((entrada) => {
          const aviso = montarAviso(entrada, porId.get(entrada.op.fichaId), sistema, agora)
          if (aviso === null) return null
          const { opId } = entrada.op
          return (
            <li key={opId}>
              <AvisoDeConflito
                {...aviso.props}
                escolhas={aviso.escolhas.map((escolha) => ({ rotulo: escolha.rotulo, principal: escolha.principal, onEscolher: () => void decidir(opId, escolha.escolha) }))}
                ocupado={ocupada === opId}
                erro={erros[opId] ?? null}
                classeDoBotao={classeDoBotao}
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
