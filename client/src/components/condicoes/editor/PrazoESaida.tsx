import type { ContextoDasFrases } from '../../../lib/condicoes/frasesDaCondicao'
import { quemApaga } from '../../../lib/condicoes/frasesDaCondicao'
import {
  CD_MAX,
  CD_MIN,
  PAGA_MAX,
  PILHAS_MAX,
  PILHAS_MIN,
  SAIDAS_DA_CONDICAO_MAX,
  TETO_DE_PILHAS_PADRAO,
  TURNOS_DO_PRAZO_MAX,
  TURNOS_PADRAO_DA_CONDICAO,
  type CondicaoMontada,
  type PrazoDaCondicao,
  type SaidaDaCondicao,
  type TipoDaSaida,
} from '../../../lib/condicoes/modelo'
import { Campo, Escolher, Frase, Nota, Numero, PorDaLista, Segmentos, Texto, Tirar } from '../../batalha/editor/pecas/controlesDaPeca'
import { PastilhaDeCondicao } from '../../PastilhaDeCondicao'
import type { AtributoDaPeca } from './registro'
import './pecas/estilo'
import {
  ATRIBUTO_DO_PAGAR_DE_PARTIDA,
  ATRIBUTOS_DA_FICHA,
  CD_DE_PARTIDA,
  COMO_SE_PAGA_NA_TELA,
  DE_NOVO_NA_TELA,
  MODOS_NA_TELA,
  O_QUE_SE_PAGA_NA_TELA,
  opcoesDosAtributos,
  PAGA_DE_PARTIDA,
  SAIDAS_NA_TELA,
  saidaNova,
  simboloDaFabricaPeloId,
  tiposDeDanoNaTela,
  turnos,
  type OpcaoDaCondicao,
} from './pecas/vocabulario'

type SaidaPagando = Extract<SaidaDaCondicao, { tipo: 'pagar' }>

/** O tamanho da pastilha na linha de quem apaga (o `pastilha(o, 22)` do protótipo). */
const PASTILHA_NA_LINHA = 20
/** As saídas que não têm o que mudar entre uma e outra: uma basta, a segunda seria a mesma regra duas vezes. */
const SAIDAS_UNICAS: readonly TipoDaSaida[] = ['cura', 'agir']
const TIPOS_DA_SAIDA_POR_DANO = tiposDeDanoNaTela('de')

/** O nome curto da saída, para o rótulo do "×" ("Tirar a saída Ao receber cura"). */
function nomeDaSaida(tipo: TipoDaSaida): string {
  return SAIDAS_NA_TELA.find((opcao) => opcao.valor === tipo)?.rotulo ?? tipo
}

/**
 * O "pagar e/ou teste" com outro jeito: o que o jeito novo usa e não estava gravado volta ao de partida
 * (o leitor recusa um "pagar" sem o quanto, ou um "teste" sem atributo e CD); o resto fica como estava,
 * para o número voltar quando o mestre volta ao jeito de antes.
 */
function comComo(saida: SaidaPagando, como: SaidaPagando['como']): SaidaPagando {
  return {
    ...saida,
    como,
    v: saida.v ?? PAGA_DE_PARTIDA,
    atr: saida.atr ?? ATRIBUTO_DO_PAGAR_DE_PARTIDA,
    cd: saida.cd ?? CD_DE_PARTIDA,
  }
}

interface LinhaDaSaidaProps {
  saida: SaidaDaCondicao
  atributos: readonly OpcaoDaCondicao<string>[]
  aoMudar: (saida: SaidaDaCondicao) => void
}

/** O corpo de uma saída, na frase do protótipo (`linhaSaida`). */
function CorpoDaSaida({ saida, atributos, aoMudar }: LinhaDaSaidaProps) {
  switch (saida.tipo) {
    case 'teste':
      return (
        <>
          <Texto forte>Teste por turno</Texto>
          <Texto>no fim da vez:</Texto>
          <Escolher rotulo="Atributo do teste" valor={saida.atr} opcoes={atributos} onChange={(atr) => aoMudar({ ...saida, atr })} />
          <Texto>CD</Texto>
          <Numero rotulo="CD" valor={saida.cd} minimo={CD_MIN} maximo={CD_MAX} onChange={(cd) => aoMudar({ ...saida, cd })} />
        </>
      )
    case 'pagar':
      return <CorpoDoPagar saida={saida} atributos={atributos} aoMudar={aoMudar} />
    case 'cura':
      return (
        <>
          <Texto forte>Ao receber cura</Texto>
          <Texto>qualquer cura tira a condição</Texto>
        </>
      )
    case 'dano':
      return (
        <>
          <Texto forte>Ao tomar dano</Texto>
          <Escolher rotulo="De que tipo" valor={saida.dano} opcoes={TIPOS_DA_SAIDA_POR_DANO} onChange={(dano) => aoMudar({ ...saida, dano })} />
        </>
      )
    case 'agir':
      return <Texto forte>Ao atacar ou usar técnica</Texto>
  }
}

/** "Na vez dele, tenta sair": só pagar, só o teste, pagar E o teste, ou pagar OU o teste. */
function CorpoDoPagar({ saida, atributos, aoMudar }: { saida: SaidaPagando; atributos: readonly OpcaoDaCondicao<string>[]; aoMudar: (saida: SaidaDaCondicao) => void }) {
  const paga = saida.como !== 'teste'
  const testa = saida.como !== 'pagar'
  return (
    <>
      <Texto forte>Na vez dele, tenta sair</Texto>
      <Segmentos rotulo="Pagar e ou teste" valor={saida.como} opcoes={COMO_SE_PAGA_NA_TELA} onChange={(como) => aoMudar(comComo(saida, como))} />
      <span className="lb-cd-quebra" aria-hidden="true" />
      {paga && (
        <>
          <Texto>paga</Texto>
          {saida.paga !== 'acao' && (
            <Numero rotulo="Quanto paga" valor={saida.v ?? PAGA_DE_PARTIDA} minimo={1} maximo={PAGA_MAX} onChange={(v) => aoMudar({ ...saida, v })} />
          )}
          <Escolher rotulo="Com o quê" valor={saida.paga} opcoes={O_QUE_SE_PAGA_NA_TELA} onChange={(com) => aoMudar({ ...saida, paga: com, v: saida.v ?? PAGA_DE_PARTIDA })} />
        </>
      )}
      {paga && testa && <Texto>{saida.como === 'e' ? 'e passa num' : 'ou passa num'}</Texto>}
      {testa && (
        <>
          <Texto>teste de</Texto>
          <Escolher rotulo="Atributo do teste" valor={saida.atr ?? ATRIBUTO_DO_PAGAR_DE_PARTIDA} opcoes={atributos} onChange={(atr) => aoMudar({ ...saida, atr })} />
          <Texto>CD</Texto>
          <Numero rotulo="CD" valor={saida.cd ?? CD_DE_PARTIDA} minimo={CD_MIN} maximo={CD_MAX} onChange={(cd) => aoMudar({ ...saida, cd })} />
        </>
      )}
    </>
  )
}

export interface PrazoESaidaProps {
  /** A condição montada (com os padrões): o prazo e as saídas que se editam, e o id para achar quem a apaga. */
  condicao: CondicaoMontada
  aoMudarPrazo: (prazo: PrazoDaCondicao) => void
  aoMudarSaidas: (saidas: SaidaDaCondicao[]) => void
  /** O catálogo em volta: quem apaga esta (as linhas tracejadas, só de leitura). */
  contexto: ContextoDasFrases
  /** Os atributos dos testes de saída (o sistema da mesa); sem eles, os 8 da ficha. */
  atributos?: readonly AtributoDaPeca[]
  /** A pastilha das que apagam esta; sem ela, só as de fábrica têm pastilha. */
  pastilhaDe?: typeof simboloDaFabricaPeloId
  /** O "Ver X" da linha de quem apaga: abre aquela condição. Sem ele, a linha não tem o botão. */
  aoVerCondicao?: (id: string) => void
}

/**
 * PRAZO, PILHAS E SAÍDA (`blocoPrazo` do protótipo), a seção fixa de toda condição: quanto dura, o que
 * acontece se ganhar de novo (o prazo recomeça, soma uma pilha até o teto, ou nada muda) e os jeitos de
 * sair antes (basta um). Quem apaga esta pela Contra-condição aparece aqui como linha tracejada: a regra
 * mora na outra (D: uma coisa, um lugar), e o "Ver" leva até ela.
 *
 * Os turnos e o teto ficam gravados mesmo fora do modo deles (`PrazoDaCondicao`): o número volta quando
 * o mestre volta ao modo.
 */
export function PrazoESaida({ condicao, aoMudarPrazo, aoMudarSaidas, contexto, atributos = ATRIBUTOS_DA_FICHA, pastilhaDe = simboloDaFabricaPeloId, aoVerCondicao }: PrazoESaidaProps) {
  const { prazo, saidas } = condicao
  const opcoesDoTeste = opcoesDosAtributos(atributos)
  const derivadas = quemApaga(condicao, contexto)
  const nTurnos = prazo.n ?? TURNOS_PADRAO_DA_CONDICAO
  const teto = prazo.teto ?? TETO_DE_PILHAS_PADRAO
  const podePor = SAIDAS_NA_TELA.filter((opcao) => !SAIDAS_UNICAS.includes(opcao.valor) || !saidas.some((saida) => saida.tipo === opcao.valor))

  const mudarSaida = (indice: number, saida: SaidaDaCondicao) => aoMudarSaidas(saidas.map((outra, i) => (i === indice ? saida : outra)))
  const tirarSaida = (indice: number) => aoMudarSaidas(saidas.filter((_, i) => i !== indice))

  return (
    <div className="lb-cd-prazo">
      <Frase>
        <Texto forte>Dura</Texto>
        <Segmentos rotulo="Quanto dura" valor={prazo.modo} opcoes={MODOS_NA_TELA} onChange={(modo) => aoMudarPrazo({ ...prazo, modo })} />
        {prazo.modo === 'turnos' && (
          <>
            <Numero rotulo="Turnos" valor={nTurnos} minimo={1} maximo={TURNOS_DO_PRAZO_MAX} onChange={(n) => aoMudarPrazo({ ...prazo, n })} />
            <Texto>{turnos(nTurnos)}</Texto>
          </>
        )}
      </Frase>

      <Frase>
        <Texto forte>Se ganhar de novo</Texto>
        <Segmentos rotulo="Se ganhar de novo" valor={prazo.deNovo} opcoes={DE_NOVO_NA_TELA} onChange={(deNovo) => aoMudarPrazo({ ...prazo, deNovo })} />
        {prazo.deNovo === 'pilha' && (
          <>
            <Texto>até</Texto>
            <Numero rotulo="Teto de pilhas" valor={teto} minimo={PILHAS_MIN} maximo={PILHAS_MAX} onChange={(n) => aoMudarPrazo({ ...prazo, teto: n })} />
            <Texto>pilhas</Texto>
          </>
        )}
      </Frase>
      {prazo.deNovo === 'pilha' && <Nota>Cada pilha soma de novo os números do Efeito na vez e do Muda atributo. As % de Dano e cura não acumulam.</Nota>}

      <Campo rotulo="Sai antes, se (basta uma)">
        {saidas.length > 0 || derivadas.length > 0 ? (
          <ul className="lb-pc__lista">
            {saidas.map((saida, indice) => (
              // A posição é a identidade da saída: duas do mesmo tipo (dano de Fogo e de Gelo) são linhas diferentes.
              <li key={indice} className="lb-pc__item">
                <CorpoDaSaida saida={saida} atributos={opcoesDoTeste} aoMudar={(nova) => mudarSaida(indice, nova)} />
                <Tirar rotulo={`Tirar a saída ${nomeDaSaida(saida.tipo)}`} onClick={() => tirarSaida(indice)} />
              </li>
            ))}
            {derivadas.map((outra) => {
              const simbolo = pastilhaDe(outra.id)
              return (
                <li key={outra.id} className="lb-pc__item lb-cd-lido">
                  {simbolo === null ? <span className="lb-cd-chip__sem" aria-hidden="true" /> : <PastilhaDeCondicao symbol={simbolo} tamanho={PASTILHA_NA_LINHA} />}
                  <Texto>
                    {/* "de", não "da": serve a todo nome (o Molhado, a Bênção), como a frase do cartão (`quemApaga`). */}
                    Sai se ganhar <b>{outra.nome}</b>: está na Contra-condição de {outra.nome}.
                  </Texto>
                  {aoVerCondicao !== undefined && (
                    <button type="button" className="lb-ed__bt lb-ed__bt--p" onClick={() => aoVerCondicao(outra.id)}>
                      Ver {outra.nome}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <Nota>Nenhuma: sai só pelo prazo.</Nota>
        )}
        {saidas.length < SAIDAS_DA_CONDICAO_MAX ? (
          <PorDaLista rotulo="Saída" opcoes={podePor} onPor={(tipo) => aoMudarSaidas([...saidas, saidaNova(tipo)])} />
        ) : (
          <Nota>{`No máximo ${SAIDAS_DA_CONDICAO_MAX} jeitos de sair.`}</Nota>
        )}
      </Campo>
    </div>
  )
}
