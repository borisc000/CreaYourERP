import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useFirestoreCollection } from "../../hooks/useFirestore";
import { AIProvider, AIPromptTemplate, AIAgent, AIExecution } from "../../types";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";

export default function AIDashboard() {
  const { companyId } = useAuth();
  const [tab, setTab] = useState<"providers" | "prompts" | "agents" | "executions">("providers");
  const [showForm, setShowForm] = useState(false);
  const [providerForm, setProviderForm] = useState({ name: "", providerType: "openai" as any, defaultModel: "", apiBaseUrl: "", apiKey: "" });

  const { data: providers } = useFirestoreCollection<AIProvider>(
    "aiProviders"
  );
  const { data: prompts } = useFirestoreCollection<AIPromptTemplate>(
    "aiPromptTemplates"
  );
  const { data: agents } = useFirestoreCollection<AIAgent>(
    "aiAgents"
  );
  const { data: executions } = useFirestoreCollection<AIExecution>(
    "aiExecutions"
  );

  const handleSubmitProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    await httpsCallable(functions, "createAIProvider")({ companyId: companyId, ...providerForm });
    setShowForm(false);
    setProviderForm({ name: "", providerType: "openai", defaultModel: "", apiBaseUrl: "", apiKey: "" });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Inteligencia Artificial</h1>

      <div className="flex gap-2 mb-6 border-b">
        {(["providers", "prompts", "agents", "executions"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium ${tab === t ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "providers" ? "Proveedores" : t === "prompts" ? "Prompts" : t === "agents" ? "Agentes" : "Ejecuciones"}
          </button>
        ))}
      </div>

      {tab === "providers" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Proveedores LLM ({providers.length})</h2>
            <button onClick={() => setShowForm(true)} className="erp-btn-primary">+ Nuevo Proveedor</button>
          </div>
          {showForm && (
            <form onSubmit={handleSubmitProvider} className="erp-card mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className="erp-input" placeholder="Nombre *" value={providerForm.name} onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })} required />
                <select className="erp-input" value={providerForm.providerType} onChange={(e) => setProviderForm({ ...providerForm, providerType: e.target.value })}>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="azure_openai">Azure OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="ollama">Ollama</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <input className="erp-input w-full" placeholder="Modelo por defecto" value={providerForm.defaultModel} onChange={(e) => setProviderForm({ ...providerForm, defaultModel: e.target.value })} />
              <input className="erp-input w-full" placeholder="API Base URL" value={providerForm.apiBaseUrl} onChange={(e) => setProviderForm({ ...providerForm, apiBaseUrl: e.target.value })} />
              <input className="erp-input w-full" type="password" placeholder="API Key" value={providerForm.apiKey} onChange={(e) => setProviderForm({ ...providerForm, apiKey: e.target.value })} />
              <div className="flex gap-3">
                <button type="submit" className="erp-btn-primary">Guardar</button>
                <button type="button" className="erp-btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </form>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {providers.map((p) => (
              <div key={p.id} className="erp-card">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-gray-500">{p.providerType} | {p.defaultModel || "Sin modelo"}</p>
                  </div>
                  {p.isDefault && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Por defecto</span>}
                </div>
                <p className="text-xs text-gray-400 mt-2">{p.apiBaseUrl || "URL por defecto"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "prompts" && (
        <div>
          <h2 className="text-lg font-bold mb-4">Plantillas de Prompt ({prompts.length})</h2>
          <div className="space-y-2">
            {prompts.map((p) => (
              <div key={p.id} className="erp-card">
                <div className="flex justify-between">
                  <p className="font-medium">{p.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${p.status === "active" ? "bg-green-100 text-green-700" : p.status === "draft" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-700"}`}>{p.status}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{p.userPrompt.substring(0, 120)}...</p>
                <p className="text-xs text-gray-400 mt-1">Variables: {p.inputVariables?.join(", ") || "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "agents" && (
        <div>
          <h2 className="text-lg font-bold mb-4">Agentes ({agents.length})</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {agents.map((a) => (
              <div key={a.id} className="erp-card">
                <p className="font-medium">{a.name}</p>
                <p className="text-sm text-gray-500">Rol: {a.role}</p>
                <p className="text-sm text-gray-500">Objetivo: {a.goal}</p>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{a.toolPolicy}</span>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{a.memoryPolicy}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "executions" && (
        <div>
          <h2 className="text-lg font-bold mb-4">Ejecuciones ({executions.length})</h2>
          <div className="space-y-2">
            {executions.slice(0, 20).map((ex) => (
              <div key={ex.id} className="erp-card">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">{new Date(ex.createdAt).toLocaleString()}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${ex.executionStatus === "completed" ? "bg-green-100 text-green-700" : ex.executionStatus === "failed" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{ex.executionStatus}</span>
                </div>
                <p className="text-sm font-medium mt-1">{ex.renderedUserPrompt?.substring(0, 100) || "Sin prompt"}...</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
