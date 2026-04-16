import { useState, useRef } from 'react';
import {
  UploadCloud, FileText, Image as ImageIcon, Wand2,
  CheckCircle2, Palette, PenTool, Layout, Download,
  AlertCircle, Loader2, ChevronRight, X, ImagePlus, Key, Cpu, Info, ExternalLink
} from 'lucide-react';

const apiKey = "";

const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delays[i]));
    }
  }
};

interface ModelOption { id: string; label: string; }
interface ReferenceImage { base64: string; mimeType: string; }

export default function App() {
  const [step, setStep] = useState(1);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [customApiKey, setCustomApiKey] = useState("");
  const [mdFile, setMdFile] = useState<File | null>(null);
  const [mdContent, setMdContent] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [selectedSize, setSelectedSize] = useState("1080x1080");
  const [numCreatives, setNumCreatives] = useState(1);
  const [availableTextModels, setAvailableTextModels] = useState<ModelOption[]>([
    { id: "gemini-2.5-flash-preview-09-2025", label: "Gemini 2.5 Flash (Padrão)" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Alta Complexidade)" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Rápido)" }
  ]);
  const [availableImageModels, setAvailableImageModels] = useState<ModelOption[]>([
    { id: "gemini-2.5-flash-image-preview", label: "Gemini Image Flash (Nano Banana)" },
    { id: "gemini-3-pro-image-preview-11-2025", label: "Gemini 3 Pro Image (Nano Banana Pro)" },
    { id: "imagen-4.0-generate-001", label: "Imagen 4.0 (Estável)" }
  ]);
  const [textModel, setTextModel] = useState("gemini-2.5-flash-preview-09-2025");
  const [imageModel, setImageModel] = useState("gemini-2.5-flash-image-preview");
  const [keyStatus, setKeyStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [palette, setPalette] = useState<string[]>([]);
  const [copyText, setCopyText] = useState("");
  const [designConcept, setDesignConcept] = useState("");
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const mdInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const sizes = [
    { id: "1080x1080", label: "Post (1:1)", icon: <Layout className="w-5 h-5" /> },
    { id: "1080x1920", label: "Story (9:16)", icon: <Layout className="w-4 h-6" /> },
    { id: "1920x1080", label: "Banner (16:9)", icon: <Layout className="w-6 h-4" /> }
  ];

  const handleMdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMdFile(file);
    const reader = new FileReader();
    reader.onload = (event) => setMdContent(event.target?.result as string);
    reader.readAsText(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setLogo(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newImages: ReferenceImage[] = [];
    let loadedCount = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        newImages.push({ base64: event.target?.result as string, mimeType: file.type });
        loadedCount++;
        if (loadedCount === files.length) {
          setReferenceImages(prev => [...prev, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const fetchModelsFromApi = useCallback(async (key: string) => {
    if (!key || key.length < 10) return;
    setKeyStatus("loading");
    setError(null);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fetchedText = data.models
        .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent") && !m.name.includes("image") && !m.name.includes("embedding"))
        .map((m: any) => ({ id: m.name.replace('models/', ''), label: m.displayName || m.name.replace('models/', '') }));
      if (fetchedText.length > 0) {
        setAvailableTextModels(fetchedText);
        setTextModel(prev => fetchedText.find((m: ModelOption) => m.id === prev) ? prev : fetchedText[0].id);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fetchedImage = data.models
        .filter((m: any) => m.name.includes("imagen") || m.name.includes("image-preview") || (m.displayName && m.displayName.toLowerCase().includes("image")))
        .map((m: any) => ({ id: m.name.replace('models/', ''), label: m.displayName || m.name.replace('models/', '') }));
      if (fetchedImage.length > 0) {
        setAvailableImageModels(fetchedImage);
        setImageModel(prev => fetchedImage.find((m: ModelOption) => m.id === prev) ? prev : fetchedImage[0].id);
      }
      setKeyStatus("success");
    } catch (err) {
      console.error(err);
      setKeyStatus("error");
      setError("Falha ao carregar modelos. Verifique se a chave é válida e possui permissões.");
    }
  }, []);

  useEffect(() => {
    if (!customApiKey || customApiKey.length < 10) {
      setKeyStatus("idle");
      return;
    }
    const timeout = setTimeout(() => {
      fetchModelsFromApi(customApiKey);
    }, 800);
    return () => clearTimeout(timeout);
  }, [customApiKey, fetchModelsFromApi]);

  const analyzeInputs = async () => {
    if (!mdContent) { setError("Por favor, faça upload do arquivo Markdown com as informações da empresa."); return; }
    setStep(2); setLoadingMsg("Analisando referências e extraindo informações..."); setError(null);
    try {
      const activeKey = customApiKey || apiKey;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${textModel}:generateContent?key=${activeKey}`;
      const systemPrompt = `
        Você é um Diretor de Criação Sênior e um Mestre em Copywriting atuando em uma agência de publicidade de elite.
        Sua tarefa é analisar o manual/documento da marca e as imagens de referência visual fornecidas.
        Você deve:
        1. Identificar uma paleta de cores (3 a 5 cores em formato HEX) que represente a marca e as referências visuais.
        2. Escrever uma 'Copy' (texto de anúncio) extremamente persuasiva, utilizando gatilhos mentais e o tom de voz da marca, focado em alta conversão. A copy deve ser curta e impactante para caber em um banner de tamanho ${selectedSize}.
        3. Desenvolver um 'Conceito de Design' detalhado, EM INGLÊS (para um gerador de imagens IA), descrevendo a estética, a iluminação, os elementos visuais esperados, baseando-se estritamente no estilo das imagens de referência enviadas. Considere deixar um espaço negativo adequado (geralmente nos cantos) se uma logo precisar ser inserida posteriormente.
        ${logo ? '4. Uma logo foi enviada. Extraia as cores primárias dela também para compor a paleta da marca de forma coerente.' : ''}
        Responda APENAS com um JSON válido seguindo a estrutura fornecida.
      `;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = [{ text: `Informações da empresa:\n${mdContent}` }];
      if (logo) { parts.push({ inlineData: { mimeType: "image/png", data: logo.split(',')[1] } }); }
      referenceImages.forEach(img => {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64.split(',')[1] } });
      });
      const payload = {
        contents: [{ role: "user", parts }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              colors: { type: "ARRAY", items: { type: "STRING" }, description: "Array de 3 a 5 códigos HEX (ex: #FFFFFF)" },
              copy: { type: "STRING", description: "Copy curta e persuasiva em Português" },
              design_concept: { type: "STRING", description: "Conceito de design hiper detalhado em INGLÊS para prompt de IA geradora de imagens. Descreva o background, atmosfera, estilo e posicionamento. NÃO inclua o texto da copy aqui." }
            },
            required: ["colors", "copy", "design_concept"]
          }
        }
      };
      const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) throw new Error("Resposta inválida da IA.");
      const data = JSON.parse(responseText);
      setPalette(data.colors || []); setCopyText(data.copy || ""); setDesignConcept(data.design_concept || ""); setStep(3);
    } catch (err: any) {
      console.error(err); setError("Erro ao analisar dados. " + err.message); setStep(1);
    }
  };

  const generateCreative = async () => {
    setStep(4); setLoadingMsg(`Gerando ${numCreatives} criativo(s) de alta conversão...`); setError(null);
    try {
      const activeKey = customApiKey || apiKey;
      const promises = Array.from({ length: numCreatives }).map(async (_, index) => {
        const finalPrompt = `
          High quality, premium advertising graphic design. Variation ${index + 1}.
          Format requirement: Think in a ${selectedSize} aspect ratio composition.
          Visual Concept: ${designConcept}.
          Color Palette to dominate the design: ${palette.join(', ')}.
          Typography: Add large, stylish, professional typography overlaying the image in a highly readable way.
          The exact text to write on the image is: "${copyText}".
          The typography must look like a professional marketing campaign.
        `.trim();
        let base64Image = "";
        if (imageModel.startsWith('imagen')) {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:predict?key=${activeKey}`;
          const payload = { instances: [{ prompt: finalPrompt }], parameters: { sampleCount: 1 } };
          const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!result.predictions || !result.predictions[0]) throw new Error("Erro ao gerar imagem. Tente modificar o conceito.");
          base64Image = result.predictions[0].bytesBase64Encoded;
        } else {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${activeKey}`;
          const payload = { contents: [{ parts: [{ text: finalPrompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } };
          const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inlineDataPart = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
          if (!inlineDataPart || !inlineDataPart.inlineData) throw new Error("Erro ao gerar imagem com o modelo Gemini Image.");
          base64Image = inlineDataPart.inlineData.data;
        }
        return `data:image/png;base64,${base64Image}`;
      });
      const images = await Promise.all(promises);
      setGeneratedImages(images); setStep(5);
    } catch (err: any) {
      console.error(err); setError("Erro ao gerar criativo. " + err.message); setStep(3);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-8 animate-fade-in w-full max-w-3xl mx-auto">
      <div className="bg-white p-8 rounded-[2rem] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100">
        <h3 className="text-xl font-semibold text-[#1d1d1f] mb-2 tracking-tight">Configuração de API e Modelos</h3>
        <p className="text-sm text-[#86868b] mb-5">Insira sua chave do Google AI Studio para gerar anúncios e carregar os modelos liberados para você.</p>
        <div className="relative">
          <Key className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="password" placeholder="AIzaSy..." value={customApiKey}
            onChange={(e) => setCustomApiKey(e.target.value)}
            className="w-full pl-12 pr-12 py-4 bg-[#f5f5f7] border-transparent rounded-2xl outline-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 text-[#1d1d1f] font-mono text-sm transition-all" />
          {keyStatus === "loading" && (
            <Loader2 className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-[#86868b] animate-spin" />
          )}
          {keyStatus === "success" && (
            <CheckCircle2 className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500" />
          )}
          {keyStatus === "error" && (
            <AlertCircle className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-red-500" />
          )}
        </div>
        {keyStatus === "success" && (
          <p className="text-sm text-emerald-600 font-medium mt-3 flex items-center gap-1.5 ml-1">
            <CheckCircle2 className="w-4 h-4" /> Modelos sincronizados automaticamente!
          </p>
        )}
        {keyStatus === "error" && (
          <p className="text-sm text-red-500 font-medium mt-3 flex items-center gap-1.5 ml-1">
            <AlertCircle className="w-4 h-4" /> Chave inválida ou sem permissão. Verifique e tente novamente.
          </p>
        )}
        <div className="mt-6 p-5 bg-[#f0f7ff] rounded-2xl border border-[#cce4ff] flex items-start gap-4">
          <Info className="w-6 h-6 text-[#0071e3] shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[#004a99] mb-1">Requisito de Faturamento (Nível 1)</p>
            <p className="text-sm text-[#0057b3]/90 leading-relaxed mb-3">
              Para ter acesso aos modelos visuais avançados e LLMs pesados (como <b>Gemini 1.5 Pro, Nano Banana Pro e Imagen 4.0</b>), sua Chave API precisa estar vinculada a um projeto com faturamento ativo (Pay-as-you-go). Sem isso, a geração de imagens falhará.
            </p>
            <a href="https://aistudio.google.com/app/billing" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[#0071e3] hover:text-[#0057b3] font-semibold text-sm transition-colors">
              Ativar faturamento no AI Studio <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100">
        <h3 className="text-xl font-semibold text-[#1d1d1f] mb-6 tracking-tight flex items-center gap-3">
          <div className="p-2 bg-[#f5f5f7] rounded-xl"><Cpu className="w-5 h-5 text-[#1d1d1f]" /></div>
          Seleção de IA
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium text-[#86868b] mb-3">IA Analítica e Copywriter</p>
            <div className="relative">
              <select value={textModel} onChange={(e) => setTextModel(e.target.value)}
                className="w-full p-4 pr-12 bg-[#f5f5f7] border-transparent rounded-2xl outline-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 text-[#1d1d1f] font-medium text-sm transition-all appearance-none cursor-pointer">
                {availableTextModels.map(model => (<option key={model.id} value={model.id}>{model.label}</option>))}
              </select>
              <ChevronRight className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-90" />
            </div>
            <p className="text-xs text-[#86868b] mt-2">Processa a brand persona e escreve os textos.</p>
          </div>
          <div>
            <p className="text-sm font-medium text-[#86868b] mb-3">IA Geradora de Imagens</p>
            <div className="relative">
              <select value={imageModel} onChange={(e) => setImageModel(e.target.value)}
                className="w-full p-4 pr-12 bg-[#f5f5f7] border-transparent rounded-2xl outline-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 text-[#1d1d1f] font-medium text-sm transition-all appearance-none cursor-pointer">
                {availableImageModels.map(model => (<option key={model.id} value={model.id}>{model.label}</option>))}
              </select>
              <ChevronRight className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-90" />
            </div>
            <p className="text-xs text-[#86868b] mt-2">Cria o design visual final do anúncio.</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100">
        <h3 className="text-xl font-semibold text-[#1d1d1f] mb-6 tracking-tight flex items-center gap-3">
          <div className="p-2 bg-[#f5f5f7] rounded-xl"><FileText className="w-5 h-5 text-[#1d1d1f]" /></div>
          Manual da Empresa (.md)
        </h3>
        <input type="file" accept=".md,.txt" ref={mdInputRef} className="hidden" onChange={handleMdUpload} />
        {!mdFile ? (
          <div onClick={() => mdInputRef.current?.click()}
            className="bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-2xl p-10 text-center cursor-pointer transition-colors border border-transparent hover:border-gray-200">
            <UploadCloud className="w-10 h-10 text-[#86868b] mx-auto mb-4" strokeWidth={1.5} />
            <p className="text-[#1d1d1f] font-medium text-lg">Carregar documento de marca</p>
            <p className="text-[#86868b] text-sm mt-2">Tom de voz, missão, produto, etc.</p>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-[#f5f5f7] p-5 rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-xl shadow-sm"><FileText className="w-6 h-6 text-[#1d1d1f]" /></div>
              <div>
                <p className="font-semibold text-[#1d1d1f]">{mdFile.name}</p>
                <p className="text-sm text-[#86868b]">{(mdFile.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button onClick={() => setMdFile(null)} className="p-2 text-[#86868b] hover:text-red-500 hover:bg-white rounded-full transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100">
        <h3 className="text-xl font-semibold text-[#1d1d1f] mb-6 tracking-tight flex items-center gap-3">
          <div className="p-2 bg-[#f5f5f7] rounded-xl"><ImagePlus className="w-5 h-5 text-[#1d1d1f]" /></div>
          Identidade Visual
        </h3>
        <input type="file" accept="image/png, image/jpeg, image/svg+xml" ref={logoInputRef} className="hidden" onChange={handleLogoUpload} />
        <div className="mb-8">
          <p className="text-sm font-medium text-[#86868b] mb-3">Logo da Empresa (Opcional)</p>
          {!logo ? (
            <div onClick={() => logoInputRef.current?.click()}
              className="bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-2xl p-6 text-center cursor-pointer transition-colors">
              <p className="text-[#1d1d1f] font-medium">Adicionar Logo</p>
              <p className="text-[#86868b] text-xs mt-1">PNG transparente recomendado</p>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-[#f5f5f7] p-4 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center overflow-hidden shadow-sm p-2">
                  <img src={logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                </div>
                <p className="font-medium text-[#1d1d1f]">Logo Carregada</p>
              </div>
              <button onClick={() => setLogo(null)} className="p-2 text-[#86868b] hover:text-red-500 hover:bg-white rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-[#86868b]">Referências de Estilo</p>
          </div>
          <input type="file" accept="image/*" multiple ref={imageInputRef} className="hidden" onChange={handleImageUpload} />
          <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
            {referenceImages.map((img, idx) => (
              <div key={idx} className="relative aspect-square group rounded-2xl overflow-hidden shadow-sm">
                <img src={img.base64} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                <button onClick={() => removeImage(idx)}
                  className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-md rounded-full text-[#1d1d1f] opacity-0 group-hover:opacity-100 transition-all hover:scale-105">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div onClick={() => imageInputRef.current?.click()}
              className="aspect-square bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors">
              <UploadCloud className="w-6 h-6 text-[#86868b] mb-2" strokeWidth={2} />
              <span className="text-xs text-[#86868b] font-medium">Adicionar</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100">
        <h3 className="text-xl font-semibold text-[#1d1d1f] mb-6 tracking-tight flex items-center gap-3">
          <div className="p-2 bg-[#f5f5f7] rounded-xl"><Layout className="w-5 h-5 text-[#1d1d1f]" /></div>
          Configurações de Geração
        </h3>
        <div className="mb-8">
          <p className="text-sm font-medium text-[#86868b] mb-3">Formato do Criativo</p>
          <div className="flex flex-col md:flex-row p-1.5 bg-[#f5f5f7] rounded-2xl gap-1">
            {sizes.map((size) => (
              <button key={size.id} onClick={() => setSelectedSize(size.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all ${selectedSize === size.id ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}>
                {size.icon} {size.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-[#86868b]">Quantidade de Variações</span>
            <span className="text-lg font-semibold text-[#1d1d1f] bg-[#f5f5f7] px-4 py-1 rounded-full">{numCreatives}</span>
          </div>
          <input type="range" min="1" max="10" value={numCreatives}
            onChange={(e) => setNumCreatives(Number(e.target.value))}
            className="w-full h-2 bg-[#e8e8ed] rounded-full appearance-none cursor-pointer accent-[#1d1d1f]" />
        </div>
      </div>

      <button onClick={analyzeInputs} disabled={!mdFile}
        className="w-full py-5 bg-[#1d1d1f] hover:bg-black disabled:bg-[#e8e8ed] disabled:text-[#86868b] disabled:cursor-not-allowed text-white text-lg font-semibold rounded-full flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] disabled:shadow-none mt-4">
        <Wand2 className="w-5 h-5" /> Processar Diretrizes
      </button>
    </div>
  );

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-in">
      <Loader2 className="w-12 h-12 text-[#1d1d1f] animate-spin mb-6" strokeWidth={2} />
      <h2 className="text-2xl font-semibold text-[#1d1d1f] mb-2 tracking-tight">Processando</h2>
      <p className="text-[#86868b] font-medium">{loadingMsg}</p>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-8 animate-fade-in w-full max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight mb-3">Aprovação Criativa</h2>
        <p className="text-[#86868b] text-lg">Revise e ajuste a direção de arte e copy geradas pela IA.</p>
      </div>
      <div className="bg-white p-8 md:p-10 rounded-[2rem] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
        <div className="space-y-10">
          <div>
            <h3 className="text-base font-semibold text-[#1d1d1f] flex items-center gap-2 mb-5 tracking-tight">
              <Palette className="w-5 h-5 text-[#86868b]" /> Paleta de Cores
            </h3>
            <div className="flex flex-wrap gap-5">
              {palette.map((color, idx) => (
                <div key={idx} className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] ring-1 ring-gray-200 relative overflow-hidden group hover:scale-105 transition-transform cursor-pointer"
                    style={{ backgroundColor: color }}>
                    <input type="color" value={color}
                      onChange={(e) => { const np = [...palette]; np[idx] = e.target.value; setPalette(np); }}
                      className="absolute inset-[-10px] w-[150%] h-[150%] opacity-0 cursor-pointer" />
                  </div>
                  <span className="text-xs font-mono text-[#86868b] uppercase">{color}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="h-px w-full bg-gray-100"></div>
          <div>
            <h3 className="text-base font-semibold text-[#1d1d1f] flex items-center gap-2 mb-4 tracking-tight">
              <PenTool className="w-5 h-5 text-[#86868b]" /> Copywriting
            </h3>
            <textarea value={copyText} onChange={(e) => setCopyText(e.target.value)}
              className="w-full p-5 bg-[#f5f5f7] border-transparent rounded-2xl text-[#1d1d1f] font-medium text-lg resize-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 outline-none h-32 transition-all leading-relaxed" />
          </div>
          <div className="h-px w-full bg-gray-100"></div>
          <div>
            <h3 className="text-base font-semibold text-[#1d1d1f] flex items-center gap-2 mb-4 tracking-tight">
              <Wand2 className="w-5 h-5 text-[#86868b]" /> Direção de Arte (Prompt)
            </h3>
            <textarea value={designConcept} onChange={(e) => setDesignConcept(e.target.value)}
              className="w-full p-5 bg-[#f5f5f7] border-transparent rounded-2xl text-[#86868b] text-sm resize-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 outline-none h-40 font-mono transition-all leading-relaxed" />
            <p className="text-xs text-[#86868b] mt-3 ml-2">Mantido em inglês para maximizar a precisão da IA visual.</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <button onClick={() => setStep(1)}
          className="px-8 py-4 bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] font-semibold rounded-full transition-colors">
          Voltar
        </button>
        <button onClick={generateCreative}
          className="flex-1 py-4 bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-lg rounded-full flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_rgba(0,113,227,0.3)] hover:shadow-[0_6px_20px_rgba(0,113,227,0.4)]">
          <ImageIcon className="w-5 h-5" /> Gerar Anúncio{numCreatives > 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );

  const renderStep5 = () => {
    const aspectRatioClass = selectedSize === "1080x1080" ? "aspect-square" : selectedSize === "1080x1920" ? "aspect-[9/16]" : "aspect-video";

    const handleDownload = async (imgBase64: string, index: number) => {
      if (!logo) {
        const link = document.createElement('a');
        link.href = imgBase64;
        link.download = `criativo-${selectedSize}-var${index + 1}.png`;
        link.click();
        return;
      }
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new window.Image();
      img.src = imgBase64;
      await new Promise(r => { img.onload = r; });
      canvas.width = img.width; canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const logoImg = new window.Image();
      logoImg.src = logo;
      await new Promise(r => { logoImg.onload = r; });
      const maxLogoWidth = canvas.width * 0.25;
      const maxLogoHeight = canvas.height * 0.25;
      let logoWidth = logoImg.width;
      let logoHeight = logoImg.height;
      const ratio = Math.min(maxLogoWidth / logoWidth, maxLogoHeight / logoHeight);
      logoWidth *= ratio; logoHeight *= ratio;
      const padding = canvas.width * 0.04;
      const x = canvas.width - logoWidth - padding;
      const y = canvas.height - logoHeight - padding;
      ctx.drawImage(logoImg, x, y, logoWidth, logoHeight);
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `criativo-com-logo-${selectedSize}-var${index + 1}.png`;
      link.click();
    };

    return (
      <div className="space-y-10 animate-fade-in w-full max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-semibold text-[#1d1d1f] tracking-tight mb-3">Criativos Prontos</h2>
          <p className="text-[#86868b] text-lg">Suas variações foram geradas com sucesso.</p>
        </div>
        <div className={`grid gap-8 ${generatedImages.length === 1 ? 'grid-cols-1 max-w-xl mx-auto' : selectedSize === "1080x1920" ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}`}>
          {generatedImages.map((img, idx) => (
            <div key={idx} className="flex flex-col">
              <div className={`relative w-full ${aspectRatioClass} bg-white rounded-[2rem] overflow-hidden shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-gray-100 group`}>
                <img src={img} alt={`Criativo ${idx + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                {logo && (
                  <img src={logo} alt="Logo Overlay" className="absolute bottom-[4%] right-[4%] max-w-[25%] max-h-[25%] object-contain drop-shadow-lg pointer-events-none" />
                )}
                <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                  <button onClick={() => handleDownload(img, idx)}
                    className="px-6 py-3 bg-white/90 backdrop-blur-md text-[#1d1d1f] rounded-full font-semibold flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 shadow-xl hover:scale-105">
                    <Download className="w-5 h-5" /> Baixar Imagem
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto pt-8">
          <button onClick={generateCreative}
            className="flex-1 py-4 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] font-semibold rounded-full flex items-center justify-center gap-2 transition-colors">
            <RefreshCw className="w-5 h-5" /> Gerar Novamente
          </button>
          <button onClick={() => { setStep(1); setGeneratedImages([]); }}
            className="flex-1 py-4 bg-[#1d1d1f] hover:bg-black text-white font-semibold rounded-full flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.1)]">
            <Layout className="w-5 h-5" /> Novo Projeto
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] font-sans selection:bg-[#0071e3] selection:text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 text-center pt-8">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tighter text-[#1d1d1f] mb-3 flex items-center justify-center gap-3">
            AdCreative <span className="text-[#0071e3]">Pro</span>
          </h1>
          <p className="text-[#86868b] text-lg font-medium tracking-tight">Inteligência Artificial para criação publicitária.</p>
        </header>
        <div className="flex justify-center mb-16">
          <div className="inline-flex bg-[#f5f5f7] p-1.5 rounded-full border border-gray-100">
            {[{ n: 1, label: "Setup" }, { n: 3, label: "Aprovação" }, { n: 5, label: "Resultado" }].map((s, i) => (
              <div key={s.n}
                className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-semibold transition-all duration-500 ${step >= s.n ? 'bg-white text-[#1d1d1f] shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-[#86868b]'}`}>
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs ${step >= s.n ? 'bg-[#1d1d1f] text-white' : 'bg-transparent border border-[#86868b]'}`}>{i + 1}</span>
                {s.label}
              </div>
            ))}
          </div>
        </div>
        {error && (
          <div className="max-w-3xl mx-auto mb-8 p-4 bg-red-50/50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 animate-fade-in backdrop-blur-xl">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
        <main className="transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] pb-20">
          {step === 1 && renderStep1()}
          {(step === 2 || step === 4) && renderLoading()}
          {step === 3 && renderStep3()}
          {step === 5 && renderStep5()}
        </main>
      </div>
    </div>
  );
}
import { useState, useRef } from 'react';
import { 
  UploadCloud, FileText, Image as ImageIcon, Wand2, 
  CheckCircle2, Palette, PenTool, Layout, Download,
  AlertCircle, Loader2, ChevronRight, RefreshCw, X, ImagePlus, Key, Cpu, Info, ExternalLink
} from 'lucide-react';

const apiKey = ""; // A chave é injetada automaticamente pelo ambiente

// --- FUNÇÕES DE API E RETRY ---
const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delays[i]));
    }
  }
};

interface ModelOption {
  id: string;
  label: string;
}

interface ReferenceImage {
  base64: string;
  mimeType: string;
}

export default function App() {
  // Estados do Fluxo
  const [step, setStep] = useState(1);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [customApiKey, setCustomApiKey] = useState("");

  // Estados de Entrada
  const [mdFile, setMdFile] = useState<File | null>(null);
  const [mdContent, setMdContent] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [selectedSize, setSelectedSize] = useState("1080x1080");
  const [numCreatives, setNumCreatives] = useState(1);
  
  // Modelos e Estados de Busca da API
  const [availableTextModels, setAvailableTextModels] = useState<ModelOption[]>([
    { id: "gemini-2.5-flash-preview-09-2025", label: "Gemini 2.5 Flash (Padrão)" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Alta Complexidade)" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Rápido)" }
  ]);
  const [availableImageModels, setAvailableImageModels] = useState<ModelOption[]>([
    { id: "gemini-2.5-flash-image-preview", label: "Gemini Image Flash (Nano Banana)" },
    { id: "gemini-3-pro-image-preview-11-2025", label: "Gemini 3 Pro Image (Nano Banana Pro)" },
    { id: "imagen-4.0-generate-001", label: "Imagen 4.0 (Estável)" }
  ]);
  const [textModel, setTextModel] = useState("gemini-2.5-flash-preview-09-2025");
  const [imageModel, setImageModel] = useState("gemini-2.5-flash-image-preview");
  const [keyStatus, setKeyStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  // Estados de Configuração (Pós Análise)
  const [palette, setPalette] = useState<string[]>([]);
  const [copyText, setCopyText] = useState("");
  const [designConcept, setDesignConcept] = useState("");

  // Estado Final
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);

  // Referências para Inputs Ocultos
  const mdInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Tamanhos disponíveis
  const sizes = [
    { id: "1080x1080", label: "Post (1:1)", icon: <Layout className="w-5 h-5" /> },
    { id: "1080x1920", label: "Story (9:16)", icon: <Layout className="w-4 h-6" /> },
    { id: "1920x1080", label: "Banner (16:9)", icon: <Layout className="w-6 h-4" /> }
  ];

  // --- HANDLERS DE UPLOAD ---
  const handleMdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMdFile(file);
    const reader = new FileReader();
    reader.onload = (event) => setMdContent(event.target?.result as string);
    reader.readAsText(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setLogo(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newImages: ReferenceImage[] = [];
    let loadedCount = 0;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        newImages.push({
          base64: event.target?.result as string,
          mimeType: file.type
        });
        loadedCount++;
        if (loadedCount === files.length) {
          setReferenceImages(prev => [...prev, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  // --- BUSCA DINÂMICA DE MODELOS PELA CHAVE API ---
  const fetchModelsFromApi = async () => {
    if (!customApiKey) {
      setError("Por favor, insira sua Chave API antes de carregar os modelos.");
      return;
    }
    
    setKeyStatus("loading");
    setError(null);
    
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${customApiKey}`);
      const data = await res.json();
      
      if (data.error) throw new Error(data.error.message);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fetchedText = data.models
        .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent") && !m.name.includes("image") && !m.name.includes("embedding"))
        .map((m: any) => ({ id: m.name.replace('models/', ''), label: m.displayName || m.name.replace('models/', '') }));

      if (fetchedText.length > 0) {
        setAvailableTextModels(fetchedText);
        if (!fetchedText.find((m: ModelOption) => m.id === textModel)) {
          setTextModel(fetchedText[0].id);
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fetchedImage = data.models
        .filter((m: any) => m.name.includes("imagen") || m.name.includes("image-preview") || (m.displayName && m.displayName.toLowerCase().includes("image")))
        .map((m: any) => ({ id: m.name.replace('models/', ''), label: m.displayName || m.name.replace('models/', '') }));

      if (fetchedImage.length > 0) {
        setAvailableImageModels(fetchedImage);
        if (!fetchedImage.find((m: ModelOption) => m.id === imageModel)) {
          setImageModel(fetchedImage[0].id);
        }
      }

      setKeyStatus("success");
    } catch (err) {
      console.error(err);
      setKeyStatus("error");
      setError("Falha ao carregar modelos. Verifique se a chave é válida e possui permissões.");
    }
  };

  // --- PASSO 2: ANÁLISE COM GEMINI (DIRETOR DE COPY/ARTE) ---
  const analyzeInputs = async () => {
    if (!mdContent) {
      setError("Por favor, faça upload do arquivo Markdown com as informações da empresa.");
      return;
    }
    
    setStep(2);
    setLoadingMsg("Analisando referências e extraindo informações...");
    setError(null);

    try {
      const activeKey = customApiKey || apiKey;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${textModel}:generateContent?key=${activeKey}`;
      
      const systemPrompt = `
        Você é um Diretor de Criação Sênior e um Mestre em Copywriting atuando em uma agência de publicidade de elite.
        Sua tarefa é analisar o manual/documento da marca e as imagens de referência visual fornecidas.
        
        Você deve:
        1. Identificar uma paleta de cores (3 a 5 cores em formato HEX) que represente a marca e as referências visuais.
        2. Escrever uma 'Copy' (texto de anúncio) extremamente persuasiva, utilizando gatilhos mentais e o tom de voz da marca, focado em alta conversão. A copy deve ser curta e impactante para caber em um banner de tamanho ${selectedSize}.
        3. Desenvolver um 'Conceito de Design' detalhado, EM INGLÊS (para um gerador de imagens IA), descrevendo a estética, a iluminação, os elementos visuais esperados, baseando-se estritamente no estilo das imagens de referência enviadas. Considere deixar um espaço negativo adequado (geralmente nos cantos) se uma logo precisar ser inserida posteriormente.
        ${logo ? '4. Uma logo foi enviada. Extraia as cores primárias dela também para compor a paleta da marca de forma coerente.' : ''}

        Responda APENAS com um JSON válido seguindo a estrutura fornecida.
      `;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = [
        { text: `Informações da empresa:\n${mdContent}` }
      ];

      if (logo) {
        parts.push({
          inlineData: { mimeType: "image/png", data: logo.split(',')[1] }
        });
      }

      referenceImages.forEach(img => {
        const base64Data = img.base64.split(',')[1];
        parts.push({
          inlineData: { mimeType: img.mimeType, data: base64Data }
        });
      });

      const payload = {
        contents: [{ role: "user", parts }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              colors: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "Array de 3 a 5 códigos HEX (ex: #FFFFFF)"
              },
              copy: {
                type: "STRING",
                description: "Copy curta e persuasiva em Português"
              },
              design_concept: {
                type: "STRING",
                description: "Conceito de design hiper detalhado em INGLÊS para prompt de IA geradora de imagens. Descreva o background, atmosfera, estilo e posicionamento. NÃO inclua o texto da copy aqui."
              }
            },
            required: ["colors", "copy", "design_concept"]
          }
        }
      };

      const result = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) throw new Error("Resposta inválida da IA.");

      const data = JSON.parse(responseText);
      
      setPalette(data.colors || []);
      setCopyText(data.copy || "");
      setDesignConcept(data.design_concept || "");
      setStep(3);

    } catch (err: any) {
      console.error(err);
      setError("Erro ao analisar dados. " + err.message);
      setStep(1);
    }
  };

  // --- PASSO 4: GERAÇÃO DA IMAGEM ---
  const generateCreative = async () => {
    setStep(4);
    setLoadingMsg(`Gerando ${numCreatives} criativo(s) de alta conversão...`);
    setError(null);

    try {
      const activeKey = customApiKey || apiKey;
      
      const promises = Array.from({ length: numCreatives }).map(async (_, index) => {
        const finalPrompt = `
          High quality, premium advertising graphic design. Variation ${index + 1}.
          Format requirement: Think in a ${selectedSize} aspect ratio composition. 
          Visual Concept: ${designConcept}. 
          Color Palette to dominate the design: ${palette.join(', ')}. 
          Typography: Add large, stylish, professional typography overlaying the image in a highly readable way.
          The exact text to write on the image is: "${copyText}".
          The typography must look like a professional marketing campaign.
        `.trim();

        let base64Image = "";

        if (imageModel.startsWith('imagen')) {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:predict?key=${activeKey}`;
          const payload = {
            instances: [{ prompt: finalPrompt }],
            parameters: { sampleCount: 1 }
          };

          const result = await fetchWithRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!result.predictions || !result.predictions[0]) {
            throw new Error("Erro ao gerar imagem. Tente modificar o conceito.");
          }
          base64Image = result.predictions[0].bytesBase64Encoded;

        } else {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${activeKey}`;
          const payload = {
            contents: [{ parts: [{ text: finalPrompt }] }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
          };

          const result = await fetchWithRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inlineDataPart = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
          if (!inlineDataPart || !inlineDataPart.inlineData) {
            throw new Error("Erro ao gerar imagem com o modelo Gemini Image.");
          }
          base64Image = inlineDataPart.inlineData.data;
        }

        return `data:image/png;base64,${base64Image}`;
      });

      const images = await Promise.all(promises);
      setGeneratedImages(images);
      setStep(5);

    } catch (err: any) {
      console.error(err);
      setError("Erro ao gerar criativo. " + err.message);
      setStep(3);
    }
  };

  // --- RENDERIZADORES DE TELAS ---

  const renderStep1 = () => (
    <div className="space-y-8 animate-fade-in w-full max-w-3xl mx-auto">
      
      {/* Bloco da Chave de API para Deploy */}
      <div className="bg-white p-8 rounded-[2rem] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100">
        <h3 className="text-xl font-semibold text-[#1d1d1f] mb-2 tracking-tight">
          Configuração de API e Modelos
        </h3>
        <p className="text-sm text-[#86868b] mb-5">
          Insira sua chave do Google AI Studio para gerar anúncios e carregar os modelos liberados para você.
        </p>
        
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Key className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="password" 
              placeholder="AIzaSy..." 
              value={customApiKey}
              onChange={(e) => {
                setCustomApiKey(e.target.value);
                setKeyStatus("idle");
              }}
              className="w-full pl-12 pr-4 py-4 bg-[#f5f5f7] border-transparent rounded-2xl outline-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 text-[#1d1d1f] font-mono text-sm transition-all"
            />
          </div>
          <button 
            onClick={fetchModelsFromApi}
            disabled={keyStatus === "loading" || !customApiKey}
            className="px-8 py-4 bg-[#1d1d1f] hover:bg-black disabled:bg-[#e8e8ed] disabled:text-[#86868b] text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all whitespace-nowrap"
          >
            {keyStatus === "loading" ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            Carregar Modelos
          </button>
        </div>

        {keyStatus === "success" && (
          <p className="text-sm text-emerald-600 font-medium mt-3 flex items-center gap-1.5 ml-1">
            <CheckCircle2 className="w-4 h-4" /> Modelos sincronizados com sua conta!
          </p>
        )}

        {/* Info Box de Faturamento */}
        <div className="mt-6 p-5 bg-[#f0f7ff] rounded-2xl border border-[#cce4ff] flex items-start gap-4">
          <Info className="w-6 h-6 text-[#0071e3] shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[#004a99] mb-1">Requisito de Faturamento (Nível 1)</p>
            <p className="text-sm text-[#0057b3]/90 leading-relaxed mb-3">
              Para ter acesso aos modelos visuais avançados e LLMs pesados (como <b>Gemini 1.5 Pro, Nano Banana Pro e Imagen 4.0</b>), sua Chave API precisa estar vinculada a um projeto com faturamento ativo (Pay-as-you-go). Sem isso, a geração de imagens falhará.
            </p>
            <a 
              href="https://aistudio.google.com/app/billing" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center gap-1.5 text-[#0071e3] hover:text-[#0057b3] font-semibold text-sm transition-colors"
            >
              Ativar faturamento no AI Studio <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100">
        <h3 className="text-xl font-semibold text-[#1d1d1f] mb-6 tracking-tight flex items-center gap-3">
          <div className="p-2 bg-[#f5f5f7] rounded-xl"><Cpu className="w-5 h-5 text-[#1d1d1f]" /></div>
          Seleção de IA
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium text-[#86868b] mb-3">IA Analítica e Copywriter</p>
            <div className="relative">
              <select 
                value={textModel}
                onChange={(e) => setTextModel(e.target.value)}
                className="w-full p-4 pr-12 bg-[#f5f5f7] border-transparent rounded-2xl outline-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 text-[#1d1d1f] font-medium text-sm transition-all appearance-none cursor-pointer"
              >
                {availableTextModels.map(model => (
                  <option key={model.id} value={model.id}>{model.label}</option>
                ))}
              </select>
              <ChevronRight className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-90" />
            </div>
            <p className="text-xs text-[#86868b] mt-2">Processa a brand persona e escreve os textos.</p>
          </div>

          <div>
            <p className="text-sm font-medium text-[#86868b] mb-3">IA Geradora de Imagens</p>
            <div className="relative">
              <select 
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
                className="w-full p-4 pr-12 bg-[#f5f5f7] border-transparent rounded-2xl outline-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 text-[#1d1d1f] font-medium text-sm transition-all appearance-none cursor-pointer"
              >
                {availableImageModels.map(model => (
                  <option key={model.id} value={model.id}>{model.label}</option>
                ))}
              </select>
              <ChevronRight className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-90" />
            </div>
            <p className="text-xs text-[#86868b] mt-2">Cria o design visual final do anúncio.</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100">
        <h3 className="text-xl font-semibold text-[#1d1d1f] mb-6 tracking-tight flex items-center gap-3">
          <div className="p-2 bg-[#f5f5f7] rounded-xl"><FileText className="w-5 h-5 text-[#1d1d1f]" /></div>
          Manual da Empresa (.md)
        </h3>
        
        <input 
          type="file" accept=".md,.txt" ref={mdInputRef}
          className="hidden" onChange={handleMdUpload}
        />
        
        {!mdFile ? (
          <div 
            onClick={() => mdInputRef.current?.click()}
            className="bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-2xl p-10 text-center cursor-pointer transition-colors border border-transparent hover:border-gray-200"
          >
            <UploadCloud className="w-10 h-10 text-[#86868b] mx-auto mb-4" strokeWidth={1.5} />
            <p className="text-[#1d1d1f] font-medium text-lg">Carregar documento de marca</p>
            <p className="text-[#86868b] text-sm mt-2">Tom de voz, missão, produto, etc.</p>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-[#f5f5f7] p-5 rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-xl shadow-sm"><FileText className="w-6 h-6 text-[#1d1d1f]" /></div>
              <div>
                <p className="font-semibold text-[#1d1d1f]">{mdFile.name}</p>
                <p className="text-sm text-[#86868b]">{(mdFile.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button onClick={() => setMdFile(null)} className="p-2 text-[#86868b] hover:text-red-500 hover:bg-white rounded-full transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100">
        <h3 className="text-xl font-semibold text-[#1d1d1f] mb-6 tracking-tight flex items-center gap-3">
          <div className="p-2 bg-[#f5f5f7] rounded-xl"><ImagePlus className="w-5 h-5 text-[#1d1d1f]" /></div>
          Identidade Visual
        </h3>
        
        <input 
          type="file" accept="image/png, image/jpeg, image/svg+xml" ref={logoInputRef}
          className="hidden" onChange={handleLogoUpload}
        />
        
        <div className="mb-8">
          <p className="text-sm font-medium text-[#86868b] mb-3">Logo da Empresa (Opcional)</p>
          {!logo ? (
            <div 
              onClick={() => logoInputRef.current?.click()}
              className="bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-2xl p-6 text-center cursor-pointer transition-colors"
            >
              <p className="text-[#1d1d1f] font-medium">Adicionar Logo</p>
              <p className="text-[#86868b] text-xs mt-1">PNG transparente recomendado</p>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-[#f5f5f7] p-4 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center overflow-hidden shadow-sm p-2">
                  <img src={logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                </div>
                <p className="font-medium text-[#1d1d1f]">Logo Carregada</p>
              </div>
              <button onClick={() => setLogo(null)} className="p-2 text-[#86868b] hover:text-red-500 hover:bg-white rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-[#86868b]">Referências de Estilo</p>
          </div>
          
          <input 
            type="file" accept="image/*" multiple ref={imageInputRef}
            className="hidden" onChange={handleImageUpload}
          />

          <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
            {referenceImages.map((img, idx) => (
              <div key={idx} className="relative aspect-square group rounded-2xl overflow-hidden shadow-sm">
                <img src={img.base64} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                <button 
                  onClick={() => removeImage(idx)}
                  className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-md rounded-full text-[#1d1d1f] opacity-0 group-hover:opacity-100 transition-all hover:scale-105"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            
            <div 
              onClick={() => imageInputRef.current?.click()}
              className="aspect-square bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors"
            >
              <UploadCloud className="w-6 h-6 text-[#86868b] mb-2" strokeWidth={2} />
              <span className="text-xs text-[#86868b] font-medium">Adicionar</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100">
        <h3 className="text-xl font-semibold text-[#1d1d1f] mb-6 tracking-tight flex items-center gap-3">
          <div className="p-2 bg-[#f5f5f7] rounded-xl"><Layout className="w-5 h-5 text-[#1d1d1f]" /></div>
          Configurações de Geração
        </h3>
        
        <div className="mb-8">
          <p className="text-sm font-medium text-[#86868b] mb-3">Formato do Criativo</p>
          <div className="flex flex-col md:flex-row p-1.5 bg-[#f5f5f7] rounded-2xl gap-1">
            {sizes.map((size) => (
              <button
                key={size.id}
                onClick={() => setSelectedSize(size.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
                  selectedSize === size.id 
                    ? 'bg-white text-[#1d1d1f] shadow-sm' 
                    : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                {size.icon}
                {size.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-[#86868b]">Quantidade de Variações</span>
            <span className="text-lg font-semibold text-[#1d1d1f] bg-[#f5f5f7] px-4 py-1 rounded-full">{numCreatives}</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="10" 
            value={numCreatives}
            onChange={(e) => setNumCreatives(Number(e.target.value))}
            className="w-full h-2 bg-[#e8e8ed] rounded-full appearance-none cursor-pointer accent-[#1d1d1f]"
          />
        </div>
      </div>

      <button
        onClick={analyzeInputs}
        disabled={!mdFile}
        className="w-full py-5 bg-[#1d1d1f] hover:bg-black disabled:bg-[#e8e8ed] disabled:text-[#86868b] disabled:cursor-not-allowed text-white text-lg font-semibold rounded-full flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] disabled:shadow-none mt-4"
      >
        <Wand2 className="w-5 h-5" />
        Processar Diretrizes
      </button>
    </div>
  );

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-in">
      <Loader2 className="w-12 h-12 text-[#1d1d1f] animate-spin mb-6" strokeWidth={2} />
      <h2 className="text-2xl font-semibold text-[#1d1d1f] mb-2 tracking-tight">Processando</h2>
      <p className="text-[#86868b] font-medium">{loadingMsg}</p>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-8 animate-fade-in w-full max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight mb-3">Aprovação Criativa</h2>
        <p className="text-[#86868b] text-lg">Revise e ajuste a direção de arte e copy geradas pela IA.</p>
      </div>

      <div className="bg-white p-8 md:p-10 rounded-[2rem] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
        <div className="space-y-10">
          
          <div>
            <h3 className="text-base font-semibold text-[#1d1d1f] flex items-center gap-2 mb-5 tracking-tight">
              <Palette className="w-5 h-5 text-[#86868b]" /> 
              Paleta de Cores
            </h3>
            <div className="flex flex-wrap gap-5">
              {palette.map((color, idx) => (
                <div key={idx} className="flex flex-col items-center gap-3">
                  <div 
                    className="w-16 h-16 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] ring-1 ring-gray-200 relative overflow-hidden group hover:scale-105 transition-transform cursor-pointer"
                    style={{ backgroundColor: color }}
                  >
                    <input 
                      type="color" 
                      value={color}
                      onChange={(e) => {
                        const newPalette = [...palette];
                        newPalette[idx] = e.target.value;
                        setPalette(newPalette);
                      }}
                      className="absolute inset-[-10px] w-[150%] h-[150%] opacity-0 cursor-pointer"
                    />
                  </div>
                  <span className="text-xs font-mono text-[#86868b] uppercase">{color}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px w-full bg-gray-100"></div>

          <div>
            <h3 className="text-base font-semibold text-[#1d1d1f] flex items-center gap-2 mb-4 tracking-tight">
              <PenTool className="w-5 h-5 text-[#86868b]" /> 
              Copywriting
            </h3>
            <textarea 
              value={copyText}
              onChange={(e) => setCopyText(e.target.value)}
              className="w-full p-5 bg-[#f5f5f7] border-transparent rounded-2xl text-[#1d1d1f] font-medium text-lg resize-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 outline-none h-32 transition-all leading-relaxed"
            />
          </div>

          <div className="h-px w-full bg-gray-100"></div>

          <div>
            <h3 className="text-base font-semibold text-[#1d1d1f] flex items-center gap-2 mb-4 tracking-tight">
              <Wand2 className="w-5 h-5 text-[#86868b]" /> 
              Direção de Arte (Prompt)
            </h3>
            <textarea 
              value={designConcept}
              onChange={(e) => setDesignConcept(e.target.value)}
              className="w-full p-5 bg-[#f5f5f7] border-transparent rounded-2xl text-[#86868b] text-sm resize-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 outline-none h-40 font-mono transition-all leading-relaxed"
            />
            <p className="text-xs text-[#86868b] mt-3 ml-2">Mantido em inglês para maximizar a precisão da IA visual.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <button
          onClick={() => setStep(1)}
          className="px-8 py-4 bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] font-semibold rounded-full transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={generateCreative}
          className="flex-1 py-4 bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-lg rounded-full flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_rgba(0,113,227,0.3)] hover:shadow-[0_6px_20px_rgba(0,113,227,0.4)]"
        >
          <ImageIcon className="w-5 h-5" />
          Gerar Anúncio{numCreatives > 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );

  const renderStep5 = () => {
    const aspectRatioClass = 
      selectedSize === "1080x1080" ? "aspect-square" :
      selectedSize === "1080x1920" ? "aspect-[9/16]" :
      "aspect-video";

    const handleDownload = async (imgBase64: string, index: number) => {
      if (!logo) {
        const link = document.createElement('a');
        link.href = imgBase64;
        link.download = `criativo-${selectedSize}-var${index + 1}.png`;
        link.click();
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      const img = new window.Image();
      img.src = imgBase64;
      await new Promise(r => { img.onload = r; });

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const logoImg = new window.Image();
      logoImg.src = logo;
      await new Promise(r => { logoImg.onload = r; });

      const maxLogoWidth = canvas.width * 0.25;
      const maxLogoHeight = canvas.height * 0.25;
      let logoWidth = logoImg.width;
      let logoHeight = logoImg.height;

      const ratio = Math.min(maxLogoWidth / logoWidth, maxLogoHeight / logoHeight);
      logoWidth *= ratio;
      logoHeight *= ratio;

      const padding = canvas.width * 0.04;
      const x = canvas.width - logoWidth - padding;
      const y = canvas.height - logoHeight - padding;

      ctx.drawImage(logoImg, x, y, logoWidth, logoHeight);

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `criativo-com-logo-${selectedSize}-var${index + 1}.png`;
      link.click();
    };

    return (
      <div className="space-y-10 animate-fade-in w-full max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-semibold text-[#1d1d1f] tracking-tight mb-3">Criativos Prontos</h2>
          <p className="text-[#86868b] text-lg">Suas variações foram geradas com sucesso.</p>
        </div>

        <div className={`grid gap-8 ${
          generatedImages.length === 1 ? 'grid-cols-1 max-w-xl mx-auto' : 
          selectedSize === "1080x1920" ? 'grid-cols-2 lg:grid-cols-4' : 
          'grid-cols-1 md:grid-cols-2'
        }`}>
          {generatedImages.map((img, idx) => (
            <div key={idx} className="flex flex-col">
              <div className={`relative w-full ${aspectRatioClass} bg-white rounded-[2rem] overflow-hidden shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-gray-100 group`}>
                <img 
                  src={img} 
                  alt={`Criativo ${idx + 1}`} 
                  className="absolute inset-0 w-full h-full object-cover"
                />
                
                {logo && (
                  <img 
                    src={logo} 
                    alt="Logo Overlay" 
                    className="absolute bottom-[4%] right-[4%] max-w-[25%] max-h-[25%] object-contain drop-shadow-lg pointer-events-none"
                  />
                )}

                <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                  <button 
                    onClick={() => handleDownload(img, idx)}
                    className="px-6 py-3 bg-white/90 backdrop-blur-md text-[#1d1d1f] rounded-full font-semibold flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 shadow-xl hover:scale-105"
                  >
                    <Download className="w-5 h-5" /> Baixar Imagem
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto pt-8">
          <button
            onClick={generateCreative}
            className="flex-1 py-4 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] font-semibold rounded-full flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Gerar Novamente
          </button>
          <button
            onClick={() => {
              setStep(1);
              setGeneratedImages([]);
            }}
            className="flex-1 py-4 bg-[#1d1d1f] hover:bg-black text-white font-semibold rounded-full flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.1)]"
          >
            <Layout className="w-5 h-5" />
            Novo Projeto
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] font-sans selection:bg-[#0071e3] selection:text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        <header className="mb-12 text-center pt-8">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tighter text-[#1d1d1f] mb-3 flex items-center justify-center gap-3">
            AdCreative <span className="text-[#0071e3]">Pro</span>
          </h1>
          <p className="text-[#86868b] text-lg font-medium tracking-tight">Inteligência Artificial para criação publicitária.</p>
        </header>

        <div className="flex justify-center mb-16">
          <div className="inline-flex bg-[#f5f5f7] p-1.5 rounded-full border border-gray-100">
            {[
              { n: 1, label: "Setup" },
              { n: 3, label: "Aprovação" },
              { n: 5, label: "Resultado" }
            ].map((s, i) => (
              <div 
                key={s.n}
                className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-semibold transition-all duration-500 ${
                  step >= s.n 
                    ? 'bg-white text-[#1d1d1f] shadow-[0_2px_8px_rgba(0,0,0,0.06)]' 
                    : 'text-[#86868b]'
                }`}
              >
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs ${step >= s.n ? 'bg-[#1d1d1f] text-white' : 'bg-transparent border border-[#86868b]'}`}>
                  {i + 1}
                </span>
                {s.label}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="max-w-3xl mx-auto mb-8 p-4 bg-red-50/50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 animate-fade-in backdrop-blur-xl">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <main className="transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] pb-20">
          {step === 1 && renderStep1()}
          {(step === 2 || step === 4) && renderLoading()}
          {step === 3 && renderStep3()}
          {step === 5 && renderStep5()}
        </main>
        
      </div>
    </div>
  );
}
import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <button
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
