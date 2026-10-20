// Biblioteca de prompts de imagem e vídeo — importada do Animation Workspace (conteúdo
// licenciado pelo Igor). Imagens de referência em public/prompts (WebP 640px).
// Gerado por script; para adicionar prompts próprios, acrescente itens no mesmo formato.

export interface PromptCategoria {
  id: string;
  nome: string;
  descricao: string;
  tipo: "imagem" | "video";
}

export interface PromptItem {
  id: string;
  categoria: string;
  titulo: string;
  prompt: string;
  imagem: string;
  tags: string[];
}

export const PROMPT_CATEGORIAS: PromptCategoria[] = [
  {
    "id": "1",
    "nome": "Prompts Especiais",
    "descricao": "Esses são os meus prompts favoritos, para mudar estilo, técnicas diferentes, e planos especiais. Foram criados por mim para uso profissional.",
    "tipo": "imagem"
  },
  {
    "id": "2",
    "nome": "Upscale",
    "descricao": "Prompts dedicados a melhoria e upscale de imagem mantendo os detalhes.",
    "tipo": "imagem"
  },
  {
    "id": "3",
    "nome": "Planos de enquadramento",
    "descricao": "Diferentes ângulos e planos de câmera para suas cenas.",
    "tipo": "imagem"
  },
  {
    "id": "8",
    "nome": "Prompt para vídeo [Base]",
    "descricao": "Base para criação de vídeos com IA.",
    "tipo": "video"
  },
  {
    "id": "9",
    "nome": "Seedance 2.0",
    "descricao": "Prompts para imagem.",
    "tipo": "imagem"
  }
];

export const PROMPTS: PromptItem[] = [
  {
    "id": "p12",
    "categoria": "1",
    "titulo": "Estilo de Animação 3D de Filme",
    "prompt": "Recrie esta imagem como uma cena de um filme de animação 3D de alta qualidade, com visual mais cinematográfico.\n\nIluminação aprimorada de um amanhecer. Texturas mais ricas e uma estética mais profissional.\n\nMantenha os mesmos personagens e a essência da cena.",
    "imagem": "/prompts/p12.webp",
    "tags": [
      "Animação 3D",
      "Cinematográfico",
      "Realista"
    ]
  },
  {
    "id": "p2",
    "categoria": "1",
    "titulo": "Upscale",
    "prompt": "Recrie a imagem, em alta resolução, com detalhes e texturas reais, detalhamento do personagem mantendo a consistência da referência, melhore a textura da roupa e do cenário.\n\nMantenha  a mesma composição, cenário e ação, melhorando apenas os detalhes pedidos\n\nA luz é realista e cinematografica.",
    "imagem": "/prompts/p2.webp",
    "tags": [
      "Upscale",
      "Detalhado",
      "Realista"
    ]
  },
  {
    "id": "p3",
    "categoria": "1",
    "titulo": "Storyboard Cinematográfico 16:09",
    "prompt": "Crie 4 imagens 1x4, contando uma historia com variação de enquadramentos criativos, como cenas de um filme.\n[Historia]\n\nQuero variação de enquadramentos, planos mais ricos como:  plano geral, over the shoulder, planos macro, primeiro plano focado, primeiro plano desfocado. \n\nSem alterar a cena. personagens devem estar no mesmo lugar.   \n\nCom composições mais profissionais como de um diretor de fotografia: Regra dos terços, proporção áurea, bem como os filmes premiados.  Mantenha os mesmos personagem.  \n\nA luz é realista. Mantenha o estilo da imagem de referência, como se tudo fosse parte de um mesmo filme.",
    "imagem": "/prompts/p3.webp",
    "tags": [
      "Storyboard",
      "Cinematográfico",
      "Variação"
    ]
  },
  {
    "id": "p13",
    "categoria": "1",
    "titulo": "Storyboard Cinematográfico 9:16",
    "prompt": "Gere uma única imagem em proporção 16:9, dividida em 4 painéis verticais 9:16 de larguras iguais, lado a lado (como um storyboard de cinema), separados por finas bordas pretas.\n\n[Historia]\n\nQuero variação de enquadramentos, planos mais ricos como:  plano geral, over the shoulder, planos macro, primeiro plano focado, primeiro plano desfocado. \n\nSem alterar a cena. personagens devem estar no mesmo lugar.   \n\nA luz é realista e cinematográfica. Mantenha o estilo da imagem de referência, como se tudo fosse parte de um mesmo filme.",
    "imagem": "/prompts/p13.webp",
    "tags": [
      "Storyboard",
      "Cinematográfico",
      "9:16"
    ]
  },
  {
    "id": "p4",
    "categoria": "1",
    "titulo": "Banco de Posições (Full Body)",
    "prompt": "Crie várias imagens do personagem, cada uma com uma pegando um ângulo diferente de corpo inteiro, de lado, de frente, de costas, de cima de baixo \n\nsempre um full body shot em todas imagens\n\nA luz é realista e cinematográfica.\n\nMantenha os personagens, proporção e formatos bem fiéis, Apenas mude a ação para posição que foi pedido e estilo de animação 3d detalhado com texturas.",
    "imagem": "/prompts/p4.webp",
    "tags": [
      "Posições",
      "Full Body",
      "Personagem"
    ]
  },
  {
    "id": "p5",
    "categoria": "1",
    "titulo": "Banco de Emoções",
    "prompt": "Crie varias imagens, cada uma com uma expressão de um sentimento diferente, raiva, tristeza, timidez, vergonha, alegria, inocência, medo, ansiedade! \n\nsempre um médio close-up em todas imagens\n\nA luz é realista e cinematográfica.\n\nMantenha os personagens, proporção e formatos bem fiéis, Apenas mude a ação para posição que foi pedido e estilo de animação 3d detalhado com texturas.",
    "imagem": "/prompts/p5.webp",
    "tags": [
      "Emoções",
      "Close-up",
      "Personagem"
    ]
  },
  {
    "id": "p7",
    "categoria": "1",
    "titulo": "Variação de Ângulos (Cenário)",
    "prompt": "Crie várias imagens do cenário, cada uma com uma pegando um ângulo diferente do quarto pegando todos os ângulos, e vários cantos diferentes\n\nA luz é realista e cinematográfica.\n\nMantenha o mesmo ambiente, proporção e formatos bem fiéis, Apenas mude os ângulos",
    "imagem": "/prompts/p7.webp",
    "tags": [
      "Cenário",
      "Ângulos",
      "Variação"
    ]
  },
  {
    "id": "p6",
    "categoria": "1",
    "titulo": "Esboço a Caneta (Personagem)",
    "prompt": "Mude para estilo de um desenho feito a mão, no formato de esboço feito com caneta preta. O fundo é branco, não precisa pintar.  \n\nSeja fiel e consistente com as formas e proporções",
    "imagem": "/prompts/p6.webp",
    "tags": [
      "Esboço",
      "Caneta",
      "Desenho"
    ]
  },
  {
    "id": "p8",
    "categoria": "1",
    "titulo": "Esboço a Caneta (Cenário)",
    "prompt": "Mude para estilo de um desenho feito a mão, no formato de esboço feito com caneta preta. O fundo do cenário pode ser detalhado, não precisa pintar.  \n\nSeja fiel e consistente com as formas e proporções",
    "imagem": "/prompts/p8.webp",
    "tags": [
      "Esboço",
      "Cenário",
      "Desenho"
    ]
  },
  {
    "id": "p9",
    "categoria": "1",
    "titulo": "Frame Cinematográfico Realista",
    "prompt": "Mude para um estilo de frame de filme cinematográfico com texturas e detalhes realistas. com poros na pele e micro pelos.\n\n[Iluminação] A luz é realista e cinematográfica.\n\nMantenha os personagens com proporções e formatos fieis. Apenas mude para o estilo que foi pedido\n\nQuero texturas no personagem,  poros na pele, leves imperfeições, textura na roupa, desgaste e brilhos realistas.",
    "imagem": "/prompts/p9.webp",
    "tags": [
      "Frame",
      "Cinematográfico",
      "Realista"
    ]
  },
  {
    "id": "up1",
    "categoria": "2",
    "titulo": "Upscale Detalhado Fotografia",
    "prompt": "Recrie a imagem, em alta resolução, com detalhes e texturas reais, detalhamento do personagem mantendo a consistência da referência, melhore a textura da roupa, do cenário e do assunto principal.\n\nMantenha  a mesma composição, luz, cores, cenário e ação, melhorando apenas os detalhes pedidos\n\nA imagem é uma fotografia profissional em alta resolução.",
    "imagem": "/prompts/up1.webp",
    "tags": [
      "Upscale",
      "Fotografia",
      "Realista"
    ]
  },
  {
    "id": "up2",
    "categoria": "2",
    "titulo": "Upscale Macro F1.2",
    "prompt": "Recrie a imagem, em alta resolução, como uma fotografia profissional, com detalhes e texturas reais, detalhamento do personagem, do rosto, expressão e dá roupa, mantendo a consistência da referência, melhore a textura da roupa e do cenário micro texturas e pequenos detalhes.\n\nMantenha a mesma composição, luz, cores, cenário e ação, melhorando apenas os detalhes pedidos\n\nA imagem é em alta qualidade com detalhes, feita por uma câmera profissional em alta resolução, com uma lente com abertura em f1.2. profundidade de campo rasa e natural.\n\nQuero detalhes, poros na pele, pequenas marcas quando existir, micro pelos realistas e pequenas imperfeições, de forma natural",
    "imagem": "/prompts/up2.webp",
    "tags": [
      "Upscale",
      "Macro",
      "F1.2"
    ]
  },
  {
    "id": "up3",
    "categoria": "2",
    "titulo": "Upscale Animação F1.2",
    "prompt": "Recrie a imagem, em alta resolução, com nitidez, detalhes e texturas refinadas, se tiver personagem crie um detalhamento dele, do rosto, expressão e dá roupa, mantendo a consistência da referência, melhore a textura da roupa, micro texturas e pequenos detalhes também do cenário.\n\nMantenha o mesmo estilo de animação, a mesma composição, luz, cores, cenário e ação, melhorando apenas os detalhes pedidos.\n\nA imagem mantém o seu estilo de animação mas agora em alta qualidade com detalhes de forma nítida e profissional\n\n[Se tiver personagem] Quero detalhes, poros na pele, pequenas marcas quando existir, micro pelos realistas e pequenas imperfeições, de forma natural",
    "imagem": "/prompts/up3.webp",
    "tags": [
      "Upscale",
      "Animação",
      "Nitidez"
    ]
  },
  {
    "id": "en1",
    "categoria": "3",
    "titulo": "Macro shot",
    "prompt": "Mude para um [Macro shot] \n\nMantenha o mesmo personagem, respeitando as proporções, luz, composição e ação, mudando apenas para o plano que foi pedido.",
    "imagem": "/prompts/en1.webp",
    "tags": [
      "Enquadramento",
      "Macro"
    ]
  },
  {
    "id": "en2",
    "categoria": "3",
    "titulo": "Extreme long shot",
    "prompt": "Mude para um [Extreme long shot] \n\nMantenha o mesmo personagem, respeitando as proporções, luz, composição e ação, mudando apenas para o plano que foi pedido.",
    "imagem": "/prompts/en2.webp",
    "tags": [
      "Enquadramento",
      "Extreme Long Shot"
    ]
  },
  {
    "id": "en3",
    "categoria": "3",
    "titulo": "Close-up shot",
    "prompt": "Mude para um [close-up shot]\n\nMantenha o mesmo personagem, respeitando as proporções, luz, composição e ação, mudando apenas para o plano que foi pedido.",
    "imagem": "/prompts/en3.webp",
    "tags": [
      "Enquadramento",
      "Close-up"
    ]
  },
  {
    "id": "en4",
    "categoria": "3",
    "titulo": "Side Profile shot",
    "prompt": "Mude para um [Side Profile shot]\n\nMantenha o mesmo personagem, respeitando as proporções, luz, composição e ação, mudando apenas para o plano que foi pedido.",
    "imagem": "/prompts/en4.webp",
    "tags": [
      "Enquadramento",
      "Side Profile"
    ]
  },
  {
    "id": "en5",
    "categoria": "3",
    "titulo": "Extreme close-up shot",
    "prompt": "Mude para um [extreme close-up shot]\n\nMantenha o mesmo personagem, respeitando as proporções, luz, composição e ação, mudando apenas para o plano que foi pedido.",
    "imagem": "/prompts/en5.webp",
    "tags": [
      "Enquadramento",
      "Extreme Close-up"
    ]
  },
  {
    "id": "en6",
    "categoria": "3",
    "titulo": "High angle back shot",
    "prompt": "Mude para um [High angle back shot]\n\nMantenha o mesmo personagem, respeitando as proporções, luz, composição e ação, mudando apenas para o plano que foi pedido.",
    "imagem": "/prompts/en6.webp",
    "tags": [
      "Enquadramento",
      "High Angle Back"
    ]
  },
  {
    "id": "en7",
    "categoria": "3",
    "titulo": "Low angle shot",
    "prompt": "Mude para um [Low angle shot]\n\nMantenha o mesmo personagem, respeitando as proporções, luz, composição e ação, mudando apenas para o plano que foi pedido.",
    "imagem": "/prompts/en7.webp",
    "tags": [
      "Enquadramento",
      "Low Angle"
    ]
  },
  {
    "id": "en8",
    "categoria": "3",
    "titulo": "Off-center shot",
    "prompt": "Mude para um [Off-center shot]\n\nMantenha o mesmo personagem, respeitando as proporções, luz, composição e ação, mudando apenas para o plano que foi pedido.",
    "imagem": "/prompts/en8.webp",
    "tags": [
      "Enquadramento",
      "Off-center"
    ]
  },
  {
    "id": "en9",
    "categoria": "3",
    "titulo": "Over the shoulder shot",
    "prompt": "Mude para um [Over the shoulder shot]\n\nMantenha o mesmo personagem, respeitando as proporções, luz, composição e ação, mudando apenas para o plano que foi pedido.",
    "imagem": "/prompts/en9.webp",
    "tags": [
      "Enquadramento",
      "Over the Shoulder"
    ]
  },
  {
    "id": "vid1",
    "categoria": "8",
    "titulo": "Aproximação Cinematográfica",
    "prompt": "[Ação]  \nSeu movimento é natural e realista.\n\nA camera vai se aproximando  lentamente de forma cinematografica, quanto mais se aproxima mais revela detalhes e texturas.  \n\nEfeitos sonoros do que está acontecendo e ambiencia, Não tem trilha, nem musica, nem tons e não tem fala.",
    "imagem": "/prompts/vid1.webp",
    "tags": [
      "Vídeo",
      "Aproximação",
      "Cinematográfico"
    ]
  },
  {
    "id": "vid2",
    "categoria": "8",
    "titulo": "Afastamento Desfocado",
    "prompt": "[Ação]\n\nA camera vai se afastando lentamente de forma cinematografica,  com o primeiro plano passando desfocado.\n\nEfeitos sonoros do que está acontecendo e ambiencia, Não tem trilha, nem musica, nem tons e não tem fala.",
    "imagem": "/prompts/vid2.webp",
    "tags": [
      "Vídeo",
      "Afastamento",
      "Desfocado"
    ]
  },
  {
    "id": "vid3",
    "categoria": "8",
    "titulo": "Movimento Lateral",
    "prompt": "[Ação]\n\nA camera faz um movimento lateral suave e cinematografico. \n\nEfeitos sonoros do que está acontecendo e ambiencia, Não tem trilha, nem musica, nem tons e não tem fala.",
    "imagem": "/prompts/vid3.webp",
    "tags": [
      "Vídeo",
      "Movimento Lateral",
      "Suave"
    ]
  },
  {
    "id": "vid4",
    "categoria": "8",
    "titulo": "Afastamento Acompanhando",
    "prompt": "[Ação]  \n\nSeu movimento é natural e realista.\nA camera vai se afastando acompanhando o movimento do personagem. de forma natural e realista mantendo o mesmo enquadramento\n\nEfeitos sonoros do que está acontecendo e ambiencia, Não tem trilha, nem musica, nem tons e não tem fala.",
    "imagem": "/prompts/vid4.webp",
    "tags": [
      "Vídeo",
      "Afastamento",
      "Acompanhando"
    ]
  },
  {
    "id": "vid5",
    "categoria": "8",
    "titulo": "Acompanhamento Fixo",
    "prompt": "[Ação]  \n\nA camera está acompanhando o movimento do assunto principal. de forma natural e realista mantendo o mesmo enquadramento\n\nEfeitos sonoros do que está acontecendo e ambiencia, Não tem trilha, nem musica, nem tons e não tem fala.",
    "imagem": "/prompts/vid5.webp",
    "tags": [
      "Vídeo",
      "Acompanhamento",
      "Fixo"
    ]
  },
  {
    "id": "vid6",
    "categoria": "8",
    "titulo": "Câmera na Mão",
    "prompt": "[Ação]\n\nA camera está parada mas fazendo um leve movimento de camera na mão, de forma natural e realista\n\nEfeitos sonoros do que está acontecendo e ambiencia, Não tem trilha, nem musica, nem tons e não tem fala.",
    "imagem": "/prompts/vid6.webp",
    "tags": [
      "Vídeo",
      "Câmera na Mão",
      "Realista"
    ]
  },
  {
    "id": "se1",
    "categoria": "9",
    "titulo": "Banco de personagens com fundo branco",
    "prompt": "Crie várias imagens do personagem pose neutra, braços relaxados, cada uma com uma pegando um ângulo diferente: de corpo inteiro fullbody shot de lado, fullbody shot de frente, fullbody shot de costas, fullbody shot em 3/4 e uma em close-up shot no rosto. as imagens ficam organizadas em 3x2.\n\nMantenha os personagens, proporção e formatos bem legítimos, apenas mude a ação para a posição que foi pedido. Mantenha exatamente o mesmo estilo da imagem de referência.\n\nPorém, eu quero que não aplique o cenário. O fundo é branco.",
    "imagem": "/prompts/se1.webp",
    "tags": [
      "Seedance",
      "Turnaround",
      "Personagem"
    ]
  },
  {
    "id": "se2",
    "categoria": "9",
    "titulo": "Personagem isolado 2x3",
    "prompt": "Crie várias imagens do personagem, cada uma com uma pegando um ângulo diferente ela está com uma expressão neutra, com os braços relaxados e olhando para a câmera : Ele de corpo inteiro fullbody shot de lado, fullbody shot de frente, fullbody shot de costas, fullbody shot em 3/4 e uma em close-up shot no seu rosto e close-up shot no rosto de perfil. as imagens ficam organizadas em 3x2.\n\nMantenha consistencia, proporção e formatos bem legítimos, apenas mude a ação para a posição que foi pedido. Mantenha exatamente o mesmo estilo da imagem de referência. \n\nPorém, eu quero que não aplique o cenário. O fundo é branco. \n\nNão quero textos extra, nem linhas delimitando os quadrantes. Apenas o personagem em várias posições, assim como foi pedido.",
    "imagem": "/prompts/se2.webp",
    "tags": [
      "Seedance",
      "Turnaround",
      "Consistência"
    ]
  }
];
