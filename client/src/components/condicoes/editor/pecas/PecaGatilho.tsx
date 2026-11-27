import type { PecaDaCondicaoDa } from '../../../../lib/condicoes/modelo'
import type { DuracaoDaPeca, PecaDoGatilho } from '../../../../lib/itens/modelo'
import { NUMERO_DO_ITEM_MAX, PECAS_DO_GATILHO_MAX, TURNOS_DO_GATILHO_MAX } from '../../../../lib/itens/pecasDoItem'
import { Escolher, Frase, Nota, Numero, PorDaLista, Segmentos, Texto, Tirar } from '../../../batalha/editor/pecas/controlesDaPeca'
import type { PropsDaPecaDaCondicao } from '../registro'
import './estilo'
import { AO_DISPARAR_NA_TELA, EFEITOS_DO_GATILHO_NA_TELA, efeitoDoGatilhoNovo, outrasDoContexto, turnos, type OpcaoDaCondicao } from './vocabulario'

type GatilhoDaPeca = PecaDaCondicaoDa<'gatilho'>['gatilho']

/**
 * Os prazos do "Põe condição". O leitor do gatilho (`gatilhoLido`, lib/itens/pecasDoItem.ts) ainda aceita só
 * 1 a 3 turnos ou o fim da batalha: um prazo maior deixaria a peça torta e a condição perderia as peças na
 * próxima leitura. Quando o leitor for até 10 (`DURACAO_DA_PECA_MAX`), é só pôr as linhas aqui.
 */
type TextoDaDuracao = '1' | '2' | '3' | 'fim'
const DURACOES: readonly (OpcaoDaCondicao<TextoDaDuracao> & { duracao: DuracaoDaPeca })[] = [
  { valor: '1', rotulo: 'por 1 turno', duracao: 1 },
  { valor: '2', rotulo: 'por 2 turnos', duracao: 2 },
  { valor: '3', rotulo: 'por 3 turnos', duracao: 3 },
  { valor: 'fim', rotulo: 'até o fim da batalha', duracao: 'fim' },
]
const textoDaDuracao = (duracao: DuracaoDaPeca): string => DURACOES.find((opcao) => opcao.duracao === duracao)?.valor ?? String(duracao)

/** O "Tira condição" sem nome: as negativas (a frase diz "perde as condições negativas"). */
const AS_NEGATIVAS = ''

interface EfeitoProps {
  efeito: PecaDoGatilho
  nomes: readonly string[]
  aoMudar: (efeito: PecaDoGatilho) => void
}

/** Os campos de um efeito, depois do "o que faz". */
function CamposDoEfeito({ efeito, nomes, aoMudar }: EfeitoProps) {
  const condicoes = nomes.map((nome): OpcaoDaCondicao<string> => ({ valor: nome, rotulo: nome }))
  switch (efeito.tipo) {
    case 'dano':
      return (
        <>
          <Numero rotulo="Dano" valor={efeito.valor} minimo={1} maximo={NUMERO_DO_ITEM_MAX} onChange={(valor) => aoMudar({ ...efeito, valor })} />
          <Texto>de dano</Texto>
        </>
      )
    case 'curar':
      return (
        <>
          <Numero rotulo="Cura" valor={efeito.fixo} minimo={1} maximo={NUMERO_DO_ITEM_MAX} onChange={(fixo) => aoMudar({ ...efeito, fixo })} />
          <Texto>de vida</Texto>
        </>
      )
    case 'condicao':
      return (
        <>
          <Escolher rotulo="Qual condição" valor={efeito.nome} opcoes={condicoes} onChange={(nome) => aoMudar({ ...efeito, nome })} />
          <Escolher
            rotulo="Por quanto tempo"
            valor={textoDaDuracao(efeito.duracao)}
            opcoes={DURACOES}
            onChange={(texto) => {
              const duracao = DURACOES.find((opcao) => opcao.valor === texto)?.duracao
              if (duracao !== undefined) aoMudar({ ...efeito, duracao })
            }}
          />
        </>
      )
    case 'tirar':
      return (
        <Escolher
          rotulo="Qual condição tira"
          valor={efeito.nome ?? AS_NEGATIVAS}
          opcoes={[{ valor: AS_NEGATIVAS, rotulo: 'as condições negativas' }, ...condicoes]}
          onChange={(nome) => aoMudar({ tipo: 'tirar', nome: nome === AS_NEGATIVAS ? null : nome })}
        />
      )
  }
}

/** "Uma vez" some e "a cada X" continua: o padrão do dono (pedido de 26/11), que dá para trocar logo ao lado. */
function comVezes(gatilho: GatilhoDaPeca, vezes: GatilhoDaPeca['vezes']): GatilhoDaPeca {
  return { ...gatilho, vezes, aoDisparar: vezes === 'cada' ? 'continua' : 'some' }
}

/**
 * DEPOIS DE X TURNOS (`corpoGatilho` do protótipo; o gatilho da 0.6.4, igual): conta os turnos de quem
 * está com ela e, ao chegar, dá dano, cura, põe ou tira condição, uma vez ou a cada X; ao disparar, esta
 * condição some ou continua. Os efeitos guardam o NOME da condição (como o gatilho de antes). O gatilho
 * tem sempre ao menos um efeito: sem nenhum, o leitor o recusa (para tirar o último, tire a peça).
 */
export function PecaGatilho({ peca, condicao, contexto, aoMudar }: PropsDaPecaDaCondicao<'gatilho'>) {
  const { gatilho } = peca
  const mudar = (novo: GatilhoDaPeca) => aoMudar({ ...peca, gatilho: novo })
  const nomes = outrasDoContexto(contexto, condicao.id).map((outra) => outra.nome)
  const mudarEfeito = (indice: number, efeito: PecaDoGatilho) => mudar({ ...gatilho, pecas: gatilho.pecas.map((atual, i) => (i === indice ? efeito : atual)) })
  const tirarEfeito = (indice: number) => mudar({ ...gatilho, pecas: gatilho.pecas.filter((_, i) => i !== indice) })
  const umSo = gatilho.pecas.length <= 1
  return (
    <>
      <Frase>
        <Texto forte>Depois de</Texto>
        <Numero rotulo="Turnos até disparar" valor={gatilho.turnos} minimo={1} maximo={TURNOS_DO_GATILHO_MAX} onChange={(n) => mudar({ ...gatilho, turnos: n })} />
        <Texto>{`${turnos(gatilho.turnos)} com ela,`}</Texto>
        <Segmentos
          rotulo="Quantas vezes"
          valor={gatilho.vezes}
          opcoes={[
            { valor: 'uma', rotulo: 'uma vez' },
            { valor: 'cada', rotulo: `a cada ${gatilho.turnos} ${turnos(gatilho.turnos)}` },
          ]}
          onChange={(vezes) => mudar(comVezes(gatilho, vezes))}
        />
      </Frase>
      <ul className="lb-pc__lista">
        {gatilho.pecas.map((efeito, indice) => (
          <li key={indice} className="lb-pc__item">
            <Escolher rotulo="O que faz" valor={efeito.tipo} opcoes={EFEITOS_DO_GATILHO_NA_TELA} onChange={(tipo) => mudarEfeito(indice, efeitoDoGatilhoNovo(tipo, nomes))} />
            <CamposDoEfeito efeito={efeito} nomes={nomes} aoMudar={(novo) => mudarEfeito(indice, novo)} />
            {!umSo && <Tirar rotulo="Tirar o efeito" onClick={() => tirarEfeito(indice)} />}
          </li>
        ))}
      </ul>
      {gatilho.pecas.length < PECAS_DO_GATILHO_MAX ? (
        <Frase>
          <PorDaLista rotulo="Efeito" opcoes={EFEITOS_DO_GATILHO_NA_TELA} onPor={(tipo) => mudar({ ...gatilho, pecas: [...gatilho.pecas, efeitoDoGatilhoNovo(tipo, nomes)] })} />
        </Frase>
      ) : (
        <Nota>{`No máximo ${PECAS_DO_GATILHO_MAX} efeitos num gatilho.`}</Nota>
      )}
      <Frase>
        <Texto forte>Ao disparar</Texto>
        <Segmentos rotulo="Ao disparar" valor={gatilho.aoDisparar} opcoes={AO_DISPARAR_NA_TELA} onChange={(aoDisparar) => mudar({ ...gatilho, aoDisparar })} />
      </Frase>
    </>
  )
}
