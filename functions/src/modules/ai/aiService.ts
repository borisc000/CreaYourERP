import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app"];
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
    const { companyId: _c, ...data } = request.data;
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
    const { companyId: _c, id, ...data } = request.data;
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
    const { companyId: _c, ...data } = request.data;
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
    const { companyId: _c, id, ...data } = request.data;
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
    const { companyId: _c, ...data } = request.data;
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
    const { companyId: _c, id, ...data } = request.data;
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
