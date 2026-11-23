import { useMemo } from 'react'
import { avaliarDoCartao, ETIQUETA_DA_PERGUNTA } from '../../../../lib/batalha/requisitos/avaliar'
import { frasesDosRequisitos } from '../../../../lib/batalha/requisitos/frases'
import { lerRequisitos } from '../../../../lib/batalha/requisitos/ler'
import type { ValorJson } from '../../../../lib/batalha/requisitos/modelo'
import type { Personagem } from '../../../../lib/personagem'
import { blocoParaLer, contextoDaFicha } from '../requisitosDoCartao'

interface ResumoDosRequisitosProps {
  todos: readonly ValorJson[]
  qual: 'usar' | 'evoluir'
  /** O nome que a frase usa ("Para usar CAÇA AS BRUXAS!"; na evolução, a versão que vira). */
  nome: string
  personagem: Personagem
  /** O custo normal em SP: o "e gasta" do SP precisa dele além deste. */
  custoEmSp: number
}

/**
 * "Em palavras" e o "Falta:" ao vivo (protótipo dos requisitos, tela 1, `resumoHTML`): a frase do
 * bloco (`frasesDosRequisitos`) e o que o menu da batalha mostraria com a ficha de agora
 * (`avaliarDoCartao`, o avaliador da B1). Uma fonte só: a mesma frase do menu, do host e do registro.
 */
export function ResumoDosRequisitos({ todos, qual, nome, personagem, custoEmSp }: ResumoDosRequisitosProps) {
  const lidos = useMemo(() => lerRequisitos(blocoParaLer(todos, qual)), [todos, qual])
  const contexto = useMemo(() => contextoDaFicha(personagem, custoEmSp), [personagem, custoEmSp])
  const avaliacao = useMemo(() => avaliarDoCartao(lidos, qual, contexto), [lidos, qual, contexto])
  const linhas = lidos.bloco === null ? [] : frasesDosRequisitos(lidos.bloco).flatMap((secao) => secao.linhas.filter((linha) => !linha.startsWith('Evoluída')))
  const quem = nome.trim() || 'esta técnica'
  if (linhas.length === 0) return null
  const comeco = qual === 'evoluir' ? `Para evoluir para ${quem}, precisa` : `Para usar ${quem}, precisa`
  const veredito =
    avaliacao === null || avaliacao.veredito === 'cumpre'
      ? qual === 'evoluir'
        ? 'Pode evoluir com a ficha de agora.'
        : 'Liberada com a ficha de agora.'
      : avaliacao.veredito === 'falta'
        ? (avaliacao.motivo ?? 'Falta algum requisito.')
        : `Na hora de usar: ${[...new Set(avaliacao.perguntas.map((pergunta) => ETIQUETA_DA_PERGUNTA[pergunta.tipo]))].join(', ')}.`
  return (
    <div className="lb-req__resumo" aria-live="polite">
      <p className="lb-req__resumo-tit">Em palavras</p>
      <p className="lb-req__resumo-frase">
        {comeco}: {linhas.join('; ')}.
        {qual === 'evoluir' && ` Vale até usar ${quem} uma vez; depois volta à comum.`}
      </p>
      <p className="lb-req__resumo-lin">
        <span>{qual === 'evoluir' ? 'O botão Evoluir, com a ficha de agora:' : 'No menu da batalha, com a ficha de agora:'}</span>
        <span data-falta={avaliacao?.veredito === 'falta' ? '' : undefined}>{veredito}</span>
      </p>
      {avaliacao?.naoSei === true && <p className="lb-ed__dica">Parte só se sabe na batalha (o alvo, os aliados, o que já aconteceu na vez): lá o mestre confere.</p>}
    </div>
  )
}
