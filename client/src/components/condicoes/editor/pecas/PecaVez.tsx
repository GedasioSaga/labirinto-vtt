import { PORCENTO_MAX, VALOR_DA_VEZ_MAX, type PecaDaCondicaoDa } from '../../../../lib/condicoes/modelo'
import { Caixa, Escolher, Frase, Numero, Segmentos } from '../../../batalha/editor/pecas/controlesDaPeca'
import type { PropsDaPecaDaCondicao } from '../registro'
import './estilo'
import { CONTA_DA_VEZ_NA_TELA, FAZ_DA_VEZ_NA_TELA, QUANDO_NA_TELA, RECURSOS_NA_TELA } from './vocabulario'

type PecaDaVez = PecaDaCondicaoDa<'vez'>

/** O teto do número: o fixo vai até 999; a % até 100 (o leitor recusa acima). */
const tetoDoValor = (conta: PecaDaVez['conta']): number => (conta === 'fixo' ? VALOR_DA_VEZ_MAX : PORCENTO_MAX)

/** "Direto na vida" só vale quando tira vida; "quem pôs ganha o mesmo" só quando tira vida ou SP. */
const valeODireto = (peca: Pick<PecaDaVez, 'faz' | 'recurso'>): boolean => peca.faz === 'tira' && peca.recurso === 'vida'
const valeORouba = (peca: Pick<PecaDaVez, 'faz' | 'recurso'>): boolean => peca.faz === 'tira' && peca.recurso !== 'escudo'

/**
 * A peça com um campo novo, já limpa: o número cabe no teto da conta, e a marca que deixou de valer (o
 * "direto" ao trocar a vida pelo SP, o "rouba" ao trocar o tira pelo dá) sai, em vez de ficar escondida
 * mudando a regra sem ninguém ver.
 */
function ajustada(peca: PecaDaVez): PecaDaVez {
  const { direto, rouba, ...resto } = peca
  return {
    ...resto,
    v: Math.min(peca.v, tetoDoValor(peca.conta)),
    ...(direto === true && valeODireto(peca) ? { direto } : {}),
    ...(rouba === true && valeORouba(peca) ? { rouba } : {}),
  }
}

/**
 * EFEITO NA VEZ (`corpoVez` do protótipo): ao entrar, no começo ou no fim de cada vez de quem tem, tira ou
 * dá um tanto de vida, SP ou Escudo, fixo ou em % da máxima ou da atual. Tirando vida, pode passar do
 * Escudo; tirando vida ou SP, quem pôs a condição pode ganhar o mesmo.
 */
export function PecaVez({ peca, aoMudar }: PropsDaPecaDaCondicao<'vez'>) {
  const mudar = (campos: Partial<PecaDaVez>) => aoMudar(ajustada({ ...peca, ...campos }))
  const comDireto = valeODireto(peca)
  const comRouba = valeORouba(peca)
  return (
    <>
      <Frase>
        <Escolher rotulo="Quando" valor={peca.quando} opcoes={QUANDO_NA_TELA} onChange={(quando) => mudar({ quando })} />
        <Segmentos rotulo="Tira ou dá" valor={peca.faz} opcoes={FAZ_DA_VEZ_NA_TELA} onChange={(faz) => mudar({ faz })} />
        <Numero rotulo="Quanto" valor={peca.v} minimo={0} maximo={tetoDoValor(peca.conta)} onChange={(v) => mudar({ v })} />
        <Escolher rotulo="Como conta" valor={peca.conta} opcoes={CONTA_DA_VEZ_NA_TELA} onChange={(conta) => mudar({ conta })} />
        <Escolher rotulo="O quê" valor={peca.recurso} opcoes={RECURSOS_NA_TELA} onChange={(recurso) => mudar({ recurso })} />
      </Frase>
      {(comDireto || comRouba) && (
        <Frase sub>
          {comDireto && <Caixa rotulo="Direto na vida (passa do Escudo)" marcado={peca.direto === true} onChange={(ligado) => mudar({ direto: ligado ? true : undefined })} />}
          {comRouba && <Caixa rotulo="Quem pôs a condição ganha o mesmo" marcado={peca.rouba === true} onChange={(ligado) => mudar({ rouba: ligado ? true : undefined })} />}
        </Frase>
      )}
    </>
  )
}
