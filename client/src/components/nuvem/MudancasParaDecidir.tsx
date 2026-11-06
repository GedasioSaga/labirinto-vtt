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

/**
 * As entradas que decidem juntas, na ordem da fila, como o sincronizador as
 * decide (`grupoDaDecisao`): o tudo-ou-nada (`atomico`, o mesmo `loteId`)
 * numa linha só, a op solta numa linha dela.
 */
function agruparDecisoes(paraDecidir: readonly EntradaDaFila[]): EntradaDaFila[][] {
  const grupos: EntradaDaFila[][] = []
  const porLote = new Map<string, EntradaDaFila[]>()
  for (const entrada of paraDecidir) {
    if (entrada.op.atomico !== true) {
      grupos.push([entrada])
      continue
    }
    const doLote = porLote.get(entrada.op.loteId)
    if (doLote !== undefined) {
      doLote.push(entrada)
      continue
    }
    const novo = [entrada]
    porLote.set(entrada.op.loteId, novo)
    grupos.push(novo)
  }
  return grupos
}

const ESCOLHAS_DO_GRUPO: Readonly<Record<EscolhaDaDecisao, string>> = {
  'ficar-com-a-do-outro': 'Ficar com a do outro em tudo',
  'usar-a-minha': 'Usar a sua em tudo',
  'desfazer-aqui': 'Desfazer tudo aqui',
  'guardar-como-nota': 'Guardar tudo como nota',
}

/** A troca ou o pagamento numa linha: o aviso da op que bateu, dizendo que a escolha vale para todas as mudanças dela. */
function montarAvisoDoGrupo(grupo: readonly EntradaDaFila[], porId: ReadonlyMap<string, Personagem>, sistema: SistemaDeRpg | undefined, agora: number): AvisoMontado | null {
  // A que bateu de fato (sem `porCausaDe`) explica o aviso; as outras foram recusadas junto com ela.
  const principal = grupo.find((entrada) => entrada.situacao.t !== 'conflito' || entrada.situacao.conflito.porCausaDe === undefined) ?? grupo.at(0)
  if (principal === undefined) return null
  const aviso = montarAviso(principal, porId.get(principal.op.fichaId), sistema, agora)
  if (aviso === null) return null
  const nomes = [...new Set(grupo.map((entrada) => porId.get(entrada.op.fichaId)?.nome ?? 'ficha fora desta pasta'))]
  const partes = grupo.map(({ op }) => {
    const ficha = porId.get(op.fichaId)
    return `${rotuloDoCaminho(op.caminho, ficha, sistema)} de ${ficha?.nome ?? 'ficha fora desta pasta'}: ${oQueAOpQueria(op)}`
  })
  return {
    props: {
      ...aviso.props,
      onde: nomes.join(', '),
      titulo: `Troca ou pagamento recusado inteiro. ${aviso.props.titulo}`,
      detalhe: `Estas ${grupo.length} mudanças iam juntas (${partes.join('; ')}): a escolha vale para todas, nunca para uma só. ${aviso.props.detalhe ?? ''}`.trim(),
    },
    escolhas: aviso.escolhas.map((escolha) => ({ ...escolha, rotulo: ESCOLHAS_DO_GRUPO[escolha.escolha] })),
  }
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
  // Uma linha por decisão: a troca inteira conta uma vez, como é decidida.
  const grupos = agruparDecisoes(campanha.paraDecidir)

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
        <span className="lby-cab__n">{grupos.length}</span>
      </div>
      <p className="lby-dica">Mudanças suas que o servidor não aceitou. A mesa não para: enquanto você não escolhe, a ficha no app fica com o seu valor.</p>
      <ul className="lby-decidir__lista">
        {grupos.map((grupo) => {
          const [primeira, ...resto] = grupo
          if (primeira === undefined) return null
          const aviso = resto.length === 0 ? montarAviso(primeira, porId.get(primeira.op.fichaId), sistema, agora) : montarAvisoDoGrupo(grupo, porId, sistema, agora)
          if (aviso === null) return null
          // Qualquer op do grupo serve: o sincronizador decide o tudo-ou-nada inteiro a partir dela.
          const { opId } = primeira.op
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
