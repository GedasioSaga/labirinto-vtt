import type { PerguntaNaHora, RespostasDoPedido } from '../../lib/batalha/perguntaNaHora'
import { RESPOSTA_SIM } from '../../lib/batalha/requisitos/modelo'
import './requisitosNoMenu.css'

/**
 * REQUISITOS G (protótipo aprovado, telas 2 e 6): as perguntas dos requisitos NA HORA de usar ou de
 * evoluir, na ordem do avaliador: o "Um destes" (escolha um, rádio) e a caixa "Cumpriu?" (o
 * personalizado: quem usa marca; o registro diz "(declarou: ...)"). As respostas vão no campo
 * `respostas` do pedido, nas chaves `req.*`; o host confere de novo.
 */

/** A caixa "Cumpriu?" (J1) é a pergunta com o "Sim, cumpri"; o resto é o "Um destes". */
export function ehACaixa(pergunta: PerguntaNaHora): boolean {
  return pergunta.tipo === 'opcoes' && pergunta.opcoes.some((opcao) => opcao.valor === RESPOSTA_SIM)
}

/** O que ainda falta responder (o motivo para o botão); tudo respondido = `null`. */
export function faltaResponder(perguntas: readonly PerguntaNaHora[], respostas: RespostasDoPedido): string | null {
  for (const pergunta of perguntas) {
    const resposta = respostas[pergunta.chave]
    if (ehACaixa(pergunta)) {
      if (resposta !== RESPOSTA_SIM) return 'Marque a caixa "Cumpriu?": sem cumprir, não dá para usar'
    } else if (resposta === undefined) return 'Escolha um dos requisitos do "Um destes"'
  }
  return null
}

/** Só as respostas das perguntas de agora (a de uma opção que deixou de valer não vai: o host a recusaria). */
export function respostasDeAgora(perguntas: readonly PerguntaNaHora[], respostas: RespostasDoPedido): RespostasDoPedido {
  const ficam: Record<string, string | number> = {}
  for (const pergunta of perguntas) {
    const resposta = respostas[pergunta.chave]
    if (resposta !== undefined) ficam[pergunta.chave] = resposta
  }
  return ficam
}

export interface PerguntasDosRequisitosProps {
  idBase: string
  /** O nome da técnica (a nota da caixa). */
  nome: string
  perguntas: readonly PerguntaNaHora[]
  respostas: RespostasDoPedido
  onResponder: (chave: string, valor: string) => void
}

export function PerguntasDosRequisitos({ idBase, nome, perguntas, respostas, onResponder }: PerguntasDosRequisitosProps) {
  if (perguntas.length === 0) return null
  return (
    <>
      {perguntas.map((pergunta) => {
        if (pergunta.tipo !== 'opcoes') return null
        const idDaPergunta = `${idBase}-req-${pergunta.chave}`
        if (ehACaixa(pergunta)) {
          const marcada = respostas[pergunta.chave] === RESPOSTA_SIM
          return (
            <section key={pergunta.chave} className="bt-cumpriu" aria-labelledby={`${idDaPergunta}-tit`}>
              <h3 className="bt-cumpriu__tit" id={`${idDaPergunta}-tit`}>
                Cumpriu?
              </h3>
              <p className="bt-cumpriu__nota">{nome} pede algo que o app não confere sozinho.</p>
              <label className="bt-cumpriu__marca">
                <input type="checkbox" checked={marcada} onChange={(evento) => onResponder(pergunta.chave, evento.target.checked ? RESPOSTA_SIM : 'nao')} />
                <span>{pergunta.texto}</span>
              </label>
              <p className="bt-cumpriu__nota">O registro anota que você declarou; o mestre pode desfazer pela linha.</p>
            </section>
          )
        }
        return (
          <fieldset key={pergunta.chave} className="bt-umdestes">
            <legend>Um destes: escolha um</legend>
            {pergunta.opcoes.map((opcao) => (
              <label key={opcao.valor} className="bt-umdestes__op">
                <input type="radio" name={idDaPergunta} checked={respostas[pergunta.chave] === opcao.valor} onChange={() => onResponder(pergunta.chave, opcao.valor)} />
                <span>{opcao.rotulo}</span>
              </label>
            ))}
          </fieldset>
        )
      })}
    </>
  )
}
