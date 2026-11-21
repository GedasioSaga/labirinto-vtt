import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { ArmadilhaDoObjeto, ConteudoDoObjeto, ItemNoConteudo, Prop, TipoDeArmadilha } from '../../types/map'
import type { Documento } from '../../documentos/tipos'
import {
  armadilhaMudouDoPadrao,
  armadilhaPadrao,
  conteudoDe,
  DANO_DA_ARMADILHA_MAX,
  DOCUMENTOS_NO_CONTEUDO_MAX,
  ITENS_NO_CONTEUDO_MAX,
  MINIGAME_DO_OBJETO,
  minigameLigado,
  mobiliaDoConteudo,
  MOEDAS_NO_CONTEUDO_MAX,
  objetoReposto,
  POR_VEZ_DA_ARMADILHA_MAX,
  TURNOS_DA_ARMADILHA_MAX,
  type MobiliaComConteudo,
} from '../../lib/conteudoDoObjeto'
import { itemParaDar, type ItemDoCatalogo } from '../../lib/acervoDeItens'
import { ITEM_QUANTIDADE_MAX } from '../../lib/items'
import { movimentoReduzido } from '../../lib/primitivosDaTela'
import { useMapStore } from '../../stores/mapStore'
import { useToastStore } from '../../stores/toastStore'
import { tituloOuSemTitulo } from '../../documentos/naFicha'
import { DOCUMENTO_APAGADO_DA_BIBLIOTECA, useBibliotecaDeDocumentos } from '../documentos/EscolhaDeDocumento'
import { IconeDoPapel } from '../documentos/IconeDoPapel'
import { ImagemOuIniciais } from '../FichaPecas'
import { Toggle } from '../Toggle'
import { Desenho, Icone, type DesenhoDoConteudo } from './conteudo/DesenhosDoConteudo'
import { EscolhaDeDocumentoDoBau } from './conteudo/EscolhaDeDocumentoDoBau'
import { EscolhaDoAcervo } from './conteudo/EscolhaDoAcervo'
import './conteudoDoObjeto.css'

/*
 * CONTEÚDO do baú, da caixa e do barril (ficha do objeto). Redesign aprovado
 * pelo mestre em 21/11/2026 ("gostei"; docs/design/bau/NOTAS.md e o
 * protótipo conteudo-do-bau.html): toda linha começa pela vaga com a
 * miniatura; itens, documentos e moedas moram na mesma lista "Dentro do baú";
 * a escolha do acervo é a grade de miniaturas e fica aberta depois de pôr;
 * minigame e armadilha descem para "Ao abrir". Cada mudança é um passo do
 * Ctrl+Z (`updateProp`); tirar também oferece Desfazer no aviso. Regras em
 * `lib/conteudoDoObjeto.ts` (os dados não mudaram).
 */

/** O passo das moedas no − e no +. */
const PASSO_DAS_MOEDAS = 5
/** Quanto o Desfazer do tirar fica no aviso. */
const DESFAZER_MS = 5000
/** O clique na lixeira logo depois de ela aparecer é o mesmo gesto do "−": ignora. */
const LIXEIRA_ACABOU_DE_APARECER_MS = 450
/** A partir de quantos tipos a conta vira "N de 40 tipos". */
const TIPOS_PARA_AVISAR = ITENS_NO_CONTEUDO_MAX - 5
/** As linhas que sobem quando uma sai (FLIP, só `transform`). */
const DESLIZE_MS = 180
const SAIDA_MS = 120
const CURVA_DE_SAIDA = 'cubic-bezier(0.23, 1, 0.32, 1)'

interface TextosDoObjeto {
  dentro: string
  no: string
  do: string
  poe: string
  vazio: string
  verbo: 'abrir' | 'quebrar'
  passado: 'abriu' | 'quebrou'
  desenho: DesenhoDoConteudo
  ferramenta: DesenhoDoConteudo
}

const TEXTOS: Readonly<Record<MobiliaComConteudo, TextosDoObjeto>> = {
  bau: { dentro: 'Dentro do baú', no: 'no baú', do: 'do baú', poe: 'põe no baú', vazio: 'O baú abre vazio', verbo: 'abrir', passado: 'abriu', desenho: 'bau', ferramenta: 'cadeado' },
  caixa: { dentro: 'Dentro da caixa', no: 'na caixa', do: 'da caixa', poe: 'põe na caixa', vazio: 'A caixa quebra e não tem nada', verbo: 'quebrar', passado: 'quebrou', desenho: 'caixa', ferramenta: 'pe-de-cabra' },
  barril: { dentro: 'Dentro do barril', no: 'no barril', do: 'do barril', poe: 'põe no barril', vazio: 'O barril quebra e não tem nada', verbo: 'quebrar', passado: 'quebrou', desenho: 'barril', ferramenta: 'marreta' },
}

function hora(em: number): string {
  const data = new Date(em)
  return `${String(data.getHours()).padStart(2, '0')}h${String(data.getMinutes()).padStart(2, '0')}`
}

/** A chave estável da linha do item: o id do acervo; o item de antes, sem id, pelo nome e lugar. */
function chaveDoItem(dentro: ItemNoConteudo, indice: number): string {
  return dentro.item.itemId === undefined ? `n:${indice}:${dentro.item.nome}` : `i:${dentro.item.itemId}`
}

function totalDeItens(conteudo: ConteudoDoObjeto): number {
  return conteudo.itens.reduce((soma, dentro) => soma + dentro.quantidade, 0)
}

function textoDaConta(conteudo: ConteudoDoObjeto): string {
  if (conteudo.itens.length >= TIPOS_PARA_AVISAR) return `${conteudo.itens.length} de ${ITENS_NO_CONTEUDO_MAX} tipos`
  const total = totalDeItens(conteudo)
  return total === 0 ? '' : total === 1 ? '1 item' : `${total.toLocaleString('pt-BR')} itens`
}

function fraseDaArmadilha(armadilha: ArmadilhaDoObjeto | null): string {
  if (armadilha === null) return 'Nenhuma: abriu, pegou'
  return `${armadilha.tipo === 'cobra' ? 'Cobra' : 'Aranha'}: ${armadilha.dano} PV e ${armadilha.efeito} ${armadilha.turnos} turnos`
}

/** O primeiro ancestral que rola na vertical: a página do livro. */
function quemRola(elemento: HTMLElement): HTMLElement | null {
  for (let pai = elemento.parentElement; pai !== null; pai = pai.parentElement) {
    const { overflowY } = getComputedStyle(pai)
    if ((overflowY === 'auto' || overflowY === 'scroll') && pai.scrollHeight > pai.clientHeight) return pai
  }
  return null
}

interface PassoProps {
  rotulo: string
  valor: number
  min: number
  max: number
  passo?: number
  rotuloMenos: string
  rotuloMais: string
  aoMudar: (valor: number) => void
  /** Com isto, no mínimo o − vira a lixeira e digitar 0 também tira. */
  tirar?: { rotulo: string; aoTirar: () => void }
}

/**
 * O PASSO: − número +, numa pílula só (decisão 2). O número é digitável e vale
 * no Enter ou ao sair; ↑ ↓ mudam de um passo, PageUp/PageDown de dez, Shift
 * multiplica por dez. Vazio volta ao de antes.
 */
function Passo({ rotulo, valor, min, max, passo = 1, rotuloMenos, rotuloMais, aoMudar, tirar }: PassoProps) {
  const [texto, setTexto] = useState<string | null>(null)
  const lixeiraDesde = useRef(0)
  const limitar = (n: number) => Math.min(max, Math.max(min, Math.round(n)))
  const ehLixeira = tirar !== undefined && valor <= min

  const confirmar = (campo: HTMLInputElement) => {
    const digitado = texto
    setTexto(null)
    if (digitado === null || digitado.trim() === '') return
    const lido = Number(digitado)
    if (!Number.isFinite(lido) || lido === valor) return
    if (tirar !== undefined && lido <= 0) {
      tirar.aoTirar()
      return
    }
    aoMudar(limitar(lido))
    campo.select()
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLInputElement>) => {
    const passos: Partial<Record<string, number>> = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 }
    const vezes = passos[evento.key]
    if (vezes !== undefined) {
      evento.preventDefault()
      setTexto(null)
      const novo = limitar(valor + vezes * passo * (evento.shiftKey ? 10 : 1))
      if (novo !== valor) aoMudar(novo)
      const campo = evento.currentTarget
      requestAnimationFrame(() => campo.select())
    } else if (evento.key === 'Enter') {
      evento.preventDefault()
      confirmar(evento.currentTarget)
    }
  }

  const menos = () => {
    if (ehLixeira) {
      if (performance.now() - lixeiraDesde.current < LIXEIRA_ACABOU_DE_APARECER_MS) return
      tirar.aoTirar()
      return
    }
    const novo = limitar(valor - passo)
    if (tirar !== undefined && novo <= min) lixeiraDesde.current = performance.now()
    aoMudar(novo)
  }

  const rotuloDoMenos = ehLixeira ? tirar.rotulo : rotuloMenos
  return (
    <span className="lb-conteudo__passo" role="group" aria-label={rotulo}>
      <button
        type="button"
        className={`lb-conteudo__passo-bt${ehLixeira ? ' lb-conteudo__passo-bt--tirar' : ''}`}
        aria-label={rotuloDoMenos}
        title={rotuloDoMenos}
        disabled={!ehLixeira && valor <= min}
        onClick={menos}
      >
        <Icone nome={ehLixeira ? 'lixo' : 'menos'} />
      </button>
      <input
        className="lb-conteudo__passo-num"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        aria-label={rotulo}
        value={texto ?? String(valor)}
        onFocus={(evento) => evento.currentTarget.select()}
        onChange={(evento) => setTexto(evento.target.value.replace(/\D/g, '').slice(0, 7))}
        onBlur={(evento) => confirmar(evento.currentTarget)}
        onKeyDown={aoTeclar}
      />
      <button type="button" className="lb-conteudo__passo-bt" aria-label={rotuloMais} title={rotuloMais} disabled={valor >= max} onClick={() => aoMudar(limitar(valor + passo))}>
        <Icone nome="mais" />
      </button>
    </span>
  )
}

/** A linha de toda coisa dentro: a vaga, o nome em cima, o resto embaixo e o controle. */
function Linha({ chave, classe, vaga, nome, sub, controle, realce, aoApagarRealce }: { chave: string; classe?: string; vaga: ReactNode; nome: ReactNode; sub: string; controle: ReactNode; realce: number | null; aoApagarRealce: () => void }) {
  return (
    <li className={`lb-conteudo__linha${classe === undefined ? '' : ` ${classe}`}`} data-flip={chave}>
      {vaga}
      <span className="lb-conteudo__linha-nome">{nome}</span>
      <span className="lb-conteudo__linha-sub" title={sub}>
        {sub}
      </span>
      {controle}
      {/* O realce do pôr: uma camada que acende e apaga; a `key` nova repete a animação. */}
      {realce !== null && <span key={realce} className="lb-conteudo__realce" aria-hidden="true" onAnimationEnd={aoApagarRealce} />}
    </li>
  )
}

const OPCOES_DA_ARMADILHA: readonly { valor: TipoDeArmadilha | 'nenhuma'; rotulo: string }[] = [
  { valor: 'nenhuma', rotulo: 'Nenhuma' },
  { valor: 'cobra', rotulo: 'Cobra' },
  { valor: 'aranha', rotulo: 'Aranha' },
]

function CamposDaArmadilha({ armadilha, aoMudar, jumpscare }: { armadilha: ArmadilhaDoObjeto; aoMudar: (armadilha: ArmadilhaDoObjeto) => void; jumpscare: boolean }) {
  const voltar = armadilhaMudouDoPadrao(armadilha) && (
    <>
      {' '}
      <button type="button" className="lb-conteudo__link" onClick={() => aoMudar(armadilhaPadrao(armadilha.tipo))}>
        Voltar ao padrão
      </button>
    </>
  )
  const par = (titulo: string, unidade: string, rotulo: string, valor: number, min: number, max: number, mudar: (n: number) => void) => (
    <div className="lb-conteudo__par">
      <span>
        {titulo} <small>{unidade}</small>
      </span>
      <Passo rotulo={rotulo} valor={valor} min={min} max={max} rotuloMenos={`Menos ${titulo.toLowerCase()}`} rotuloMais={`Mais ${titulo.toLowerCase()}`} aoMudar={mudar} />
    </div>
  )
  return (
    <div className="lb-conteudo__armadilha">
      {par('Dano na hora', 'PV', 'Dano na hora, em PV', armadilha.dano, 0, DANO_DA_ARMADILHA_MAX, (dano) => aoMudar({ ...armadilha, dano }))}
      {par(armadilha.efeito, 'turnos', `Turnos de ${armadilha.efeito}`, armadilha.turnos, 1, TURNOS_DA_ARMADILHA_MAX, (turnos) => aoMudar({ ...armadilha, turnos }))}
      {armadilha.tipo === 'cobra' ? (
        <>
          {par('Por turno', 'PV perdidos', 'PV perdidos por turno', armadilha.porVez, 1, POR_VEZ_DA_ARMADILHA_MAX, (porVez) => aoMudar({ ...armadilha, porVez }))}
          <p className="lb-conteudo__nota">
            Padrão da cobra: 8 PV na hora e Envenenado por 3 turnos, perdendo 4 PV em cada.{voltar}
          </p>
          <p className="lb-conteudo__nota">Jumpscare {jumpscare ? 'ligado' : 'desligado'} neste mapa (Configurações do mapa, Armadilhas).</p>
        </>
      ) : (
        <p className="lb-conteudo__nota">
          Lento: anda metade do passo enquanto durar. Padrão da aranha: 5 PV e Lento por 2 turnos.{voltar}
        </p>
      )}
    </div>
  )
}

/** "Ao abrir" ("Ao quebrar"): o minigame e a armadilha, embaixo do conteúdo (decisão 7). */
function SecaoAoAbrir({ conteudo, tipo, textos, mudar, jumpscare }: { conteudo: ConteudoDoObjeto; tipo: MobiliaComConteudo; textos: TextosDoObjeto; mudar: (novo: ConteudoDoObjeto) => void; jumpscare: boolean }) {
  const explicacaoId = useId()
  const tituloId = useId()
  const ligado = minigameLigado(conteudo)
  const marcada = conteudo.armadilha?.tipo ?? 'nenhuma'
  const trocar = (valor: TipoDeArmadilha | 'nenhuma', grupo: HTMLElement | null) => {
    if (valor !== marcada) mudar({ ...conteudo, armadilha: valor === 'nenhuma' ? null : armadilhaPadrao(valor) })
    grupo?.querySelector<HTMLButtonElement>(`[data-valor="${valor}"]`)?.focus()
  }
  const aoTeclar = (evento: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const destino = evento.key === 'ArrowRight' || evento.key === 'ArrowDown' ? indice + 1 : evento.key === 'ArrowLeft' || evento.key === 'ArrowUp' ? indice - 1 : null
    if (destino === null) return
    evento.preventDefault()
    const total = OPCOES_DA_ARMADILHA.length
    const opcao = OPCOES_DA_ARMADILHA[(destino + total) % total]
    if (opcao !== undefined) trocar(opcao.valor, evento.currentTarget.parentElement)
  }
  return (
    <section className="lb-conteudo__secao" aria-labelledby={tituloId} data-flip="ao-abrir">
      <div className="lb-conteudo__secao-cab">
        <span id={tituloId}>Ao {textos.verbo}</span>
      </div>
      {/* MINIGAME PARA O JOGADOR (16/11/2026): ligado, o jogador vê o selo de latão no objeto e o toque abre o jogo. */}
      <div className="lb-conteudo__linha lb-conteudo__linha--ao lb-conteudo__linha--chave">
        <span className={`lb-conteudo__vaga${ligado ? '' : ' e-desligada'}`} aria-hidden="true">
          <Desenho nome={textos.ferramenta} />
        </span>
        <Toggle label="Minigame para o jogador" checked={ligado} onChange={(liga) => mudar({ ...conteudo, minigame: liga })} describedBy={explicacaoId} />
        <span className="lb-conteudo__linha-sub">{ligado ? MINIGAME_DO_OBJETO[tipo] : 'Desligado'}</span>
      </div>
      <p id={explicacaoId} className="lb-conteudo__nota">
        {ligado ? (
          <>
            <b>{MINIGAME_DO_OBJETO[tipo]}</b>, pelo tipo do objeto. O jogador vê o selo, encosta e joga na tela dele; se errar, tenta de novo sem custo.
          </>
        ) : (
          'O toque do jogador não abre nada, e o objeto fica sem selo.'
        )}
      </p>
      <div className="lb-conteudo__linha lb-conteudo__linha--ao">
        <span className={`lb-conteudo__vaga${conteudo.armadilha === null ? ' lb-conteudo__vaga--vazia' : ''}`} aria-hidden="true">
          <Desenho nome={conteudo.armadilha === null ? 'nada' : conteudo.armadilha.tipo} />
        </span>
        <span className="lb-conteudo__linha-nome">Armadilha</span>
        <span className="lb-conteudo__linha-sub">{fraseDaArmadilha(conteudo.armadilha)}</span>
      </div>
      <div className="lb-conteudo__seg" role="radiogroup" aria-label="Armadilha">
        {OPCOES_DA_ARMADILHA.map((opcao, indice) => (
          <button
            key={opcao.valor}
            type="button"
            role="radio"
            aria-checked={marcada === opcao.valor}
            tabIndex={marcada === opcao.valor ? 0 : -1}
            data-valor={opcao.valor}
            className="lb-conteudo__seg-bt"
            onClick={(evento) => trocar(opcao.valor, evento.currentTarget.parentElement)}
            onKeyDown={(evento) => aoTeclar(evento, indice)}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
      {conteudo.armadilha !== null && <CamposDaArmadilha armadilha={conteudo.armadilha} jumpscare={jumpscare} aoMudar={(armadilha) => mudar({ ...conteudo, armadilha })} />}
    </section>
  )
}

type Escolha = 'itens' | 'docs' | null

/** A seção Conteúdo; só existe para o baú, a caixa, o barril e os destroços deles. */
export function ConteudoDoObjetoFicha({ prop }: { prop: Prop }) {
  const updateProp = useMapStore((state) => state.updateProp)
  const jumpscare = useMapStore((state) => state.map.semJumpscare !== true)
  const documentos = useBibliotecaDeDocumentos()
  const [escolha, setEscolha] = useState<Escolha>(null)
  const [realce, setRealce] = useState<{ chave: string; vez: number } | null>(null)
  const [ultimoPosto, setUltimoPosto] = useState<{ id: string; vez: number } | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const tituloId = useId()
  const docsCheiosId = useId()
  const buscaRef = useRef<HTMLInputElement>(null)
  const botaoItensRef = useRef<HTMLButtonElement>(null)
  const botaoDocsRef = useRef<HTMLButtonElement>(null)
  const raizRef = useRef<HTMLDivElement>(null)
  const escolhaCasaRef = useRef<HTMLDivElement>(null)
  // FLIP: onde cada pedaço estava antes de uma linha sair ou voltar.
  const posicoesAntes = useRef<Map<string, number> | null>(null)
  // A escolha aberta fica no mesmo lugar da tela quando a linha nova entra acima dela.
  const topoDaEscolhaAntes = useRef<number | null>(null)
  const vezes = useRef(0)

  useLayoutEffect(() => {
    const raiz = raizRef.current
    const antes = posicoesAntes.current
    posicoesAntes.current = null
    if (raiz !== null && antes !== null && !movimentoReduzido()) {
      for (const pedaco of raiz.querySelectorAll<HTMLElement>('[data-flip]')) {
        const topo = antes.get(pedaco.dataset.flip ?? '')
        if (topo === undefined) continue
        const delta = topo - pedaco.getBoundingClientRect().top
        if (Math.abs(delta) >= 1) pedaco.animate([{ transform: `translateY(${delta}px)` }, { transform: 'none' }], { duration: DESLIZE_MS, easing: CURVA_DE_SAIDA })
      }
    }
    const topo = topoDaEscolhaAntes.current
    topoDaEscolhaAntes.current = null
    const casa = escolhaCasaRef.current
    if (topo === null || casa === null) return
    const delta = casa.getBoundingClientRect().top - topo
    const pagina = quemRola(casa)
    if (Math.abs(delta) >= 1 && pagina !== null) pagina.scrollTop += delta
  })

  const tipo = mobiliaDoConteudo(prop)
  const conteudo = conteudoDe(prop)
  if (tipo === null || conteudo === null) return null
  const textos = TEXTOS[tipo]
  const mudar = (novo: ConteudoDoObjeto) => updateProp(prop.id, { conteudo: novo })
  // Para quem age depois (o Desfazer do aviso, o fim da animação de saída): o conteúdo de agora, não o do desenho.
  const conteudoAgora = (): ConteudoDoObjeto | null => {
    const atual = useMapStore.getState().map.props.find((outro) => outro.id === prop.id)
    return atual === undefined ? null : conteudoDe(atual)
  }
  const proximaVez = () => {
    vezes.current += 1
    return vezes.current
  }
  const anunciar = (texto: string) => {
    setAnuncio('')
    requestAnimationFrame(() => setAnuncio(texto))
  }
  const guardarPosicoes = () => {
    const raiz = raizRef.current
    if (raiz === null) return
    posicoesAntes.current = new Map([...raiz.querySelectorAll<HTMLElement>('[data-flip]')].map((pedaco) => [pedaco.dataset.flip ?? '', pedaco.getBoundingClientRect().top]))
  }
  const guardarTopoDaEscolha = () => {
    topoDaEscolhaAntes.current = escolhaCasaRef.current?.getBoundingClientRect().top ?? null
  }

  const docIds = conteudo.documentos ?? []
  const comDocumentos = (base: ConteudoDoObjeto, proximos: string[]): ConteudoDoObjeto => {
    const { documentos: _antes, ...semDocumentos } = base
    return proximos.length > 0 ? { ...semDocumentos, documentos: proximos } : semDocumentos
  }

  const porItem = (escolhido: ItemDoCatalogo) => {
    const ja = conteudo.itens.findIndex((dentro) => dentro.item.itemId === escolhido.id)
    if (ja < 0 && conteudo.itens.length >= ITENS_NO_CONTEUDO_MAX) return
    const total = ja < 0 ? 1 : Math.min(ITEM_QUANTIDADE_MAX, (conteudo.itens[ja]?.quantidade ?? 0) + 1)
    guardarTopoDaEscolha()
    if (ja >= 0) {
      mudar({ ...conteudo, itens: conteudo.itens.map((dentro, i) => (i === ja ? { ...dentro, quantidade: total } : dentro)) })
    } else {
      // Sem munições: o conteúdo do objeto não guarda a lista; a arma tirada dele cai no Acervo de agora.
      mudar({ ...conteudo, itens: [...conteudo.itens, { item: itemParaDar(escolhido, []), quantidade: 1 }] })
    }
    const vez = proximaVez()
    setRealce({ chave: `i:${escolhido.id}`, vez })
    setUltimoPosto({ id: escolhido.id, vez })
    anunciar(`${escolhido.nome}: ${total} ${textos.no}.`)
  }

  const porDocumento = (documento: Documento) => {
    if (docIds.includes(documento.id) || docIds.length >= DOCUMENTOS_NO_CONTEUDO_MAX) return
    guardarTopoDaEscolha()
    mudar(comDocumentos(conteudo, [...docIds, documento.id]))
    setRealce({ chave: `d:${documento.id}`, vez: proximaVez() })
    anunciar(`${tituloOuSemTitulo(documento)} entrou ${textos.no}.`)
    if (docIds.length + 1 >= DOCUMENTOS_NO_CONTEUDO_MAX) fecharEscolha()
  }

  /**
   * Tirar (decisão 2): a linha sai pela direita, as de baixo sobem, e o aviso
   * oferece Desfazer por 5 s. O Desfazer devolve só o que saiu, no mesmo lugar
   * e com a mesma quantidade; o que mudou depois fica.
   */
  const tirarComDesfazer = (botao: HTMLElement, rotulo: string, tirar: (base: ConteudoDoObjeto) => ConteudoDoObjeto, devolver: (base: ConteudoDoObjeto) => ConteudoDoObjeto | null, chave: string) => {
    const linha = botao.closest<HTMLElement>('.lb-conteudo__linha')
    // O foco não morre com a linha: vai para a linha de baixo, ou para o botão de pôr.
    const proximo = linha?.nextElementSibling?.querySelector<HTMLElement>('button:not(:disabled), input') ?? botaoItensRef.current
    proximo?.focus({ preventScroll: true })
    const concluir = () => {
      const atual = conteudoAgora()
      if (atual === null) return
      guardarPosicoes()
      mudar(tirar(atual))
      useToastStore.getState().push('info', `${rotulo} saiu ${textos.do}.`, DESFAZER_MS, {
        actions: [
          {
            label: 'Desfazer',
            run: () => {
              const agora = conteudoAgora()
              const volta = agora === null ? null : devolver(agora)
              if (volta === null) return
              guardarPosicoes()
              mudar(volta)
              setRealce({ chave, vez: proximaVez() })
              anunciar(`${rotulo} voltou.`)
            },
          },
        ],
      })
      anunciar(`${rotulo} saiu ${textos.do}. Desfazer no aviso, ou Ctrl+Z.`)
    }
    if (linha === null || movimentoReduzido()) {
      concluir()
      return
    }
    linha.style.pointerEvents = 'none'
    const saida = linha.animate(
      [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: 'translateX(10px)' },
      ],
      { duration: SAIDA_MS, easing: CURVA_DE_SAIDA, fill: 'forwards' },
    )
    saida.onfinish = concluir
  }

  const tirarItem = (indice: number, botao: HTMLElement) => {
    const dentro = conteudo.itens[indice]
    if (dentro === undefined) return
    const chave = chaveDoItem(dentro, indice)
    const mesmo = (outro: ItemNoConteudo, i: number) => chaveDoItem(outro, i) === chave
    tirarComDesfazer(
      botao,
      dentro.item.nome,
      (base) => ({ ...base, itens: base.itens.filter((outro, i) => !mesmo(outro, i)) }),
      (base) => {
        if (dentro.item.itemId !== undefined && base.itens.some((outro) => outro.item.itemId === dentro.item.itemId)) return null
        if (base.itens.length >= ITENS_NO_CONTEUDO_MAX) return null
        const itens = [...base.itens]
        itens.splice(Math.min(indice, itens.length), 0, dentro)
        return { ...base, itens }
      },
      chave,
    )
  }

  const tirarDocumento = (docId: string, titulo: string, botao: HTMLElement) => {
    const indice = docIds.indexOf(docId)
    tirarComDesfazer(
      botao,
      titulo,
      (base) => comDocumentos(base, (base.documentos ?? []).filter((outro) => outro !== docId)),
      (base) => {
        const atuais = base.documentos ?? []
        if (atuais.includes(docId) || atuais.length >= DOCUMENTOS_NO_CONTEUDO_MAX) return null
        const proximos = [...atuais]
        proximos.splice(Math.min(indice, proximos.length), 0, docId)
        return comDocumentos(base, proximos)
      },
      `d:${docId}`,
    )
  }

  const mudarQuantidade = (indice: number, quantidade: number) => {
    const dentro = conteudo.itens[indice]
    if (dentro === undefined || quantidade === dentro.quantidade) return
    mudar({ ...conteudo, itens: conteudo.itens.map((outro, i) => (i === indice ? { ...outro, quantidade } : outro)) })
    anunciar(`${dentro.item.nome}: ${quantidade} ${textos.no}.`)
  }

  function fecharEscolha() {
    const qual = escolha
    setEscolha(null)
    const volta = qual === 'docs' ? botaoDocsRef.current : botaoItensRef.current
    if (volta !== null && !volta.disabled) volta.focus()
    else botaoItensRef.current?.focus()
  }

  const abrirEscolha = (qual: 'itens' | 'docs') => {
    if (escolha === qual) {
      // Já aberta: o botão leva de volta à busca, com o texto selecionado (não fecha: pôr o próximo é o gesto comum).
      buscaRef.current?.focus()
      buscaRef.current?.select()
      return
    }
    setEscolha(qual)
  }

  const quantos = new Map<string, number>()
  for (const dentro of conteudo.itens) if (dentro.item.itemId !== undefined) quantos.set(dentro.item.itemId, dentro.quantidade)
  const docsCheios = docIds.length >= DOCUMENTOS_NO_CONTEUDO_MAX
  const vazio = conteudo.itens.length === 0 && docIds.length === 0
  const apagarRealce = () => setRealce(null)
  const realceDe = (chave: string) => (realce !== null && realce.chave === chave ? realce.vez : null)
  const aberto = conteudo.aberto

  return (
    <div ref={raizRef} className="lb-conteudo">
      {aberto !== undefined && (
        <div className="lb-conteudo__aberto">
          <span className="lb-conteudo__vaga" aria-hidden="true">
            <Desenho nome={tipo === 'bau' ? 'bau-aberto' : textos.desenho} />
          </span>
          <p>
            <b>
              {aberto.por === '' ? 'Alguém' : aberto.por} {textos.passado}
              {aberto.em > 0 ? ` às ${hora(aberto.em)}` : ''}.
            </b>
            <br />
            <span className="lb-conteudo__nota">Repor guarda o mesmo conteúdo de novo, para outro jogador {textos.verbo}.</span>
          </p>
          <button
            type="button"
            className="lb-conteudo__bt"
            onClick={() => {
              // O tamanho volta junto: o barril quebrado é maior que o barril (os cacos em volta), no mesmo centro.
              const antes = { conteudo: prop.conteudo, mobilia: prop.mobilia, width: prop.width, height: prop.height }
              const reposto = objetoReposto(prop)
              updateProp(prop.id, { conteudo: reposto.conteudo, mobilia: reposto.mobilia, width: reposto.width, height: reposto.height })
              botaoItensRef.current?.focus()
              useToastStore.getState().push('info', 'Fechado e reposto, com o mesmo conteúdo.', DESFAZER_MS, { actions: [{ label: 'Desfazer', run: () => updateProp(prop.id, antes) }] })
            }}
          >
            Fechar e repor
          </button>
        </div>
      )}

      <section className="lb-conteudo__secao" aria-labelledby={tituloId}>
        <div className="lb-conteudo__secao-cab">
          <span id={tituloId}>{textos.dentro}</span>
          <output>{textoDaConta(conteudo)}</output>
        </div>
        <ul className="lb-conteudo__lista" aria-labelledby={tituloId}>
          {conteudo.itens.map((dentro, indice) => {
            const chave = chaveDoItem(dentro, indice)
            const nome = dentro.item.nome
            return (
              <Linha
                key={chave}
                chave={chave}
                classe="lb-conteudo__item"
                realce={realceDe(chave)}
                aoApagarRealce={apagarRealce}
                vaga={
                  <span className="lb-conteudo__vaga" aria-hidden="true">
                    <ImagemOuIniciais imagem={dentro.item.imagem} nome={nome} />
                  </span>
                }
                nome={nome}
                sub={dentro.item.categoria ?? 'Sem categoria'}
                controle={
                  <Passo
                    rotulo={`Quantidade de ${nome}`}
                    valor={dentro.quantidade}
                    min={1}
                    max={ITEM_QUANTIDADE_MAX}
                    rotuloMenos={`Menos ${nome}`}
                    rotuloMais={`Mais ${nome}`}
                    aoMudar={(quantidade) => mudarQuantidade(indice, quantidade)}
                    tirar={{
                      rotulo: `Tirar ${nome} ${textos.do}`,
                      aoTirar: () => {
                        const botao = raizRef.current?.querySelector<HTMLElement>(`[data-flip="${CSS.escape(chave)}"]`)
                        if (botao !== null && botao !== undefined) tirarItem(indice, botao)
                      },
                    }}
                  />
                }
              />
            )
          })}
          {docIds.map((docId) => {
            const documento = documentos.find((candidato) => candidato.id === docId)
            const titulo = documento === undefined ? DOCUMENTO_APAGADO_DA_BIBLIOTECA : tituloOuSemTitulo(documento)
            const chave = `d:${docId}`
            return (
              <Linha
                key={chave}
                chave={chave}
                classe="lb-conteudo__item"
                realce={realceDe(chave)}
                aoApagarRealce={apagarRealce}
                vaga={
                  <span className={`lb-conteudo__vaga${documento === undefined ? ' lb-conteudo__vaga--apagado' : ''}`} aria-hidden="true">
                    {documento !== undefined && <IconeDoPapel papel={documento.papel} />}
                  </span>
                }
                nome={titulo}
                sub={documento === undefined ? 'Não vai para ninguém' : 'Documento, chega como novo'}
                controle={
                  <button type="button" className="lb-conteudo__tirar" aria-label={`Tirar ${titulo}`} title={`Tirar ${textos.do}`} onClick={(evento) => tirarDocumento(docId, titulo, evento.currentTarget)}>
                    <Icone nome="lixo" />
                  </button>
                }
              />
            )
          })}
          {vazio && (
            <li className="lb-conteudo__vazio" data-flip="vazio">
              <span className="lb-conteudo__vaga lb-conteudo__vaga--vazia" aria-hidden="true">
                <Desenho nome={textos.desenho} />
              </span>
              <span>
                <b>{conteudo.moedas > 0 ? 'Só moedas' : textos.vazio}</b>
                <span>{conteudo.moedas > 0 ? 'Nenhum item nem documento.' : 'Ponha itens do acervo ou documentos.'}</span>
              </span>
            </li>
          )}
          <Linha
            chave="moedas"
            classe={`lb-conteudo__linha--moedas${conteudo.moedas === 0 ? ' e-zero' : ''}`}
            realce={null}
            aoApagarRealce={apagarRealce}
            vaga={
              <span className="lb-conteudo__vaga" aria-hidden="true">
                <Desenho nome="moedas" />
              </span>
            }
            nome="Moedas"
            sub={conteudo.moedas === 0 ? 'Nenhuma' : `de ${PASSO_DAS_MOEDAS} em ${PASSO_DAS_MOEDAS}`}
            controle={
              <Passo
                rotulo="Moedas"
                valor={conteudo.moedas}
                min={0}
                max={MOEDAS_NO_CONTEUDO_MAX}
                passo={PASSO_DAS_MOEDAS}
                rotuloMenos={`Menos ${PASSO_DAS_MOEDAS} moedas`}
                rotuloMais={`Mais ${PASSO_DAS_MOEDAS} moedas`}
                aoMudar={(moedas) => mudar({ ...conteudo, moedas })}
              />
            }
          />
        </ul>
        <div className="lb-conteudo__acoes" data-flip="acoes">
          <button ref={botaoItensRef} type="button" className="lb-conteudo__bt lb-conteudo__bt--latao" aria-haspopup="dialog" aria-expanded={escolha === 'itens'} onClick={() => abrirEscolha('itens')}>
            <span className="lb-conteudo__bt-mais">+</span> Item do acervo
          </button>
          <button
            ref={botaoDocsRef}
            type="button"
            className="lb-conteudo__bt"
            aria-haspopup="dialog"
            aria-expanded={escolha === 'docs'}
            aria-describedby={docsCheios ? docsCheiosId : undefined}
            disabled={docsCheios}
            onClick={() => abrirEscolha('docs')}
          >
            <span className="lb-conteudo__bt-mais">+</span> Documento
          </button>
        </div>
        {docsCheios && (
          <p className="lb-conteudo__nota" id={docsCheiosId}>
            Já tem {DOCUMENTOS_NO_CONTEUDO_MAX} documentos, o máximo. Tire um para pôr outro.
          </p>
        )}
        <div ref={escolhaCasaRef} data-flip="escolha">
          {escolha === 'itens' && (
            <EscolhaDoAcervo
              quantos={quantos}
              cheioDeTipos={conteudo.itens.length >= ITENS_NO_CONTEUDO_MAX}
              tiposMax={ITENS_NO_CONTEUDO_MAX}
              noObjeto={textos.no}
              poe={textos.poe}
              desenho={textos.desenho}
              ultimoPosto={ultimoPosto}
              buscaRef={buscaRef}
              aoPor={porItem}
              aoFechar={fecharEscolha}
              anunciar={anunciar}
            />
          )}
          {escolha === 'docs' && (
            <EscolhaDeDocumentoDoBau documentos={documentos} dentro={docIds} noObjeto={textos.no} poe={textos.poe} buscaRef={buscaRef} aoPor={porDocumento} aoFechar={fecharEscolha} anunciar={anunciar} />
          )}
        </div>
      </section>

      <SecaoAoAbrir conteudo={conteudo} tipo={tipo} textos={textos} mudar={mudar} jumpscare={jumpscare} />
      <p className="lb-conteudo__nota" data-flip="pe">
        O jogador só descobre o que tem ao {textos.verbo}.
      </p>
      <p className="gr-sr" aria-live="polite">
        {anuncio}
      </p>
    </div>
  )
}
