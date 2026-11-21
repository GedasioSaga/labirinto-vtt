import { ATRIBUTOS_DA_REACAO_MAX, CD_MAX, LIMITE_MAX, type ReacaoDaMecanica } from '../../../lib/batalha/mecanica/modelo'
import { fraseDoLimite, frasesDaReacao, type FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import { Bloco, CampoInteiro, Escolha, Marcar, type BlocosProps, type Opcao } from './controles'

/** Os blocos 8 e 9 da mecânica: a reação (quando a técnica vai no lugar dela) e os limites. */

type TipoDaDefesa = ReacaoDaMecanica['defesa']['tipo']

const DEFESAS: readonly Opcao<TipoDaDefesa>[] = [
  { valor: 'anula', rotulo: 'Anula' },
  { valor: 'fica', rotulo: 'Fica com %' },
  { valor: 'rola', rotulo: 'Rola o d20' },
  { valor: 'nenhuma', rotulo: 'Toma inteiro' },
]

/** Quanto volta em quem atacou: o divisor do dano que ficou ('0' = nada). */
type Devolve = '0' | '1' | '2' | '3'

const DEVOLVES: readonly Opcao<Devolve>[] = [
  { valor: '0', rotulo: 'Nada' },
  { valor: '2', rotulo: 'Metade' },
  { valor: '3', rotulo: 'Um terço' },
  { valor: '1', rotulo: 'Tudo' },
]

/** O total do d20 que anula, de partida (o do Aparar, H20). */
const ANULA_DE_PARTIDA = 15
/** A parte do dano que fica, de partida (o Bloqueio, H19). */
const PORCENTO_DE_PARTIDA = 50

function defesaNova(tipo: TipoDaDefesa, ficha: FichaDaPrevia): ReacaoDaMecanica['defesa'] {
  if (tipo === 'fica') return { tipo, porcento: PORCENTO_DE_PARTIDA }
  if (tipo !== 'rola') return { tipo }
  const primeiro = ficha.sistema.atributos.at(0)
  return { tipo, atributos: primeiro === undefined ? [] : [primeiro.id], anulaCom: ANULA_DE_PARTIDA }
}

/** O divisor gravado (1 a 3, `DEVOLVE_DIVIDIDO_MAX`) como a opção da tela. */
function devolveDoDivisor(divisor: number): Devolve {
  if (divisor === 1) return '1'
  return divisor === 3 ? '3' : '2'
}

export function BlocoDaReacao({ mecanica, ficha, onChange }: Pick<BlocosProps, 'mecanica' | 'ficha' | 'onChange'>) {
  const { reacao } = mecanica
  if (reacao === undefined) return null
  const { defesa } = reacao
  const trocar = (nova: ReacaoDaMecanica) => onChange({ ...mecanica, reacao: nova })
  const rola = defesa.tipo === 'rola'
  const soNoDado = rola ? 'Na reação que rola o dado, o d20 decide: anula ou toma inteiro.' : null
  const contra = reacao.valeContra ?? []
  const trocarContra = (tipo: 'overload' | 'surpresa', sim: boolean) => {
    const { valeContra: _antes, ...resto } = reacao
    const novos = sim ? [...contra.filter((item) => item !== tipo), tipo] : contra.filter((item) => item !== tipo)
    trocar(novos.length === 0 ? resto : { ...resto, valeContra: novos })
  }
  const trocarAtributo = (id: string, sim: boolean) => {
    if (defesa.tipo !== 'rola') return
    const atributos = sim ? [...defesa.atributos.filter((atual) => atual !== id), id] : defesa.atributos.filter((atual) => atual !== id)
    trocar({ ...reacao, defesa: { ...defesa, atributos } })
  }
  return (
    <Bloco numero={8} titulo="Reação" frase={frasesDaReacao(mecanica, ficha).join(' ')} abertoAoMontar>
      <Escolha
        legenda="Defesa"
        opcoes={DEFESAS}
        valor={defesa.tipo}
        onChange={(tipo) => {
          const { devolve: _devolve, curaDoQueChegava: _cura, ...semExtras } = reacao
          // A que rola não devolve nem cura (o motor ainda não faz): os dois saem junto.
          trocar({ ...(tipo === 'rola' ? semExtras : reacao), defesa: defesaNova(tipo, ficha) })
        }}
      />
      {defesa.tipo === 'fica' && (
        <div className="lb-mec__linha">
          <CampoInteiro rotulo="Toma só" valor={defesa.porcento} minimo={1} maximo={99} depois="% do dano" onChange={(porcento) => trocar({ ...reacao, defesa: { ...defesa, porcento } })} />
        </div>
      )}
      {defesa.tipo === 'rola' && (
        <>
          <fieldset className="lb-mec__escolha">
            <legend className="lb-mec__legenda">d20 + o maior modificador entre</legend>
            {ficha.sistema.atributos.map((atributo) => (
              <Marcar
                key={atributo.id}
                rotulo={atributo.nome}
                marcado={defesa.atributos.includes(atributo.id)}
                bloqueio={!defesa.atributos.includes(atributo.id) && defesa.atributos.length >= ATRIBUTOS_DA_REACAO_MAX ? `Até ${ATRIBUTOS_DA_REACAO_MAX} atributos.` : null}
                onChange={(sim) => trocarAtributo(atributo.id, sim)}
              />
            ))}
          </fieldset>
          <div className="lb-mec__linha">
            <CampoInteiro rotulo="Anula com" valor={defesa.anulaCom} minimo={1} maximo={CD_MAX} depois="ou mais" onChange={(anulaCom) => trocar({ ...reacao, defesa: { ...defesa, anulaCom } })} />
          </div>
        </>
      )}
      <Escolha
        legenda="Devolve em quem atacou, sem reação dele"
        opcoes={DEVOLVES.map((opcao) => ({ ...opcao, bloqueio: opcao.valor === '0' ? null : soNoDado }))}
        valor={reacao.devolve === undefined ? '0' : devolveDoDivisor(reacao.devolve.divididoPor)}
        onChange={(valor) => {
          const { devolve: _antes, ...resto } = reacao
          trocar(valor === '0' ? resto : { ...resto, devolve: { divididoPor: Number(valor) } })
        }}
      />
      <Marcar
        rotulo="Parte do dano que chegava vira vida"
        marcado={reacao.curaDoQueChegava !== undefined}
        bloqueio={reacao.curaDoQueChegava === undefined ? soNoDado : null}
        onChange={(sim) => {
          const { curaDoQueChegava: _antes, ...resto } = reacao
          trocar(sim ? { ...resto, curaDoQueChegava: PORCENTO_DE_PARTIDA } : resto)
        }}
      />
      {reacao.curaDoQueChegava !== undefined && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Cura" valor={reacao.curaDoQueChegava} minimo={1} maximo={100} depois="% do que chegava" onChange={(curaDoQueChegava) => trocar({ ...reacao, curaDoQueChegava })} />
        </div>
      )}
      <Marcar rotulo="Vale também contra Overload" marcado={contra.includes('overload')} onChange={(sim) => trocarContra('overload', sim)} />
      <Marcar rotulo="Vale também contra Surpresa" marcado={contra.includes('surpresa')} onChange={(sim) => trocarContra('surpresa', sim)} />
      <Marcar
        rotulo="Só o mestre usa"
        marcado={reacao.soOMestre === true}
        onChange={(sim) => {
          const { soOMestre: _antes, ...resto } = reacao
          trocar(sim ? { ...resto, soOMestre: true } : resto)
        }}
      />
      <p className="lb-field__hint">Escolhida antes do d20; depois do dado não troca. Atordoado e Paralisado não reagem, nem com técnica.</p>
    </Bloco>
  )
}

type TipoDeLimite = 'livre' | 'recarga' | 'usos'

export function BlocoDosLimites({ mecanica, onChange }: Pick<BlocosProps, 'mecanica' | 'onChange'>) {
  const { limite } = mecanica
  const tipo: TipoDeLimite = limite.recarga !== undefined ? 'recarga' : limite.usosPorBatalha !== undefined ? 'usos' : 'livre'
  const comOverload = limite.overload === true ? { overload: true as const } : {}
  return (
    <Bloco numero={9} titulo="Limites" frase={fraseDoLimite(mecanica) ?? 'Sem limite: usa sempre que tiver o custo.'} abertoAoMontar={tipo !== 'livre' || limite.overload === true}>
      <Escolha
        legenda="Quantas vezes"
        opcoes={[
          { valor: 'livre', rotulo: 'Sem limite' },
          { valor: 'recarga', rotulo: 'Recarga' },
          { valor: 'usos', rotulo: 'Usos por batalha' },
        ]}
        valor={tipo}
        onChange={(novo) => onChange({ ...mecanica, limite: { ...comOverload, ...(novo === 'recarga' ? { recarga: 2 } : novo === 'usos' ? { usosPorBatalha: 3 } : {}) } })}
      />
      {limite.recarga !== undefined && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Espera" valor={limite.recarga} minimo={1} maximo={LIMITE_MAX} depois={limite.recarga === 1 ? 'vez para usar de novo' : 'vezes para usar de novo'} onChange={(recarga) => onChange({ ...mecanica, limite: { ...comOverload, recarga } })} />
        </div>
      )}
      {limite.usosPorBatalha !== undefined && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Até" valor={limite.usosPorBatalha} minimo={1} maximo={LIMITE_MAX} depois="usos por batalha" onChange={(usosPorBatalha) => onChange({ ...mecanica, limite: { ...comOverload, usosPorBatalha } })} />
        </div>
      )}
      <Marcar
        rotulo="Overload (1 por batalha, gasta a Ação Completa; só outra Overload defende)"
        marcado={limite.overload === true}
        onChange={(sim) => {
          const { overload: _antes, ...semOverload } = limite
          onChange({ ...mecanica, limite: sim ? { ...semOverload, overload: true } : semOverload })
        }}
      />
    </Bloco>
  )
}
