import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getQuoteExportData, type QuoteExportData, type QuoteExportLine } from "@/services/quotes";
import { ArrowLeftIcon, PrinterIcon } from "@heroicons/react/24/outline";

const sections: Array<{ key: QuoteExportLine["sectionType"]; label: string }> = [
  { key: "SERVICIOS", label: "1. Servicios y Ejecucion" },
  { key: "PERSONAL", label: "2. Personal (HH)" },
  { key: "INSUMOS", label: "3. Insumos y Equipos Asociados" },
];

function clp(value: unknown) {
  return `$${Math.round(Number(value || 0)).toLocaleString("es-CL")}`;
}

function fmtDate(value?: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return value;
  }
}

function text(value: unknown, fallback = "-") {
  return value == null || value === "" ? fallback : String(value);
}

export function QuotePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<QuoteExportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const exportData = await getQuoteExportData(id);
        setData(exportData);
        const customerSlug = (exportData.customer?.name || "Cliente").replace(/\s+/g, "_").slice(0, 25);
        document.title = `COT_${exportData.quote.quoteNumber || exportData.quote.id}_${customerSlug}`;
      } catch (err) {
        console.error("Error cargando preview de cotizacion:", err);
        setError("No se pudo cargar la cotizacion para imprimir.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const groupedLines = useMemo(() => {
    const groups: Record<QuoteExportLine["sectionType"], QuoteExportLine[]> = {
      SERVICIOS: [],
      PERSONAL: [],
      INSUMOS: [],
    };
    for (const line of data?.lines || []) {
      groups[line.sectionType || "SERVICIOS"].push(line);
    }
    return groups;
  }, [data?.lines]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-700 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-red-300 text-sm">{error || "Cotizacion no encontrada."}</p>
          <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-slate-700 text-white rounded">
            Volver
          </button>
        </div>
      </div>
    );
  }

  const { quote, company, customer, lead, creator } = data;
  const notes = quote.notes || company.defaultTerms || "Sin condiciones especificadas.";
  const showBank = Boolean(company.bankName || company.accountNumber);

  return (
    <div className="quote-preview-page min-h-screen bg-slate-600 py-6">
      <div className="quote-preview-actions fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-semibold rounded shadow"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Volver
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold rounded shadow"
        >
          <PrinterIcon className="w-4 h-4" />
          Guardar PDF / Imprimir
        </button>
      </div>

      <style>{`
        @page { size: A4; margin: 0; }
        .quote-a4-sheet {
          width: 210mm;
          min-height: 297mm;
          background: #fff;
          margin: 0 auto;
          padding: 12mm 14mm;
          box-shadow: 0 16px 48px rgba(0,0,0,.30);
          box-sizing: border-box;
          color: #334155;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 10.5px;
        }
        .quote-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        .quote-table th {
          background: #1e3a8a;
          color: #fff;
          font-weight: 700;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: .04em;
          padding: 5px 6px;
          text-align: left;
        }
        .quote-table td {
          padding: 4px 6px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: top;
        }
        .quote-table .section-row td {
          background: #f1f5f9;
          color: #0f172a;
          font-weight: 800;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: .05em;
          border-top: 1px solid #cbd5e1;
          border-bottom: 1px solid #cbd5e1;
        }
        .quote-table .num { text-align: right; white-space: nowrap; }
        .quote-table .code { color: #2563eb; font-family: "Courier New", monospace; font-weight: 700; white-space: nowrap; }
        .quote-total-row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 10px; border-bottom: 1px solid #e2e8f0; }
        @media print {
          body { background: #fff !important; }
          .quote-preview-page { background: #fff !important; padding: 0 !important; }
          .quote-preview-actions { display: none !important; }
          .quote-a4-sheet {
            margin: 0 !important;
            box-shadow: none !important;
            width: 210mm !important;
            min-height: 297mm !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          tr, .quote-footer-block { page-break-inside: avoid; }
        }
      `}</style>

      <main className="quote-a4-sheet">
        {company.logoUrl && (
          <div className="text-center mb-2">
            <img src={company.logoUrl} alt="Logo" className="h-10 max-w-40 object-contain inline-block" />
          </div>
        )}

        <header className="flex justify-between items-start gap-6 border-t-[5px] border-blue-900 pt-3 mb-3">
          <section className="min-w-0">
            <h1 className="text-[15px] leading-tight font-extrabold text-slate-900 m-0">{company.name || company.legalName || "Tu Empresa"}</h1>
            <p className="mt-1 text-slate-500"><strong className="text-slate-700">RUT:</strong> {text(company.rut)}</p>
            <p className="text-slate-500"><strong className="text-slate-700">Rubro:</strong> {text(lead.serviceTypeName)}</p>
            <p className="text-slate-500"><strong className="text-slate-700">Asesor:</strong> {text(creator.name)}</p>
            <p className="text-slate-500"><strong className="text-slate-700">Contacto:</strong> {text(creator.email)}</p>
          </section>
          <section className="text-right shrink-0">
            <div className="text-[18px] font-extrabold uppercase tracking-wider text-blue-900">Cotizacion</div>
            <table className="ml-auto mt-2 text-[10px]">
              <tbody>
                <tr><td className="font-semibold text-slate-700 pr-2">N Doc</td><td className="font-bold text-blue-900 text-left">{quote.quoteNumber || quote.id}</td></tr>
                <tr><td className="font-semibold text-slate-700 pr-2">Proyecto</td><td className="font-bold text-blue-900 text-left">{text(lead.projectCode)}</td></tr>
                <tr><td className="font-semibold text-slate-700 pr-2">Fecha</td><td className="font-bold text-blue-900 text-left">{fmtDate(quote.quoteDate || quote.createdAt)}</td></tr>
              </tbody>
            </table>
          </section>
        </header>

        <div className="h-px bg-slate-200 mb-3" />

        <section className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
            <div className="text-[8.5px] font-extrabold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1 mb-2">Solicitante / Cliente</div>
            <div className="text-[12px] font-bold text-slate-900 mb-1">{customer.name || customer.legalName || "Sin cliente"}</div>
            <p><strong>RUT</strong> {text(customer.rut || customer.taxId)}</p>
            <p><strong>Contacto</strong> {text(customer.contactName)}</p>
            <p><strong>Telefono</strong> {text(customer.phone)}</p>
            <p><strong>Email</strong> {text(customer.email)}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
            <div className="text-[8.5px] font-extrabold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1 mb-2">Referencia del Servicio</div>
            <div className="text-[11px] font-bold text-blue-700 mb-2">{lead.title || quote.title}</div>
            <div className="text-[8.5px] font-extrabold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1 mb-1">Condiciones Comerciales</div>
            <p><strong>Validez oferta</strong> {quote.validUntil ? `Hasta ${fmtDate(quote.validUntil)}` : "15 dias corridos"}</p>
            <p><strong>Moneda</strong> CLP</p>
            <p><strong>Condicion pago</strong> 30 dias</p>
          </div>
        </section>

        {lead.description && (
          <section className="bg-slate-50 border border-slate-200 border-l-4 border-l-blue-600 rounded-r-md p-3 mb-3">
            <div className="text-[8.5px] font-extrabold uppercase tracking-wider text-blue-900 mb-1">Descripcion del Servicio / Alcance</div>
            <p className="m-0 text-justify leading-relaxed">{lead.description}</p>
          </section>
        )}

        <table className="quote-table">
          <thead>
            <tr>
              <th style={{ width: "10%" }}>Cod.</th>
              <th style={{ width: "46%" }}>Descripcion del Item</th>
              <th className="num" style={{ width: "9%" }}>Cant.</th>
              <th className="num" style={{ width: "17%" }}>Val. Unitario</th>
              <th className="num" style={{ width: "18%" }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => {
              const lines = groupedLines[section.key];
              if (lines.length === 0) return null;
              return (
                <Fragment key={`${section.key}-group`}>
                  <tr key={`${section.key}-section`} className="section-row"><td colSpan={5}>{section.label}</td></tr>
                  {lines.map((line, index) => (
                    <tr key={line.id || `${section.key}-${index}`} style={index % 2 === 1 ? { background: "#f8fafc" } : undefined}>
                      <td className="code">{line.itemCode}</td>
                      <td>{line.description || "-"}</td>
                      <td className="num">{Number(line.quantity || 0).toLocaleString("es-CL")}</td>
                      <td className="num">{clp(line.unitPrice)}</td>
                      <td className="num font-bold text-slate-900">{clp(line.subtotalLine || Number(line.quantity || 0) * Number(line.unitPrice || 0))}</td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {data.lines.length === 0 && (
              <tr><td colSpan={5} className="text-center text-slate-400 py-6">Sin lineas de cotizacion</td></tr>
            )}
          </tbody>
        </table>

        <section className="quote-footer-block flex justify-between items-start gap-4 mt-4">
          <div className="w-[60%] bg-slate-100 border border-slate-200 border-l-4 border-l-blue-900 rounded-r-md p-3 leading-relaxed">
            <div className="text-[8.5px] font-extrabold uppercase tracking-wider text-blue-900 mb-2">Terminos y Condiciones</div>
            <p className="whitespace-pre-wrap m-0">{notes}</p>
            {showBank && (
              <div className="mt-3 pt-2 border-t border-dashed border-slate-300">
                <strong className="text-slate-900">Datos de Transferencia:</strong><br />
                Banco <strong>{text(company.bankName)}</strong> - Cta. {text(company.accountType, "")} N <strong>{text(company.accountNumber)}</strong><br />
                A nombre de: <strong>{company.legalName || company.name}</strong>
              </div>
            )}
          </div>

          <div className="w-[37%] border border-slate-200 rounded-lg overflow-hidden">
            <div className="quote-total-row bg-slate-50"><span>Subtotal Items</span><strong>{clp(quote.subtotalItems)}</strong></div>
            <div className="quote-total-row"><span>Gastos Adm ({quote.admMarginPct ?? 5}%)</span><strong>{clp(quote.admExpenseAmount)}</strong></div>
            <div className="quote-total-row"><span>Utilidad ({quote.profitMarginPct ?? 10}%)</span><strong>{clp(quote.profitAmount)}</strong></div>
            <div className="quote-total-row bg-blue-600 text-white font-bold"><span>Valor Neto</span><span>{clp(quote.netTotal)}</span></div>
            <div className="quote-total-row bg-blue-50 text-blue-900"><span>IVA ({quote.taxPct ?? 19}%)</span><strong>{clp(quote.taxAmount)}</strong></div>
            <div className="quote-total-row bg-blue-900 text-white font-extrabold text-[12px]"><span>TOTAL A PAGAR</span><span>{clp(quote.grossTotal)}</span></div>
          </div>
        </section>

        <footer className="text-center text-[7.5px] text-slate-400 mt-4 italic">
          Documento generado digitalmente - YOUR ERP - {company.email || ""}
        </footer>
      </main>
    </div>
  );
}
