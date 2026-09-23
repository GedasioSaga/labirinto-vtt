// JORNADA DE USUÁRIO do SALVAMENTO AUTOMÁTICO COM RECUPERAÇÃO (candidata 9 de
// docs/features-candidatas-2026-09-21.md) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A FEATURE:
//   - enquanto o mestre edita, o app guarda sozinho, de tempos em tempos, uma
//     CÓPIA DE RECUPERAÇÃO do trabalho;
//   - se o app fecha (ou cai) sem o mestre salvar, ao reabrir ele OFERECE
//     "Recuperar" o trabalho não salvo, mostrando a HORA da cópia;
//   - clicar em Recuperar devolve ao editor o que o mestre tinha desenhado;
//   - a cópia NUNCA grava por cima do arquivo salvo: o mapa salvo só muda
//     quando o mestre manda salvar.
//
// A DOR (passeio, achado 1): uma hora de masmorra sumiu e o app abriu
// "Nenhum mapa salvo ainda".
//
// ONDE ISSO MORRE HOJE:
//   - `client/src/stores/sessionStore.ts:26-51` só marca `isDirty`; nada copia
//     o mapa para lugar nenhum enquanto ele é editado;
//   - `client/src/App.tsx:729-760` (`onCloseRequested`) só PERGUNTA ao fechar
//     a janela; se o processo cai, ou se a pessoa responde "fechar", o trabalho
//     some. Não existe "autosave", "recuperar" nem cópia de recuperação em
//     `client/src` (busca por autosave|recovery|recuper|backup: nada);
//   - `client/src/screens/MainMenu.tsx:14-44` abre sempre com os mesmos dois
//     cartões, sem oferta nenhuma.
//
// COMO ESTE ARQUIVO PROVA, sem mentir:
//   DISCO DE MENTIRA QUE SOBREVIVE AO FECHAR: o mesmo disco em memória das
//   réguas vizinhas (task-jornada-visao-geral-das-cenas.spec.ts), só que cada
//   escrita é espelhada no localStorage do CONTEXTO do navegador. Fechar a aba
//   e abrir outra no mesmo contexto é "fechar o app e abrir de novo": a memória
//   da página morre, o disco (e o localStorage, caso a feature use ele) fica.
//   Nenhum `beforeunload` roda (`page.close()` padrão): é o caso "caiu".
//   O app roda com a marca `isTauri` ligada, como na régua-molde, para a
//   feature poder decidir pelo modo app ou pela ponte, sem a régua escolher.
//   GESTO REAL: clique de ponteiro nos botões e cartões, arrasto de ponteiro
//   com pausa antes de soltar para desenhar a sala, teclado para batizar a
//   sala e para o nome do mapa. Nenhum `evaluate`: nada é lido nem escrito na
//   store, no disco falso ou no localStorage pelo teste.
//   PROVA NA TELA: botão "Recuperar" pelo nome acessível; a hora da cópia em
//   texto visível; o número de salas na linha "Salas" da lista "Camadas do
//   mapa" (texto visível do painel, `components/LayersPanel.tsx`).
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - a cópia de recuperação sai no máximo 30 s depois da edição
//     (`COPIA_EM_ATE_MS`); a régua espera isso e mais uma folga antes de fechar;
//   - a oferta aparece SOZINHA na primeira tela depois de abrir o app, sem
//     clique nenhum, com um botão cujo nome acessível começa com "Recuperar";
//   - a hora da cópia aparece em texto visível na tela junto da oferta, no
//     formato HH:MM ou HHhMM (horário de Brasília, o fuso do teste), e cai
//     entre o começo da edição e o fechamento do app;
//   - clicar em "Recuperar" abre o editor com o mapa recuperado;
//   - se a oferta for um diálogo, Esc fecha sem recuperar (convenção de modal);
//     se não for, o menu continua clicável com ela na tela;
//   - depois de um Salvar limpo, reabrir NÃO oferece recuperação (não há
//     trabalho perdido — oferecer sempre seria ruído).
//
// CONTROLE POSITIVO (verde hoje): teste 1. Ele prova que o disco sobrevive ao
// fechar e reabrir, que Salvar grava, que "Carregar Mapa existente" acha o
// mapa e que a linha "Salas" conta a sala desenhada. Sem ele, o vermelho dos
// testes 2 a 4 poderia ser a infraestrutura quebrada, e não a feature ausente.
import { test, expect, type Page } from '@playwright/test'

// Disco apertado nesta máquina: sem trace e sem vídeo. Fuso fixo para a hora
// da cópia ser conferível daqui.
test.use({ trace: 'off', video: 'off', timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' })

const FUSO = 'America/Sao_Paulo'
const NOME_DO_MAPA = 'Masmorra do Autosave'
const CHAVE_DO_DISCO = '__regua_salvamento_automatico_disco__'

/** Suposição da régua: a cópia sai no máximo 30 s depois da edição. */
const COPIA_EM_ATE_MS = 30_000
/** Folga sobre o intervalo (máquina carregada, várias lanes). */
const FOLGA_MS = 5_000
/** Espera curta por elemento que já deveria estar na tela. */
const ESPERA = 10_000
/** Teste com espera de cópia: abrir, desenhar, esperar 35 s, fechar, reabrir. */
const TEMPO_DO_TESTE = 150_000

const BOTAO_RECUPERAR = /^Recuperar/i

/** Retângulos das salas, relativos ao canvas: longe do rail e da barra. */
const SALA_CRIPTA = { x0: 380, y0: 300, x1: 620, y1: 440 }
const SALA_TORRE = { x0: 380, y0: 500, x1: 620, y1: 620 }

// ───────────────────────────────────────────────────────────────────────────
// Disco de mentira que sobrevive a fechar e abrir o app no mesmo contexto
// ───────────────────────────────────────────────────────────────────────────

type JanelaDoMestre = {
  isTauri: boolean
  __TAURI_INTERNALS__: {
    metadata: { currentWindow: { label: string }; currentWebview: { windowLabel: string; label: string } }
    invoke: (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>
    transformCallback: () => number
    convertFileSrc: (filePath: string) => string
  }
}

async function instalarDiscoQueSobrevive(page: Page): Promise<void> {
  await page.context().addInitScript(
    ({ chave }: { chave: string }) => {
      const alvo = window as unknown as JanelaDoMestre
      let salvo: { textos?: Record<string, string>; pastas?: string[] } = {}
      try {
        salvo = JSON.parse(window.localStorage.getItem(chave) ?? '{}') as typeof salvo
      } catch {
        salvo = {}
      }
      const textos: Record<string, string> = { ...(salvo.textos ?? {}) }
      const pastas = new Set<string>(salvo.pastas ?? [])
      const persistir = (): void => {
        try {
          window.localStorage.setItem(chave, JSON.stringify({ textos, pastas: Array.from(pastas) }))
        } catch {
          // localStorage cheio ou bloqueado: o controle positivo acusa.
        }
      }
      const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
      const todos = (): string[] => Object.keys(textos).concat(Array.from(pastas))
      const existe = (caminho: string): boolean => {
        const c = semBarraFinal(caminho)
        return todos().some((p) => p === c || p.indexOf(`${c}/`) === 0)
      }
      alvo.isTauri = true
      alvo.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
        convertFileSrc: (caminho: string) => String(caminho),
        transformCallback: () => 0,
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
            case 'plugin:fs|mkdir':
              pastas.add(semBarraFinal(String(a.path)))
              persistir()
              return null
            case 'plugin:fs|write_text_file':
              textos[decodeURIComponent(options?.headers?.path ?? '')] = new TextDecoder().decode(args as Uint8Array)
              persistir()
              return null
            case 'plugin:fs|read_text_file': {
              const caminho = String(a.path)
              if (!(caminho in textos)) throw new Error(`arquivo não existe: ${caminho}`)
              return Array.from(new TextEncoder().encode(textos[caminho]))
            }
            case 'plugin:fs|rename': {
              const de = String(a.oldPath)
              if (de in textos) {
                textos[String(a.newPath)] = textos[de]
                delete textos[de]
                persistir()
              }
              return null
            }
            case 'plugin:fs|remove': {
              const caminho = semBarraFinal(String(a.path))
              for (const p of Object.keys(textos)) if (p === caminho || p.indexOf(`${caminho}/`) === 0) delete textos[p]
              for (const p of Array.from(pastas)) if (p === caminho || p.indexOf(`${caminho}/`) === 0) pastas.delete(p)
              persistir()
              return null
            }
            case 'plugin:fs|read_dir': {
              const prefixo = `${semBarraFinal(String(a.path))}/`
              const filhos = new Map<string, boolean>()
              for (const p of todos()) {
                if (p.indexOf(prefixo) !== 0) continue
                const resto = p.slice(prefixo.length)
                if (resto.length === 0) continue
                const corte = resto.indexOf('/')
                const nome = corte === -1 ? resto : resto.slice(0, corte)
                filhos.set(nome, (filhos.get(nome) ?? false) || corte !== -1 || pastas.has(p))
              }
              return Array.from(filhos.entries()).map(([name, isDirectory]) => ({ name, isDirectory, isFile: !isDirectory, isSymlink: false }))
            }
            default:
              return null
          }
        },
      }
    },
    { chave: CHAVE_DO_DISCO },
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos do mestre
// ───────────────────────────────────────────────────────────────────────────

/** Menu → "Criar Mapas" → batiza o mapa pelo teclado → "Criar mapa". */
async function criarMapa(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar Mapas' }).click()
  const nome = page.getByRole('textbox', { name: 'Nome do mapa' })
  await nome.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.type(NOME_DO_MAPA)
  // exact: o cartão "Criar Mapas" também casaria com "Criar mapa" por substring.
  await page.getByRole('button', { name: 'Criar mapa', exact: true }).click()
  await page.waitForSelector('canvas')
}

/**
 * Ferramenta Sala, arrasto com pausa antes de soltar, nome pelo teclado.
 * Mesmo gesto de task-jornada-nao-perder-trabalho.spec.ts.
 */
async function desenharSala(page: Page, nomeDaSala: string, r: { x0: number; y0: number; x1: number; y1: number }): Promise<void> {
  const box = await page.locator('canvas').first().boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.getByRole('button', { name: 'Sala', exact: true }).click()
  await page.mouse.move(box.x + r.x0, box.y + r.y0)
  await page.mouse.down()
  await page.mouse.move(box.x + (r.x0 + r.x1) / 2, box.y + (r.y0 + r.y1) / 2, { steps: 8 })
  await page.mouse.move(box.x + r.x1, box.y + r.y1, { steps: 8 })
  // Pausa antes de soltar: é onde o usuário confere o retângulo.
  await page.waitForTimeout(150)
  await page.mouse.up()

  const campo = page.getByRole('textbox', { name: 'Nome da sala no mapa' })
  await expect(campo, 'desenhar com a ferramenta Sala deveria pedir o nome da sala').toBeVisible({ timeout: ESPERA })
  await page.keyboard.type(nomeDaSala)
  await page.keyboard.press('Enter')
  await expect(campo).toHaveCount(0)
}

/** Clique real em "Salvar" na barra; espera o aviso "Mapa salvo". */
async function salvar(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Mapa salvo' }).first(), 'Salvar não confirmou "Mapa salvo"').toBeVisible({
    timeout: ESPERA,
  })
}

/** A linha "Salas" da lista "Camadas do mapa" tem de mostrar `n` (texto visível). */
async function conferirSalasNaTela(page: Page, n: number, porque: string): Promise<void> {
  const abaMapa = page.getByRole('tab', { name: 'Mapa' })
  if ((await abaMapa.count()) > 0) await abaMapa.click()
  const cabecalho = page.getByRole('button', { name: 'Camadas', exact: true })
  await expect(cabecalho, 'o painel do editor deveria ter a seção "Camadas"').toBeVisible({ timeout: ESPERA })
  if ((await cabecalho.getAttribute('aria-expanded')) === 'false') await cabecalho.click()
  await expect(cabecalho).toHaveAttribute('aria-expanded', 'true')
  const linha = page.getByRole('list', { name: 'Camadas do mapa' }).getByRole('listitem').filter({ hasText: 'Salas' })
  await expect(linha, porque).toHaveText(new RegExp(`^Salas\\s*${n}$`), { timeout: ESPERA })
}

/**
 * Fecha o app sem salvar e abre de novo: a aba morre sem `beforeunload` (como
 * um processo que cai) e outra nasce no MESMO contexto, com o mesmo disco.
 */
async function fecharSemSalvarEReabrir(page: Page): Promise<Page> {
  const contexto = page.context()
  await page.close()
  const nova = await contexto.newPage()
  await nova.goto('/')
  await expect(nova.getByRole('button', { name: /Carregar Mapa existente/ }), 'o app reaberto deveria mostrar o menu inicial').toBeVisible({
    timeout: ESPERA,
  })
  return nova
}

/** Abre pelo menu o mapa salvo desta régua. */
async function abrirMapaSalvo(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await page.getByRole('button', { name: new RegExp(NOME_DO_MAPA) }).first().click()
  await page.waitForSelector('canvas')
}

/** Espera o intervalo máximo da cópia (suposição da régua) e mais a folga. */
async function darTempoParaACopia(page: Page): Promise<void> {
  await page.waitForTimeout(COPIA_EM_ATE_MS + FOLGA_MS)
}

// ───────────────────────────────────────────────────────────────────────────
// A hora da cópia
// ───────────────────────────────────────────────────────────────────────────

const MINUTO_MS = 60_000

function horaEmBrasilia(ms: number): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms))
}

/** Todos os HH:MM possíveis para uma cópia feita entre `inicio` e `fim`. */
function horasPossiveis(inicio: number, fim: number): Set<string> {
  const horas = new Set<string>()
  for (let m = Math.floor(inicio / MINUTO_MS); m <= Math.floor(fim / MINUTO_MS); m++) horas.add(horaEmBrasilia(m * MINUTO_MS))
  return horas
}

/** Horas escritas na tela como "14:05" ou "14h05", normalizadas para "14:05". */
function horasNoTexto(texto: string): string[] {
  const achadas: string[] = []
  for (const m of texto.matchAll(/\b(\d{1,2})\s*[:h]\s*(\d{2})\b/g)) achadas.push(`${m[1].padStart(2, '0')}:${m[2]}`)
  return achadas
}

// ───────────────────────────────────────────────────────────────────────────
// Os testes
// ───────────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await instalarDiscoQueSobrevive(page)
})

test('1. CONTROLE POSITIVO: sala salva sobrevive a fechar e reabrir, e reabrir sem perda não oferece recuperar', async ({ page }) => {
  test.setTimeout(TEMPO_DO_TESTE)
  await criarMapa(page)
  await desenharSala(page, 'Cripta', SALA_CRIPTA)
  await conferirSalasNaTela(page, 1, 'a sala recém-desenhada deveria contar na linha "Salas"')
  await salvar(page)

  const reaberto = await fecharSemSalvarEReabrir(page)

  // Tudo estava salvo: não há o que recuperar, e oferecer seria ruído.
  await reaberto.waitForTimeout(1500)
  await expect(reaberto.getByRole('button', { name: BOTAO_RECUPERAR }), 'reabrir depois de um Salvar limpo não deveria oferecer recuperação').toHaveCount(0)

  await abrirMapaSalvo(reaberto)
  await conferirSalasNaTela(reaberto, 1, 'o mapa salvo, reaberto do disco, deveria ter a sala Cripta')
})

test('2. fechar sem salvar e reabrir: a primeira tela oferece "Recuperar" com a hora da cópia', async ({ page }) => {
  test.setTimeout(TEMPO_DO_TESTE)
  await criarMapa(page)
  const inicio = Date.now()
  await desenharSala(page, 'Cripta', SALA_CRIPTA)
  await darTempoParaACopia(page)
  const fim = Date.now()

  const reaberto = await fecharSemSalvarEReabrir(page)

  const recuperar = reaberto.getByRole('button', { name: BOTAO_RECUPERAR }).first()
  await expect(recuperar, 'o app reaberto depois de fechar sem salvar não ofereceu "Recuperar" o trabalho não salvo').toBeVisible({
    timeout: ESPERA,
  })
  const horas = horasNoTexto(await reaberto.locator('body').innerText())
  const validas = horasPossiveis(inicio, fim)
  expect(
    horas.filter((h) => validas.has(h)),
    `a oferta de recuperação não mostra a hora da cópia (esperada uma de ${[...validas].join(', ')}; na tela: ${horas.join(', ') || 'nenhuma hora'})`,
  ).not.toHaveLength(0)
})

test('3. clicar em "Recuperar" devolve ao editor a sala que não foi salva', async ({ page }) => {
  test.setTimeout(TEMPO_DO_TESTE)
  await criarMapa(page)
  await desenharSala(page, 'Cripta', SALA_CRIPTA)
  await darTempoParaACopia(page)

  const reaberto = await fecharSemSalvarEReabrir(page)

  const recuperar = reaberto.getByRole('button', { name: BOTAO_RECUPERAR }).first()
  await expect(recuperar, 'o app reaberto não ofereceu "Recuperar" o trabalho não salvo').toBeVisible({ timeout: ESPERA })
  await recuperar.hover()
  await reaberto.waitForTimeout(80)
  await recuperar.click()

  await reaberto.waitForSelector('canvas', { timeout: ESPERA })
  await conferirSalasNaTela(reaberto, 1, 'Recuperar não devolveu a sala Cripta que o mestre desenhou e não salvou')
})

test('4. a cópia de recuperação nunca grava por cima do mapa salvo: ele reabre sem a sala não salva', async ({ page }) => {
  test.setTimeout(TEMPO_DO_TESTE)
  await criarMapa(page)
  await desenharSala(page, 'Cripta', SALA_CRIPTA)
  await salvar(page)
  // Trabalho novo, NÃO salvo, por cima do mapa já salvo.
  await desenharSala(page, 'Torre', SALA_TORRE)
  await conferirSalasNaTela(page, 2, 'a segunda sala deveria contar na linha "Salas" antes de fechar')
  await darTempoParaACopia(page)

  const reaberto = await fecharSemSalvarEReabrir(page)

  // A feature tem de existir: sem a oferta, "não sobrescreveu" passaria de graça.
  await expect(
    reaberto.getByRole('button', { name: BOTAO_RECUPERAR }).first(),
    'o app reaberto não ofereceu "Recuperar" a sala Torre, que ficou sem salvar',
  ).toBeVisible({ timeout: ESPERA })

  // O mestre recusa a oferta: Esc, se ela for um diálogo (convenção de modal).
  if ((await reaberto.getByRole('dialog').count()) > 0 || (await reaberto.getByRole('alertdialog').count()) > 0) {
    await reaberto.keyboard.press('Escape')
  }
  await abrirMapaSalvo(reaberto)
  await conferirSalasNaTela(reaberto, 1, 'o mapa salvo reabriu com a sala não salva: a cópia de recuperação gravou por cima do arquivo')
})
