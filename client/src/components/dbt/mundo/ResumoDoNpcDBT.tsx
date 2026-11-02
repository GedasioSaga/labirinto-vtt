import { useMemo } from 'react'
import { IDS_DOS_ATRIBUTOS, type EfeitoDaFaixaDBT, type FaixaDeDanoDBT } from '../../../lib/dbt/modelo'
import { comSinal, modificadorDoAtributo, SIGLA_DO_ATRIBUTO, valorDoAtributo } from '../../../lib/dbt/regras/atributos'
import { montarTecnica, type TabelaDeRanksDBT } from '../../../lib/dbt/regras/tecnicas'
import type { Personagem } from '../../../lib/personagem'
import { formatarNumero } from '../../livros/comum'
import { derivadosDoPersonagem, fichaDe, ROTULOS_DO_LIVRO } from './contasDoMundo'

/**
 * O resumo da ficha Dragon Ball que o bestiário e a prévia do NPC pronto
 * mostram: PV, PK, CA, EP e deslocamento (com a conta no "title"), os sete
 * atributos e as técnicas com Ki e faixa. Só leitura: editar é na ficha.
 */

const NOME_DO_EFEITO: Readonly<Record<EfeitoDaFaixaDBT, string>> = { dano: 'dano', mitigacao: 'mitigação', cura: 'cura', ca: 'CA' }

export function faixaEscrita(faixa: FaixaDeDanoDBT): string {
  return `${formatarNumero(faixa.minimo)}-${formatarNumero(faixa.medio)}-${formatarNumero(faixa.completo)}`
}

export interface ResumoDoNpcDBTProps {
  personagem: Personagem
  ranks: TabelaDeRanksDBT
  /** Cabeçalho das seções (h3 no bestiário, h4 na prévia do diálogo). */
  nivel?: 'h3' | 'h4'
}

export function ResumoDoNpcDBT({ personagem, ranks, nivel = 'h4' }: ResumoDoNpcDBTProps) {
  const ficha = fichaDe(personagem)
  const derivados = useMemo(() => derivadosDoPersonagem(personagem, ficha, ranks), [personagem, ficha, ranks])
  const tecnicas = useMemo(
    () => ficha.tecnicas.map((tecnica) => ({ tecnica, montada: montarTecnica(tecnica, { rank: ranks[tecnica.rank], rotulos: ROTULOS_DO_LIVRO }) })),
    [ficha, ranks],
  )
  const Titulo = nivel
  const ep = derivados.epBonus === 0 ? formatarNumero(derivados.epTotal.valor) : `${formatarNumero(derivados.epBase.valor)}+${formatarNumero(derivados.epBonus)}`
  const numeros = [
    { rotulo: 'PV', valor: formatarNumero(derivados.pvMax.valor), formula: derivados.pvMax.formula },
    { rotulo: 'PK', valor: formatarNumero(derivados.pkMax.valor), formula: derivados.pkMax.formula },
    { rotulo: 'CA', valor: formatarNumero(derivados.ca.valor), formula: derivados.ca.formula },
    { rotulo: 'EP', valor: ep, formula: derivados.epTotal.formula },
    { rotulo: 'Desl.', valor: `${formatarNumero(derivados.deslocamento.valor)} m`, formula: derivados.deslocamento.formula },
  ]
  const passivas = ficha.npc?.passivas ?? []

  return (
    <>
      <dl className="dbm-numeros">
        {numeros.map((numero) => (
          <div key={numero.rotulo} className="dbm-num" title={numero.formula}>
            <dt>{numero.rotulo}</dt>
            <dd>{numero.valor}</dd>
          </div>
        ))}
      </dl>
      <dl className="dbm-atrs" aria-label="Atributos">
        {IDS_DOS_ATRIBUTOS.map((id) => (
          <div key={id} className="dbm-atr">
            <dt>{SIGLA_DO_ATRIBUTO[id]}</dt>
            <dd>{valorDoAtributo(personagem.atributos, id)}</dd>
            <small>{comSinal(modificadorDoAtributo(personagem.atributos, id))}</small>
          </div>
        ))}
      </dl>
      <div>
        <Titulo className="mu-bes-bloco__tit">Técnicas</Titulo>
        {tecnicas.length === 0 ? (
          <p className="mu-pg-nota">Nenhuma técnica ainda. Monte na ficha.</p>
        ) : (
          <ul className="dbm-tecs dbm-previa__tecs">
            {tecnicas.map(({ tecnica, montada }) => (
              <li key={tecnica.id} className="dbm-tec">
                <span className="dbm-tec__nome">{tecnica.nome}</span>
                <span className="dbm-tec__meta">
                  Rank {tecnica.rank} · Ki {formatarNumero(montada.ki)}
                  {montada.faixa.completo > 0 && (
                    <>
                      {' · '}
                      <span className="dbm-tec__faixa">
                        {NOME_DO_EFEITO[tecnica.efeitoDaFaixa]} {faixaEscrita(montada.faixa)}
                      </span>
                    </>
                  )}
                  {tecnica.alcance.trim().length > 0 && ` · ${tecnica.alcance.trim()}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {(passivas.length > 0 || ficha.transformacoes.length > 0) && (
        <div>
          <Titulo className="mu-bes-bloco__tit">Passivas e transformações</Titulo>
          <ul className="dbm-avisos">
            {passivas.map((passiva) => (
              <li key={passiva.id} title={passiva.efeito}>
                {passiva.nome}
              </li>
            ))}
            {ficha.transformacoes.map((forma) => (
              <li key={forma.id} title={forma.efeitos}>
                {forma.nome} · EP +{formatarNumero(forma.ep)} · Ki {formatarNumero(forma.custoKi)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
