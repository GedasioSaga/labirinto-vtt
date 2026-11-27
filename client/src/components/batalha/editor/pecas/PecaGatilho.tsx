import { AVISO_DO_GATILHO_MAX, EFEITOS_DO_GATILHO_MAX, TURNOS_DA_PECA_MAX, type EfeitoDoGatilho, type PecaGatilho as Gatilho } from '../../../../lib/batalha/mecanica/pecas'
import { Caixa, Campo, EscolherCondicao, Escolher, Frase, Numero, PorDaLista, Segmentos, Texto, TextoCurto, Tirar } from './controlesDaPeca'
import type { PropsDaPeca } from './registro'
import { EFEITOS_DO_GATILHO_NA_TELA, GATILHOS_NA_TELA, STATUS_DAS_PECAS, efeitoDoGatilhoNovo, semOItem, trocado, turnos } from './vocabulario'

/** A vida que fica no "em vez de cair" quando a caixa liga. */
const FICA_COM_DE_PARTIDA = 1

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
  }
}

/** O gatilho com o "quando" novo: o "fica com N de vida" só existe no "Ao cair" (o leitor recusa fora dele). */
function comQuando(peca: Gatilho, quando: Gatilho['quando']): Gatilho {
  const { ficaCom: _antes, ...sem } = peca
  return quando === 'aoCair' && peca.ficaCom !== undefined ? { ...peca, quando } : { ...sem, quando }
}

/**
 * DISPARA SOZINHA (mecânica 3; `corpoGatilho` do protótipo; só na passiva): quando algo acontece, faz até
 * 5 efeitos sem gastar ação. Sem "Pergunta antes de disparar", aplica na hora com Desfazer (D6); com ela,
 * é o "Ativar / Agora não" de hoje.
 */
export function PecaGatilho({ peca, aoMudar }: PropsDaPeca<'gatilho'>) {
  const { efeitos } = peca
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
        {peca.quando !== 'rodada' && (
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
      <Frase>
        <Caixa rotulo="Pergunta antes de disparar (Ativar ou Agora não), como as passivas da batalha hoje" marcado={peca.pergunta} onChange={(pergunta) => aoMudar({ ...peca, pergunta })} />
      </Frase>
      <Campo rotulo="Faz">
        <ul className="lb-pc__lista">
          {efeitos.map((efeito, indice) => (
            <li key={`${indice}-${efeito.tipo}`} className="lb-pc__item">
              <CorpoDoEfeito efeito={efeito} aoMudar={(novo) => aoMudar({ ...peca, efeitos: trocado(efeitos, indice, novo) })} />
              {efeitos.length > 1 && <Tirar rotulo="Tirar este efeito" onClick={() => aoMudar({ ...peca, efeitos: semOItem(efeitos, indice) })} />}
            </li>
          ))}
        </ul>
      </Campo>
      {efeitos.length < EFEITOS_DO_GATILHO_MAX && (
        <Frase>
          <PorDaLista rotulo="Efeito" opcoes={EFEITOS_DO_GATILHO_NA_TELA} onPor={(tipo) => aoMudar({ ...peca, efeitos: [...efeitos, efeitoDoGatilhoNovo(tipo)] })} />
        </Frase>
      )}
    </>
  )
}
