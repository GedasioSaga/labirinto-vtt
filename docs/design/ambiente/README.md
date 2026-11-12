# Protótipo: a ferramenta Ambiente (12/11/2026)

Pedido do mestre (12/11/2026): "Sobre a neblina, eu acho interessantes esses efeitos, adicione na parte da neblina poder colocar efeito de chuva ou efeito de brasas na verda a ferramente de neblina pode ser tornar ferramenta ambiente."

A ferramenta **Neblina** passa a se chamar **Ambiente** e ganha cinco efeitos: neblina, chuva, brasas, neve e folhas e cinzas. Cada efeito vale no mapa inteiro (uma chave) ou só onde o mestre pintar com o pincel, e tem intensidade própria. O vento é um só e todos seguem ele. Chuva, neve e folhas não caem dentro de casa de teto fechado nem em cômodo fechado. Brasas e neblina entram pela porta aberta.

Este protótipo serve para o mestre aprovar a ideia antes de ela entrar no app. A proposta completa, com o plano para levar ao app, está em `tmp/novos-2026-11-12/ambiente/PROPOSTA.md`. Como funciona hoje: `tmp/novos-2026-11-12/ambiente/ACHADOS.md`.

## Como abrir

Abra `prototipo-ambiente.html` no Chrome ou no Edge, com dois cliques. É uma página só, sem rede e sem instalar nada. Precisa de WebGL2; sem ele, a página avisa.

- `prototipo-ambiente.html?prova=1` abre e roda a conferência sozinha. O resultado aparece numa caixa no painel.

## O que dá para fazer

**Painel (à direita)**
- **Efeito**: escolhe qual dos cinco efeitos você está mexendo (teclas `1` a `5`). Cada linha mostra se ele está ligado e onde (no mapa inteiro, pintado ou desligado).
- **Mapa inteiro**: a chave e a intensidade. Os nomes mudam com a força: Garoa, Chuva, Chuva forte e Tempestade; Floquinhos, Neve e Nevasca; Poucas, Várias e Muitas; Leve, Média e Fechada. A neblina também tem densidade, como hoje. Folhas e cinzas escolhem entre Folhas, Cinzas ou As duas.
- **Pincel**: pincel ou borracha (segure `Alt` para apagar), tamanho (`[` e `]`), intensidade e "Apagar toda a ... pintada".
- **Vento da cena**: 8 direções e a força (Calmo, Brisa, Vento, Ventania). Tem rajadas leves.
- **Escolhas para você decidir**: relâmpago na chuva forte (Não, Raro, Frequente, com um botão para ver um agora), som da chuva, chão molha e junta neve. Cada escolha mostra a opção recomendada.
- **Para conferir (só no protótipo)**:
  - hora do dia (`D`, `T`, `N`);
  - ver como Mestre, Jogador na rua ou Jogador em casa (`M`, `J`, `I`);
  - telhado à vista ou visto por dentro (`R`);
  - porta fechada ou aberta (`O`, ou clique na porta);
  - pausar o movimento;
  - o depósito (um cômodo fechado) já visto ou ainda não;
  - "Mostrar o erro que a proposta evita".
- **Climas para experimentar**: Tempestade à noite, Outono com vento, Cidade em chamas, Nevasca, Garoa de manhã e Desligar tudo.
- **Copiar os números**: copia os valores atuais numa linha, para colar na conversa.

**Mapa**
- Arraste para pintar o efeito escolhido.
- A roda do mouse aproxima. Para mover a vista, arraste com o botão do meio ou com `Espaço` apertado. `0` encaixa o mapa na tela.
- `Ctrl + Z` desfaz e `Ctrl + Y` refaz a pintura. `Esc` cancela a pincelada.
- No canto de baixo, um marcador mostra quantas partículas existem e quanto o processador gasta por quadro.

## A cena de teste

O mapa tem 32 x 20 casas de 40 px e é pintado na hora no estilo Meio-Termo (as cores de `docs/design/ESTILO-DO-RPG.md`). Nele há:
- uma **casa de teto fechado** com porta;
- um **pátio sem teto**;
- um **depósito**, que é um cômodo fechado só visto depois de entrar;
- uma **zona oculta**;
- duas **áreas ainda não exploradas**;
- uma rua com a ficha do jogador.

## Provas (pasta `provas/`)

Conferido no Chromium 143.0.7499.4 headless (Playwright chromium-1200, `--use-angle=d3d11`), numa tela de 1600 x 900.

**Conferência** (`prova.json`, rodada com `?prova=1`): **passou**.
- Visão do jogador na rua, com o depósito ainda não visto e todos os efeitos ligados, mais chuva e neblina pintadas por cima do depósito. Em 3 instantes diferentes, a tela com o depósito e a tela sem ele dão **0 pixels diferentes**. Se o "seco" viesse de todas as salas (o erro que a proposta evita), a diferença seria de 59.263 pixels, o que mostra que a conferência enxerga o erro.
- Dentro da casa, a 100% e com vento forte:

  | Efeito | Pixels dentro da casa | Pixels na rua |
  |---|---|---|
  | Chuva | 0 | 185.801 |
  | Neve | 0 | 185.595 |
  | Folhas | 0 | 1.725 |
  | Cinzas | 0 | 1.876 |

- Porta:
  - Neblina: com a porta fechada, 0 pixels entram. Com ela aberta, entram 53.929, centrados a 63 px da porta.
  - Brasas: com a porta fechada, 0. Com ela aberta, 225, a 72 px da porta.

**Tempo de quadro** (`medida-do-quadro.json`). Todos os efeitos ligados no mapa inteiro: neblina 60, chuva 90, brasas 75, neve 70, folhas e cinzas 75, à noite, com a porta aberta. São 5.490 partículas num palco de 1232 x 900. Cada medida durou 6 s:

| Visão | Intervalo entre quadros (p95) | Processador por quadro (p95) | Tarefas de 200 ms ou mais |
|---|---|---|---|
| Mestre | 16,8 ms (60 quadros/s) | 0,3 ms | nenhuma |
| Mestre, esperando a placa de vídeo terminar (`gl.finish`) | 16,8 ms | 0,3 ms | nenhuma |
| Jogador na rua | 16,8 ms | 0,2 ms | nenhuma |

- Em rodadas anteriores, o processador mediu de 0,2 a 0,7 ms no p95.
- **Abertura da página**: nenhuma tarefa de 200 ms ou mais. As duas maiores tiveram 100 e 94 ms. Os shaders levam cerca de 0,8 s para compilar, mas compilam em segundo plano (`KHR_parallel_shader_compile`). Antes dessa troca, a abertura travava uma vez por 721 ms. Isso vale para o app: ver o risco na PROPOSTA.

**Folhas de contato** (10 quadros a cada 0,1 s): `folha-neblina.png`, `folha-chuva.png`, `folha-brasas.png`, `folha-neve.png` e `folha-folhas.png`. Mostram o visual final de cada efeito.

**Prints**

| Arquivo | O que mostra |
|---|---|
| `1-mestre-chuva-de-dia.png` | O mestre com chuva forte de dia. O chão molhado e as poças estão na rua e no pátio. O depósito fica seco. Na casa de teto fechado, a chuva bate no telhado. |
| `2-chuva-de-perto-respingo-e-poca.png` | De perto: a gota inclinada pelo vento, o respingo e a poça. |
| `3-jogador-na-rua-noite-chuva-e-neblina-pintada.png` | O jogador à noite. A chuva cai igual sobre o preto. A neblina pintada é cortada onde começa o que ele não conhece. |
| `4-regra-do-vazamento-contra-o-erro.png` | A proposta lado a lado com o erro evitado (o seco que desenharia o depósito). |
| `5-folhas-de-perto-a-tarde.png` | Folhas ao vento à tarde. |
| `6-todos-os-efeitos-jogador-noite.png` | O teste de força: tudo ligado, na visão do jogador, com o painel. |

## O que não foi conferido

- **Ninguém olhou num navegador com janela nem jogou com o mouse.** As cenas foram montadas pelos ganchos de teste (`window.__ambiente`). O pincel foi usado pelo gancho `pintar`, e as teclas e o arrasto de verdade não foram exercitados.
- **O tempo da placa de vídeo não foi medido em separado**, porque o Chrome não expõe o temporizador da GPU. O `gl.finish` mede só o que a espera devolve à página. Também não foi medido numa máquina fraca nem num celular.
- **O som não foi ouvido nem medido.** É ruído rosa filtrado, feito na hora, só para dar ideia. Os prints e as medidas foram feitos com o som desligado.
- **Neve e brasas sem print parado de perto**: os prints 1 a 5 mostram só chuva, neblina e folhas. Neve, brasas e cinzas aparecem nas folhas de contato e no print 6, feitos depois do último ajuste de cor e de forma. O teto de 30 prints da tarefa acabou aqui.
- **A casa vista por dentro sem print final**: com o telhado aberto, a casa fica seca. Isso foi visto num print de trabalho e medido na conferência (0 pixels), mas ficou fora dos 6 prints.
- **O relâmpago e o chão que junta neve** foram vistos parados no tempo, sem folha de contato própria.

## Arquivos

- `prototipo-ambiente.html`: o protótipo inteiro (HTML, CSS, WebGL2 e o som).
- `provas/`: os 6 prints, as 5 folhas, `prova.json` e `medida-do-quadro.json`.
- `tmp/novos-2026-11-12/ambiente/proto.mjs`: o roteiro de conferência.
  - Uso: `node proto.mjs <olhar|cenas|lado|folhas|medir|prova> [extra]`.
  - Abre um navegador headless e fecha sempre no fim.
