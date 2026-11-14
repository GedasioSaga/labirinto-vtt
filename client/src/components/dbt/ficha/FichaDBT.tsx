import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { maximoComposto } from '../../../lib/ajusteDaFicha'
import type { FichaDBT as FichaEstruturada } from '../../../lib/dbt/modelo'
import type { Personagem } from '../../../lib/personagem'
import type { FichaDePersonagemProps } from '../../FichaDePersonagem'
import { AbaHistoria } from './AbaHistoria'
import { AbaInventario } from './AbaInventario'
import { AbaRaca } from './AbaRaca'
import { AbaTalentos } from './AbaTalentos'
import { AbaTecnicas } from './AbaTecnicas'
import { AbaTransformacoes } from './AbaTransformacoes'
import { CabecalhoDBT, RecursosDBT } from './Cabecalho'
import { AtributosDBT, PericiasDBT } from './Colunas'
import { ConstrutorDeTecnica } from './ConstrutorDeTecnica'
import { ContextoDaFichaDBT, useFichaDBT, type FichaDBTNaTela, type IdDaAbaDBT } from './contexto'
import { comMaximosDaRegra, derivadosDe, fichaDe, racaDaFicha, referenciaDosRecursos, varianteDaFicha, type ReferenciaDosRecursos } from './edicaoDaFicha'
import './fichaDBT.css'

/**
 * FICHA DRAGON BALL TALES "Scouter" (fase 2 do plano
 * docs/planos/sistema-dragon-ball.md; desenho aprovado em
 * docs/design/ficha-dragon-ball/prototipo.html). Mesma interface da ficha
 * padrão (`FichaDePersonagemProps`): quem hospeda (a janela do mestre, a do
 * jogador, o perfil da carta) não sabe que ela é outra.
 *
 *  - Fora da edição ela LÊ, e o PV/PK mudam na hora pelo ajuste rápido
 *    (`onAjustar`), como na ficha padrão.
 *  - Em Editar tudo vira controle e vai para o rascunho da janela
 *    (`onChange`); os máximos de PV e PK da regra são gravados junto.
 *  - Jogador/NPC, ND, aprovar técnica especial e valores à mão são do mestre
 *    (`tipoEditavel`, que só a janela do mestre deixa ligado).
 */
export function FichaDBT({ personagem, editando, onChange, escolherImagem, tituloId, tipoEditavel = true, onAjustar, inventario }: FichaDePersonagemProps) {
  const [aba, setAba] = useState<IdDaAbaDBT>('tecnicas')
  const [construtor, setConstrutor] = useState<{ tecnicaId: string | null } | null>(null)
  const quemAbriuOConstrutor = useRef<HTMLElement | null>(null)
  // O PV/PK de quando o Editar abriu: a conta dos máximos parte dele (nasce na primeira mudança, morre no Salvar/Cancelar).
  const referenciaDaEdicao = useRef<ReferenciaDosRecursos | null>(null)
  const painelId = `dbf-${personagem.id}`

  useEffect(() => {
    if (editando) return
    // Salvar, Cancelar ou o X da janela encerram a edição: o construtor aberto fecha junto, e não reabre no próximo Editar.
    setConstrutor(null)
    referenciaDaEdicao.current = null
  }, [editando])

  const ficha = useMemo(() => fichaDe(personagem), [personagem])
  const derivados = useMemo(() => derivadosDe(personagem), [personagem])
  const raca = racaDaFicha(ficha)
  const variante = varianteDaFicha(ficha, raca)
  const ehNpc = personagem.tipo === 'npc'

  const gravar = (proximo: Personagem) => {
    const conta = comMaximosDaRegra(referenciaDaEdicao.current ?? referenciaDosRecursos(personagem), personagem, proximo)
    referenciaDaEdicao.current = conta.referencia
    onChange(conta.personagem)
  }

  const tela: FichaDBTNaTela = {
    personagem,
    ficha,
    derivados,
    raca,
    variante,
    editando,
    // NPC sem o bloco `npc` fora da edição: é o perfil que o jogador abre (o bloco é só do mestre) ou NPC antigo sem ND; nos dois, vale a conta do jogador.
    ehMestre: tipoEditavel && (editando || !ehNpc || ficha.npc !== undefined),
    ehNpc,
    pvAtual: personagem.recursos.pv ?? 0,
    pvMax: personagem.maximos.pv === undefined ? derivados.pvMax.valor : maximoComposto(personagem, 'pv').total,
    pkAtual: personagem.recursos.pk ?? 0,
    pkMax: personagem.maximos.pk === undefined ? derivados.pkMax.valor : maximoComposto(personagem, 'pk').total,
    mudar: (mudanca: (atual: Personagem) => Personagem) => {
      if (!editando) return
      gravar(mudanca(personagem))
    },
    mudarFicha: (mudanca: (atual: FichaEstruturada) => FichaEstruturada) => {
      if (!editando) return
      gravar({ ...personagem, dbt: mudanca(ficha) })
    },
    // Na edição tudo é campo e espera o Salvar; o ajuste rápido é só da leitura (como na ficha padrão).
    ajustar: editando ? undefined : onAjustar,
    irPara: setAba,
    abrirConstrutor: (tecnicaId) => {
      if (!editando) return
      quemAbriuOConstrutor.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setConstrutor({ tecnicaId })
    },
  }

  const fecharConstrutor = () => {
    setConstrutor(null)
    const origem = quemAbriuOConstrutor.current
    // A técnica nova aparece na lista: o foco volta ao botão que abriu, ou ao painel se ele sumiu.
    requestAnimationFrame(() => {
      if (origem !== null && origem.isConnected) origem.focus()
      else document.getElementById(`${painelId}-painel`)?.focus()
    })
  }

  const construtorAberto = editando && construtor !== null

  return (
    <ContextoDaFichaDBT.Provider value={tela}>
      <div className="dbf" data-editando={editando ? '' : undefined}>
        <div className="dbf-casca" hidden={construtorAberto}>
          <CabecalhoDBT tituloId={tituloId} escolherImagem={escolherImagem} />
          <RecursosDBT />
          <div className="dbf-grid">
            <section className="dbf-col" aria-label="Atributos">
              <AtributosDBT />
            </section>
            <section className="dbf-col" aria-label="Perícias">
              <PericiasDBT />
            </section>
            <section className="dbf-main" aria-label="Seções da ficha">
              <AbasDaFicha aba={aba} onAba={setAba} idBase={painelId} />
              <div className="dbf-panel" id={`${painelId}-painel`} role="tabpanel" aria-labelledby={`${painelId}-aba-${aba}`} tabIndex={0}>
                {aba === 'tecnicas' && <AbaTecnicas />}
                {aba === 'transformacoes' && <AbaTransformacoes escolherImagem={escolherImagem} />}
                {aba === 'talentos' && <AbaTalentos />}
                {aba === 'inventario' && <AbaInventario mochila={editando ? undefined : inventario} />}
                {aba === 'raca' && <AbaRaca />}
                {aba === 'historia' && <AbaHistoria />}
              </div>
            </section>
          </div>
        </div>
        {construtorAberto && <ConstrutorDeTecnica key={construtor.tecnicaId ?? 'nova'} tecnicaId={construtor.tecnicaId} onFechar={fecharConstrutor} />}
      </div>
    </ContextoDaFichaDBT.Provider>
  )
}

function AbasDaFicha({ aba, onAba, idBase }: { aba: IdDaAbaDBT; onAba: (aba: IdDaAbaDBT) => void; idBase: string }) {
  const { ficha, derivados, ehNpc } = useFichaDBT()
  const abas: { id: IdDaAbaDBT; nome: string; conta?: string; ponto?: boolean }[] = [
    { id: 'tecnicas', nome: 'Técnicas', conta: String(ficha.tecnicas.length) },
    { id: 'transformacoes', nome: 'Transformações', conta: ficha.transformacoes.length > 0 ? String(ficha.transformacoes.length) : undefined, ponto: ficha.transformacaoAtiva !== null },
    { id: 'talentos', nome: 'Talentos', conta: `${derivados.talentos.usados}/${derivados.talentos.disponiveis + derivados.talentos.movimentosExtras}` },
    { id: 'inventario', nome: 'Inventário', conta: `${derivados.cargaUsada}/${derivados.carga.valor}` },
    { id: 'raca', nome: 'Raça' },
    { id: 'historia', nome: ehNpc ? 'Passivas e notas' : 'História e notas' },
  ]
  // Setas trocam de aba e levam o foco; Tab sai da fileira para o painel (uma parada só).
  const teclas = (event: KeyboardEvent<HTMLDivElement>) => {
    const atual = abas.findIndex((a) => a.id === aba)
    let proxima = -1
    if (event.key === 'ArrowRight') proxima = (atual + 1) % abas.length
    else if (event.key === 'ArrowLeft') proxima = (atual - 1 + abas.length) % abas.length
    else if (event.key === 'Home') proxima = 0
    else if (event.key === 'End') proxima = abas.length - 1
    if (proxima < 0) return
    event.preventDefault()
    const destino = abas[proxima]
    onAba(destino.id)
    requestAnimationFrame(() => document.getElementById(`${idBase}-aba-${destino.id}`)?.focus())
  }
  return (
    <div className="dbf-tabs" role="tablist" aria-label="Seções da ficha" onKeyDown={teclas}>
      {abas.map((a) => (
        <button
          key={a.id}
          type="button"
          role="tab"
          id={`${idBase}-aba-${a.id}`}
          className="dbf-tab"
          aria-selected={a.id === aba}
          aria-controls={`${idBase}-painel`}
          tabIndex={a.id === aba ? 0 : -1}
          onClick={() => onAba(a.id)}
        >
          {a.nome}
          {a.conta !== undefined && <span className="dbf-tab__n">{a.conta}</span>}
          {a.ponto === true && <span className="dbf-tab__ponto" role="img" aria-label="forma ativa" />}
        </button>
      ))}
    </div>
  )
}
