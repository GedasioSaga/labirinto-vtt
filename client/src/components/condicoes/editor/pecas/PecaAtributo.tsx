import { A_PARTIR_DO_TURNO_MAX, A_PARTIR_DO_TURNO_PADRAO, PORCENTO_MAX, VALOR_DO_ATRIBUTO_MAX, type PecaDaCondicaoDa } from '../../../../lib/condicoes/modelo'
import { Caixa, Escolher, Frase, Nota, Numero, Segmentos, Texto } from '../../../batalha/editor/pecas/controlesDaPeca'
import type { PropsDaPecaDaCondicao } from '../registro'
import './estilo'
import { ATRIBUTOS_DO_STATUS, CONTA_DO_ATRIBUTO_NA_TELA, FAZ_DO_ATRIBUTO_NA_TELA, opcoesDosAtributos, RITMOS_NA_TELA } from './vocabulario'

type PecaDoAtributo = PecaDaCondicaoDa<'atributo'>

/** O teto que a caixa "Com teto" sugere ao ligar (`pecaNova` do protótipo). */
const TETO_DE_PARTIDA = 30
/** O "a partir do turno" começa no 2: no 1 seria o "a cada turno". */
const A_PARTIR_DO_TURNO_MIN = 2

const tetoDoValor = (conta: PecaDoAtributo['conta']): number => (conta === 'pct' ? PORCENTO_MAX : VALOR_DO_ATRIBUTO_MAX)
/** Só "perde" e "ganha" têm conta e ritmo: "fica em" e "no máximo" prendem o número enquanto durar. */
const muda = (faz: PecaDoAtributo['faz']): boolean => faz === 'tira' || faz === 'soma'

/**
 * A peça com um campo novo, já limpa: o "fica em" e o "no máximo" voltam a pontos e de uma vez (a conta e o
 * ritmo não valem neles); o "a partir do turno" só fica no ritmo dele; o teto só fica com ritmo; os
 * números cabem no teto da conta (100 em %).
 */
function ajustada(peca: PecaDoAtributo): PecaDoAtributo {
  const { aPartirN, tetoN, ...resto } = peca
  const prende = !muda(peca.faz)
  const conta = prende ? 'fixo' : peca.conta
  const ritmo = prende ? 'umaVez' : peca.ritmo
  const teto = tetoDoValor(conta)
  return {
    ...resto,
    conta,
    ritmo,
    v: Math.min(peca.v, teto),
    ...(ritmo === 'aPartir' && aPartirN !== undefined ? { aPartirN } : {}),
    ...(ritmo !== 'umaVez' && tetoN !== undefined ? { tetoN: Math.min(tetoN, teto) } : {}),
  }
}

/**
 * MUDA ATRIBUTO (`corpoAtributo` do protótipo): perde, ganha, fica em ou fica no máximo em N de um
 * atributo; perdendo ou ganhando, em pontos ou em % do valor, de uma vez, a cada turno somando, ou a partir
 * do turno N; com ritmo, pode ter teto do total.
 */
export function PecaAtributo({ peca, aoMudar, atributos }: PropsDaPecaDaCondicao<'atributo'>) {
  const mudar = (campos: Partial<PecaDoAtributo>) => aoMudar(ajustada({ ...peca, ...campos }))
  const comRitmo = muda(peca.faz)
  const porcento = peca.conta === 'pct'
  return (
    <>
      <Frase>
        <Escolher rotulo="Atributo" valor={peca.atr} opcoes={opcoesDosAtributos(atributos ?? ATRIBUTOS_DO_STATUS)} onChange={(atr) => mudar({ atr })} />
        <Escolher rotulo="Como muda" valor={peca.faz} opcoes={FAZ_DO_ATRIBUTO_NA_TELA} onChange={(faz) => mudar({ faz })} />
        <Numero rotulo="Quanto" valor={peca.v} minimo={0} maximo={tetoDoValor(peca.conta)} onChange={(v) => mudar({ v })} />
        {comRitmo ? <Escolher rotulo="Pontos ou %" valor={peca.conta} opcoes={CONTA_DO_ATRIBUTO_NA_TELA} onChange={(conta) => mudar({ conta })} /> : <Texto>enquanto durar</Texto>}
      </Frase>
      {comRitmo && (
        <Frase>
          <Texto forte>Quando</Texto>
          <Segmentos rotulo="Quando muda" valor={peca.ritmo} opcoes={RITMOS_NA_TELA} onChange={(ritmo) => mudar({ ritmo })} />
          {peca.ritmo === 'aPartir' && (
            <>
              <Numero
                rotulo="A partir do turno"
                valor={peca.aPartirN ?? A_PARTIR_DO_TURNO_PADRAO}
                minimo={A_PARTIR_DO_TURNO_MIN}
                maximo={A_PARTIR_DO_TURNO_MAX}
                onChange={(aPartirN) => mudar({ aPartirN })}
              />
              <Texto>, a cada turno</Texto>
            </>
          )}
        </Frase>
      )}
      {comRitmo && peca.ritmo !== 'umaVez' && (
        <Frase sub>
          <Caixa rotulo="Com teto" marcado={peca.tetoN !== undefined} onChange={(ligado) => mudar({ tetoN: ligado ? TETO_DE_PARTIDA : undefined })} />
          {peca.tetoN !== undefined ? (
            <>
              <Texto>no máximo</Texto>
              <Numero rotulo="Teto do total" valor={peca.tetoN} minimo={1} maximo={tetoDoValor(peca.conta)} onChange={(tetoN) => mudar({ tetoN })} />
              <Texto>{porcento ? '% no total' : 'pontos no total'}</Texto>
            </>
          ) : (
            <Nota>sem teto, soma até a condição sair</Nota>
          )}
        </Frase>
      )}
    </>
  )
}
