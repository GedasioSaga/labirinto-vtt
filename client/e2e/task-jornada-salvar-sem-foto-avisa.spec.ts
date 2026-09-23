// JORNADA DE USUÁRIO — "mandei guardar no acervo e o token não tinha foto".
//
// O CAMINHO MAIS COMUM DE QUEM CHEGA: a pessoa clica "Adicionar token", digita
// "Goblin" e já clica em "Salvar no acervo", antes de escolher imagem nenhuma.
// O botão aparece sempre, e de propósito — o comentário de
// `components/TokenImageControls.tsx:44-48` diz que ele fica visível porque a
// resposta do app "ensina". Este arquivo cobra que a resposta ENSINE MESMO.
//
// POR QUE ELE PRECISOU EXISTIR (varredura de 18/09/2026, achado
// `TokenImageControls.tsx:49`, status CONFIRMADO): nada, em teste nenhum,
// toca nesse clique. Se `reportFileError` passar a engolir o erro, ou se o
// `throw` de `SEM_FOTO_PARA_SALVAR` virar um `return` silencioso, o clique
// passa a não fazer NADA — e a suíte continua verde enquanto a pessoa conclui
// que o acervo não funciona.
//
// O QUE ESTA JORNADA COBRA ALÉM DO AVISO EXISTIR:
//   o aviso é uma instrução — "escolha uma imagem para ele antes de guardar no
//   acervo" — e a pessoa só consegue cumpri-la DEPOIS de ler, achar o botão
//   "Escolher imagem...", abrir o seletor do sistema, procurar a foto na pasta
//   dela e voltar. Hoje o aviso é um toast que se apaga sozinho em 7 segundos
//   (`stores/toastStore.ts`, DEFAULT_DURATION_MS.error = 7000), e não existe
//   nenhum lugar na tela onde reencontrá-lo. Quem leu devagar, ou foi atender o
//   telefone, volta para uma tela sem pista nenhuma do que aconteceu — e o
//   único registro do que ela tinha de fazer sumiu sem ela ter dispensado.
//
// REGRAS DE JORNADA respeitadas: gesto real de ponteiro e teclado; nenhum
// `evaluate` que mude estado do app (esta jornada não tem nenhum `evaluate`);
// toda afirmação é sobre texto VISÍVEL na tela.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** Trecho do aviso que `lib/tokenLibrary.ts` (`SEM_FOTO_PARA_SALVAR`) manda
 *  para a tela por `App.tsx` (`reportFileError`). A jornada cobra o PEDAÇO que
 *  ensina o que fazer, não a frase inteira — o texto pode melhorar sem a
 *  jornada virar obstáculo, mas não pode deixar de dizer o que fazer. */
const O_QUE_FAZER = 'escolha uma imagem'

/**
 * Quanto tempo a pessoa leva para ler o aviso e ir atrás da foto.
 *
 * 12 segundos é curto para qualquer medida de gente: ler uma frase de duas
 * linhas, procurar "Escolher imagem..." no painel e decidir. O toast de erro
 * do app vive 7 (`stores/toastStore.ts`). A jornada mede entre os dois de
 * propósito: qualquer coisa que exija pressa para ser lida já falhou.
 */
const TEMPO_PARA_LER_E_AGIR_MS = 12_000

/**
 * Disco e seletor de arquivo de mentira, só o suficiente para o app rodar em
 * modo aplicativo (fora dele o acervo nem é oferecido —
 * `stores/tokenLibraryStore.ts` sai cedo quando `isTauri()` é falso).
 *
 * Nenhuma foto é semeada aqui: esta jornada é justamente sobre o token que
 * NÃO tem foto, e o seletor de arquivo nunca chega a ser aberto.
 */
type InternalsDoTauri = {
  metadata: { currentWindow: { label: string }; currentWebview: { windowLabel: string; label: string } }
  invoke: (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>
  transformCallback: () => number
  convertFileSrc: (filePath: string, protocol?: string) => string
}
type JanelaDoMestre = { isTauri: boolean; __TAURI_INTERNALS__: InternalsDoTauri }

interface DiscoSalvo {
  textos: Record<string, string>
  binarios: Record<string, number[]>
  pastas: string[]
}

async function discoDoMestre(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const CHAVE = 'labirinto.disco-de-mentira'
    const alvo = window as unknown as JanelaDoMestre
    const vazio: DiscoSalvo = { textos: {}, binarios: {}, pastas: [] }
    let disco: DiscoSalvo = vazio
    try {
      const bruto = window.sessionStorage.getItem(CHAVE)
      disco = bruto === null ? vazio : (JSON.parse(bruto) as DiscoSalvo)
    } catch {
      disco = vazio
    }
    const gravar = () => {
      try {
        window.sessionStorage.setItem(CHAVE, JSON.stringify(disco))
      } catch {
        // Cota estourada só deixa o último arquivo sem persistir; a jornada
        // falha na asserção seguinte, que é onde ela deve falhar.
      }
    }
    gravar()

    const existe = (caminho: string): boolean =>
      caminho in disco.textos || caminho in disco.binarios || disco.pastas.indexOf(caminho) !== -1

    alvo.isTauri = true
    alvo.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
      transformCallback: () => 0,
      convertFileSrc: (caminho: string) => String(caminho),
      invoke: async (cmd, args, options) => {
        const a = (args ?? {}) as Record<string, unknown>
        switch (cmd) {
          case 'plugin:path|resolve_directory':
            return 'C:/appdata'
          case 'plugin:path|join':
            return (a.paths as string[]).join('/')
          case 'plugin:path|dirname': {
            const p = String(a.path)
            return p.slice(0, Math.max(0, p.lastIndexOf('/')))
          }
          case 'plugin:fs|exists':
            return existe(String(a.path))
          case 'plugin:fs|mkdir': {
            if (disco.pastas.indexOf(String(a.path)) === -1) disco.pastas.push(String(a.path))
            gravar()
            return null
          }
          case 'plugin:fs|write_text_file': {
            const caminho = decodeURIComponent(options?.headers?.path ?? '')
            disco.textos[caminho] = new TextDecoder().decode(args as Uint8Array)
            gravar()
            return null
          }
          case 'plugin:fs|read_text_file': {
            const caminho = String(a.path)
            if (!(caminho in disco.textos)) throw new Error(`arquivo não existe: ${caminho}`)
            return Array.from(new TextEncoder().encode(disco.textos[caminho]))
          }
          case 'plugin:fs|write_file': {
            const caminho = decodeURIComponent(options?.headers?.path ?? '')
            disco.binarios[caminho] = Array.from(args as Uint8Array)
            gravar()
            return null
          }
          case 'plugin:fs|read_file': {
            const caminho = String(a.path)
            if (caminho in disco.binarios) return disco.binarios[caminho]
            throw new Error(`arquivo não existe: ${caminho}`)
          }
          case 'plugin:fs|rename': {
            const de = String(a.oldPath)
            const para = String(a.newPath)
            if (de in disco.textos) {
              disco.textos[para] = disco.textos[de]
              delete disco.textos[de]
            }
            if (de in disco.binarios) {
              disco.binarios[para] = disco.binarios[de]
              delete disco.binarios[de]
            }
            gravar()
            return null
          }
          case 'plugin:fs|remove': {
            const caminho = String(a.path)
            delete disco.textos[caminho]
            delete disco.binarios[caminho]
            disco.pastas = disco.pastas.filter((p) => p !== caminho)
            gravar()
            return null
          }
          case 'plugin:fs|read_dir': {
            const prefixo = `${String(a.path).replace(/[/]+$/, '')}/`
            const nomes = Object.keys(disco.textos)
              .concat(Object.keys(disco.binarios))
              .filter((p) => p.indexOf(prefixo) === 0)
              .map((p) => p.slice(prefixo.length))
              .filter((nome) => nome.length > 0 && nome.indexOf('/') === -1)
            return nomes.map((name) => ({ name, isDirectory: false, isFile: true, isSymlink: false }))
          }
          case 'plugin:event|listen':
            return 1
          default:
            return null
        }
      },
    }
  })
}

/** "Adicionar token" → nome → Enter. SEM escolher imagem: é este o ponto. */
async function criarTokenSemFoto(page: Page, nome: string): Promise<void> {
  await page.getByRole('button', { name: 'Adicionar token', exact: true }).click()
  const campo = page.getByRole('textbox', { name: 'Nome do novo token' })
  await campo.click()
  await campo.pressSequentially(nome, { delay: 20 })
  await campo.press('Enter')
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toBeVisible()
  // A prova VISÍVEL de que o token não tem foto: o painel oferece "Escolher
  // imagem..." e não "Trocar imagem..." (components/TokenImageControls.tsx).
  await expect(page.getByRole('button', { name: 'Escolher imagem...' })).toBeVisible()
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('CONTROLE POSITIVO: mandar guardar um token sem foto responde na tela, e a resposta diz o que fazer', async ({ page }) => {
  test.setTimeout(120_000)
  await discoDoMestre(page)
  await enterEditor(page)

  await criarTokenSemFoto(page, 'Goblin')
  await page.getByRole('button', { name: 'Salvar no acervo' }).click()

  // O aviso aparece — o clique não pode ser um botão que não faz nada.
  const aviso = page.getByText(O_QUE_FAZER, { exact: false })
  await expect(aviso).toBeVisible({ timeout: 15_000 })

  // E o token NÃO entrou na estante: o estado vazio continua lá.
  await expect(page.getByText('Nenhum token no acervo ainda.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Colocar Goblin no mapa' })).toHaveCount(0)
})

/**
 * O DEFEITO — o aviso é uma instrução que some antes de a pessoa poder cumpri-la.
 *
 * O texto manda escolher uma imagem antes de guardar. Para cumprir, a pessoa
 * precisa ler, achar "Escolher imagem..." no painel, abrir o seletor do
 * sistema e procurar o arquivo na pasta dela. O aviso, hoje, é um toast que se
 * apaga sozinho aos 7 segundos (`stores/toastStore.ts`) — e não sobra nenhum
 * lugar na tela onde reencontrar a frase: nem uma marca no botão, nem um texto
 * na seção "Imagem do token", nem um histórico de avisos.
 *
 * A jornada cobra as duas coisas que faltam, nesta ordem:
 *   1. o aviso continua visível enquanto a pessoa age (12 segundos, medida de
 *      gente, e não de timer);
 *   2. quem some é a PESSOA, pelo botão "Dispensar aviso" — sumir sozinho é o
 *      app decidindo que ela já leu.
 */
test('o aviso de "sem foto" continua na tela enquanto a pessoa vai atrás da imagem, e só some quando ela dispensa', async ({ page }) => {
  test.setTimeout(120_000)
  await discoDoMestre(page)
  await enterEditor(page)

  await criarTokenSemFoto(page, 'Goblin')
  await page.getByRole('button', { name: 'Salvar no acervo' }).click()

  const aviso = page.getByText(O_QUE_FAZER, { exact: false })
  await expect(aviso).toBeVisible({ timeout: 15_000 })

  // ── a pessoa lê e vai atrás da foto ──────────────────────────────────────
  // Nenhum gesto aqui de propósito: este é o tempo em que ela está lendo,
  // procurando o botão e pensando. O app não pode usá-lo para apagar a
  // instrução que ele mesmo acabou de dar.
  await page.waitForTimeout(TEMPO_PARA_LER_E_AGIR_MS)

  await expect(
    aviso,
    `o aviso que ensina o que fazer sumiu sozinho antes de ${TEMPO_PARA_LER_E_AGIR_MS / 1000} segundos, e não sobrou nada na tela dizendo por que o token não entrou na estante`,
  ).toBeVisible()

  // ── e quem apaga o aviso é ela ───────────────────────────────────────────
  await page.getByRole('button', { name: 'Dispensar aviso' }).click()
  await expect(aviso).toHaveCount(0)
})
