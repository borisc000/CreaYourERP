import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";
import { callLLM } from "./llmCaller";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }

export const getAIDashboard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "ai.view", { companyId });
    const [providers, prompts, agents, executions] = await Promise.all([
      companyRef(companyId).collection("aiProviders").get(),
      companyRef(companyId).collection("aiPromptTemplates").get(),
      companyRef(companyId).collection("aiAgents").get(),
      companyRef(companyId).collection("aiExecutions").orderBy("createdAt", "desc").limit(20).get(),
    ]);
    return {
      totalProviders: providers.size,
      totalPrompts: prompts.size,
      totalAgents: agents.size,
      recentExecutions: executions.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }
);

export const createAIProvider = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "ai.create", { companyId });
    const { companyId: _, ...data } = request.data;
    if (!data.name || !data.providerType) throw new HttpsError("invalid-argument", "Datos incompletos");
    if (data.isDefault) {
      const existing = await companyRef(companyId).collection("aiProviders").where("isDefault", "==", true).get();
      for (const d of existing.docs) await d.ref.update({ isDefault: false });
    }
    const ref = await companyRef(companyId).collection("aiProviders").add({
      companyId, providerType: data.providerType, name: data.name,
      apiBaseUrl: data.apiBaseUrl || "", apiKey: data.apiKey || "", defaultModel: data.defaultModel || "",
      availableModels: data.availableModels || [], capabilities: data.capabilities || [],
      timeoutSeconds: data.timeoutSeconds || 30, isDefault: data.isDefault || false, isActive: true,
      createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id };
  }
);

export const updateAIProvider = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "ai.edit", { companyId });
    const { companyId: _, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    if (data.isDefault) {
      const existing = await companyRef(companyId).collection("aiProviders").where("isDefault", "==", true).get();
      for (const d of existing.docs) await d.ref.update({ isDefault: false });
    }
    await companyRef(companyId).collection("aiProviders").doc(id).update({ ...data, updatedAt: nowIso() });
    return { updated: true };
  }
);

export const createAIPromptTemplate = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "ai.create", { companyId });
    const { companyId: _, ...data } = request.data;
    if (!data.name || !data.userPrompt) throw new HttpsError("invalid-argument", "Datos incompletos");
    const ref = await companyRef(companyId).collection("aiPromptTemplates").add({
      companyId, name: data.name, description: data.description || "",
      systemPrompt: data.systemPrompt || "", userPrompt: data.userPrompt,
      inputVariables: data.inputVariables || [], preferredProviderId: data.preferredProviderId || "",
      temperature: data.temperature ?? 0.7, maxTokens: data.maxTokens ?? 1024,
      status: data.status || "draft", createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id };
  }
);

export const updateAIPromptTemplate = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "ai.edit", { companyId });
    const { companyId: _, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    await companyRef(companyId).collection("aiPromptTemplates").doc(id).update({ ...data, updatedAt: nowIso() });
    return { updated: true };
  }
);

export const createAIAgent = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "ai.create", { companyId });
    const { companyId: _, ...data } = request.data;
    if (!data.name || !data.role) throw new HttpsError("invalid-argument", "Datos incompletos");
    const ref = await companyRef(companyId).collection("aiAgents").add({
      companyId, name: data.name, role: data.role, goal: data.goal || "",
      instructions: data.instructions || "", toolPolicy: data.toolPolicy || "none",
      memoryPolicy: data.memoryPolicy || "session", maxIterations: data.maxIterations || 5,
      preferredProviderId: data.preferredProviderId || "", preferredPromptId: data.preferredPromptId || "",
      isActive: true, createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id };
  }
);

export const updateAIAgent = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "ai.edit", { companyId });
    const { companyId: _, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    await companyRef(companyId).collection("aiAgents").doc(id).update({ ...data, updatedAt: nowIso() });
    return { updated: true };
  }
);

export const planAIExecution = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "ai.create", { companyId });
    const { agentId, promptTemplateId, providerId, inputData } = request.data;

    let renderedSystem = "";
    let renderedUser = "";

    if (promptTemplateId) {
      const pt = await companyRef(companyId).collection("aiPromptTemplates").doc(promptTemplateId).get();
      if (pt.exists) {
        const p = pt.data()!;
        renderedSystem = p.systemPrompt || "";
        renderedUser = p.userPrompt || "";
        if (inputData && typeof inputData === "object") {
          for (const [key, value] of Object.entries(inputData)) {
            const re = new RegExp(`{{\\s*${key}\\s*}}`, "g");
            renderedSystem = renderedSystem.replace(re, String(value));
            renderedUser = renderedUser.replace(re, String(value));
          }
        }
      }
    }

    const ref = await companyRef(companyId).collection("aiExecutions").add({
      companyId, agentId: agentId || null, promptTemplateId: promptTemplateId || null,
      providerId: providerId || null, inputData: inputData || null,
      renderedSystemPrompt: renderedSystem, renderedUserPrompt: renderedUser,
      executionStatus: "planned", createdAt: nowIso(),
    });

    return { id: ref.id, status: "planned", renderedSystemPrompt: renderedSystem, renderedUserPrompt: renderedUser };
  }
);

export const executeAI = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "ai.create", { companyId });
    const { executionId } = request.data;
    if (!executionId) throw new HttpsError("invalid-argument", "executionId requerido");

    const execRef = companyRef(companyId).collection("aiExecutions").doc(executionId);
    const execSnap = await execRef.get();
    if (!execSnap.exists) throw new HttpsError("not-found", "Ejecución no encontrada");
    const exec = execSnap.data()!;

    if (exec.executionStatus === "running") {
      throw new HttpsError("failed-precondition", "La ejecución ya está en curso");
    }
    if (exec.executionStatus === "completed") {
      return { id: executionId, status: "completed", result: exec.resultText || "" };
    }

    // Determine provider
    let providerId = exec.providerId;
    if (!providerId) {
      const defaults = await companyRef(companyId).collection("aiProviders").where("isDefault", "==", true).where("isActive", "==", true).limit(1).get();
      if (!defaults.empty) providerId = defaults.docs[0].id;
    }
    if (!providerId) throw new HttpsError("failed-precondition", "No hay proveedor AI configurado");

    const providerSnap = await companyRef(companyId).collection("aiProviders").doc(providerId).get();
    if (!providerSnap.exists) throw new HttpsError("not-found", "Proveedor AI no encontrado");
    const provider = providerSnap.data()!;
    if (!provider.apiKey) throw new HttpsError("failed-precondition", "Proveedor AI sin API key configurada");

    // Determine prompt parameters
    let temperature = 0.7;
    let maxTokens = 1024;
    if (exec.promptTemplateId) {
      const ptSnap = await companyRef(companyId).collection("aiPromptTemplates").doc(exec.promptTemplateId).get();
      if (ptSnap.exists) {
        const pt = ptSnap.data()!;
        temperature = pt.temperature ?? temperature;
        maxTokens = pt.maxTokens ?? maxTokens;
      }
    }

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
    if (exec.renderedSystemPrompt) {
      messages.push({ role: "system", content: exec.renderedSystemPrompt });
    }
    if (exec.renderedUserPrompt) {
      messages.push({ role: "user", content: exec.renderedUserPrompt });
    }
    if (messages.length === 0) {
      throw new HttpsError("failed-precondition", "No hay prompts renderizados para ejecutar");
    }

    // Update status to running
    await execRef.update({ executionStatus: "running", startedAt: nowIso(), updatedAt: nowIso() });

    const result = await callLLM(
      {
        providerType: provider.providerType,
        apiKey: provider.apiKey,
        apiBaseUrl: provider.apiBaseUrl || undefined,
        defaultModel: provider.defaultModel || undefined,
        timeoutSeconds: provider.timeoutSeconds || 30,
      },
      messages,
      { temperature, maxTokens }
    );

    if (result.ok) {
      await execRef.update({
        executionStatus: "completed",
        resultText: result.text,
        usage: result.usage || null,
        completedAt: nowIso(),
        updatedAt: nowIso(),
      });
      return { id: executionId, status: "completed", result: result.text, usage: result.usage };
    } else {
      await execRef.update({
        executionStatus: "failed",
        errorMessage: result.error || "Unknown error",
        completedAt: nowIso(),
        updatedAt: nowIso(),
      });
      throw new HttpsError("internal", result.error || "Error ejecutando LLM");
    }
  }
);
