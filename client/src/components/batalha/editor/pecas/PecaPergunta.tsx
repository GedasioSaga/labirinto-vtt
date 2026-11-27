import type { TipoQueBate } from '../../../../lib/batalha/mecanica/modelo'
import { NOME_CURTO_MAX, PERGUNTAS_MAX, RESPOSTAS_POR_PERGUNTA_MAX, RESPOSTAS_POR_PERGUNTA_MIN, TEXTO_DA_PERGUNTA_MAX, type PerguntaDaPeca, type RespostaDaPeca } from '../../../../lib/batalha/mecanica/pecas'
import { Campo, EscolherCondicao, Escolher, Frase, Mais, Nota, Numero, Segmentos, Texto, TextoCurto, Tirar } from './controlesDaPeca'
import type { PropsDaPeca } from './registro'
import { BATIDAS_NA_TELA, nomeLivre, semOItem, trocado, type OpcaoDaPeca } from './vocabulario'

/** "o golpe já bate" = a resposta não troca o tipo (o `bate` fica ausente). */
const BATE_COMO_JA_BATE = 'mesmo'
const OPCOES_DE_BATIDA: readonly OpcaoDaPeca<TipoQueBate | typeof BATE_COMO_JA_BATE>[] = [{ valor: BATE_COMO_JA_BATE, rotulo: 'o golpe já bate' }, ...BATIDAS_NA_TELA]

function respostaNova(usados: readonly string[]): RespostaDaPeca {
  return { nome: nomeLivre('Resposta', usados), dano: 0, perfuracao: 0 }
}

/** O nome não pode repetir na mesma pergunta (o leitor recusa): o repetido fica só na tela. */
function nomeRepetido(respostas: readonly RespostaDaPeca[], indice: number, nome: string): boolean {
  const chave = nome.trim().toLocaleLowerCase('pt-BR')
  return respostas.some((outra, atual) => atual !== indice && outra.nome.trim().toLocaleLowerCase('pt-BR') === chave)
}

function LinhaDaResposta({ resposta, respostas, indice, podeTirar, aoMudar, aoTirar }: { resposta: RespostaDaPeca; respostas: readonly RespostaDaPeca[]; indice: number; podeTirar: boolean; aoMudar: (resposta: RespostaDaPeca) => void; aoTirar: () => void }) {
  const nome = resposta.nome
  return (
    <li className="lb-pc__item">
      <TextoCurto
        rotulo={`Nome da resposta ${indice + 1}`}
        valor={nome}
        maximo={NOME_CURTO_MAX}
        placeholder="Resposta"
        onChange={(novo) => {
          if (!nomeRepetido(respostas, indice, novo)) aoMudar({ ...resposta, nome: novo })
        }}
      />
      <Texto>bate como</Texto>
      <Escolher
        rotulo={`Tipo do golpe na resposta ${nome}`}
        valor={resposta.bate ?? BATE_COMO_JA_BATE}
        opcoes={OPCOES_DE_BATIDA}
        onChange={(bate) => {
          const { bate: _antes, ...sem } = resposta
          aoMudar(bate === BATE_COMO_JA_BATE ? sem : { ...sem, bate })
        }}
      />
      <Texto>dano</Texto>
      <Numero rotulo={`Dano a mais na resposta ${nome}`} valor={resposta.dano} minimo={-200} maximo={200} onChange={(dano) => aoMudar({ ...resposta, dano })} />
      <Texto>deixa</Texto>
      <EscolherCondicao
        rotulo={`Condição na resposta ${nome}`}
        valor={resposta.condicao}
        nenhuma
        onChange={(condicao) => {
          const { condicao: _antes, ...sem } = resposta
          aoMudar(condicao === undefined ? sem : { ...sem, condicao })
        }}
      />
      <Texto>passa do Escudo</Texto>
      <Numero rotulo={`Porcentagem que passa do Escudo na resposta ${nome}`} valor={resposta.perfuracao} minimo={0} maximo={100} onChange={(perfuracao) => aoMudar({ ...resposta, perfuracao })} />
      <Texto>%</Texto>
      {podeTirar && <Tirar rotulo={`Tirar a resposta ${nome}`} onClick={aoTirar} />}
    </li>
  )
}

function BlocoDaPergunta({ pergunta, indice, sozinha, aoMudar, aoTirar }: { pergunta: PerguntaDaPeca; indice: number; sozinha: boolean; aoMudar: (pergunta: PerguntaDaPeca) => void; aoTirar: () => void }) {
  const { respostas } = pergunta
  return (
    <div className="lb-pc__bloco">
      <Frase>
        <Texto forte>{sozinha ? 'Pergunta' : `Pergunta ${indice + 1}`}</Texto>
        <TextoCurto rotulo={`Texto da pergunta ${indice + 1}`} valor={pergunta.texto} maximo={TEXTO_DA_PERGUNTA_MAX} placeholder="Como o golpe bate?" largo onChange={(texto) => aoMudar({ ...pergunta, texto })} />
        {!sozinha && <Tirar rotulo={`Tirar a pergunta ${indice + 1}`} onClick={aoTirar} />}
      </Frase>
      <ul className="lb-pc__lista">
        {respostas.map((resposta, posicao) => (
          <LinhaDaResposta
            // A posição é a identidade: a resposta não tem id no disco, e a ordem só muda por tirar.
            key={posicao}
            resposta={resposta}
            respostas={respostas}
            indice={posicao}
            podeTirar={respostas.length > RESPOSTAS_POR_PERGUNTA_MIN}
            aoMudar={(nova) => aoMudar({ ...pergunta, respostas: trocado(respostas, posicao, nova) })}
            aoTirar={() => aoMudar({ ...pergunta, respostas: semOItem(respostas, posicao) })}
          />
        ))}
      </ul>
      <div>
        {respostas.length < RESPOSTAS_POR_PERGUNTA_MAX ? (
          <Mais onClick={() => aoMudar({ ...pergunta, respostas: [...respostas, respostaNova(respostas.map((r) => r.nome))] })}>Resposta</Mais>
        ) : (
          <Nota>Até {RESPOSTAS_POR_PERGUNTA_MAX} respostas por pergunta.</Nota>
        )}
      </div>
    </div>
  )
}

/**
 * PERGUNTA NA HORA (mecânica 1; `corpoPergunta` do protótipo): até 3 perguntas, de 2 a 6 respostas cada;
 * cada resposta troca como o golpe bate, soma dano, deixa uma condição e diz quanto passa do Escudo.
 * O NPC responde a primeira, ou o mestre responde (decisão 8).
 */
export function PecaPergunta({ peca, aoMudar }: PropsDaPeca<'pergunta'>) {
  const { perguntas } = peca
  return (
    <>
      {perguntas.map((pergunta, indice) => (
        <BlocoDaPergunta
          key={indice}
          pergunta={pergunta}
          indice={indice}
          sozinha={perguntas.length === 1}
          aoMudar={(nova) => aoMudar({ ...peca, perguntas: trocado(perguntas, indice, nova) })}
          aoTirar={() => aoMudar({ ...peca, perguntas: semOItem(perguntas, indice) })}
        />
      ))}
      {perguntas.length < PERGUNTAS_MAX && (
        <Frase>
          <Mais fantasma onClick={() => aoMudar({ ...peca, perguntas: [...perguntas, { texto: 'Qual?', respostas: [respostaNova([]), respostaNova(['Resposta 1'])] }] })}>
            Outra pergunta
          </Mais>
        </Frase>
      )}
      <Campo rotulo="Quando um NPC usa">
        <Segmentos
          rotulo="Quando um NPC usa"
          valor={peca.npc}
          opcoes={[
            { valor: 'mestre', rotulo: 'o mestre responde' },
            { valor: 'primeira', rotulo: 'vale a primeira resposta' },
          ]}
          onChange={(npc) => aoMudar({ ...peca, npc })}
        />
      </Campo>
    </>
  )
}
