import { CD_DO_ANULA_MAX, CD_DO_ANULA_MIN, SP_DO_ANULA_MAX, VEZES_DO_ANULA_MAX, type PorDoAnula } from '../../../../lib/batalha/anulaODano'
import { pedidoDaMarca } from '../../../../lib/batalha/comoMarca'
import { AVISO_DO_GATILHO_MAX, EFEITOS_DO_GATILHO_MAX, GATILHO_ANTES_DO_DANO, PECA_DE_PARTIDA, TURNOS_DA_PECA_MAX, type EfeitoDoGatilho, type PecaGatilho as Gatilho } from '../../../../lib/batalha/mecanica/pecas'
import { Caixa, Campo, EscolherCondicao, Escolher, Frase, Nota, Numero, PorDaLista, Segmentos, Texto, TextoCurto, Tirar } from './controlesDaPeca'
import { EscolherCorteDoAnula } from './CorteDoAnula'
import { EscolherExcecao, NotaDaExcecao } from './ExcecaoDoGolpe'
import { PagaETesta } from './PagaETesta'
import type { PropsDaPeca } from './registro'
import { EFEITOS_DO_MAIS_NA_TELA, GATILHOS_NA_TELA, ROTULO_DO_ANULA, STATUS_DAS_PECAS, efeitoDoGatilhoNovo, semOItem, trocado, turnos, vezes, type OpcaoDaPeca } from './vocabulario'

/** A vida que fica no "em vez de cair" quando a caixa liga. */
const FICA_COM_DE_PARTIDA = 1

type EfeitoDoAnula = Extract<EfeitoDoGatilho, { tipo: 'anula' }>

const LIMITES_DO_ANULA: readonly OpcaoDaPeca<PorDoAnula>[] = [
  { valor: 'sempre', rotulo: 'toda vez' },
  { valor: 'rodada', rotulo: 'por rodada' },
  { valor: 'batalha', rotulo: 'por batalha' },
]
const ROTULOS_DO_ANULA = { paga: 'SP para anular', como: 'Paga e/ou testa para anular', teste: 'Teste para anular' }

/**
 * ANULA O DANO (pedido de 27/11/2026, "Intangível"): toma 0 do golpe, sozinho, a não ser que o golpe tenha a
 * exceção; com limite por rodada ou por batalha e o mesmo "paga e/ou testa" da Marca (aqui com CD, porque a
 * batalha rola o teste sozinha). A regra é a do motor (`lib/batalha/anulacaoNoGolpe.ts`).
 */
function CorpoDoAnula({ efeito, aoMudar }: { efeito: EfeitoDoAnula; aoMudar: (efeito: EfeitoDoGatilho) => void }) {
  const { exceto, ...semExcecao } = efeito
  const { corte: _corte, ...semCorte } = efeito
  const pedido = pedidoDaMarca(efeito.paga, efeito.teste, efeito.como)
  return (
    <>
      <Frase>
        <Texto forte>{ROTULO_DO_ANULA}</Texto>
        <EscolherExcecao exceto={exceto} aoMudar={(nova) => aoMudar(nova === undefined ? semExcecao : { ...semExcecao, exceto: nova })} />
      </Frase>
      <NotaDaExcecao exceto={exceto} />
      {/* Pedido de 28/11/2026: anular tudo ou só uma parte (−N de dano ou −X%). */}
      <EscolherCorteDoAnula corte={efeito.corte} aoMudar={(corte) => aoMudar(corte === undefined ? semCorte : { ...semCorte, corte })} />
      <Frase sub>
        <Texto>Limite:</Texto>
        <Segmentos rotulo="Limite do anula" valor={efeito.por} opcoes={LIMITES_DO_ANULA} onChange={(por) => aoMudar({ ...efeito, por })} />
        {efeito.por !== 'sempre' && (
          <>
            <Texto>até</Texto>
            <Numero rotulo="Quantas vezes anula" valor={efeito.vezes} minimo={1} maximo={VEZES_DO_ANULA_MAX} onChange={(n) => aoMudar({ ...efeito, vezes: n })} />
            <Texto>{vezes(efeito.vezes)}</Texto>
          </>
        )}
      </Frase>
      <PagaETesta
        comeco="Para anular, paga"
        rotulos={ROTULOS_DO_ANULA}
        paga={efeito.paga}
        pagaMax={SP_DO_ANULA_MAX}
        teste={efeito.teste}
        como={efeito.como}
        cd={{ valor: efeito.cd, minimo: CD_DO_ANULA_MIN, maximo: CD_DO_ANULA_MAX, rotulo: 'CD para anular', aoMudar: (cd) => aoMudar({ ...efeito, cd }) }}
        aoPagar={(paga) => aoMudar({ ...efeito, paga })}
        aoTestar={(teste) => aoMudar({ ...efeito, teste })}
        aoEscolherComo={(como) => aoMudar({ ...efeito, como })}
      />
      {pedido === 'ou' && <Nota>Na hora, quem tem o SP paga; quem não tem rola o teste.</Nota>}
      {pedido !== 'nada' && <Nota>O SP só sai quando anula; se não passa, o golpe entra normal e o registro diz por quê.</Nota>}
    </>
  )
}

function CorpoDoEfeito({ efeito, aoMudar }: { efeito: EfeitoDoGatilho; aoMudar: (efeito: EfeitoDoGatilho) => void }) {
  switch (efeito.tipo) {
    case 'atributo':
      return (
        <>
          <Texto>Sobe</Texto>
          <Escolher rotulo="Atributo" valor={efeito.atributo} opcoes={STATUS_DAS_PECAS} onChange={(atributo) => aoMudar({ ...efeito, atributo })} />
          <Numero rotulo="Quanto sobe" valor={efeito.valor} minimo={-200} maximo={200} semZero onChange={(valor) => aoMudar({ ...efeito, valor })} />
          <Texto>por</Texto>
          <Numero rotulo="Por quantos turnos" valor={efeito.turnos} minimo={1} maximo={TURNOS_DA_PECA_MAX} onChange={(n) => aoMudar({ ...efeito, turnos: n })} />
          <Texto>{turnos(efeito.turnos)}</Texto>
        </>
      )
    case 'recuperar':
      return (
        <>
          <Texto>Recupera</Texto>
          <Numero rotulo="Quanto recupera" valor={efeito.valor} minimo={1} maximo={500} onChange={(valor) => aoMudar({ ...efeito, valor })} />
          <Texto>de</Texto>
          <Escolher
            rotulo="Vida ou SP"
            valor={efeito.recurso}
            opcoes={[
              { valor: 'hp', rotulo: 'Vida' },
              { valor: 'sp', rotulo: 'SP' },
            ]}
            onChange={(recurso) => aoMudar({ ...efeito, recurso })}
          />
          <Texto>por turno, durante</Texto>
          <Numero rotulo="Durante quantos turnos" valor={efeito.turnos} minimo={1} maximo={TURNOS_DA_PECA_MAX} onChange={(n) => aoMudar({ ...efeito, turnos: n })} />
          <Texto>{turnos(efeito.turnos)}</Texto>
        </>
      )
    case 'escudo':
      return (
        <>
          <Texto>Ganha</Texto>
          <Numero rotulo="Quanto de Escudo" valor={efeito.valor} minimo={1} maximo={500} onChange={(valor) => aoMudar({ ...efeito, valor })} />
          <Texto>de Escudo</Texto>
        </>
      )
    case 'condSi':
    case 'condAlvo':
      return (
        <>
          <Texto>{efeito.tipo === 'condSi' ? 'O dono fica' : 'O alvo fica'}</Texto>
          <EscolherCondicao
            rotulo={efeito.tipo === 'condSi' ? 'Condição no dono' : 'Condição no alvo'}
            valor={efeito.condicao}
            nenhuma={false}
            onChange={(condicao) => {
              if (condicao !== undefined) aoMudar({ ...efeito, condicao })
            }}
          />
        </>
      )
    case 'aviso':
      return (
        <>
          <Texto>Avisa o mestre:</Texto>
          <TextoCurto rotulo="Texto do aviso" valor={efeito.texto} maximo={AVISO_DO_GATILHO_MAX} placeholder="O que o mestre precisa saber" largo onChange={(texto) => aoMudar({ ...efeito, texto })} />
        </>
      )
    case 'anula':
      return <CorpoDoAnula efeito={efeito} aoMudar={aoMudar} />
  }
}

/**
 * O gatilho com o "quando" novo: o "fica com N de vida" só existe no "Ao cair", e o "Ao ser atingido (antes do
 * dano)" leva só o "Anula o dano", sem pergunta e sem o "uma vez por batalha" do gatilho (o limite é do efeito);
 * ao sair dele, o "Anula o dano" sai também (o leitor recusa os dois fora do lugar).
 */
function comQuando(peca: Gatilho, quando: Gatilho['quando']): Gatilho {
  const { ficaCom: _antes, ...sem } = peca
  if (quando === GATILHO_ANTES_DO_DANO) {
    const anula = peca.efeitos.find((efeito) => efeito.tipo === 'anula') ?? efeitoDoGatilhoNovo('anula')
    return { ...sem, quando, vezes: 'sempre', pergunta: false, efeitos: [anula] }
  }
  const outros = peca.efeitos.filter((efeito) => efeito.tipo !== 'anula')
  const efeitos = outros.length > 0 ? outros : PECA_DE_PARTIDA.gatilho.efeitos
  return quando === 'aoCair' && peca.ficaCom !== undefined ? { ...peca, quando, efeitos } : { ...sem, quando, efeitos }
}

/**
 * DISPARA SOZINHA (mecânica 3; `corpoGatilho` do protótipo; só na passiva): quando algo acontece, faz até
 * 5 efeitos sem gastar ação. Sem "Pergunta antes de disparar", aplica na hora com Desfazer (D6); com ela,
 * é o "Ativar / Agora não" de hoje.
 */
export function PecaGatilho({ peca, aoMudar }: PropsDaPeca<'gatilho'>) {
  const { efeitos } = peca
  const antesDoDano = peca.quando === GATILHO_ANTES_DO_DANO
  const mudarEfeito = (indice: number, novo: EfeitoDoGatilho): void => aoMudar({ ...peca, efeitos: trocado(efeitos, indice, novo) })
  return (
    <>
      <Frase>
        <Texto forte>Quando</Texto>
        <Escolher rotulo="Quando dispara" valor={peca.quando} opcoes={GATILHOS_NA_TELA} onChange={(quando) => aoMudar(comQuando(peca, quando))} />
        {peca.quando === 'rodada' && <Numero rotulo="Qual rodada" valor={peca.n} minimo={1} maximo={30} onChange={(n) => aoMudar({ ...peca, n })} />}
        {peca.quando === 'vidaAbaixo' && (
          <>
            <Numero rotulo="Porcentagem da vida" valor={peca.n} minimo={1} maximo={99} onChange={(n) => aoMudar({ ...peca, n })} />
            <Texto>%</Texto>
          </>
        )}
        {peca.quando !== 'rodada' && !antesDoDano && (
          <Segmentos
            rotulo="Quantas vezes"
            valor={peca.vezes}
            opcoes={[
              { valor: 'sempre', rotulo: 'toda vez' },
              { valor: 'umaPorBatalha', rotulo: 'uma vez por batalha' },
            ]}
            onChange={(vezes) => aoMudar({ ...peca, vezes })}
          />
        )}
      </Frase>
      {peca.quando === 'aoCair' && (
        <Frase sub>
          <Caixa
            rotulo="em vez de cair, fica com"
            marcado={peca.ficaCom !== undefined}
            onChange={(marcado) => {
              const { ficaCom: _antes, ...sem } = peca
              aoMudar(marcado ? { ...sem, ficaCom: FICA_COM_DE_PARTIDA } : sem)
            }}
          />
          {peca.ficaCom !== undefined && (
            <>
              <Numero rotulo="Vida que fica" valor={peca.ficaCom} minimo={1} maximo={9999} onChange={(ficaCom) => aoMudar({ ...peca, ficaCom })} />
              <Texto>de vida</Texto>
            </>
          )}
        </Frase>
      )}
      {antesDoDano ? (
        <>
          <Nota>Automático: dispara sozinho dentro do golpe, antes do dano entrar na ficha (não pergunta).</Nota>
          <div className="lb-pc__bloco">
            {efeitos.map((efeito, indice) => (
              <CorpoDoEfeito key={`${indice}-${efeito.tipo}`} efeito={efeito} aoMudar={(novo) => mudarEfeito(indice, novo)} />
            ))}
          </div>
        </>
      ) : (
        <>
          <Frase>
            <Caixa rotulo="Pergunta antes de disparar (Ativar ou Agora não), como as passivas da batalha hoje" marcado={peca.pergunta} onChange={(pergunta) => aoMudar({ ...peca, pergunta })} />
          </Frase>
          <Campo rotulo="Faz">
            <ul className="lb-pc__lista">
              {efeitos.map((efeito, indice) => (
                <li key={`${indice}-${efeito.tipo}`} className="lb-pc__item">
                  <CorpoDoEfeito efeito={efeito} aoMudar={(novo) => mudarEfeito(indice, novo)} />
                  {efeitos.length > 1 && <Tirar rotulo="Tirar este efeito" onClick={() => aoMudar({ ...peca, efeitos: semOItem(efeitos, indice) })} />}
                </li>
              ))}
            </ul>
          </Campo>
          {efeitos.length < EFEITOS_DO_GATILHO_MAX && (
            <Frase>
              <PorDaLista rotulo="Efeito" opcoes={EFEITOS_DO_MAIS_NA_TELA} onPor={(tipo) => aoMudar({ ...peca, efeitos: [...efeitos, efeitoDoGatilhoNovo(tipo)] })} />
            </Frase>
          )}
        </>
      )}
    </>
  )
}
