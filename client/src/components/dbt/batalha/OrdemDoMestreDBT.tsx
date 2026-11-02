import { useState, type FormEvent } from 'react'
import { COMPORTAMENTO, nomeDaCondicao } from '../../../lib/dbt/batalha/condicoes'
import type { AcaoDoMestreDBT, EntranteDBT, IdDaCondicao, SituacaoDeMorte } from '../../../lib/dbt/batalha/tipos'
import { useRpgStore } from '../../../stores/rpgStore'
import { MenuDaCarta, type ItemDoMenuDaCarta } from '../../batalha/MenuDaCarta'
import { Dialogo } from '../../grimorio/Dialogo'
import { NOME_DA_SITUACAO, NOME_DO_VOO, comSinal, type CartaDBT } from './dadosDaBatalhaDBT'
import { BarraDeRecurso } from './pecasDaBatalhaDBT'

/**
 * A ORDEM NO PAINEL DO MESTRE: cada carta com PV e Ki, EP e CA, condições,
 * forma e voo; o menu da carta (o `MenuDaCarta` genérico da batalha) traz o
 * que o mestre faz nos dois modos (seção 15): dar a vez, mover, condição,
 * modificador, Reação em Desvantagem, derrubar, ação gratuita, Ação Oculta,
 * situação, tirar. Abaixo, incluir quem está na cena e ficou de fora.
 */

export interface OrdemDoMestreDBTProps {
  cartas: readonly CartaDBT[]
  /** Fase de combate: dar a vez e ação gratuita valem. */
  combate: boolean
  vez: string | null
  personagemDe: (id: string) => string | null
  /** Tokens da cena com ficha que não estão na batalha. */
  deFora: readonly EntranteDBT[]
  mestre: (acao: AcaoDoMestreDBT) => boolean
}

const CONDICOES: readonly IdDaCondicao[] = Object.keys(COMPORTAMENTO) as IdDaCondicao[]
const SITUACOES: readonly SituacaoDeMorte[] = ['de-pe', 'salvaguarda', 'inconsciente', 'morto']

type Caixa = { tipo: 'condicao'; carta: CartaDBT } | { tipo: 'temporario'; carta: CartaDBT }

export function OrdemDoMestreDBT({ cartas, combate, vez, personagemDe, deFora, mestre }: OrdemDoMestreDBTProps) {
  const [menu, setMenu] = useState<{ carta: CartaDBT; ancora: HTMLElement } | null>(null)
  const [caixa, setCaixa] = useState<Caixa | null>(null)
  const [incluir, setIncluir] = useState('')
  const nomeDaVez = cartas.find((carta) => carta.id === vez)?.nome ?? null

  const itensDe = (carta: CartaDBT): ItemDoMenuDaCarta[] => {
    const indice = cartas.findIndex((candidata) => candidata.id === carta.id)
    const itens: ItemDoMenuDaCarta[] = []
    const personagemId = personagemDe(carta.id)
    if (personagemId !== null) itens.push({ id: 'ficha', rotulo: 'Abrir a ficha', detalhe: 'PV e Ki também se ajustam por lá', onEscolher: () => useRpgStore.getState().abrirFicha(personagemId) })
    if (combate) {
      itens.push({ id: 'vez', secao: 'Vez', rotulo: 'Dar a vez', desabilitado: carta.vez, detalhe: carta.vez ? 'Já é a vez dele' : 'Fecha o turno de quem está e começa o dele', onEscolher: () => mestre({ tipo: 'darAVez', combatenteId: carta.id }) })
    }
    itens.push({ id: 'subir', secao: combate ? undefined : 'Ordem', rotulo: 'Subir na ordem', desabilitado: indice <= 0, onEscolher: () => mestre({ tipo: 'moverCarta', combatenteId: carta.id, posicao: indice - 1 }) })
    itens.push({ id: 'descer', rotulo: 'Descer na ordem', desabilitado: indice >= cartas.length - 1, onEscolher: () => mestre({ tipo: 'moverCarta', combatenteId: carta.id, posicao: indice + 1 }) })
    itens.push({ id: 'condicao', secao: 'Condições', rotulo: 'Pôr condição…', onEscolher: () => setCaixa({ tipo: 'condicao', carta }) })
    for (const condicao of carta.condicoes) itens.push({ id: `tirar:${condicao.id}`, rotulo: `Tirar ${condicao.nome}`, onEscolher: () => mestre({ tipo: 'tirarCondicao', combatenteId: carta.id, condicaoId: condicao.id }) })
    itens.push({ id: 'temporario', rotulo: 'Modificador temporário…', detalhe: 'Acerto, CA ou dano por algumas rodadas', onEscolher: () => setCaixa({ tipo: 'temporario', carta }) })
    for (const temporario of carta.temporarios) itens.push({ id: `tirar-temp:${temporario.id}`, rotulo: `Tirar ${temporario.rotulo}`, onEscolher: () => mestre({ tipo: 'tirarTemporario', combatenteId: carta.id, temporarioId: temporario.id }) })
    itens.push({
      id: 'desvantagem',
      secao: 'Reações',
      rotulo: 'Reação em Desvantagem',
      marcado: carta.reacaoEmDesvantagem,
      detalhe: 'Reação defensiva sem gastar Ki (precisa ter o Ki)',
      onEscolher: () => mestre({ tipo: 'desvantagem', combatenteId: carta.id, ligada: !carta.reacaoEmDesvantagem }),
    })
    if (combate && vez !== null && vez !== carta.id && nomeDaVez !== null) {
      itens.push({ id: 'oportunidade', rotulo: `Ataque de oportunidade em ${nomeDaVez}`, detalhe: 'Técnica de ação, Ki normal', onEscolher: () => mestre({ tipo: 'acaoGratuita', combatenteId: carta.id, contra: vez, motivo: 'oportunidade' }) })
      itens.push({ id: 'gratuita', rotulo: `Ação gratuita contra ${nomeDaVez}`, detalhe: 'Técnica previsível errou: sem Ki', onEscolher: () => mestre({ tipo: 'acaoGratuita', combatenteId: carta.id, contra: vez, motivo: 'previsivel' }) })
    }
    if (carta.acaoOculta !== null) itens.push({ id: 'oculta', rotulo: 'Disparar a Ação Oculta', detalhe: carta.acaoOculta.texto === '' ? `${carta.acaoOculta.ki} Ki reservados` : carta.acaoOculta.texto, onEscolher: () => mestre({ tipo: 'dispararOculta', combatenteId: carta.id }) })
    if (carta.voo > 0) itens.push({ id: 'derrubar', rotulo: 'Derrubar do voo', detalhe: 'Abre a queda (estabilizar ou cair)', onEscolher: () => mestre({ tipo: 'derrubar', combatenteId: carta.id }) })
    SITUACOES.forEach((situacao, posicao) =>
      itens.push({
        id: `situacao:${situacao}`,
        secao: posicao === 0 ? 'Situação' : undefined,
        rotulo: NOME_DA_SITUACAO[situacao],
        marcado: carta.situacao === situacao,
        onEscolher: () => mestre({ tipo: 'situacao', combatenteId: carta.id, situacao }),
      }),
    )
    itens.push({ id: 'tirar', secao: 'Batalha', rotulo: 'Tirar da batalha', perigo: true, onEscolher: () => mestre({ tipo: 'tirar', combatenteId: carta.id }) })
    return itens
  }

  const entranteEscolhido = deFora.find((entrante) => entrante.tokenId === incluir)

  return (
    <>
      <ol className="dbb-ordem" aria-label="Ordem dos turnos">
        {cartas.map((carta) => (
          <li key={carta.id} className="dbb-carta" data-vez={carta.vez ? 'sim' : 'nao'} data-fora={carta.situacao === 'inconsciente' || carta.situacao === 'morto' ? 'sim' : 'nao'} aria-current={carta.vez ? 'step' : undefined}>
            <span className="dbb-carta__ini" aria-label={carta.iniciativa === null ? 'Sem iniciativa' : `Iniciativa ${carta.iniciativa}`}>
              {carta.iniciativa ?? '–'}
            </span>
            <span className="dbb-carta__corpo">
              <span className="dbb-carta__nome">
                {carta.nome}
                <small>
                  {carta.manual ? 'sem ficha DBT, à mão' : `EP ${carta.ep ?? 0}, CA ${carta.ca ?? 0}`}
                  {carta.npc ? ', NPC' : ''}
                </small>
              </span>
              {carta.pv !== null && carta.pk !== null && (
                <span className="dbb-recursos">
                  <BarraDeRecurso tipo="pv" atual={carta.pv.atual} max={carta.pv.max} />
                  <BarraDeRecurso tipo="pk" atual={carta.pk.atual} max={carta.pk.max} />
                </span>
              )}
              <TagsDaCarta carta={carta} />
            </span>
            <span className="dbb-carta__ctl">
              <button
                type="button"
                className="dbf-btn dbf-btn--sm dbf-btn--ghost"
                aria-haspopup="menu"
                aria-expanded={menu?.carta.id === carta.id}
                aria-label={`Menu de ${carta.nome}`}
                onClick={(evento) => setMenu({ carta, ancora: evento.currentTarget })}
              >
                ⋯
              </button>
            </span>
          </li>
        ))}
      </ol>
      {deFora.length > 0 && (
        <div className="dbb-campos">
          <label className="dbb-campo">
            Incluir quem está na cena
            <select className="dbf-sel" value={incluir} onChange={(evento) => setIncluir(evento.target.value)}>
              <option value="">Escolha uma ficha</option>
              {deFora.map((entrante) => (
                <option key={entrante.tokenId} value={entrante.tokenId}>
                  {entrante.nome}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="dbf-btn dbf-btn--sm"
            disabled={entranteEscolhido === undefined}
            onClick={() => {
              if (entranteEscolhido !== undefined && mestre({ tipo: 'incluir', entrante: entranteEscolhido })) setIncluir('')
            }}
          >
            Incluir (rola a iniciativa)
          </button>
        </div>
      )}
      {menu !== null && <MenuDaCarta ancora={menu.ancora} rotulo={`Ações de ${menu.carta.nome}`} itens={itensDe(menu.carta)} onFechar={() => setMenu(null)} />}
      {caixa?.tipo === 'condicao' && <CaixaDeCondicao carta={caixa.carta} onFechar={() => setCaixa(null)} mestre={mestre} />}
      {caixa?.tipo === 'temporario' && <CaixaDeTemporario carta={caixa.carta} onFechar={() => setCaixa(null)} mestre={mestre} />}
    </>
  )
}

function TagsDaCarta({ carta }: { carta: CartaDBT }) {
  const tags: { id: string; texto: string; classe: string }[] = []
  if (carta.situacao !== 'de-pe') tags.push({ id: 'situacao', texto: carta.situacao === 'salvaguarda' ? `Salvaguarda ${carta.morte.sucessos}/${carta.morte.falhas}` : NOME_DA_SITUACAO[carta.situacao], classe: 'dbf-tag dbb-tag-mal' })
  if (carta.transformacao !== null) tags.push({ id: 'forma', texto: carta.transformacao, classe: 'dbf-tag dbf-tag--amber' })
  if (carta.voo > 0) tags.push({ id: 'voo', texto: NOME_DO_VOO[carta.voo], classe: 'dbf-tag dbf-tag--ki' })
  for (const condicao of carta.condicoes) tags.push({ id: condicao.id, texto: condicao.nome, classe: 'dbf-tag dbb-tag-mal' })
  for (const temporario of carta.temporarios) {
    const partes = [temporario.acerto !== 0 ? `acerto ${comSinal(temporario.acerto)}` : '', temporario.ca !== 0 ? `CA ${comSinal(temporario.ca)}` : '', temporario.dano !== 0 ? `dano ${comSinal(temporario.dano)}` : ''].filter((parte) => parte !== '')
    tags.push({ id: temporario.id, texto: partes.length === 0 ? temporario.rotulo : `${temporario.rotulo}: ${partes.join(', ')}`, classe: 'dbf-tag' })
  }
  if (carta.agarradoPor !== null) tags.push({ id: 'agarrado', texto: `Agarrado por ${carta.agarradoPor}`, classe: 'dbf-tag dbb-tag-mal' })
  if (carta.perdeTurno !== null) tags.push({ id: 'perde', texto: `Perde o próximo turno (${carta.perdeTurno})`, classe: 'dbf-tag dbf-tag--wait' })
  if (carta.reacaoEmDesvantagem) tags.push({ id: 'desvantagem', texto: 'Reação em Desvantagem', classe: 'dbf-tag dbf-tag--fraca' })
  if (carta.acaoOculta !== null) tags.push({ id: 'oculta', texto: 'Ação Oculta pronta', classe: 'dbf-tag dbf-tag--wait' })
  if (tags.length === 0) return null
  return (
    <span className="dbb-carta__tags">
      {tags.map((tag) => (
        <span key={tag.id} className={tag.classe}>
          {tag.texto}
        </span>
      ))}
    </span>
  )
}

function CaixaDeCondicao({ carta, onFechar, mestre }: { carta: CartaDBT; onFechar: () => void; mestre: (acao: AcaoDoMestreDBT) => boolean }) {
  const [condicao, setCondicao] = useState<IdDaCondicao>('atordoado')
  const [cd, setCd] = useState('')
  const [nome, setNome] = useState('')
  const testa = COMPORTAMENTO[condicao].aoAplicar.length > 0
  const enviar = (evento: FormEvent) => {
    evento.preventDefault()
    const valor = Number(cd)
    const acao: Extract<AcaoDoMestreDBT, { tipo: 'porCondicao' }> = { tipo: 'porCondicao', combatenteId: carta.id, condicao }
    if (testa && cd.trim() !== '' && Number.isFinite(valor)) acao.cd = Math.trunc(valor)
    if (condicao === 'personalizada' && nome.trim() !== '') acao.nome = nome.trim()
    if (mestre(acao)) onFechar()
  }
  return (
    <Dialogo aberto titulo={`Pôr condição em ${carta.nome}`} onFechar={onFechar} pequeno descricao="Com CD, ele testa ao receber; sem CD, a condição entra direto.">
      <form className="dbf dbb" onSubmit={enviar}>
        <label className="dbf-fld">
          Condição
          <select className="dbf-sel" value={condicao} onChange={(evento) => setCondicao(evento.target.value as IdDaCondicao)}>
            {CONDICOES.map((id) => (
              <option key={id} value={id}>
                {id === 'personalizada' ? 'Personalizada (só texto)' : nomeDaCondicao(id)}
              </option>
            ))}
          </select>
        </label>
        {condicao === 'personalizada' && (
          <label className="dbf-fld">
            Nome
            <input className="dbf-inp" value={nome} maxLength={60} onChange={(evento) => setNome(evento.target.value)} />
          </label>
        )}
        {testa && (
          <label className="dbf-fld">
            CD do teste ({COMPORTAMENTO[condicao].aoAplicar.map((atributo) => atributo.toUpperCase()).join(' ou ')}); vazio = sem teste
            <input className="dbf-inp dbf-inp--num dbf-inp--curto" type="number" inputMode="numeric" value={cd} onChange={(evento) => setCd(evento.target.value)} />
          </label>
        )}
        <div className="dbb-cartao__acoes">
          <button type="submit" className="dbf-btn dbf-btn--pri">
            Pôr condição
          </button>
          <button type="button" className="dbf-btn dbf-btn--ghost" onClick={onFechar}>
            Cancelar
          </button>
        </div>
      </form>
    </Dialogo>
  )
}

function CaixaDeTemporario({ carta, onFechar, mestre }: { carta: CartaDBT; onFechar: () => void; mestre: (acao: AcaoDoMestreDBT) => boolean }) {
  const [rotulo, setRotulo] = useState('')
  const [acerto, setAcerto] = useState('0')
  const [ca, setCa] = useState('0')
  const [dano, setDano] = useState('0')
  const [rodadas, setRodadas] = useState('1')
  const numero = (texto: string) => (Number.isFinite(Number(texto)) ? Math.trunc(Number(texto)) : 0)
  const vazio = numero(acerto) === 0 && numero(ca) === 0 && numero(dano) === 0
  const enviar = (evento: FormEvent) => {
    evento.preventDefault()
    if (vazio) return
    const quantas = rodadas.trim() === '' ? null : Math.max(1, numero(rodadas))
    if (mestre({ tipo: 'temporario', combatenteId: carta.id, rotulo: rotulo.trim() === '' ? 'Modificador' : rotulo.trim(), acerto: numero(acerto), ca: numero(ca), dano: numero(dano), rodadas: quantas })) onFechar()
  }
  return (
    <Dialogo aberto titulo={`Modificador em ${carta.nome}`} onFechar={onFechar} pequeno descricao="Some quando as rodadas passarem; vazio = até você tirar.">
      <form className="dbf dbb" onSubmit={enviar}>
        <label className="dbf-fld">
          Nome
          <input className="dbf-inp" value={rotulo} maxLength={60} placeholder="Ex.: Kaioken do mestre" onChange={(evento) => setRotulo(evento.target.value)} />
        </label>
        <div className="dbb-campos">
          {(
            [
              ['Acerto', acerto, setAcerto],
              ['CA', ca, setCa],
              ['Dano', dano, setDano],
              ['Rodadas', rodadas, setRodadas],
            ] as const
          ).map(([nome, valor, trocar]) => (
            <label key={nome} className="dbb-campo">
              {nome}
              <input className="dbf-inp" type="number" inputMode="numeric" value={valor} onChange={(evento) => trocar(evento.target.value)} />
            </label>
          ))}
        </div>
        {vazio && <p className="dbb-cartao__d">Ponha algum número em acerto, CA ou dano.</p>}
        <div className="dbb-cartao__acoes">
          <button type="submit" className="dbf-btn dbf-btn--pri" disabled={vazio}>
            Dar o modificador
          </button>
          <button type="button" className="dbf-btn dbf-btn--ghost" onClick={onFechar}>
            Cancelar
          </button>
        </div>
      </form>
    </Dialogo>
  )
}
