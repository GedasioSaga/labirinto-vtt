import { chaveDaFala } from '../../lib/falasDoPino'
import { nomeDaFonte } from '../../lib/fonteNoPreludio'
import { estaNaLixeira } from '../../lib/preparo/lixeira'
import { podeIrAoJogador } from '../../lib/preparo/pacoteDoJogador'
import { pinosEmDia, situacaoDaFonte } from '../../lib/preparo/pinoLigado'
import type { Verbete } from '../../lib/preparo/tipos'
import { contarSituacaoDosPinosLigados, type PersonagemQueDiz, type SituacaoDoPinoLigado } from '../../stores/colocacaoDoPreludio'
import { useAdventureStore } from '../../stores/adventureStore'
import { useMapStore } from '../../stores/mapStore'
import { usePreludio } from '../estado/preludio'

/**
 * O PINO LIGADO SEGUE O PRELÚDIO (P3 do estudo de 15/11), na janela do mapa:
 * cada vez que um verbete muda (a janela do Prelúdio gravou e avisou, ou a
 * tela do Prelúdio aqui dentro editou), o `description` de todo pino ligado a
 * ele — na cena aberta e nas cenas de fundo da memória — vira a cópia em dia,
 * já limpa. O próximo envio aos jogadores leva o texto novo, por todas as
 * portas que já leem o `description` (cartão, revelação, "Mostrar agora").
 * A entrada ligada do "?" (P5) segue igual, no `texto` dela, e o "quem diz"
 * segue o nome do Personagem escolhido.
 *
 * A troca entra como mudança de fora (`applyPlayerChange`): não vira passo do
 * Ctrl+Z, e desfazer outra coisa não traz o texto velho de volta. O mapa fica
 * "não salvo": a cópia de reserva nova vai ao disco no próximo salvar.
 *
 * Para ler, abre o Prelúdio desta janela, só leitura (o mesmo que o Roteiro do
 * Livro faz). Baixa só quando o mapa tem pino ligado, ou quando a ficha do "?"
 * pede os Personagens (`vigiaDosPinosLigados.ts`).
 */

let ligado = false

/**
 * Os Personagens que podem dizer uma entrada (a sessão e o formato mais novo nunca vão ao jogador), por nome.
 * O que está na Lixeira não se escolhe; a entrada que já o tinha continua com ele (o nome segue por `quemDizEmDia`).
 */
function personagensQueDizem(verbetes: ReadonlyMap<string, Verbete>): PersonagemQueDiz[] {
  const lista: PersonagemQueDiz[] = []
  for (const verbete of verbetes.values()) {
    if (verbete.tipo !== 'personagem' || !podeIrAoJogador(verbete) || estaNaLixeira(verbete)) continue
    lista.push({ id: verbete.id, nome: nomeDaFonte(verbete.titulo) || 'Personagem sem nome' })
  }
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

function aplicar(): void {
  const preludio = usePreludio.getState()
  if (preludio.carga.t === 'fechada') {
    void preludio.carregar()
    return
  }
  if (preludio.carga.t !== 'pronta') {
    contarSituacaoDosPinosLigados(false, new Map())
    return
  }
  const { verbetes } = preludio
  const mapa = useMapStore.getState()
  if (pinosEmDia(mapa.map, verbetes) !== mapa.map) mapa.applyPlayerChange((atual) => pinosEmDia(atual, verbetes))
  // A ficha do pino (pacote principal) lê daqui se a fonte segue, virou segredo ou sumiu.
  const porPino = new Map<string, SituacaoDoPinoLigado>()
  for (const pin of useMapStore.getState().map.pins) {
    if (pin.fonte !== undefined) porPino.set(pin.id, situacaoDaFonte(pin.fonte, verbetes).t)
    for (const fala of pin.falas ?? []) if (fala.fonte !== undefined) porPino.set(chaveDaFala(pin.id, fala.id), situacaoDaFonte(fala.fonte, verbetes).t)
  }
  contarSituacaoDosPinosLigados(true, porPino, personagensQueDizem(verbetes))
  const aventura = useAdventureStore.getState()
  for (const [sceneId, slot] of Object.entries(aventura.cache)) {
    if (sceneId === aventura.activeSceneId || slot.status !== 'ok') continue
    if (pinosEmDia(slot.map, verbetes) !== slot.map) aventura.applyPlayerChangeToBackgroundScene(sceneId, (atual) => pinosEmDia(atual, verbetes))
  }
}

let agendado = false
function agendar(): void {
  if (agendado) return
  agendado = true
  queueMicrotask(() => {
    agendado = false
    aplicar()
  })
}

/** Liga uma vez por janela e vale enquanto ela viver. */
export function ligarPinosLigados(): void {
  if (ligado) return
  ligado = true
  // Só o que pode mudar o texto ou trazer pino ligado novo: verbetes e carga do Prelúdio, pinos da cena aberta, cenas de fundo.
  usePreludio.subscribe((estado, antes) => {
    if (estado.verbetes !== antes.verbetes || estado.carga !== antes.carga) agendar()
  })
  useMapStore.subscribe((estado, antes) => {
    if (estado.map.pins !== antes.map.pins) agendar()
  })
  useAdventureStore.subscribe((estado, antes) => {
    if (estado.cache !== antes.cache) agendar()
  })
  agendar()
}
