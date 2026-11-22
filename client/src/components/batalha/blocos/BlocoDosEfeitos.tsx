import { useId } from 'react'
import { DANO_MAX, NOME_DO_SELO_MAX } from '../../../lib/batalha/combate'
import { CURAS_NO_ALVO_MAX, EFEITOS_MAX, FORMULA_MAX, MAXIMO_DA_CURA, NOMES_QUE_TIRA_MAX, SELOS_NO_GOLPE_MAX, TEXTO_A_MAO_MAX, type Efeito, type Numero, type NumeroSimples, type Recurso } from '../../../lib/batalha/mecanica/modelo'
import { ehAjuda } from '../../../lib/batalha/mecanica/modelos'
import { fraseDoEfeito } from '../../../lib/batalha/mecanica/resumo'
import { Bloco, CampoInteiro, Escolha, Marcar, numeroDoTexto, semEspaco, Texto, textoDoNumero, type BlocosProps, type Opcao } from './controles'
import { PecasDoSelo, type SeloDaPeca } from './PecasDoSelo'

/**
 * O bloco 7 da mecânica: o que deixa. Fase 5 (SISTEMA.md §2 e §3): até 3
 * selos no mesmo golpe (um só em quem usa), a cura de HP, SP ou Escudo no
 * alvo e outra em quem usa, tirar as negativas, as positivas, todas ou pelo
 * nome (o antídoto), o roubo de vida e os lembretes à mão.
 */

type CuraDaPeca = Extract<Efeito, { tipo: 'cura' }>
type QuaisTira = 'negativos' | 'positivos' | 'todos' | 'nomes'

const RECURSOS_DA_CURA: readonly Opcao<Recurso>[] = [
  { valor: 'hp', rotulo: 'HP' },
  { valor: 'sp', rotulo: 'SP' },
  { valor: 'escudo', rotulo: 'Escudo' },
]

const QUAIS_TIRA: readonly Opcao<QuaisTira>[] = [
  { valor: 'negativos', rotulo: 'As negativas' },
  { valor: 'positivos', rotulo: 'As positivas' },
  { valor: 'todos', rotulo: 'Todas' },
  { valor: 'nomes', rotulo: 'Pelo nome' },
]

/** A ordem fixa dos efeitos (a ficha gravada sai sempre igual; os selos guardam a ordem entre eles). */
const ORDEM: readonly Efeito['tipo'][] = ['selo', 'cura', 'tirarSelos', 'dreno', 'reviver', 'aMao']

/** Fase 6 (H14): a parte do HP máximo com que o caído volta, de partida. */
const REVIVER_DE_PARTIDA = 25

/** A parte do dano que volta em vida, de partida (o H17). */
const DRENO_DE_PARTIDA = 50

function textoDaCura(quanto: Numero, carga: 0 | 1 | 2 | 3): string {
  if ('porCarga' in quanto) return textoDoNumero(quanto.porCarga[carga])
  return carga === 0 ? textoDoNumero(quanto) : ''
}

/** A cura com o número de uma carga trocado (ou o número de sempre). */
function curaComTexto(cura: CuraDaPeca, carga: 0 | 1 | 2 | 3, texto: string): CuraDaPeca {
  const numero = numeroDoTexto(texto, DANO_MAX)
  if (!('porCarga' in cura.quanto)) return { ...cura, quanto: numero }
  const cargas: [NumeroSimples, NumeroSimples, NumeroSimples, NumeroSimples] = [...cura.quanto.porCarga]
  cargas[carga] = numero
  return { ...cura, quanto: { porCarga: cargas } }
}

/** Fase 7: a parte do máximo de partida (a Poção Suprema). */
const PARTE_DO_MAXIMO_DE_PARTIDA = 50

/** Fase 7 (itens): a cura pela parte do máximo do alvo, do recurso que ela recupera (o Escudo não tem máximo). */
function PecasDaParte({ cura, onChange }: { cura: CuraDaPeca; onChange: (cura: CuraDaPeca) => void }) {
  const { quanto } = cura
  const recurso = cura.recurso === 'escudo' ? null : cura.recurso
  if (recurso === null) return null
  return (
    <>
      <Marcar
        rotulo="Pela parte do máximo do alvo (%)"
        marcado={'porcento' in quanto}
        bloqueio={cura.em === 'quemUsa' ? 'Em quem usa, só número ou fórmula.' : null}
        onChange={(sim) => onChange({ ...cura, quanto: sim ? { porcento: PARTE_DO_MAXIMO_DE_PARTIDA, de: MAXIMO_DA_CURA[recurso], deQuem: 'alvo' } : { fixo: 100 } })}
      />
      {'porcento' in quanto && <CampoInteiro rotulo="Parte do máximo" valor={quanto.porcento} minimo={1} maximo={100} depois="%" onChange={(porcento) => onChange({ ...cura, quanto: { ...quanto, porcento } })} />}
    </>
  )
}

/** Uma cura (no alvo ou em quem usa): o recurso, quanto (com a Concentração, só no alvo) e a frase. */
function PecasDaCura({ cura, comConcentracao, onChange }: { cura: CuraDaPeca; comConcentracao: boolean; onChange: (cura: CuraDaPeca) => void }) {
  const { quanto } = cura
  // Fase 7: trocar o recurso de uma cura pela parte leva a parte junto (o SP pelo SP máximo); o Escudo volta a número.
  const trocarRecurso = (recurso: Recurso) => onChange({ ...cura, recurso, quanto: 'porcento' in quanto ? (recurso === 'escudo' ? { fixo: 100 } : { ...quanto, de: MAXIMO_DA_CURA[recurso] }) : quanto })
  return (
    <div className="lb-mec__linha lb-mec__linha--recuo">
      <Escolha legenda="Recupera" opcoes={RECURSOS_DA_CURA} valor={cura.recurso} onChange={trocarRecurso} />
      <PecasDaParte cura={cura} onChange={onChange} />
      {'porcento' in quanto ? null : (
        <>
          <Texto rotulo={'porCarga' in quanto ? 'Sem carga' : 'Quanto'} valor={textoDaCura(quanto, 0)} maximo={FORMULA_MAX} placeholder="Ex.: 100 ou Espírito × 2" onChange={(texto) => onChange(curaComTexto(cura, 0, texto))} />
          {'porCarga' in quanto && ([1, 2, 3] as const).map((carga) => <Texto key={carga} rotulo={`Carga ${carga}`} valor={textoDaCura(quanto, carga)} maximo={FORMULA_MAX} onChange={(texto) => onChange(curaComTexto(cura, carga, texto))} />)}
        </>
      )}
      {comConcentracao && !('porcento' in quanto) && (
        <Marcar
          rotulo="Muda com a Concentração"
          marcado={'porCarga' in quanto}
          onChange={(sim) => {
            const zero = 'porCarga' in quanto ? quanto.porCarga[0] : quanto
            onChange({ ...cura, quanto: sim ? { porCarga: [zero, zero, zero, zero] } : zero })
          }}
        />
      )}
      {cura.recurso === 'escudo' && <p className="lb-field__hint">O Escudo soma por cima, sem teto: é a camada que o próximo golpe gasta primeiro.</p>}
    </div>
  )
}

export function BlocoDosEfeitos({ mecanica, ficha, onChange }: Pick<BlocosProps, 'mecanica' | 'ficha' | 'onChange'>) {
  const listaId = useId()
  const { efeitos } = mecanica
  const ajuda = ehAjuda(mecanica.alvo.quem)
  const cheio = efeitos.length >= EFEITOS_MAX
  const trocarEfeitos = (novos: readonly Efeito[]) => onChange({ ...mecanica, efeitos: [...novos].sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo)) })
  /** Troca (ou tira, com `null`) o efeito que `achar` aponta; sem ele, põe no fim. */
  const trocarUm = (achar: (efeito: Efeito) => boolean, novo: Efeito | null) => {
    const indice = efeitos.findIndex(achar)
    if (indice < 0) {
      if (novo !== null) trocarEfeitos([...efeitos, novo])
      return
    }
    trocarEfeitos(novo === null ? efeitos.filter((_, j) => j !== indice) : efeitos.map((efeito, j) => (j === indice ? novo : efeito)))
  }
  const selos = efeitos.flatMap((efeito, indice) => (efeito.tipo === 'selo' ? [{ indice, selo: efeito }] : []))
  const curasNoAlvo = efeitos.filter((efeito): efeito is CuraDaPeca => efeito.tipo === 'cura' && efeito.em === undefined)
  const [curaNoAlvo, segundaCura] = curasNoAlvo
  const curaEmQuemUsa = efeitos.find((efeito): efeito is CuraDaPeca => efeito.tipo === 'cura' && efeito.em === 'quemUsa')
  const tira = efeitos.find((efeito) => efeito.tipo === 'tirarSelos')
  const dreno = efeitos.find((efeito) => efeito.tipo === 'dreno')
  const revive = efeitos.find((efeito) => efeito.tipo === 'reviver')
  const lembretes = efeitos.flatMap((efeito, indice) => (efeito.tipo === 'aMao' ? [{ indice, texto: efeito.texto }] : []))
  // Fase 4: só no lugar da reação, o selo vai em quem atacou e a cura e o "tira selos" (efeitos da vez) não existem.
  const soReacao = mecanica.uso === 'reacao'
  const tambemReacao = mecanica.uso === 'ativaOuReacao'
  const semAjuda = soReacao ? 'Só no lugar da reação a técnica não roda na vez: o efeito não teria em quem pegar.' : ajuda ? null : 'Só em aliado ou em quem usa (bloco 4).'
  const daVez = soReacao ? 'Só no lugar da reação a técnica não roda na vez.' : null
  const cheioOu = (outro: string | null): string | null => outro ?? semEspaco(cheio, EFEITOS_MAX)
  const umEmQuemUsa = selos.some(({ selo }) => selo.em === 'quemUsa') ? 'Já há um selo em quem usa.' : null
  const emQuemPode = soReacao ? (['atacante'] as const) : tambemReacao ? (['alvo', 'quemUsa', 'atacante'] as const) : (['alvo', 'quemUsa'] as const)
  const seloNovo = (): SeloDaPeca => (soReacao ? { tipo: 'selo', nome: 'Marcado', duracao: 1, natureza: 'debuff', em: 'atacante' } : { tipo: 'selo', nome: ajuda ? 'Fortalecido' : 'Atordoado', duracao: 1, natureza: ajuda ? 'buff' : 'debuff' })
  const nomesQueTira = tira !== undefined && typeof tira.quais === 'object' ? tira.quais.nomes : null
  const frases = efeitos.map((efeito) => fraseDoEfeito(efeito, mecanica, ficha))
  return (
    <Bloco numero={7} titulo="O que deixa" frase={frases.length === 0 ? 'Nada além do dano.' : frases.join(' ')} abertoAoMontar={efeitos.length > 0}>
      {selos.map(({ indice, selo }, numero) => (
        <div key={indice} className="lb-mec__efeito">
          <div className="lb-mec__efeito-cab">
            <span className="lb-mec__legenda">{selos.length === 1 ? 'Selo' : `Selo ${numero + 1}`}</span>
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" aria-label={`Tirar o selo ${selo.nome.trim() || numero + 1}`} onClick={() => trocarEfeitos(efeitos.filter((_, j) => j !== indice))}>
              Tirar
            </button>
          </div>
          <PecasDoSelo
            selo={selo}
            ajuda={ajuda && selo.em === undefined}
            emQuemPode={emQuemPode}
            bloqueioEmQuemUsa={umEmQuemUsa}
            listaId={listaId}
            ficha={ficha}
            onChange={(novo) => trocarEfeitos(efeitos.map((efeito, j) => (j === indice ? novo : efeito)))}
          />
        </div>
      ))}
      <button
        type="button"
        className="lb-btn lb-btn--compact lb-mec__mais"
        disabled={selos.length >= SELOS_NO_GOLPE_MAX || cheio}
        title={selos.length >= SELOS_NO_GOLPE_MAX ? `Até ${SELOS_NO_GOLPE_MAX} selos no mesmo golpe` : cheio ? `Já tem ${EFEITOS_MAX} efeitos` : undefined}
        onClick={() => trocarEfeitos([...efeitos, seloNovo()])}
      >
        {soReacao ? '+ Selo em quem atacou' : selos.length === 0 ? (ajuda ? '+ Dá um selo' : '+ Se acertar, deixa um selo') : '+ Outro selo'}
      </button>
      <Marcar rotulo="Cura ou recupera (no alvo)" marcado={curaNoAlvo !== undefined} bloqueio={curaNoAlvo === undefined ? cheioOu(semAjuda) : null} onChange={(sim) => trocarUm((efeito) => efeito.tipo === 'cura' && efeito.em === undefined, sim ? { tipo: 'cura', recurso: 'hp', quanto: { fixo: 100 }, emQuem: 'alvo' } : null)} />
      {curaNoAlvo !== undefined && <PecasDaCura cura={curaNoAlvo} comConcentracao onChange={(nova) => trocarUm((efeito) => efeito === curaNoAlvo, nova)} />}
      {/* Fase 7 (o Elixir): o mesmo alvo recupera também outro recurso (HP e SP), cada um uma vez. */}
      {curaNoAlvo !== undefined && curaNoAlvo.recurso !== 'escudo' && (
        <Marcar
          rotulo={`Também recupera ${curaNoAlvo.recurso === 'hp' ? 'SP' : 'HP'} (no alvo)`}
          marcado={segundaCura !== undefined}
          bloqueio={segundaCura === undefined ? cheioOu(curasNoAlvo.length >= CURAS_NO_ALVO_MAX ? 'Já há duas curas no alvo.' : null) : null}
          onChange={(sim) => trocarUm((efeito) => efeito === segundaCura, sim ? { tipo: 'cura', recurso: curaNoAlvo.recurso === 'hp' ? 'sp' : 'hp', quanto: { fixo: 50 }, emQuem: 'alvo' } : null)}
        />
      )}
      {segundaCura !== undefined && <PecasDaCura cura={segundaCura} comConcentracao={false} onChange={(nova) => trocarUm((efeito) => efeito === segundaCura, nova)} />}
      <Marcar rotulo="Quem usa também recupera" marcado={curaEmQuemUsa !== undefined} bloqueio={curaEmQuemUsa === undefined ? cheioOu(daVez) : null} onChange={(sim) => trocarUm((efeito) => efeito.tipo === 'cura' && efeito.em === 'quemUsa', sim ? { tipo: 'cura', recurso: 'sp', quanto: { fixo: 10 }, emQuem: 'alvo', em: 'quemUsa' } : null)} />
      {curaEmQuemUsa !== undefined && <PecasDaCura cura={curaEmQuemUsa} comConcentracao={false} onChange={(nova) => trocarUm((efeito) => efeito.tipo === 'cura' && efeito.em === 'quemUsa', nova)} />}
      <Marcar rotulo="Tira selos" marcado={tira !== undefined} bloqueio={tira === undefined ? cheioOu(semAjuda) : null} onChange={(sim) => trocarUm((efeito) => efeito.tipo === 'tirarSelos', sim ? { tipo: 'tirarSelos', quais: 'negativos' } : null)} />
      {tira !== undefined && tira.tipo === 'tirarSelos' && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <Escolha<QuaisTira>
            legenda="Quais"
            opcoes={QUAIS_TIRA}
            valor={typeof tira.quais === 'object' ? 'nomes' : tira.quais}
            onChange={(quais) => trocarUm((efeito) => efeito.tipo === 'tirarSelos', { tipo: 'tirarSelos', quais: quais === 'nomes' ? { nomes: ['Envenenado'] } : quais })}
          />
          {nomesQueTira !== null && (
            <Texto
              rotulo={`Os nomes (até ${NOMES_QUE_TIRA_MAX}, separados por vírgula)`}
              valor={nomesQueTira.join(', ')}
              maximo={(NOME_DO_SELO_MAX + 2) * NOMES_QUE_TIRA_MAX}
              placeholder="Ex.: Envenenado"
              onChange={(texto) => trocarUm((efeito) => efeito.tipo === 'tirarSelos', { tipo: 'tirarSelos', quais: { nomes: texto.split(',').map((nome) => nome.trim()).filter((nome) => nome !== '').slice(0, NOMES_QUE_TIRA_MAX) } })}
            />
          )}
          {tira.quais !== 'negativos' && <p className="lb-field__hint">O contador, a marca, os ajustes do mestre e os selos das passivas nunca saem.</p>}
        </div>
      )}
      <Marcar
        rotulo="Rouba vida: quem usa recupera parte do dano que causar"
        marcado={dreno !== undefined}
        bloqueio={dreno === undefined ? cheioOu(mecanica.dano === undefined ? 'Precisa de dano (bloco 6).' : daVez) : null}
        onChange={(sim) => trocarUm((efeito) => efeito.tipo === 'dreno', sim ? { tipo: 'dreno', recurso: 'hp', porcentoDoDano: DRENO_DE_PARTIDA } : null)}
      />
      {dreno !== undefined && dreno.tipo === 'dreno' && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Recupera" valor={dreno.porcentoDoDano} minimo={1} maximo={100} depois="% do dano causado, em HP" onChange={(porcentoDoDano) => trocarUm((efeito) => efeito.tipo === 'dreno', { ...dreno, porcentoDoDano })} />
        </div>
      )}
      {/* Fase 6 (H14): reviver liga o alvo caído (um aliado escolhido); tirar volta ao alvo de pé. */}
      <Marcar
        rotulo="Revive: quem caiu (0 de vida) levanta"
        marcado={revive !== undefined}
        bloqueio={revive === undefined ? cheioOu(mecanica.alvo.quem !== 'aliados' ? 'Só num aliado (bloco 4).' : mecanica.dano !== undefined || curaNoAlvo !== undefined || tira !== undefined || dreno !== undefined ? 'Reviver não junta com dano, cura nem tirar condições.' : daVez) : null}
        onChange={(sim) => {
          const { estado: _antes, ...alvoDePe } = mecanica.alvo
          const forma = mecanica.alvo.forma.tipo === 'varios' ? mecanica.alvo.forma : { tipo: 'um' as const }
          const outros = efeitos.filter((efeito) => efeito.tipo !== 'reviver')
          const reviver: Efeito = { tipo: 'reviver', volta: { porcento: REVIVER_DE_PARTIDA, de: 'hpMaximo', deQuem: 'alvo' } }
          onChange(sim ? { ...mecanica, alvo: { ...alvoDePe, forma, estado: 'caido' }, efeitos: [...outros, reviver].sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo)) } : { ...mecanica, alvo: alvoDePe, efeitos: outros })
        }}
      />
      {revive !== undefined && revive.tipo === 'reviver' && 'porcento' in revive.volta && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Levanta com" valor={revive.volta.porcento} minimo={1} maximo={100} depois="% do HP máximo dele" onChange={(porcento) => trocarUm((efeito) => efeito.tipo === 'reviver', { tipo: 'reviver', volta: { porcento, de: 'hpMaximo', deQuem: 'alvo' } })} />
        </div>
      )}
      <div className="lb-mec__lembretes">
        {lembretes.map((lembrete, numero) => (
          <div key={lembrete.indice} className="lb-mec__linha">
            <Texto
              rotulo={`Lembrete ${numero + 1}`}
              valor={lembrete.texto}
              maximo={TEXTO_A_MAO_MAX}
              placeholder="O que o app não faz e o mestre confere"
              onChange={(texto) => trocarEfeitos(efeitos.map((efeito, j) => (j === lembrete.indice ? { tipo: 'aMao', texto } : efeito)))}
            />
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" aria-label={`Tirar o lembrete ${numero + 1}`} onClick={() => trocarEfeitos(efeitos.filter((_, j) => j !== lembrete.indice))}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className="lb-btn lb-btn--compact lb-mec__mais" disabled={cheio} title={cheio ? `Já tem ${EFEITOS_MAX} efeitos` : undefined} onClick={() => trocarEfeitos([...efeitos, { tipo: 'aMao', texto: '' }])}>
          + Lembrete à mão
        </button>
        <p className="lb-field__hint">O lembrete não executa nada: aparece na mira e no registro para o mestre conferir.</p>
      </div>
    </Bloco>
  )
}
