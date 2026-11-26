import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { lerOAcervoSeFaltar, useAcervoDeItensStore } from '../stores/acervoDeItensStore'
import { converterAsFichasDeAntes } from '../stores/batalha/conversaoDasFichas'
import { escolherImagemDaFicha, escolherTextoJson, salvarTextoJson } from '../lib/arquivosDaFicha'
import { ehEmbutido } from '../lib/bibliotecaDeSistemas'
import { nomeDaCopia, rascunhoDaCopia, rascunhoDoSistema, rascunhoEmBranco, type RascunhoDoSistema } from '../lib/editorDeSistema'
import { serializarSistema, type SistemaDeRpg } from '../lib/sistemaDeRpg'
import { herdaDaPasta, hostWorldOf, mochilaMoraNaFicha, personagensAtivos, sistemaAtivo, temRpgNoMapa, useAdventureStore } from '../stores/adventureStore'
import { useToastStore } from '../stores/toastStore'
import { campanhaDaPasta } from './nuvem/ponteDoLobby'
import { SISTEMA_FIXO_NO_LOBBY, usePastaPublicada } from './nuvem/usePastaPublicada'
import { carriedItemsOf, quantidadeDe } from '../lib/items'
import { tirarDaMochilaDaFicha } from '../lib/mochila/darNaFicha'
import { fichaComMochila } from '../lib/mochila/juncao'
import { mochilaComAVagaAcesa } from '../lib/luzDoItem'
import { moedasDe } from '../lib/troca'
import { MochilaDoMestre } from './MochilaDoMestre'
import { partyItemChange, tokenDoPersonagem } from '../lib/party'
import type { AppliedItems, HostWorld } from '../net/hostSession'
import type { CarriedItem } from '../types/map'
import { InventarioDaFicha } from './InventarioDaFicha'
import { itemQueSeUsa } from '../lib/curaPeloItem'
import { motivoDeNaoUsarFora, motivoDoItemSemEfeito, soEmQuemUsa } from '../lib/mochila/usarItemFora'
import { falarNoChat } from '../stores/falaNoChat'
import { candidatosAoUsoFora, usarItemForaNaMesa } from '../stores/usoDoItemFora'
import { UsarItemFora } from './UsarItemFora'

/** Quem o histórico da ficha diz que mexeu, no "Usar" do mestre. */
const QUEM_USA_NO_HISTORICO = 'Mestre'
import { chaveDaCenaAberta } from '../stores/turnoForaDaBatalha'
import { useMapStore } from '../stores/mapStore'
import { ligarFichaAosTokens } from '../stores/ligarFichaNoToken'
import { sistemaPorId, useRpgStore, type AberturaDoEditor } from '../stores/rpgStore'
import { temLivro } from '../lib/livroDeRegras'
import type { Personagem } from '../lib/personagem'
import { ajustarFichaComoMestre } from '../stores/ajusteDoMestre'
import { FichaDePersonagemDialog, type TokenParaLigar } from './FichaDePersonagemDialog'
import { EditorDeSistemaDialog } from './EditorDeSistemaDialog'
import { LivroDeRegrasDialog } from './LivroDeRegrasDialog'
import { SistemasDialog } from './SistemasDialog'
import { comAventura } from '../stores/virarAventura'

/**
 * As janelas do sistema de RPG, montadas UMA vez no App: a grade de sistemas,
 * a ficha de personagem e o livro de regras. Quem abre (a lista "Personagens", o "Abrir ficha"
 * do token) só mexe no `rpgStore`; assim a janela não depende de o painel
 * esquerdo estar montado nem de qual seção está aberta.
 */
export interface RpgDialogsProps {
  /**
   * INVENTÁRIO NA FICHA: grava a mudança da mochila na cena certa e avisa as
   * telas dos jogadores (`applyItemsInScene` + pontes, em `App.tsx`). Ausente =
   * o inventário só lê.
   */
  aplicarItens?: (change: AppliedItems) => boolean
  /** Mapa solto: pergunta e vira aventura antes de gravar o sistema escolhido (`garantirAventura`). `true` = pode seguir. */
  garantirAventura: () => Promise<boolean>
}

export function RpgDialogs({ aplicarItens, garantirAventura }: RpgDialogsProps) {
  const adventure = useAdventureStore((state) => state.adventure)
  // O sistema e os personagens EM USO: os da pasta de mapas quando o mapa herda dela.
  const sistemaId = useAdventureStore(sistemaAtivo)
  const personagens = useAdventureStore(personagensAtivos)
  const temRpg = useAdventureStore(temRpgNoMapa)
  const activeSceneId = useAdventureStore((state) => state.activeSceneId)
  const cache = useAdventureStore((state) => state.cache)
  // Quem é o dono da mochila: a ficha (já migrou) ou o boneco ligado (ainda não). Muda o que a aba Itens mostra na edição.
  const mochilaNaFicha = useAdventureStore(mochilaMoraNaFicha)
  const tokens = useMapStore((state) => state.map.tokens)
  const personagemAberto = useRpgStore((state) => state.personagemAberto)
  const abrirEditando = useRpgStore((state) => state.abrirEditando)
  const sistemasAbertos = useRpgStore((state) => state.sistemasAbertos)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const avisos = useRpgStore((state) => state.avisosDaBiblioteca)
  const livroAberto = useRpgStore((state) => state.livroAberto)
  const editorDeSistema = useRpgStore((state) => state.editorDeSistema)
  // LOBBY: o mapa que herda troca o sistema UNIVERSAL da pasta; publicada, ele ficou fixo (o site lê as fichas pelo que foi junto, 12.21).
  const pastaQueManda = useAdventureStore((state) => (herdaDaPasta(state) ? (state.pasta?.pastaId ?? null) : null))
  const { publicada: pastaNoLobby } = usePastaPublicada(pastaQueManda)
  const acervoLido = useAcervoDeItensStore((state) => state.podeGravar)

  // FRENTE A (decisões do dono de 25/11/2026): o que a ficha de antes guardava fora da mochila passa para ela
  // sozinho, ao abrir a aventura e a cada mudança das fichas. O Acervo é lido antes: é nele que a bala acha o item.
  useEffect(() => {
    if (!mochilaNaFicha) return
    lerOAcervoSeFaltar()
    // A conversão avisa os próprios erros (toast): nada sobe daqui.
    void converterAsFichasDeAntes()
  }, [personagens, mochilaNaFicha, acervoLido, sistemaId])

  /** Confere de novo na hora: a grade pode abrir antes de a leitura do disco dizer que a pasta está no Lobby. */
  const escolherSistema = async (id: string) => {
    if (pastaQueManda !== null) {
      let noLobby = pastaNoLobby
      try {
        noLobby = noLobby || (await campanhaDaPasta(pastaQueManda)) !== null
      } catch (erro) {
        useToastStore.getState().push('error', `Não deu para conferir se a pasta está no Lobby, e o sistema ficou como estava: ${erro instanceof Error ? erro.message : String(erro)}`)
        return
      }
      if (noLobby) {
        useToastStore.getState().push('error', SISTEMA_FIXO_NO_LOBBY)
        return
      }
    }
    comAventura(garantirAventura, () => useAdventureStore.getState().setSistemaDeRpg(id))
  }

  // A grade abre também no mapa solto (Configurações do mapa): escolher ali pergunta antes se ele vira aventura.
  const grade = sistemasAbertos && (
    <SistemasDialog
      sistemas={biblioteca}
      escolhidoId={sistemaId}
      avisos={avisos}
      escolhaTravada={pastaNoLobby ? SISTEMA_FIXO_NO_LOBBY : undefined}
      onEscolher={(id) => void escolherSistema(id)}
      onImportar={async () => {
        const texto = await escolherTextoJson('Importar sistema de RPG', 'Sistema de RPG')
        return texto === null ? null : useRpgStore.getState().importarSistema(texto)
      }}
      onEditar={(abertura) => useRpgStore.getState().abrirEditorDeSistema(abertura)}
      onDuplicar={(sistema) => useRpgStore.getState().duplicarSistema(sistema)}
      onExportar={(sistema) => salvarTextoJson(`Exportar ${sistema.nome}`, 'Sistema de RPG', sistema.id, serializarSistema(sistema))}
      onApagar={(sistema) => useRpgStore.getState().apagarSistema(sistema.id)}
      ehEmbutido={ehEmbutido}
      onClose={() => useRpgStore.getState().fecharSistemas()}
    />
  )
  // Depois da grade: o editor abre por cima dela. Fora de aventura também — a biblioteca é do app.
  const editor = editorDeSistema !== null && <EditorDaBiblioteca abertura={editorDeSistema} biblioteca={biblioteca} />

  // Ficha e livro só com onde guardar: a aventura, ou a pasta de mapas de que o mapa (até solto) herda.
  if (!temRpg) {
    return (
      <>
        {grade}
        {editor}
      </>
    )
  }

  const personagem = personagemAberto === null ? undefined : personagens.find((candidato) => candidato.id === personagemAberto)
  const sistema = sistemaPorId(biblioteca, sistemaId)
  const tokensParaLigar: TokenParaLigar[] = tokens.map((token) => ({ id: token.id, nome: token.name, personagemId: token.characterId }))
  // A mochila mora no token: o mapa aberto (assinado acima pelos tokens) e as cenas de fundo carregadas.
  const doMestre =
    personagem === undefined
      ? undefined
      : inventarioDoMestre(hostWorldOf({ adventure, activeSceneId, cache }, useMapStore.getState().map), personagem, aplicarItens, mochilaNaFicha)
  // Antes da migração, com o boneco dono, o Salvar leva a ele as vagas que a edição pôs na mochila (`salvarComAsVagasNoBoneco`).
  const salvarFicha = doMestre?.salvar ?? ((salvo: Personagem) => useAdventureStore.getState().salvarPersonagem(salvo))

  return (
    <>
      {grade}
      {editor}
      {personagem !== undefined && (
        <FichaDePersonagemDialog
          key={personagem.id}
          personagem={personagem}
          sistema={sistema}
          sistemaId={sistemaId}
          editandoNoInicio={abrirEditando}
          onSalvar={salvarFicha}
          onClose={() => useRpgStore.getState().fecharFicha()}
          escolherImagem={escolherImagemDaFicha}
          // "Trazer de outra ficha": as fichas da pasta (jogadores e NPCs, as mesmas dos Livros de regras).
          outrasFichas={personagens}
          onAbrirLivro={sistema !== undefined && temLivro(sistema) ? () => useRpgStore.getState().abrirLivro() : undefined}
          tokens={tokensParaLigar}
          // Pelo histórico do mapa, como o resto do token: Ctrl+Z desliga. A mesma porta do "Ligar ficha" do mapa:
          // NPC que já está em outro token da cena liga uma CÓPIA, cada token com a própria vida (bug de 25/11/2026).
          onLigarToken={(tokenId) => void ligarFichaAosTokens(personagem.id, [tokenId])}
          // AJUSTE RÁPIDO: o mesmo caminho da "Vida ›" do botão direito (`stores/ajusteDoMestre.ts`): o dano na
          // batalha é o "Dar dano" dela; o resto grava na ficha de AGORA e vira linha "ficha" na batalha.
          onAjustar={
            sistema === undefined
              ? undefined
              : (ajuste) => {
                  const feito = ajustarFichaComoMestre(personagem.id, sistema, ajuste)
                  return feito === 'batalha' || feito.gravou
                }
          }
          inventario={doMestre?.inventario}
          mochilaDoBoneco={doMestre?.mochilaDoBoneco}
        />
      )}
      {/* Depois da ficha: abre por cima dela. */}
      {livroAberto && sistema !== undefined && <LivroDeRegrasDialog sistema={sistema} onClose={() => useRpgStore.getState().fecharLivro()} />}
    </>
  )
}

/** O rascunho com que o editor abre: o do sistema, em branco, ou a cópia com um nome que ninguém da biblioteca usa. */
function rascunhoDaAbertura(abertura: AberturaDoEditor, biblioteca: readonly SistemaDeRpg[]): RascunhoDoSistema {
  if (abertura.tipo === 'editar') return rascunhoDoSistema(abertura.sistema)
  if (abertura.copiaDe === null) return rascunhoEmBranco()
  return rascunhoDaCopia(
    abertura.copiaDe,
    nomeDaCopia(
      abertura.copiaDe.nome,
      biblioteca.map((sistema) => sistema.nome),
    ),
  )
}

/**
 * O editor ligado à biblioteca. O rascunho nasce UMA vez, na abertura: o
 * `RpgDialogs` redesenha a cada token que anda, e refazer o rascunho do One
 * Piece (centenas de linhas) a cada passo seria trabalho jogado fora.
 */
function EditorDaBiblioteca({ abertura, biblioteca }: { abertura: AberturaDoEditor; biblioteca: readonly SistemaDeRpg[] }) {
  const [inicial] = useState(() => rascunhoDaAbertura(abertura, biblioteca))
  const idsDaBiblioteca = useMemo(() => new Set(biblioteca.map((sistema) => sistema.id)), [biblioteca])
  return (
    <EditorDeSistemaDialog
      inicial={inicial}
      idsDaBiblioteca={idsDaBiblioteca}
      onSalvar={(sistema) => useRpgStore.getState().salvarSistema(sistema)}
      onClose={() => useRpgStore.getState().fecharEditorDeSistema()}
    />
  )
}

/**
 * FASE 5 (a ficha é a dona da mochila, `lib/mochila/espelho.ts`): sem boneco
 * ligado nas cenas carregadas, a janela mostra a mochila da PRÓPRIA FICHA. Não
 * há chão onde largar; o "Tirar" tira a vaga inteira da ficha, pelo funil da
 * aventura (`ajustarPersonagem`), o mesmo do ajuste rápido.
 */
function mochilaDaFichaSemBoneco(personagem: Personagem) {
  const tirar = (item: CarriedItem, fechar: () => void) => {
    const ok = useAdventureStore.getState().ajustarPersonagem(personagem.id, (atual) => tirarDaMochilaDaFicha(atual, item.id, quantidadeDe(item)))
    if (ok) fechar()
    else useToastStore.getState().push('error', `Não deu para tirar ${item.nome} de ${personagem.nome}.`)
  }
  // O "Editar" e o "+ Adicionar" do mestre (pedido de 16/11/2026): direto na ficha, a dona da mochila.
  const gravar = (mochila: CarriedItem[]) => useAdventureStore.getState().ajustarPersonagem(personagem.id, (atual) => fichaComMochila(atual, mochila, moedasDe(atual)))
  const mochilaDeAgora = () => personagensAtivos(useAdventureStore.getState()).find((candidato) => candidato.id === personagem.id)?.mochila ?? []
  return (
    <MochilaDoMestre
      itens={personagem.mochila ?? []}
      dono={personagem.nome || 'o personagem'}
      gravar={gravar}
      mochilaDeAgora={mochilaDeAgora}
      vazio={`Nada com ${personagem.nome || 'o personagem'}. Dê um item pelo acervo de itens ou pelo livro.`}
      acoes={(item, fechar) => (
        <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" onClick={() => tirar(item, fechar)}>
          Tirar
        </button>
      )}
    />
  )
}

/** O que a ficha do mestre mostra na aba Itens: o inventário com as ações e, com o BONECO dono da mochila, a mochila dele. */
interface InventarioDoMestre {
  inventario: ReactNode
  /** Antes da migração (`mochilaNaFicha` falso) com token ligado: a mochila dele, a que a aba conta e a edição não troca pelo rascunho. */
  mochilaDoBoneco?: readonly CarriedItem[]
  /** Com `mochilaDoBoneco`: o Salvar da ficha que leva a ele as vagas novas da edição (`salvarComAsVagasNoBoneco`). */
  salvar?: (salvo: Personagem) => boolean
}

/**
 * O SALVAR DA FICHA com o BONECO dono da mochila (antes da migração): as vagas
 * que a edição pôs na mochila — o "Passar para a mochila" — vão para a mochila
 * DELE, pelo caminho dos itens, e a cópia da ficha fica como está (ninguém a
 * vê). Antes os cartões saíam da aba e as vagas paravam na cópia: o item
 * sumia. As vagas são as que o Salvar da janela juntou à mochila da ficha de
 * agora (`salvarSobreOAtual`); a que o boneco já tem (mesmo id) não duplica.
 * Primeiro o boneco: se ele não recebe, a ficha não grava e a janela segue na
 * edição, com os cartões ainda no rascunho; se a ficha é recusada, as vagas
 * saem dele de novo — nada fica nos dois lugares, nada some.
 */
function salvarComAsVagasNoBoneco(salvo: Personagem, dono: string, mochilaDoBoneco: () => CarriedItem[], gravarNoBoneco: (mochila: CarriedItem[]) => boolean): boolean {
  const aventura = useAdventureStore.getState()
  const daFicha = personagensAtivos(aventura).find((candidato) => candidato.id === salvo.id)
  const idsDaFicha = new Set((daFicha?.mochila ?? []).map((vaga) => vaga.id))
  const novas = (salvo.mochila ?? []).filter((vaga) => !idsDaFicha.has(vaga.id))
  if (novas.length === 0) return aventura.salvarPersonagem(salvo)
  const { mochila: _comAsVagas, ...semMochila } = salvo
  const fichaComACopia: Personagem = daFicha?.mochila === undefined ? semMochila : { ...semMochila, mochila: daFicha.mochila }
  const antes = mochilaDoBoneco()
  const idsDoBoneco = new Set(antes.map((vaga) => vaga.id))
  const entram = novas.filter((vaga) => !idsDoBoneco.has(vaga.id))
  if (entram.length > 0 && !gravarNoBoneco([...antes, ...entram])) {
    useToastStore.getState().push('error', `Não deu para pôr os itens na mochila de ${dono}: a ficha continua em edição.`)
    return false
  }
  if (useAdventureStore.getState().salvarPersonagem(fichaComACopia)) return true
  const idsQueEntraram = new Set(entram.map((vaga) => vaga.id))
  if (idsQueEntraram.size > 0) gravarNoBoneco(mochilaDoBoneco().filter((vaga) => !idsQueEntraram.has(vaga.id)))
  return false
}

/**
 * O inventário do personagem na ficha do mestre: a mochila do token ligado,
 * com as ações que o Grupo já tem — largar no chão (vira pino pegável onde o
 * token está) e tirar — e o "Usar" pelo efeito do item (o consumível sem
 * efeito mostra a sugestão do Acervo, sem gastar por palpite). Sem token
 * ligado nas cenas carregadas, a mochila da própria ficha.
 * `mochilaNaFicha` = a aventura já passou a mochila para a ficha; falso = o
 * token ligado é o dono, e a cópia da ficha não vale.
 */
function inventarioDoMestre(world: HostWorld, personagem: Personagem, aplicarItens: ((change: AppliedItems) => boolean) | undefined, mochilaNaFicha: boolean): InventarioDoMestre {
  const personagemId = personagem.id
  const achado = tokenDoPersonagem(world, personagemId)
  if (achado === null) return { inventario: mochilaDaFichaSemBoneco(personagem) }
  const { token, sceneId } = achado
  const dono = token.name || 'o token'
  // UMA MOCHILA SÓ (pedido de 21/11/2026, a Tocha do Hector): depois da migração a FICHA é a dona — a grade lê e grava
  // nela (o funil da aventura, `ajustarPersonagem`, espelha em todo boneco dela). Antes lia o PRIMEIRO boneco ligado, e a
  // ficha com dois bonecos mostrava a mochila de um enquanto o jogador via a do outro e a aba Itens contava a da ficha.
  const daFicha = () => personagensAtivos(useAdventureStore.getState()).find((candidato) => candidato.id === personagemId)
  const gravarNaFicha = (mochila: CarriedItem[]) => useAdventureStore.getState().ajustarPersonagem(personagemId, (atual) => fichaComMochila(atual, mochila, moedasDe(atual)))
  // O "Editar", o "+ Adicionar" e o Salvar da ficha (pedido de 16/11/2026): antes da migração, pelo caminho dos itens do
  // boneco (o dono), como o "Usar" abaixo. A de agora é a do dono, lida na hora.
  const gravar = (mochila: CarriedItem[]) =>
    mochilaNaFicha ? gravarNaFicha(mochila) : aplicarItens !== undefined && aplicarItens({ mochilas: [{ tokenId: token.id, mochila }], ...(sceneId === null ? {} : { sceneId }) })
  const mochilaDeAgora = () => {
    if (mochilaNaFicha) return daFicha()?.mochila ?? []
    const agora = tokenDoPersonagem(hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map), personagemId)
    return agora === null ? [] : carriedItemsOf(agora.token)
  }
  const itens = mochilaNaFicha ? (personagem.mochila ?? []) : carriedItemsOf(token)
  const doBoneco: Omit<InventarioDoMestre, 'inventario'> = mochilaNaFicha
    ? {}
    : { mochilaDoBoneco: carriedItemsOf(token), salvar: (salvo) => salvarComAsVagasNoBoneco(salvo, dono, mochilaDeAgora, gravar) }
  const agir = (kind: 'tirar' | 'devolver', item: CarriedItem, fechar: () => void) => {
    if (kind === 'tirar' && mochilaNaFicha) {
      if (useAdventureStore.getState().ajustarPersonagem(personagemId, (atual) => tirarDaMochilaDaFicha(atual, item.id, quantidadeDe(item)))) fechar()
      return
    }
    const change = partyItemChange(world, { kind, item: { ...item, tokenId: token.id, sceneId } }, crypto.randomUUID())
    if (change !== null && aplicarItens?.(change) === true) fechar()
  }
  // Fase 8: o "Usar" do item com efeito, pela mesa do mestre (a mesma do pedido do jogador), com aviso no chat e Desfazer.
  const cenaDoUso = sceneId ?? chaveDaCenaAberta()
  const candidatosDoUso = () => candidatosAoUsoFora(cenaDoUso, personagemId)
  const usarComEfeito = (item: CarriedItem, alvoPersonagemId: string, fechar: () => void): string | null => {
    const feito = usarItemForaNaMesa({ sceneKey: cenaDoUso, tokenId: token.id, personagemId, vagaId: item.id, alvoPersonagemId, quem: QUEM_USA_NO_HISTORICO })
    if (!feito.ok) return feito.motivo
    falarNoChat(feito.texto)
    useToastStore.getState().push('info', feito.texto, undefined, { actions: [{ label: 'Desfazer', run: () => void feito.desfazer() }] })
    if (!mochilaDeAgora().some((vaga) => vaga.id === item.id)) fechar()
    return null
  }
  if (aplicarItens === undefined) return { inventario: <InventarioDaFicha itens={itens} vazio={`Nada com ${dono}. Dê um item pelo acervo de itens.`} />, ...doBoneco }
  const inventario = (
    <MochilaDoMestre
      itens={itens}
      dono={dono}
      gravar={gravar}
      mochilaDeAgora={mochilaDeAgora}
      vazio={`Nada com ${dono}. Dê um item pelo acervo de itens.`}
      acoes={(item, fechar) => (
        <>
          {/* ITEM QUE ILUMINA: aceso, a luz anda com a ficha (`lib/luzDoItem.ts`); pelo caminho dos itens, como o "Usar". */}
          {item.luz !== undefined && (
            <button
              type="button"
              className="lb-btn lb-btn--compact"
              aria-pressed={item.acesa === true}
              onClick={() => {
                const mochila = mochilaComAVagaAcesa(mochilaDeAgora(), item.id, item.acesa !== true)
                if (mochila !== null) gravar(mochila)
              }}
            >
              {item.acesa === true ? 'Apagar' : 'Acender'}
            </button>
          )}
          {/* Fase 8 (SISTEMA.md §5.2): o item com efeito usa as peças dele (cura, condição, reviver), em si ou num colega.
              Nº 9 do levantamento: o consumível sem efeito não gasta mais por palpite pelo nome; o "Usar" fica apagado com a sugestão do Acervo. */}
          {(item.efeito !== undefined || itemQueSeUsa(item)) && (
            <UsarItemFora
              item={item}
              motivo={motivoDoItemSemEfeito(item) ?? motivoDeNaoUsarFora(item)}
              candidatos={(soEmQuemUsa(item) ? candidatosDoUso().slice(0, 1) : candidatosDoUso()).map(({ personagem: candidato }) => ({ id: candidato.id, nome: candidato.nome }))}
              onUsar={(alvoPersonagemId) => usarComEfeito(item, alvoPersonagemId, fechar)}
            />
          )}
          <button type="button" className="lb-btn lb-btn--compact" onClick={() => agir('devolver', item, fechar)}>
            Largar no chão
          </button>
          <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" onClick={() => agir('tirar', item, fechar)}>
            Tirar
          </button>
        </>
      )}
    />
  )
  return { inventario, ...doBoneco }
}
