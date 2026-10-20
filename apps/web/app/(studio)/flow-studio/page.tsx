"use client";

import { useState, useEffect } from "react";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, Icon } from "@vincere-studio/ui";

const CAMERA_PRESETS = [
  { name: "Push-in Cinemático", prompt: "slow cinematic push-in shot, 35mm lens, shallow depth of field, dramatic volumetric lighting" },
  { name: "Dossiê 3D Inclinado (Nike)", prompt: "overhead 3D perspective angle, physical paper card resting on dark slate desk, subtle camera drift, archive lighting" },
  { name: "Orbit 360° Produto", prompt: "smooth 45-degree orbit around the subject, studio softbox lighting with crisp metallic rim light" },
  { name: "Dolly Zoom (Vértigo)", prompt: "dolly zoom vertigo effect, background stretches while subject stays anchored, suspenseful cinematic atmosphere" },
  { name: "Macro Close-up", prompt: "extreme macro lens close-up, razor-sharp texture detail, soft diffused natural backlight" },
  { name: "FPV Drone Dinâmico", prompt: "fast continuous low-angle tracking shot, dynamic forward motion, realistic motion blur" },
];

export default function FlowStudioPage() {
  const [activeTab, setActiveTab] = useState<"image" | "video" | "cinema" | "queue">("image");
  const [prompt, setPrompt] = useState("");
  const [tipo, setTipo] = useState<"imagem" | "video">("imagem");
  const [modelo, setModelo] = useState("pro"); // "pro" (Nano Banana Pro) or "lower_priority" (Veo 3.1)
  const [proporcao, setProporcao] = useState("16:9");
  const [duracao, setDuracao] = useState("8s");
  const [resolucao, setResolucao] = useState("720p");
  const [daemonStatus, setDaemonStatus] = useState<{
    ok: boolean;
    running: boolean;
    browser_connected?: boolean;
    browser_hidden?: boolean;
    queue_size?: number;
    error?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [targetProjectId, setTargetProjectId] = useState<string>("");
  const [targetSceneId, setTargetSceneId] = useState<string>("");
  const [completedJobs, setCompletedJobs] = useState<any[]>([]);
  const [assigningJobId, setAssigningJobId] = useState<string | null>(null);
  const [selectedProjectPerJob, setSelectedProjectPerJob] = useState<Record<string, string>>({});
  const [selectedScenePerJob, setSelectedScenePerJob] = useState<Record<string, string>>({});

  // Check daemon health and load projects
  const checkDaemon = async () => {
    try {
      const res = await fetch("/api/flow");
      const data = await res.json();
      setDaemonStatus(data);

      const qRes = await fetch("/api/flow?action=queue");
      const qData = await qRes.json();
      if (qData.ok && qData.recent_completed) {
        setCompletedJobs(qData.recent_completed);
      }
    } catch {
      setDaemonStatus({ ok: false, running: false, error: "Erro de conexão com API local" });
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/flow?action=projects");
      const data = await res.json();
      if (data.ok && data.projects) {
        setProjects(data.projects);
      }
    } catch {}
  };

  useEffect(() => {
    checkDaemon();
    fetchProjects();
    const interval = setInterval(checkDaemon, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleApplyPreset = (presetPrompt: string) => {
    setPrompt((prev) => (prev ? `${prev}, ${presetPrompt}` : presetPrompt));
  };

  const handleAssignToProject = async (jobId: string, projId: string, sceneId?: string, jobPrompt?: string) => {
    if (!projId) {
      alert("Selecione um projeto de destino para incorporar esta mídia.");
      return;
    }
    setAssigningJobId(jobId);
    setFeedback("Incorporando mídia ao projeto selecionado...");
    try {
      const res = await fetch("/api/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_to_project",
          jobId,
          projectId: projId,
          sceneId: sceneId || undefined,
          prompt: jobPrompt,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback(`✓ ${data.message || "Mídia salva no projeto!"} (Caminho: ${data.filePath})`);
      } else {
        setFeedback(`Erro ao vincular mídia: ${data.error}`);
      }
    } catch (e: any) {
      setFeedback(`Erro: ${e.message}`);
    } finally {
      setAssigningJobId(null);
    }
  };

  const handleBrowserAction = async (command: "show" | "hide" | "login") => {
    try {
      setFeedback(`Enviando comando '${command}' para o Chrome do Flow...`);
      const res = await fetch("/api/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "browser", command }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback(`Comando '${command}' executado com sucesso.`);
      } else {
        setFeedback(`Falha: ${data.error || "Verifique se o daemon está ativo."}`);
      }
      checkDaemon();
    } catch (e: any) {
      setFeedback(`Erro: ${e.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsSubmitting(true);
    setFeedback("Enviando geração para o Google Flow (Fila Central)...");

    try {
      const res = await fetch("/api/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enqueue",
          tipo,
          prompt,
          modelo,
          proporcao,
          duracao,
          resolucao,
          targetProjectId: targetProjectId || undefined,
          targetSceneId: targetSceneId || undefined,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setFeedback(`✓ Geração enfileirada com sucesso no Google Flow! Assim que concluir, a mídia aparecerá na galeria abaixo pronta para uso.`);
        checkDaemon();
      } else {
        setFeedback(`Aviso: ${data.error || "O daemon do Flow não respondeu. Certifique-se de que python flow_queue_daemon.py está ativo."}`);
      }
    } catch (err: any) {
      setFeedback(`Erro ao enfileirar: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Topbar crumbs={["Flow Studio", "Mídia IA"]} />
      <main className="space-y-6 p-6">
        <PageHeader
          icon="auto_awesome"
          title="Flow Studio & Mídia IA"
          subtitle="Gere imagens fotorealistas com Nano Banana Pro e vídeos com Veo 3.1 diretamente na sua conta do Google Flow usando seus créditos, sem custo de API avulsa."
          right={
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs ${
                  daemonStatus?.running
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-warning/30 bg-warning/10 text-warning"
                }`}
              >
                <span className={`size-2 rounded-full ${daemonStatus?.running ? "bg-success" : "bg-warning animate-pulse"}`} />
                {daemonStatus?.running ? "Flow Daemon Online (Porta 9334)" : "Flow Daemon Offline (Local)"}
              </span>
              <Button
                variant="outline"
                size="sm"
                icon="refresh"
                onClick={checkDaemon}
              >
                Atualizar Status
              </Button>
            </div>
          }
        />

        {/* Quick Connection Controls */}
        <Card className="p-4 border-line bg-surface-low/80">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded bg-primary/10 text-primary-bright">
                <Icon name="stream" className="text-[22px]" />
              </div>
              <div>
                <div className="font-display text-sm font-semibold">Conexão Google Flow (Invisível & Anti-Captcha)</div>
                <div className="text-xs text-muted">
                  {daemonStatus?.running
                    ? `Chrome conectado: ${daemonStatus.browser_connected ? "Sim" : "Aguardando login"} | Fila: ${daemonStatus.queue_size ?? 0} jobs`
                    : "Inicie o daemon em C:\\Users\\Igor\\flow-studio-mcp via abrir_dashboard.bat ou terminal para ativar a automação"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon="visibility"
                onClick={() => handleBrowserAction("show")}
              >
                Ver Navegador
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon="visibility_off"
                onClick={() => handleBrowserAction("hide")}
              >
                Ocultar Navegador
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon="login"
                onClick={() => handleBrowserAction("login")}
              >
                Fazer Login no Flow
              </Button>
            </div>
          </div>
          {feedback && (
            <div className="mt-3 rounded border border-primary/20 bg-primary/5 p-2 text-xs font-mono text-primary-bright">
              {feedback}
            </div>
          )}
        </Card>

        {/* Studio Sub-Navigation */}
        <div className="flex border-b border-line gap-2">
          <button
            onClick={() => {
              setActiveTab("image");
              setTipo("imagem");
              setModelo("pro");
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "image"
                ? "border-primary text-primary-bright"
                : "border-transparent text-muted hover:text-fg"
            }`}
          >
            <Icon name="image" className="text-[18px]" />
            Nano Banana Pro (Imagens)
          </button>
          <button
            onClick={() => {
              setActiveTab("video");
              setTipo("video");
              setModelo("lower_priority");
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "video"
                ? "border-primary text-primary-bright"
                : "border-transparent text-muted hover:text-fg"
            }`}
          >
            <Icon name="videocam" className="text-[18px]" />
            Veo 3.1 & Omni (Vídeos IA)
          </button>
          <button
            onClick={() => setActiveTab("cinema")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "cinema"
                ? "border-primary text-primary-bright"
                : "border-transparent text-muted hover:text-fg"
            }`}
          >
            <Icon name="camera" className="text-[18px]" />
            Presets de Câmera & Cinema
          </button>
        </div>

        {/* Studio Content */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Prompt & Controls Form */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="label-mono text-muted">
                      Prompt de Geração ({tipo === "imagem" ? "Nano Banana Pro" : "Veo 3.1"})
                    </label>
                    <span className="text-[11px] text-muted font-mono">Suporta inglês e português</span>
                  </div>
                  <textarea
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={
                      tipo === "imagem"
                        ? "Ex: Uma foto de arquivo de um par de tênis de corrida vintage de 1972 em cima de uma mesa de madeira escura com documentos, iluminação suave de janela, grão 35mm..."
                        : "Ex: Movimento lento de aproximação revelando a fachada da primeira loja em preto e branco, luz de néon sutil ao fundo, atmosfera de mistério anos 70..."
                    }
                    className="field w-full p-3 text-sm font-sans"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {/* Model Selector */}
                  <div>
                    <label className="label-mono mb-1 block text-muted">Modelo</label>
                    <select
                      value={modelo}
                      onChange={(e) => setModelo(e.target.value)}
                      className="field w-full px-2.5 py-1.5 text-xs"
                    >
                      {tipo === "imagem" ? (
                        <>
                          <option value="pro">Nano Banana Pro (Máx Detalhe)</option>
                          <option value="2.1">Nano Banana 2.1 (Padrão)</option>
                          <option value="lite">Nano Banana Lite (Rápido)</option>
                        </>
                      ) : (
                        <>
                          <option value="lower_priority">Veo 3.1 Lite (Econômico)</option>
                          <option value="fast">Veo 3.1 Fast (Alta Fidelidade)</option>
                          <option value="quality">Veo 3.1 Quality (Cinema Máximo)</option>
                          <option value="omni">Omni 1.1 Flash (Ultrarrápido)</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* Aspect Ratio */}
                  <div>
                    <label className="label-mono mb-1 block text-muted">Proporção</label>
                    <select
                      value={proporcao}
                      onChange={(e) => setProporcao(e.target.value)}
                      className="field w-full px-2.5 py-1.5 text-xs"
                    >
                      <option value="16:9">16:9 (Cinema Horizontal)</option>
                      <option value="9:16">9:16 (Reels/Shorts Vertical)</option>
                      <option value="1:1">1:1 (Quadrado)</option>
                      <option value="4:3">4:3 (Documentário Clássico)</option>
                    </select>
                  </div>

                  {/* Duration or Resolution */}
                  {tipo === "video" ? (
                    <div>
                      <label className="label-mono mb-1 block text-muted">Duração</label>
                      <select
                        value={duracao}
                        onChange={(e) => setDuracao(e.target.value)}
                        className="field w-full px-2.5 py-1.5 text-xs"
                      >
                        <option value="4s">4 Segundos</option>
                        <option value="6s">6 Segundos</option>
                        <option value="8s">8 Segundos</option>
                        <option value="10s">10 Segundos</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="label-mono mb-1 block text-muted">Resolução</label>
                      <select
                        value={resolucao}
                        onChange={(e) => setResolucao(e.target.value)}
                        className="field w-full px-2.5 py-1.5 text-xs"
                      >
                        <option value="1K">1K Padrão</option>
                        <option value="2K">2K Cinema</option>
                        <option value="4K">4K Ultra (Flow Pro)</option>
                      </select>
                    </div>
                  )}

                  {/* Quality / Resolution */}
                  <div>
                    <label className="label-mono mb-1 block text-muted">Qualidade</label>
                    <select
                      value={resolucao}
                      onChange={(e) => setResolucao(e.target.value)}
                      className="field w-full px-2.5 py-1.5 text-xs"
                    >
                      <option value="720p">720p HD</option>
                      <option value="360p">360p Preview Rápido</option>
                    </select>
                  </div>
                </div>

                {/* Project Destination Selector */}
                <div className="rounded border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="label-mono text-primary-bright flex items-center gap-1.5 text-xs font-semibold">
                      <Icon name="folder_shared" className="text-[16px]" />
                      Destino da Mídia / Vincular ao Projeto (Opcional)
                    </label>
                    <span className="text-[11px] text-muted">A imagem vai direto para a pasta do projeto</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={targetProjectId}
                      onChange={(e) => {
                        setTargetProjectId(e.target.value);
                        setTargetSceneId("");
                      }}
                      className="field w-full px-2.5 py-1.5 text-xs bg-surface-low"
                    >
                      <option value="">Apenas Galeria Geral do Flow (Sem vincular)</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          📁 {p.title} ({p.format === "SHORT_9_16" ? "9:16" : "16:9"})
                        </option>
                      ))}
                    </select>
                    {targetProjectId && (
                      <select
                        value={targetSceneId}
                        onChange={(e) => setTargetSceneId(e.target.value)}
                        className="field w-full px-2.5 py-1.5 text-xs bg-surface-low"
                      >
                        <option value="">Banco de Imagens Geral do Projeto</option>
                        {projects
                          .find((p) => p.id === targetProjectId)
                          ?.scripts?.[0]?.blocks?.flatMap((b: any) =>
                            b.scenes.map((s: any) => ({
                              ...s,
                              actNumber: b.act,
                            }))
                          )
                          ?.map((s: any) => (
                            <option key={s.id} value={s.id}>
                              Ato {s.actNumber} · Cena #{s.order}: {s.description || s.prompt?.slice(0, 30) || "Sem descrição"}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs text-muted flex items-center gap-1.5">
                    <Icon name="check_circle" className="text-success text-[14px]" />
                    Sem gasto de API paga — utiliza créditos da sua conta Google
                  </span>
                  <Button
                    type="submit"
                    variant="primary"
                    icon="auto_awesome"
                    disabled={isSubmitting || !prompt.trim()}
                  >
                    {isSubmitting ? "Enviando à Fila..." : `Gerar ${tipo === "imagem" ? "Imagem" : "Vídeo"} no Google Flow`}
                  </Button>
                </div>
              </form>
            </Card>

            {/* Camera Language Presets */}
            <Card className="p-4">
              <h4 className="font-display text-xs font-semibold mb-3 flex items-center gap-1.5 text-fg-secondary">
                <Icon name="movie" className="text-[16px] text-primary-bright" />
                Injetar Movimento de Câmera & Linguagem Cinematográfica
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CAMERA_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p.prompt)}
                    className="flex flex-col text-left p-2.5 rounded border border-line bg-surface-low hover:border-primary/40 hover:bg-surface-mid transition-all text-xs"
                  >
                    <span className="font-medium text-fg">{p.name}</span>
                    <span className="text-[11px] text-muted truncate mt-0.5">{p.prompt}</span>
                  </button>
                ))}
              </div>
            </Card>

            {/* Galeria de Mídias Geradas no Flow */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon name="photo_library" className="text-primary-bright text-[20px]" />
                  <h3 className="font-display text-sm font-bold text-fg">
                    Mídias Geradas no Flow ({completedJobs.length})
                  </h3>
                </div>
                <span className="text-xs text-muted">Prontas para incorporar aos seus projetos</span>
              </div>

              {completedJobs.length === 0 ? (
                <div className="rounded border border-dashed border-line p-8 text-center text-xs text-muted">
                  Nenhuma mídia gerada recentemente na fila. Digite um prompt acima para gerar sua primeira imagem com Nano Banana Pro!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {completedJobs.map((job) => {
                    const selProj = selectedProjectPerJob[job.job_id] || targetProjectId || (projects[0]?.id ?? "");
                    const targetProjObj = projects.find((p) => p.id === selProj);
                    const selScene = selectedScenePerJob[job.job_id] || "";
                    const isAssigning = assigningJobId === job.job_id;

                    return (
                      <div key={job.job_id} className="flex flex-col rounded-lg border border-line bg-surface-low/80 overflow-hidden">
                        <div className="relative bg-void aspect-video flex items-center justify-center overflow-hidden">
                          {job.tipo === "video" ? (
                            <video
                              src={`/api/flow?action=file&jobId=${job.job_id}`}
                              controls
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img
                              src={`/api/flow?action=file&jobId=${job.job_id}`}
                              alt={job.prompt}
                              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          )}
                          <span className="absolute top-2 left-2 rounded bg-void/80 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-mono text-primary-bright border border-primary/30">
                            {job.modelo} · {job.proporcao}
                          </span>
                        </div>

                        <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                          <p className="text-xs text-fg line-clamp-2 leading-relaxed" title={job.prompt}>
                            {job.prompt}
                          </p>

                          <div className="pt-2 border-t border-line/60 space-y-2">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-mono text-muted uppercase">Vincular a:</label>
                              <select
                                value={selProj}
                                onChange={(e) => {
                                  setSelectedProjectPerJob((prev) => ({ ...prev, [job.job_id]: e.target.value }));
                                }}
                                className="field w-full px-2 py-1 text-xs bg-surface-mid"
                              >
                                {projects.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    📁 {p.title}
                                  </option>
                                ))}
                              </select>

                              {targetProjObj && targetProjObj.scripts?.[0]?.blocks && (
                                <select
                                  value={selScene}
                                  onChange={(e) => {
                                    setSelectedScenePerJob((prev) => ({ ...prev, [job.job_id]: e.target.value }));
                                  }}
                                  className="field w-full px-2 py-1 text-[11px] bg-surface-mid"
                                >
                                  <option value="">Banco Geral do Projeto</option>
                                  {targetProjObj.scripts[0].blocks.flatMap((b: any) =>
                                    b.scenes.map((s: any) => ({
                                      ...s,
                                      actNumber: b.act,
                                    }))
                                  ).map((s: any) => (
                                    <option key={s.id} value={s.id}>
                                      Ato {s.actNumber} - Cena #{s.order}: {s.description || s.prompt?.slice(0, 25) || "Sem descrição"}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1">
                              <Button
                                size="sm"
                                variant="primary"
                                icon="move_to_inbox"
                                className="flex-1 text-xs"
                                disabled={isAssigning || !selProj}
                                onClick={() => handleAssignToProject(job.job_id, selProj, selScene, job.prompt)}
                              >
                                {isAssigning ? "Salvando..." : "Incorporar ao Projeto"}
                              </Button>

                              <a
                                href={`/api/flow?action=file&jobId=${job.job_id}`}
                                download={`flow_${job.job_id.slice(0, 8)}.${job.tipo === "video" ? "mp4" : "png"}`}
                                className="p-1.5 rounded border border-line hover:border-primary/40 text-muted hover:text-fg text-xs"
                                title="Baixar arquivo direto"
                              >
                                <Icon name="download" className="text-[16px]" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Quick Guide & Info Sidebar */}
          <div className="space-y-4">
            <Card className="p-4 bg-surface-low/90">
              <h4 className="font-display text-sm font-semibold mb-2 flex items-center gap-2">
                <Icon name="info" className="text-primary-bright text-[18px]" />
                Como Funciona a Integração
              </h4>
              <ul className="space-y-2 text-xs text-fg-secondary leading-relaxed">
                <li className="flex items-start gap-1.5">
                  <span className="text-primary-bright font-bold">1.</span>
                  <span>O Vincere Studio envia o prompt para o seu daemon local na <strong>porta 9334</strong>.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary-bright font-bold">2.</span>
                  <span>O Google Chrome opera de forma <strong>invisível em segundo plano</strong>, executando no Google Flow.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary-bright font-bold">3.</span>
                  <span>O arquivo final é baixado diretamente para a pasta do Vincere Studio e fica disponível na aba <strong>Media Assets</strong>.</span>
                </li>
              </ul>
            </Card>

            <Card className="p-4 border-line">
              <h4 className="font-display text-sm font-semibold mb-2 flex items-center gap-2">
                <Icon name="tips_and_updates" className="text-warning text-[18px]" />
                Dicas de Prompt (Nano Banana & Veo)
              </h4>
              <div className="space-y-2 text-xs text-muted leading-relaxed">
                <p>
                  <strong>Para fotos de documento/arquivo:</strong> mencione sempre o tipo de papel (<em>crinkled paper, polaroid border, dossier stamp</em>) e iluminação noir.
                </p>
                <p>
                  <strong>Para consistência:</strong> o modelo Nano Banana Pro responde muito bem à definição de lentes (<em>35mm, 85mm</em>) e resolução descrita explicitamente no prompt.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
