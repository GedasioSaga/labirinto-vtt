# Judge v4 (feito ao vivo no Blender pelo MCP)

O Judge é o avatar do mestre na batalha: um cavaleiro de armadura prateada, elmo com chifres de touro e capa azul, montado num chocobo marrom de máscara de metal. Ele ergue uma carta vermelha que brilha.

O modelo foi montado ao vivo no Blender 5.2, na cena "Judge", por scripts Python mandados pelo MCP do Blender. As penas são placas largas; armadura, elmo, máscara, capa e carta são malhas feitas por código, com materiais do Poly Haven.

## O que mudou na v4

- **Braços e luvas (parte A):** os braços viraram placas de armadura articuladas, com luvas. A carta fica presa entre o indicador e o médio erguidos e o polegar.
- **Olho, ombreiras e pés (parte B):** o chocobo ganhou o olho preto grande. As ombreiras encolheram para caber no corpo do cavaleiro, sem perder as lâminas, a gravura e as ameias. Os pés foram refeitos.
- **Capa, máscara, crista e peito (parte C):** a capa cai com simulação de tecido, sem atravessar a cauda. A testeira em forma de caixa virou uma máscara de frente e lados, presa por correias. Uma crista de penas longas sai do topo da cabeça e da nuca. O peitoral foi refeito.
- **Parte D, esta rodada:**
  - **Cauda deitada para trás.** O leque em pé, que lembrava um peru, virou 15 penas compridas e largas que saem para trás quase na horizontal, abrindo em leque no chão e subindo um pouco, como um telhado dobrado. A capa foi simulada de novo por cima da cauda nova.
  - **Máscara angulosa.** Placas retas com arestas vivas no lugar das curvas lisas. O furo do olho é um losango de cantos marcados, com borda de aço escuro, e não mais um aro redondo. O olho preto, o bico retangular que afina, a crista da nuca e as tiras azuis da frente ficaram.
  - **Contorno azul no herói.** Duas luzes de contorno fortes (14.000 W e 8.000 W) e uma terceira, grande e azul, que só acende o metal. A cauda fica fora das luzes de contorno, senão estoura em branco. O fundo ganhou manchas de névoa lavanda.
  - **Olhos do juiz na folha.** A 64 px por quadrado, o olho da viseira tem 2 a 3 px e sumia no reflexo do aço. Cada olho ganhou um brilho azul-claro com um aro azul e uma sombra macia em volta, virado para a câmera da folha. O brilho só existe na folha; no herói os olhos já aparecem pelo tamanho.

## O que tem aqui

| Arquivo | O que é |
|---|---|
| `judge-heroi.png` | Imagem grande (1200 x 1500), em 3/4 de baixo, com a carta erguida (1.929 KB) |
| `judge-folha.png` | Folha do app: 8 direções x 20 quadros, fundo transparente, 3840 x 1920 (6.570 KB) |
| `judge-folha.webp` | A mesma folha em WebP qualidade 90, bem mais leve para o app (1.158 KB) |
| `judge-folha.json` | Como ler a folha (tamanho do quadro, direções, animações, ponto do chão) |
| `fonte/judge.blend` | O modelo, com as texturas dentro. Abre no Blender 5.2; tudo fica na cena "Judge" (12.657 KB) |
| `fonte/render_judge.py` | Renderiza o herói e a folha de novo, fora da janela do Blender |

## Como a folha funciona

- Cada quadro tem 192 x 240 px. Um quadrado do mapa vale 64 px, então o Judge ocupa 1 quadrado no chão e uns 2,5 de altura.
- O ponto do chão (centro da base) fica em x = 96, y = 200 dentro de cada quadro.
- Câmera ortográfica, 30 graus acima, de frente. As luzes ficam paradas e o modelo gira.
- Linhas, de cima para baixo: sul, sudeste, leste, nordeste, norte, noroeste, oeste, sudoeste. "Sul" é virado para quem olha a tela.
- Colunas 1 a 12: respiração, em laço, a 12 quadros por segundo. O braço da carta fica baixo e a carta brilha pouco.
- Colunas 13 a 20: erguer a carta, uma vez só. O braço sobe, passa um pouco do ponto e assenta; o brilho vermelho cresce.

## Como renderizar de novo

Na pasta `fonte/`, com o Blender 5.2 fechado ou aberto (roda em outro processo):

```
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b judge.blend --python render_judge.py -- limpar heroi folha webp --tmp C:/caminho/temporario
```

`limpar` tira do arquivo o que não é usado e salva o `.blend` de novo, `heroi` refaz a imagem grande, `folha` refaz a folha e o `.json`, e `webp` faz a cópia leve da folha. A pasta `--tmp` guarda os 160 quadros soltos antes de montar a folha e pode ser apagada depois. Com a placa de vídeo (OptiX), a folha leva uns 2 minutos e o herói alguns minutos.

Detalhes que o `render_judge.py` cuida sozinho:

- **Herói:** liga a névoa do fundo, tira a cauda das luzes de contorno (light linking) e cria por um instante a luz `JL_contorno_metal`, que só acende os objetos de material `JM_m_aco` e `JJ_m_aco` e não deixa a capa, a cauda e a crista fazerem sombra nela. Depois do render tudo volta como estava.
- **Folha:** acende os planos `JE_brilho_olhoE` e `JE_brilho_olhoD` (o brilho dos olhos). Eles copiam a rotação da câmera da folha e ficam 7 cm à frente do olho, na direção da câmera. Como a câmera é ortográfica, isso não muda o lugar do olho na tela; só põe o brilho na frente da viseira. A crista da ave e o braço erguido, que ficam mais longe, ainda cobrem o brilho quando estão na frente.

## O que ainda fica longe da pintura

- **No sul, a crista cobre o rosto do juiz.** Vista de frente e de cima, a crista do chocobo fica entre a câmera e a viseira, então na primeira linha da folha os olhos do juiz não aparecem. Nas outras direções de frente e de lado eles aparecem. Para aparecerem também no sul, seria preciso abrir a crista no meio ou baixá-la uns 15 cm, o que muda o desenho aprovado na parte C.
- **De lado (leste e oeste),** o brilho do olho de trás aparece um pouco abaixo da sobrancelha, e o olho vira um risquinho de dois pontos em vez de um.
- **Na respiração, a carta baixa** aparece como um retângulo vermelho na maioria das direções, mas no sudeste fica na frente do rosto e no oeste e sudoeste fica meio coberta pela crista.
- **As penas** continuam placas lisas, sem a pincelada macia da pintura.

## Créditos (Poly Haven, licença CC0)

Todos os materiais de fora vêm do Poly Haven, em domínio público (CC0). O crédito não é obrigatório; fica aqui por cortesia.

- Céu "Rogland Overcast", de Greg Zaal: a luz fria e nublada.
- "Metal Plate 02", de Rob Tuytel: o riscado e a rugosidade do aço.
- "Denim Fabric 05", de Rico Cilliers e colormass: a trama da capa e dos panos.
- "Leather Red 02", de Rob Tuytel: o couro da sela e das rédeas.
