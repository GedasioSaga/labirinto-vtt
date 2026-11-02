import { useId } from 'react'
import { type EfeitoDaFaixaDBT, type TecnicaDBT } from '../../../lib/dbt/modelo'
import { SIGLA_DO_ATRIBUTO, modificador } from '../../../lib/dbt/regras/atributos'
import { NOME_DO_TIPO, especiaisNaoOfensivas, montarTecnica, type TecnicaMontadaDBT } from '../../../lib/dbt/regras/tecnicas'
import { useFichaDBT } from './contexto'
import { NPC_PADRAO, RANKS_DBT, ROTULOS_POR_ID, numero, sinal, tecnicaProntaNaFicha, tecnicasProntasDaRaca, temMagoDeKi, valorDe } from './edicaoDaFicha'
import { BarraDeUso, ContaDaDica, Formula, Interruptor, TextoQueAbre, useDica } from './pecas'

/**
 * A aba Técnicas: preparadas (ocupam ST), conhecidas e especiais, com Ki e
 * faixa de dano saídos do montador (lib/dbt/regras/tecnicas.ts). Na leitura,
 * "Usar" gasta o Ki pelo ajuste rápido; na edição, monta, prepara e aprova.
 */

export const NOME_DA_FAIXA: Readonly<Record<EfeitoDaFaixaDBT, string>> = {
  dano: 'dano',
  mitigacao: 'mitigação',
  cura: 'cura',
  ca: 'CA',
}

export function useMontar(): (tecnica: TecnicaDBT) => TecnicaMontadaDBT {
  const { ficha, ehNpc } = useFichaDBT()
  const podeUsarMagica = temMagoDeKi(ficha)
  return (tecnica) => montarTecnica(tecnica, { rank: RANKS_DBT[tecnica.rank], rotulos: ROTULOS_POR_ID, pdl: ehNpc ? undefined : ficha.pdl, podeUsarMagica })
}

export function AbaTecnicas() {
  const { ficha, derivados, editando, ehNpc, abrirConstrutor } = useFichaDBT()
  const tecnicas = ficha.tecnicas
  const comuns = tecnicas.filter((t) => t.especial === null)
  const preparadas = ehNpc ? comuns : comuns.filter((t) => t.ativa)
  const conhecidas = ehNpc ? [] : comuns.filter((t) => !t.ativa)
  const especiais = tecnicas.filter((t) => t.especial !== null)
  const limiteDeEspeciais = especiaisNaoOfensivas(tecnicas, derivados.epBase.valor)
  const sobraDeSt = derivados.st.valor - derivados.stUsados

  return (
    <>
      <div className="dbf-ph">
        <h3 className="dbf-ph__t">Técnicas</h3>
        {editando && (
          <button type="button" className="dbf-btn dbf-btn--pri" onClick={() => abrirConstrutor(null)}>
            Nova técnica
          </button>
        )}
      </div>
      {ehNpc ? (
        <p className="dbf-aviso dbf-aviso--calmo">NPC não usa slots de técnica: todas ficam prontas (Livro do Narrador 4.0.5).</p>
      ) : (
        <BarraDeUso
          usado={derivados.stUsados}
          total={derivados.st.valor}
          rotulo="Slots de técnica em uso"
          dica={{ titulo: 'Slots de técnica', conta: derivados.st.formula }}
          mensagem={sobraDeSt < 0 ? `Acima do limite por ${-sobraDeSt} ST. Desative técnicas até caber.` : `Sobram ${sobraDeSt} ST. Troque as preparadas só no descanso longo.`}
        />
      )}
      {limiteDeEspeciais.passou && (
        <p className="dbf-aviso dbf-aviso--amber">
          {limiteDeEspeciais.usadas} especiais não ofensivas, e a EP base {derivados.epBase.valor} permite {limiteDeEspeciais.limite}. O mestre decide.
        </p>
      )}
      {tecnicas.length === 0 && (
        <div className="dbf-vazio">
          <p>
            {editando
              ? 'Nenhuma técnica ainda. Monte a primeira no construtor: escolha o rank, o tipo e os rótulos, e a ficha calcula o Ki, o dano e os slots. Ou pegue uma pronta da raça aqui embaixo.'
              : 'Nenhuma técnica ainda. Em Editar, monte a primeira no construtor ou pegue uma pronta da raça.'}
          </p>
          {editando && (
            <button type="button" className="dbf-btn dbf-btn--pri" onClick={() => abrirConstrutor(null)}>
              Criar técnica
            </button>
          )}
        </div>
      )}
      {preparadas.length > 0 && (
        <div className="dbf-sec">
          <h4 className="dbf-sec__t">
            {ehNpc ? 'Técnicas' : 'Preparadas'} <span>{preparadas.length}</span>
          </h4>
          {preparadas.map((t) => (
            <LinhaDaTecnica key={t.id} tecnica={t} sobraDeSt={sobraDeSt} />
          ))}
        </div>
      )}
      {conhecidas.length > 0 && (
        <div className="dbf-sec">
          <h4 className="dbf-sec__t">
            Conhecidas, fora dos slots <span>{conhecidas.length}</span>
          </h4>
          {conhecidas.map((t) => (
            <LinhaDaTecnica key={t.id} tecnica={t} sobraDeSt={sobraDeSt} />
          ))}
        </div>
      )}
      {especiais.length > 0 && (
        <div className="dbf-sec">
          <h4 className="dbf-sec__t">
            Especiais <span>não gastam ST</span>
          </h4>
          {especiais.map((t) => (
            <LinhaDaTecnica key={t.id} tecnica={t} sobraDeSt={sobraDeSt} />
          ))}
        </div>
      )}
      {editando && <TecnicasProntas />}
    </>
  )
}

function LinhaDaTecnica({ tecnica, sobraDeSt }: { tecnica: TecnicaDBT; sobraDeSt: number }) {
  const { personagem, editando, ehNpc, ehMestre, ajustar, pkAtual, mudarFicha, abrirConstrutor } = useFichaDBT()
  const montar = useMontar()
  const idBase = useId()
  const montada = montar(tecnica)
  const especial = tecnica.especial
  const slots = RANKS_DBT[tecnica.rank].slots
  const pronta = ehNpc || tecnica.ativa || (especial !== null && especial.aprovada)
  const podePreparar = tecnica.ativa || slots <= sobraDeSt
  const faltaKi = montada.ki - pkAtual
  const motivoDoUso = especial !== null && !especial.aprovada ? 'Só usa depois de o mestre aprovar' : !pronta ? 'Prepare em Editar para usar' : faltaKi > 0 ? `Falta ${faltaKi} Ki` : null
  const erro = montada.avisos.find((a) => a.gravidade === 'erro') ?? montada.avisos.find((a) => a.codigo !== 'especial-pendente')
  // Técnica com os números impressos (pronta do livro): a conta dos rótulos vira lembrete, não erro.
  const livro = montada.manual.ki || montada.manual.dano
  const nomes = montada.rotulos.map((r) => r.nome.replace(/^Alcance – /, ''))
  const mod = modificador(valorDe(personagem, tecnica.atributo))
  const acerto = mod + montada.acertoExtra
  const trocar = (mudanca: Partial<TecnicaDBT>) => mudarFicha((f) => ({ ...f, tecnicas: f.tecnicas.map((t) => (t.id === tecnica.id ? { ...t, ...mudanca } : t)) }))
  const dicaDoKi = useDica(<ContaDaDica titulo="Ki por uso" conta={montada.formulaDoKi} />)
  const faixa = montada.faixa
  const temFaixa = especial === null || especial.ofensiva || montada.manual.dano

  return (
    <article className={`dbf-tec${pronta ? ' dbf-tec--on' : ''}`} aria-labelledby={`${idBase}-n`}>
      <span className={`dbf-rk${especial !== null ? ' dbf-rk--esp' : ''}`} title={`Rank ${tecnica.rank}, ${RANKS_DBT[tecnica.rank].nome}`}>
        {especial !== null ? `esp. ${tecnica.rank}` : tecnica.rank}
      </span>
      <div className="dbf-tec__main">
        <h4 className="dbf-tec__n" id={`${idBase}-n`}>
          {tecnica.nome}
        </h4>
        <p className="dbf-tec__meta">
          {especial !== null ? `Especial ${especial.ofensiva ? 'ofensiva' : 'não ofensiva'}` : NOME_DO_TIPO[tecnica.tipo]}, acerto {SIGLA_DO_ATRIBUTO[tecnica.atributo]} {sinal(acerto)}
          {tecnica.alcance.trim() !== '' && `, ${tecnica.alcance.trim()}`}
        </p>
        {especial === null && <p className="dbf-tec__lbls">{nomes.length > 0 ? nomes.join(', ') : 'Sem rótulos'}</p>}
        {erro !== undefined && <p className={`dbf-tec__warn${erro.gravidade === 'erro' && !livro ? ' dbf-tec__warn--erro' : ''}`}>{erro.texto}</p>}
        <TextoQueAbre texto={especial !== null ? especial.efeito || tecnica.descricao : tecnica.descricao} className="dbf-tec__desc" />
      </div>
      <div className="dbf-tec__nums">
        <span {...dicaDoKi.props} tabIndex={0} className="dbf-tec__ki dbf-f">
          <b>{montada.ki}</b> Ki{montada.multiplicadorDoKi !== 1 && !montada.manual.ki ? ` (×${montada.multiplicadorDoKi})` : ''}
        </span>
        {dicaDoKi.dica}
        {temFaixa && (
          <>
            <Formula titulo="Faixa" conta={montada.formulaDoDano} rotulo={`${NOME_DA_FAIXA[tecnica.efeitoDaFaixa]} mínimo ${faixa.minimo}, médio ${faixa.medio}, completo ${faixa.completo}`}>
              <span className="dbf-dn">
                <i>{numero(faixa.minimo)}</i>
                <i>{numero(faixa.medio)}</i>
                <i>{numero(faixa.completo)}</i>
              </span>
            </Formula>
            <span className="dbf-dn__l">{NOME_DA_FAIXA[tecnica.efeitoDaFaixa]} mín, méd, completo</span>
          </>
        )}
      </div>
      <div className="dbf-tec__acts">
        {(montada.manual.ki || montada.manual.dano) && <span className="dbf-tag dbf-tag--fraca">Números do livro</span>}
        {especial !== null && !especial.aprovada && <span className="dbf-tag dbf-tag--wait">Aguarda o mestre</span>}
        {editando && !ehNpc && especial === null && (
          <>
            <Interruptor ligado={tecnica.ativa} disabled={!podePreparar} descritoPor={podePreparar ? undefined : `${idBase}-st`} onTrocar={() => trocar({ ativa: !tecnica.ativa })}>
              Preparada
            </Interruptor>
            {!podePreparar && (
              <span className="dbf-motivo" id={`${idBase}-st`}>
                Precisa de {slots} ST, sobram {Math.max(0, sobraDeSt)}
              </span>
            )}
          </>
        )}
        {editando && ehMestre && especial !== null && (
          <Interruptor ligado={especial.aprovada} onTrocar={() => trocar({ especial: { ...especial, aprovada: !especial.aprovada } })}>
            Aprovada
          </Interruptor>
        )}
        <span className="dbf-tec__st">{especial !== null ? '0 ST' : ehNpc ? `Rank ${tecnica.rank}` : `${slots} ST`}</span>
        {!editando && ajustar !== undefined && (
          <>
            {motivoDoUso !== null && (
              <span className="dbf-motivo" id={`${idBase}-uso`}>
                {motivoDoUso}
              </span>
            )}
            <button
              type="button"
              className="dbf-btn dbf-btn--sm"
              disabled={motivoDoUso !== null}
              aria-describedby={motivoDoUso !== null ? `${idBase}-uso` : undefined}
              onClick={() => ajustar({ parte: 'recurso', chave: 'pk', valor: Math.max(0, pkAtual - montada.ki) })}
            >
              Usar <span className="dbf-ki-cost">−{montada.ki} Ki</span>
            </button>
          </>
        )}
        {editando && (
          <button type="button" className="dbf-btn dbf-btn--sm dbf-btn--ghost" onClick={() => abrirConstrutor(tecnica.id)}>
            Editar
          </button>
        )}
      </div>
    </article>
  )
}

/** As técnicas prontas da raça e dos pacotes dela (suplementos): um clique põe na ficha, com os números impressos. */
function TecnicasProntas() {
  const { ficha, raca, ehNpc, mudarFicha } = useFichaDBT()
  const prontas = tecnicasProntasDaRaca(raca)
  if (raca === null) return null
  const naFicha = new Set(ficha.tecnicas.map((t) => t.nome.trim().toLowerCase()))
  const rankPadrao = (ficha.npc ?? NPC_PADRAO).rank
  return (
    <div className="dbf-sec">
      <h4 className="dbf-sec__t">
        Prontas de {raca.nome} <span>{prontas.length === 0 ? 'o livro não traz técnica pronta para esta raça' : `${prontas.length} no livro e nos suplementos`}</span>
      </h4>
      {prontas.map(({ origem, tecnica }, i) => {
        const ja = naFicha.has(tecnica.nome.trim().toLowerCase())
        return (
          <div key={`${origem}-${tecnica.nome}-${i}`} className="dbf-bk">
            <div>
              <h5>{tecnica.nome}</h5>
              <div className="dbf-bk__meta">
                <span className="dbf-tag">Rank {tecnica.rankTexto}</span>
                {tecnica.custoTexto !== '' && <span className="dbf-tag dbf-tag--ki">Ki {tecnica.custoTexto}</span>}
                {tecnica.faixaTexto !== '' && <span className="dbf-tag">{tecnica.faixaTexto}</span>}
                {origem !== raca.nome && <span className="dbf-tag dbf-tag--fraca">{origem}</span>}
              </div>
              <TextoQueAbre texto={[tecnica.descricao, tecnica.efeito].filter((p) => p.trim() !== '').join('\n\n')} className="dbf-bk__ef" />
            </div>
            <div className="dbf-bk__acts">
              <button
                type="button"
                className={`dbf-btn dbf-btn--sm${ja ? ' dbf-btn--on' : ''}`}
                disabled={ja}
                onClick={() => mudarFicha((f) => ({ ...f, tecnicas: [...f.tecnicas, tecnicaProntaNaFicha(tecnica, rankPadrao, ehNpc)] }))}
              >
                {ja ? 'Na ficha' : 'Adicionar'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
