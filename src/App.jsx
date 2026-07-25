import { useEffect, useMemo, useState } from "react";
import "./App.css";

const STORAGE_KEY = "ert-response-v2-final";
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const newReport = () => ({ id: uid(), included: true, text: "" });

const initialData = () => ({
  title: "",
  phenomenon: "",
  includePhenomenon: true,
  ph: "",
  leakAmount: "",
  leakRate: "",
  includeProperties: true,
  noContact: true,
  inhalationPatients: "",
  contactPatients: "",
  includePatients: true,
  gasAlarm: false,
  reports: [newReport()],
  history: [],
  ended: false,
  requestAnalysis: false,
  closeSituation: false,
});

const generalTemplates = [
  { id: "control", label: "통제라인 구축", fields: [], build: () => "통제라인 구축" },
  {
    id: "liquid",
    label: "미상의 액상 (고임/맺힘) 확인",
    fields: [{ key: "state", label: "상태", type: "select", options: ["고임", "맺힘"] }],
    build: ({ state }) => `미상의 액상 ${state || "고임"} 확인`,
  },
  { id: "ppe-plan", label: "보호구 착용 후 확인 예정", fields: [], build: () => "보호구 착용 후 확인 예정" },
  {
    id: "ppe-entry",
    label: "보호구 (A/B/C/D)등급 착용 후 현장 진입 실시",
    fields: [{ key: "grade", label: "등급", type: "select", options: ["A", "B", "C", "D"] }],
    build: ({ grade }) => `보호구 ${grade || "A"}등급 착용 후 현장 진입 실시`,
  },
  {
    id: "unit-defect",
    label: "[]호기 []결함 확인",
    fields: [
      { key: "unit", label: "호기", type: "text", placeholder: "예: 1" },
      { key: "defect", label: "결함", type: "text", placeholder: "예: Valve" },
    ],
    build: ({ unit, defect }) => `${unit || "[]"}호기 ${defect || "[]"}결함 확인`,
  },
  {
    id: "pipe-defect",
    label: "[]배관 []결함 확인",
    fields: [
      { key: "pipe", label: "배관", type: "text", placeholder: "예: PCW" },
      { key: "defect", label: "결함", type: "text", placeholder: "예: 플랜지 Leak" },
    ],
    build: ({ pipe, defect }) => `${pipe || "[]"}배관 ${defect || "[]"}결함 확인`,
  },
  {
    id: "cleanup",
    label: "[] 오염부 제거 및 제수 작업 (실시/완료)",
    fields: [
      { key: "target", label: "대상·위치", type: "text", placeholder: "예: 바닥" },
      { key: "state", label: "상태", type: "select", options: ["실시", "완료"] },
    ],
    build: ({ target, state }) => `${target || "[]"} 오염부 제거 및 제수 작업 ${state || "실시"}`,
  },
  { id: "no-defect", label: "추가 결함 없음 확인", fields: [], build: () => "추가 결함 없음 확인" },
  {
    id: "temperature",
    label: "온/습도 확인 결과 []",
    fields: [{ key: "result", label: "확인 결과", type: "text", placeholder: "예: 23℃ / 45%" }],
    build: ({ result }) => `온/습도 확인 결과 ${result || "[]"}`,
  },
  {
    id: "valve",
    label: "Valve 차단 (실시/후 확인 시 (특이사항 없음/[]))",
    fields: [
      { key: "mode", label: "구분", type: "select", options: ["실시", "후 확인 시"] },
      { key: "resultType", label: "확인 결과", type: "select", options: ["특이사항 없음", "직접 입력"] },
      { key: "result", label: "직접 입력", type: "text", placeholder: "확인 결과 입력" },
    ],
    build: ({ mode, resultType, result }) => {
      if (mode === "실시") return "Valve 차단 실시";
      const finalResult = resultType === "직접 입력" ? (result || "[]") : "특이사항 없음";
      return `Valve 차단 후 확인 시 ${finalResult}`;
    },
  },
  {
    id: "environment",
    label: "주변 환경 측정 시 [](ppm/ppb/%LEL)으로 특이사항 없음",
    fields: [
      { key: "value", label: "측정값", type: "text", placeholder: "예: 0" },
      { key: "unit", label: "단위", type: "select", options: ["ppm", "ppb", "%LEL"] },
    ],
    build: ({ value, unit }) => `주변 환경 측정 시 ${value || "[]"}${unit || "ppm"}으로 특이사항 없음`,
  },
];

const gasTemplates = [
  {
    id: "detector",
    label: "[]감지기 측정 시 [](ppm/ppb/%LEL) 확인",
    fields: [
      { key: "detector", label: "감지기", type: "text", placeholder: "예: NH3" },
      { key: "value", label: "측정값", type: "text", placeholder: "예: 10" },
      { key: "unit", label: "단위", type: "select", options: ["ppm", "ppb", "%LEL"] },
    ],
    build: ({ detector, value, unit }) => `${detector || "[]"}감지기 측정 시 ${value || "[]"}${unit || "ppm"} 확인`,
  },
  {
    id: "cassette",
    label: "주변 환경 측정 시 [](ppm/ppb/%LEL) 및 Chem Cassete 변색 확인",
    fields: [
      { key: "value", label: "측정값", type: "text", placeholder: "예: 0" },
      { key: "unit", label: "단위", type: "select", options: ["ppm", "ppb", "%LEL"] },
    ],
    build: ({ value, unit }) => `주변 환경 측정 시 ${value || "[]"}${unit || "ppm"} 및 Chem Cassete 변색 확인`,
  },
  {
    id: "gpd",
    label: "초음파 카메라 및 GPD-100 [카트리지]감지기 측정 시 특이사항 없음",
    fields: [{ key: "cartridge", label: "카트리지", type: "text", placeholder: "예: NH3" }],
    build: ({ cartridge }) => `초음파 카메라 및 GPD-100 ${cartridge || "[카트리지]"}감지기 측정 시 특이사항 없음`,
  },
  { id: "calibration", label: "LP E&C 감지기 검교정 요청 실시", fields: [], build: () => "LP E&C 감지기 검교정 요청 실시" },
];

const normalize = (saved) => {
  const base = initialData();
  if (!saved || typeof saved !== "object") return base;
  return {
    ...base,
    ...saved,
    title: saved.title ?? "",
    reports: Array.isArray(saved.reports) && saved.reports.length
      ? saved.reports.map((r) => ({ id: r.id || uid(), included: r.included !== false, text: r.text || "" }))
      : [newReport()],
    history: Array.isArray(saved.history) ? saved.history.filter(Boolean).slice(0, 50) : [],
  };
};

const splitLines = (text) => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const appendLine = (current, next) => [current.trimEnd(), next.trim()].filter(Boolean).join("\n");

export default function App() {
  const [data, setData] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalize(JSON.parse(raw)) : initialData();
    } catch {
      return initialData();
    }
  });
  const [openReportId, setOpenReportId] = useState(null);
  const [composer, setComposer] = useState(null);
  const [showSummary, setShowSummary] = useState(true);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const visibleTemplates = useMemo(() => data.gasAlarm
    ? [...generalTemplates.slice(0, 4), ...gasTemplates, ...generalTemplates.slice(4)]
    : generalTemplates, [data.gasAlarm]);

  const allTemplates = [...generalTemplates, ...gasTemplates];
  const selectedTemplate = composer ? allTemplates.find((t) => t.id === composer.templateId) : null;

  const update = (key, value) => setData((p) => ({ ...p, [key]: key === "title" ? value.toUpperCase() : value }));
  const updateReport = (id, patch) => setData((p) => ({ ...p, reports: p.reports.map((r) => r.id === id ? { ...r, ...patch } : r) }));

  const rememberLines = (text) => {
    const lines = splitLines(text);
    if (!lines.length) return;
    setData((p) => {
      const seen = new Set();
      const combined = [...lines.reverse(), ...p.history];
      const history = combined.filter((line) => {
        const key = line.trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 50);
      return { ...p, history };
    });
  };

  const addText = (reportId, text) => {
    if (!text.trim()) return;
    setData((p) => ({
      ...p,
      reports: p.reports.map((r) => r.id === reportId ? { ...r, text: appendLine(r.text, text) } : r),
    }));
    rememberLines(text);
  };

  const chooseTemplate = (reportId, template) => {
    if (!template.fields.length) {
      addText(reportId, template.build({}));
      return;
    }
    const values = {};
    template.fields.forEach((f) => { values[f.key] = f.type === "select" ? f.options[0] : ""; });
    setComposer({ reportId, templateId: template.id, values });
  };

  const applyTemplate = () => {
    if (!composer || !selectedTemplate) return;
    addText(composer.reportId, selectedTemplate.build(composer.values));
    setComposer(null);
  };

  const patientText = () => {
    if (data.noContact) return "접촉자 없음";
    const parts = [];
    if (String(data.inhalationPatients).trim()) parts.push(`흡입환자 ${String(data.inhalationPatients).trim()}명`);
    if (String(data.contactPatients).trim()) parts.push(`접촉환자 ${String(data.contactPatients).trim()}명`);
    return parts.length ? `${parts.join(" / ")} 발생` : "";
  };

  const summaryText = useMemo(() => {
    const lines = [`[${data.title.trim() || "출동 위치"}]`];
    if (data.includePhenomenon && data.phenomenon.trim()) lines.push(`-. 현상: ${data.phenomenon.trim()}`);
    const props = [];
    if (data.ph.trim()) props.push(`pH ${data.ph.trim()}`);
    if (data.leakAmount.trim()) props.push(data.leakAmount.trim());
    if (data.leakRate.trim()) props.push(data.leakRate.trim());
    if (data.includeProperties && props.length) lines.push(`-. 성상: ${props.join(", ")}`);
    const patient = patientText();
    if (data.includePatients && patient) lines.push(`-. 환자 여부: ${patient}`);

    const seen = new Set();
    const responses = [];
    data.reports.filter((r) => r.included).forEach((r) => {
      splitLines(r.text).forEach((line) => {
        const key = line.trim();
        if (!seen.has(key)) { seen.add(key); responses.push(key); }
      });
    });
    if (responses.length) {
      lines.push("", "-. 대응 내용");
      responses.forEach((line, i) => lines.push(`${i + 1}. ${line}`));
    }
    if (data.ended && data.requestAnalysis) lines.push("", "-. 원인분석 및 재발방지대책 요청하겠습니다.");
    if (data.ended && data.closeSituation) {
      if (!(data.ended && data.requestAnalysis)) lines.push("");
      lines.push("**상황 종료합니다.");
    }
    return lines.join("\n");
  }, [data]);

  const copy = async (text) => {
    if (!text.trim()) return;
    try { await navigator.clipboard.writeText(text); }
    catch {
      const el = document.createElement("textarea");
      el.value = text; document.body.appendChild(el); el.select(); document.execCommand("copy"); el.remove();
    }
    alert("보고 내용이 복사되었습니다.");
  };

  const copyReport = (report) => {
    if (!report.text.trim()) return alert("대응 내용을 먼저 입력해주세요.");
    rememberLines(report.text);
    copy(`[${data.title.trim() || "출동 위치"}]\n${report.text.trim()}`);
  };

  const addReport = () => {
    const item = newReport();
    setData((p) => ({ ...p, reports: [...p.reports, item] }));
    setOpenReportId(item.id);
  };

  const reset = () => {
    if (!confirm("현재 출동 내용과 문구 이력을 모두 초기화할까요?")) return;
    setData(initialData()); setOpenReportId(null); setComposer(null);
  };

  return (
    <div className="app"><main className="container">
      <header className="top-card">
        <div><p className="eyebrow">ERT RESPONSE V2</p><h1>출동 대응 보고 작성</h1><p>작성 내용은 현재 기기에 자동 저장됩니다.</p></div>
        <button className="reset" onClick={reset}>전체 초기화</button>
      </header>

      <section className="card">
        <div className="section-head"><div><p className="kicker">공통 정보</p><h2>출동 기본정보</h2></div>
          <label className={`toggle ${data.gasAlarm ? "active" : ""}`}><input type="checkbox" checked={data.gasAlarm} onChange={(e) => update("gasAlarm", e.target.checked)} />Gas Alarm</label>
        </div>
        <Field label="제목 · 출동 위치"><input value={data.title} onChange={(e) => update("title", e.target.value)} placeholder="예: 그린1동 1F H23기둥" /><small>영문은 자동으로 대문자로 변환됩니다.</small></Field>
        <Field label="현상" include={data.includePhenomenon} onInclude={(v) => update("includePhenomenon", v)}><textarea value={data.phenomenon} onChange={(e) => update("phenomenon", e.target.value)} placeholder="현장 현상을 입력하세요." /></Field>
        <Field label="성상" include={data.includeProperties} onInclude={(v) => update("includeProperties", v)}>
          <div className="grid"><input value={data.ph} onChange={(e) => update("ph", e.target.value)} placeholder="pH" /><input value={data.leakAmount} onChange={(e) => update("leakAmount", e.target.value)} placeholder="Leak량 예: 10L" /><input value={data.leakRate} onChange={(e) => update("leakRate", e.target.value)} placeholder="Leak속도 예: 초당 1방울" /></div>
        </Field>
        <Field label="환자 여부" include={data.includePatients} onInclude={(v) => update("includePatients", v)}>
          <label className="check-row"><input type="checkbox" checked={data.noContact} onChange={(e) => update("noContact", e.target.checked)} />접촉자 없음</label>
          {!data.noContact && <div className="grid patient-grid"><label>흡입환자<input inputMode="numeric" value={data.inhalationPatients} onChange={(e) => update("inhalationPatients", e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" /></label><label>접촉환자<input inputMode="numeric" value={data.contactPatients} onChange={(e) => update("contactPatients", e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" /></label></div>}
        </Field>
      </section>

      <section className="card">
        <div className="section-head"><div><p className="kicker">실시간 전송</p><h2>상황별 대응</h2><p>한 중간보고에 여러 문구를 계속 추가할 수 있습니다.</p></div><span className="badge">총 {data.reports.length}건</span></div>
        <div className="reports">
          {data.reports.map((report) => {
            const open = openReportId === report.id;
            return <article className="report" key={report.id}>
              <div className="report-head"><label className="title-check"><input type="checkbox" checked={report.included} onChange={(e) => updateReport(report.id, { included: e.target.checked })} /><strong>[{data.title.trim() || "출동 위치"}]</strong></label>
                <div className="actions"><button onClick={() => { setOpenReportId(open ? null : report.id); setComposer(null); }}>문구 목록</button><button onClick={() => copyReport(report)}>복사</button>{data.reports.length > 1 && <button className="danger" onClick={() => setData((p) => ({ ...p, reports: p.reports.filter((r) => r.id !== report.id) }))}>삭제</button>}</div>
              </div>
              <textarea className="report-text" value={report.text} onBlur={(e) => rememberLines(e.target.value)} onChange={(e) => updateReport(report.id, { text: e.target.value })} placeholder="대응 내용을 직접 입력하거나 문구를 여러 개 추가하세요." />
              {open && <div className="template-panel">
                {data.history.length > 0 && <><h3>이번 출동 사용 이력</h3><div className="template-list history">{data.history.map((line, i) => <button key={`${line}-${i}`} onClick={() => addText(report.id, line)}>{line}</button>)}</div></>}
                <h3>대응 문구</h3><div className="template-list">{visibleTemplates.map((t) => <button key={t.id} onClick={() => chooseTemplate(report.id, t)}>{t.label}{gasTemplates.some((g) => g.id === t.id) && <span>Gas</span>}</button>)}</div>
                {composer?.reportId === report.id && selectedTemplate && <div className="composer"><h3>{selectedTemplate.label}</h3><div className="composer-grid">{selectedTemplate.fields.map((f) => {
                  if (f.key === "result" && composer.values.resultType !== "직접 입력" && selectedTemplate.id === "valve") return null;
                  return <label key={f.key}>{f.label}{f.type === "select" ? <select value={composer.values[f.key]} onChange={(e) => setComposer((c) => ({ ...c, values: { ...c.values, [f.key]: e.target.value } }))}>{f.options.map((o) => <option key={o}>{o}</option>)}</select> : <input value={composer.values[f.key]} placeholder={f.placeholder} onChange={(e) => setComposer((c) => ({ ...c, values: { ...c.values, [f.key]: e.target.value } }))} />}</label>;
                })}</div><div className="composer-actions"><button onClick={() => setComposer(null)}>취소</button><button className="primary" onClick={applyTemplate}>현재 보고에 추가</button></div></div>}
              </div>}
            </article>;
          })}
        </div>
        <button className="add" onClick={addReport}>+ 중간보고 추가</button>
      </section>

      <section className="card">
        <div className="section-head"><div><p className="kicker">최종 보고</p><h2>대응 정리</h2><p>체크한 보고만 모으고 중복 문장은 자동으로 제외합니다.</p></div><button onClick={() => setShowSummary((v) => !v)}>{showSummary ? "접기" : "보기"}</button></div>
        {showSummary && <><pre className="summary">{summaryText}</pre><button className="copy-main" onClick={() => copy(summaryText)}>대응 정리 복사</button></>}
        <label className={`toggle end ${data.ended ? "active" : ""}`}><input type="checkbox" checked={data.ended} onChange={(e) => update("ended", e.target.checked)} />종료</label>
        {data.ended && <div className="end-options"><label><input type="checkbox" checked={data.requestAnalysis} onChange={(e) => update("requestAnalysis", e.target.checked)} />원인분석 및 재발방지대책 요청하겠습니다.</label><label><input type="checkbox" checked={data.closeSituation} onChange={(e) => update("closeSituation", e.target.checked)} />상황 종료합니다.</label></div>}
      </section>
    </main></div>
  );
}

function Field({ label, include, onInclude, children }) {
  return <div className="field"><div className="field-head"><label>{label}</label>{typeof include === "boolean" && <label className="include"><input type="checkbox" checked={include} onChange={(e) => onInclude(e.target.checked)} />대응 정리에 포함</label>}</div>{children}</div>;
}
