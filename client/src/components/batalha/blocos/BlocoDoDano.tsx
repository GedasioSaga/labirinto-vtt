import { NOME_DO_SELO_MAX } from '../../../lib/batalha/combate'
import { CAMPO_DO_DANO } from '../../../lib/batalha/formula'
import { danoUsaArma, EXTRAS_MAX, FORMULA_MAX, type DanoDaMecanica, type Porcento } from '../../../lib/batalha/mecanica/modelo'
import { frasesDoDano } from '../../../lib/batalha/mecanica/resumo'
import type { CartaoDaFicha } from '../../../lib/personagem'
import { CampoDeDano } from '../../CampoDeDano'
import { Bloco, CampoDasVezes, CampoInteiro, Escolha, Marcar, Texto, textoDoNumero, type BlocosProps } from './controles'

/**
 * O bloco 6 da mecânica: quanto dano. Fase 5: a base pela vida do alvo (B10:
 * a tecla "% da vida do alvo" saiu da fileira e virou esta opção), a
 * perfuração parcial (B13) e o 2º golpe (B17).
 */

const DANO_DA_ARMA = /dano\s+da\s+arma/i

/** A base de partida pela vida do alvo (a Explosão do Siegfried: 10% da vida atual). */
const VIDA_DE_PARTIDA: Porcento = { porcento: 10, de: 'hpAtual', deQuem: 'alvo' }
/** A parte que perfura, de partida (o "Perfurante 50%" do aceite). */
const PERFURACAO_DE_PARTIDA = 50
/** A parte do dano do 2º golpe, de partida (metade, o Rapid Dash). */
const SEGUNDO_DE_PARTIDA = 50

/** O dano sem uma das chaves opcionais. */
function sem<K extends 'perfuracao' | 'segundoGolpe' | 'arma'>(dano: DanoDaMecanica, chave: K): Omit<DanoDaMecanica, K> {
  const { [chave]: _fora, ...resto } = dano
  return resto
}

export function BlocoDoDano({ mecanica, cartao, ficha, onChange, naArma }: BlocosProps) {
  const { dano } = mecanica
  const pelaVida = dano !== undefined && 'porcento' in dano.base ? dano.base : null
  const formula = dano === undefined || 'porcento' in dano.base ? '' : textoDoNumero(dano.base)
  // A prévia usa o campo Dano de sempre (o mesmo leitor da Saúde), num cartão de mentira só com a fórmula.
  const { mecanica: _pecas, mecanicaProposta: _proposta, aMao: _aMao, ...semPecas } = cartao
  const cartaoDaPrevia: CartaoDaFicha = { ...semPecas, campos: { [CAMPO_DO_DANO]: formula } }
  const trocarDano = (novo: DanoDaMecanica) => onChange({ ...mecanica, dano: novo })
  const trocarFormula = (texto: string) => {
    if (dano === undefined) return
    const comArma = DANO_DA_ARMA.test(texto)
    // Quem já marcou "perguntar qual arma" continua perguntando enquanto a fórmula tiver o Dano da Arma.
    const arma = dano.arma === 'perguntar' ? 'perguntar' : 'padrao'
    trocarDano({ ...sem(dano, 'arma'), base: { formula: texto.slice(0, FORMULA_MAX) }, ...(comArma ? { arma } : {}) })
  }
  const extras = dano?.multiplicadores.extra ?? []
  const trocarExtras = (novos: { nome: string; vezes: number }[]) => {
    if (dano === undefined) return
    const { extra: _velhos, ...mult } = dano.multiplicadores
    trocarDano({ ...dano, multiplicadores: novos.length === 0 ? mult : { ...mult, extra: novos } })
  }
  return (
    <Bloco numero={6} titulo="Quanto dano" frase={frasesDoDano(mecanica, ficha).join(' ') || 'Sem dano.'} abertoAoMontar={dano !== undefined}>
      <Marcar
        rotulo="Dá dano"
        marcado={dano !== undefined}
        onChange={(sim) => {
          if (!sim) {
            const { dano: _fora, ...semDano } = mecanica
            // A metade de quem passa no teste sai junto: sem dano não há metade (a leitura recusaria só pela chave órfã do selo).
            onChange(semDano.teste.tipo === 'resistencia' && semDano.teste.sePassar === 'metade' ? { ...semDano, teste: { ...semDano.teste, sePassar: 'nada' } } : semDano)
            return
          }
          onChange({ ...mecanica, dano: { base: { formula: '' }, multiplicadores: { concentracao: true, surpresa: true } } })
        }}
      />
      {dano !== undefined && (
        <>
          <Escolha<'formula' | 'vida'>
            legenda="Como conta"
            opcoes={[
              { valor: 'formula', rotulo: 'Fórmula' },
              { valor: 'vida', rotulo: 'Pela vida do alvo' },
            ]}
            valor={pelaVida === null ? 'formula' : 'vida'}
            onChange={(como) => trocarDano(como === 'vida' ? { ...sem(dano, 'arma'), base: VIDA_DE_PARTIDA } : { ...dano, base: { formula: '' } })}
          />
          {pelaVida === null ? (
            <CampoDeDano
              rotulo="Fórmula do dano"
              campoId={CAMPO_DO_DANO}
              cartao={cartaoDaPrevia}
              personagem={ficha.personagem}
              sistema={ficha.sistema}
              semDanoDaArma={false}
              ehArma={false}
              semModo
              semVidaDoAlvo
              onChange={(novo) => trocarFormula(novo.campos[CAMPO_DO_DANO] ?? '')}
            />
          ) : (
            <div className="lb-mec__linha lb-mec__linha--recuo">
              <CampoInteiro rotulo="Dano" valor={pelaVida.porcento} minimo={1} maximo={100} depois="% da vida" onChange={(porcento) => trocarDano({ ...dano, base: { ...pelaVida, porcento } })} />
              <Escolha<'hpAtual' | 'hpMaximo'>
                legenda="De qual vida do alvo"
                opcoes={[
                  { valor: 'hpAtual', rotulo: 'A atual' },
                  { valor: 'hpMaximo', rotulo: 'A máxima' },
                ]}
                valor={pelaVida.de === 'hpMaximo' ? 'hpMaximo' : 'hpAtual'}
                onChange={(de) => trocarDano({ ...dano, base: { ...pelaVida, de } })}
              />
              <p className="lb-field__hint">O app lê a vida de cada alvo na hora do golpe (o jogador não vê a do NPC: a conta é do mestre).</p>
            </div>
          )}
          <div className="lb-mec__marcas">
            <Marcar rotulo="Perfurante" marcado={dano.perfurante === true || dano.perfuracao !== undefined} onChange={(perfurante) => trocarDano({ ...sem(dano, 'perfuracao'), perfurante })} />
          </div>
          {(dano.perfurante === true || dano.perfuracao !== undefined) && (
            <div className="lb-mec__linha lb-mec__linha--recuo">
              <Escolha<'tudo' | 'parte'>
                legenda="Direto no HP"
                opcoes={[
                  { valor: 'tudo', rotulo: 'Todo o dano' },
                  { valor: 'parte', rotulo: 'Só uma parte' },
                ]}
                valor={dano.perfuracao === undefined ? 'tudo' : 'parte'}
                onChange={(quanto) => trocarDano(quanto === 'tudo' ? { ...sem(dano, 'perfuracao'), perfurante: true } : { ...dano, perfurante: true, perfuracao: PERFURACAO_DE_PARTIDA })}
              />
              {dano.perfuracao !== undefined && <CampoInteiro rotulo="Passa direto" valor={dano.perfuracao} minimo={1} maximo={99} depois="% (o resto vai no Escudo)" onChange={(perfuracao) => trocarDano({ ...dano, perfuracao })} />}
            </div>
          )}
          <Marcar
            rotulo="Dá um 2º golpe nos mesmos alvos (com outra reação)"
            marcado={dano.segundoGolpe !== undefined}
            onChange={(sim) => trocarDano(sim ? { ...dano, segundoGolpe: { fracao: SEGUNDO_DE_PARTIDA / 100, perfurante: false } } : sem(dano, 'segundoGolpe'))}
          />
          {dano.segundoGolpe !== undefined && (
            <div className="lb-mec__linha lb-mec__linha--recuo">
              <CampoInteiro rotulo="O 2º golpe leva" valor={Math.round(dano.segundoGolpe.fracao * 100)} minimo={1} maximo={100} depois="% do dano" onChange={(parte) => dano.segundoGolpe !== undefined && trocarDano({ ...dano, segundoGolpe: { ...dano.segundoGolpe, fracao: parte / 100 } })} />
              <Marcar rotulo="O 2º golpe é perfurante" marcado={dano.segundoGolpe.perfurante} onChange={(perfurante) => dano.segundoGolpe !== undefined && trocarDano({ ...dano, segundoGolpe: { ...dano.segundoGolpe, perfurante } })} />
            </div>
          )}
          <div className="lb-mec__marcas">
            <Marcar rotulo="Multiplica com a Concentração" marcado={dano.multiplicadores.concentracao} onChange={(concentracao) => trocarDano({ ...dano, multiplicadores: { ...dano.multiplicadores, concentracao } })} />
            <Marcar rotulo="Multiplica com a Surpresa" marcado={dano.multiplicadores.surpresa} onChange={(surpresa) => trocarDano({ ...dano, multiplicadores: { ...dano.multiplicadores, surpresa } })} />
            {naArma !== true && danoUsaArma(dano) && (
              <Marcar rotulo="Pergunta qual arma na hora (já vem marcada a padrão)" marcado={dano.arma === 'perguntar'} onChange={(sim) => trocarDano({ ...dano, arma: sim ? 'perguntar' : 'padrao' })} />
            )}
          </div>
          {extras.map((extra, indice) => (
            <div key={`${indice}-${extras.length}`} className="lb-mec__linha lb-mec__linha--recuo">
              <Texto rotulo={`Multiplicador ${indice + 1}`} valor={extra.nome} maximo={NOME_DO_SELO_MAX} placeholder="Ex.: Ponto vital" onChange={(nome) => trocarExtras(extras.map((atual, j) => (j === indice ? { ...atual, nome } : atual)))} />
              <span className="lb-mec__texto">
                <span className="lb-mec__numero-rotulo" aria-hidden="true">
                  ×
                </span>
                <CampoDasVezes rotulo={`Vezes do multiplicador ${indice + 1}`} vezes={extra.vezes} onChange={(vezes) => trocarExtras(extras.map((atual, j) => (j === indice ? { ...atual, vezes } : atual)))} />
              </span>
              <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" aria-label={`Tirar o multiplicador ${indice + 1}`} onClick={() => trocarExtras(extras.filter((_, j) => j !== indice))}>
                ×
              </button>
            </div>
          ))}
          {extras.length < EXTRAS_MAX && (
            <button type="button" className="lb-btn lb-btn--compact lb-mec__mais" onClick={() => trocarExtras([...extras, { nome: '', vezes: 1.5 }])}>
              + Multiplicador (furtivo, ponto vital)
            </button>
          )}
        </>
      )}
    </Bloco>
  )
}
