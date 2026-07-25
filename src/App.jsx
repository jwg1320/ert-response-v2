import { useEffect, useMemo, useState } from "react";
import "./App.css";

const STORAGE_KEY = "ert-response-v2";

const createId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const createResponse = () => ({
  id: createId(),
  included: true,
  text: "",
});

const createInitialData = () => ({
  title: "",
  phenomenon: "",
  ph: "",
  leakAmount: "",
  leakRate: "",
  noContact: true,
  patient: "",
  gasAlarm: false,
  responses: [createResponse()],
  isEnded: false,
  requestAnalysis: false,
  closeSituation: false,
});

const GENERAL_TEMPLATES = [
  {
    id: "control-line",
    label: "통제라인 구축",
    fields: [],
    build: () => "통제라인 구축",
  },
  {
    id: "unknown-liquid",
    label: "미상의 액상 (고임/맺힘) 확인",
    fields: [
      {
        key: "state",
        label: "액상 상태",
        type: "select",
        options: ["고임", "맺힘"],
      },
    ],
    build: ({ state }) => `미상의 액상 ${state || "고임"} 확인`,
  },
  {
    id: "ppe-check",
    label: "보호구 착용 후 확인 예정",
    fields: [],
    build: () => "보호구 착용 후 확인 예정",
  },
  {
    id: "ppe-entry",
    label: "보호구 (A/B/C/D)등급 착용 후 현장 진입 실시",
    fields: [
      {
        key: "grade",
        label: "보호구 등급",
        type: "select",
        options: ["A", "B", "C", "D"],
      },
    ],
    build: ({ grade }) =>
      `보호구 ${grade || "A"}등급 착용 후 현장 진입 실시`,
  },
  {
    id: "equipment-defect",
    label: "[]호기 []결함 확인",
    fields: [
      {
        key: "unit",
        label: "호기",
        type: "text",
        placeholder: "예: 1 또는 A-01",
      },
      {
        key: "defect",
        label: "결함",
        type: "text",
        placeholder: "예: Valve",
      },
    ],
    build: ({ unit, defect }) =>
      `${unit || "[]"}호기 ${defect || "[]"}결함 확인`,
  },
  {
    id: "pipe-defect",
    label: "[]배관 []결함 확인",
    fields: [
      {
        key: "pipe",
        label: "배관",
        type: "text",
        placeholder: "예: PCW 또는 NH3",
      },
      {
        key: "defect",
        label: "결함",
        type: "text",
        placeholder: "예: 플랜지 Leak",
      },
    ],
    build: ({ pipe, defect }) =>
      `${pipe || "[]"}배관 ${defect || "[]"}결함 확인`,
  },
  {
    id: "decontamination",
    label: "[] 오염부 제거 및 제수 작업 (실시/완료)",
    fields: [
      {
        key: "target",
        label: "대상 또는 위치",
        type: "text",
        placeholder: "예: 바닥",
      },
      {
        key: "state",
        label: "진행 상태",
        type: "select",
        options: ["실시", "완료"],
      },
    ],
    build: ({ target, state }) =>
      `${target || "[]"} 오염부 제거 및 제수 작업 ${state || "실시"}`,
  },
  {
    id: "no-more-defects",
    label: "추가 결함 없음",
    fields: [],
    build: () => "추가 결함 없음",
  },
  {
    id: "temperature-humidity",
    label: "온/습도 확인 결과 []",
    fields: [
      {
        key: "result",
        label: "온·습도 결과",
        type: "text",
        placeholder: "예: 23℃ / 45%",
      },
    ],
    build: ({ result }) => `온/습도 확인 결과 ${result || "[]"}`,
  },
  {
    id: "valve-close",
    label: "Valve 차단 (실시/후 결과[])",
    fields: [
      {
        key: "mode",
        label: "구분",
        type: "select",
        options: ["실시", "후 결과"],
      },
      {
        key: "result",
        label: "차단 후 결과",
        type: "text",
        placeholder: "예: 압력 저하 확인",
        showWhen: { key: "mode", value: "후 결과" },
      },
    ],
    build: ({ mode, result }) => {
      if (mode === "후 결과") {
        return `Valve 차단 후 결과 ${result || "[]"}`;
      }

      return "Valve 차단 실시";
    },
  },
  {
    id: "environment-normal",
    label: "주변 환경 측정 시 [](ppm/ppb/%LEL)으로 특이사항 없음",
    fields: [
      {
        key: "value",
        label: "측정값",
        type: "text",
        placeholder: "예: 0",
      },
      {
        key: "unit",
        label: "단위",
        type: "select",
        options: ["ppm", "ppb", "%LEL"],
      },
    ],
    build: ({ value, unit }) =>
      `주변 환경 측정 시 ${value || "[]"}${unit || "ppm"}으로 특이사항 없음`,
  },
];

const GAS_ALARM_TEMPLATES = [
  {
    id: "detector-reading",
    label: "[]감지기 측정 시 [](ppm/ppb/%LEL) 확인",
    fields: [
      {
        key: "detector",
        label: "감지기",
        type: "text",
        placeholder: "예: NH3",
      },
      {
        key: "value",
        label: "측정값",
        type: "text",
        placeholder: "예: 10",
      },
      {
        key: "unit",
        label: "단위",
        type: "select",
        options: ["ppm", "ppb", "%LEL"],
      },
    ],
    build: ({ detector, value, unit }) =>
      `${detector || "[]"}감지기 측정 시 ${value || "[]"}${unit || "ppm"} 확인`,
  },
  {
    id: "chem-cassette",
    label: "주변 환경 측정 시 [](ppm/ppb/%LEL) 및 Chem Cassete 변색 확인",
    fields: [
      {
        key: "value",
        label: "측정값",
        type: "text",
        placeholder: "예: 0",
      },
      {
        key: "unit",
        label: "단위",
        type: "select",
        options: ["ppm", "ppb", "%LEL"],
      },
    ],
    build: ({ value, unit }) =>
      `주변 환경 측정 시 ${value || "[]"}${unit || "ppm"} 및 Chem Cassete 변색 확인`,
  },
  {
    id: "ultrasonic-gpd",
    label: "초음파 카메라 및 GPD-100 [카트리지]감지기 측정 시 특이사항 없음",
    fields: [
      {
        key: "cartridge",
        label: "카트리지",
        type: "text",
        placeholder: "예: NH3",
      },
    ],
    build: ({ cartridge }) =>
      `초음파 카메라 및 GPD-100 ${cartridge || "[카트리지]"}감지기 측정 시 특이사항 없음`,
  },
  {
    id: "calibration-request",
    label: "LP E&C 감지기 검교정 요청 실시",
    fields: [],
    build: () => "LP E&C 감지기 검교정 요청 실시",
  },
];

const normalizeData = (saved) => {
  if (!saved || typeof saved !== "object") {
    return createInitialData();
  }

  const responses = Array.isArray(saved.responses)
    ? saved.responses
        .map((response) => ({
          id: response?.id || createId(),
          included:
            typeof response?.included === "boolean"
              ? response.included
              : true,
          text: response?.text ?? "",
        }))
        .filter(Boolean)
    : [];

  return {
    title: saved.title ?? "",
    phenomenon: saved.phenomenon ?? "",
    ph: saved.ph ?? "",
    leakAmount: saved.leakAmount ?? "",
    leakRate: saved.leakRate ?? "",
    noContact:
      typeof saved.noContact === "boolean" ? saved.noContact : true,
    patient: saved.patient ?? "",
    gasAlarm: Boolean(saved.gasAlarm),
    responses: responses.length > 0 ? responses : [createResponse()],
    isEnded: Boolean(saved.isEnded),
    requestAnalysis: Boolean(saved.requestAnalysis),
    closeSituation: Boolean(saved.closeSituation),
  };
};

function App() {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? normalizeData(JSON.parse(saved)) : createInitialData();
    } catch (error) {
      console.error("V2 저장 데이터 불러오기 실패:", error);
      return createInitialData();
    }
  });

  const [openTemplateResponseId, setOpenTemplateResponseId] = useState(null);
  const [templateComposer, setTemplateComposer] = useState(null);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("V2 자동 저장 실패:", error);
    }
  }, [data]);

  const visibleTemplates = useMemo(() => {
    if (!data.gasAlarm) {
      return GENERAL_TEMPLATES;
    }

    return [
      ...GENERAL_TEMPLATES.slice(0, 4),
      ...GAS_ALARM_TEMPLATES,
      ...GENERAL_TEMPLATES.slice(4),
    ];
  }, [data.gasAlarm]);

  const selectedTemplate = useMemo(() => {
    if (!templateComposer) return null;

    return [...GENERAL_TEMPLATES, ...GAS_ALARM_TEMPLATES].find(
      (template) => template.id === templateComposer.templateId
    );
  }, [templateComposer]);

  const updateField = (field, value) => {
    setData((prev) => ({
      ...prev,
      [field]: field === "title" ? value.toUpperCase() : value,
    }));
  };

  const updateResponse = (responseId, patch) => {
    setData((prev) => ({
      ...prev,
      responses: prev.responses.map((response) =>
        response.id === responseId ? { ...response, ...patch } : response
      ),
    }));
  };

  const addResponse = () => {
    const newResponse = createResponse();

    setData((prev) => ({
      ...prev,
      responses: [...prev.responses, newResponse],
    }));

    setOpenTemplateResponseId(newResponse.id);
    setTemplateComposer(null);
  };

  const removeResponse = (responseId) => {
    setData((prev) => {
      if (prev.responses.length <= 1) return prev;

      return {
        ...prev,
        responses: prev.responses.filter(
          (response) => response.id !== responseId
        ),
      };
    });

    if (openTemplateResponseId === responseId) {
      setOpenTemplateResponseId(null);
    }

    if (templateComposer?.responseId === responseId) {
      setTemplateComposer(null);
    }
  };

  const selectTemplate = (responseId, template) => {
    if (template.fields.length === 0) {
      updateResponse(responseId, { text: template.build({}) });
      setOpenTemplateResponseId(null);
      setTemplateComposer(null);
      return;
    }

    const initialValues = {};

    template.fields.forEach((field) => {
      initialValues[field.key] =
        field.type === "select" ? field.options[0] : "";
    });

    setTemplateComposer({
      responseId,
      templateId: template.id,
      values: initialValues,
    });
  };

  const updateTemplateValue = (key, value) => {
    setTemplateComposer((prev) =>
      prev
        ? {
            ...prev,
            values: {
              ...prev.values,
              [key]: value,
            },
          }
        : prev
    );
  };

  const applyTemplate = () => {
    if (!templateComposer || !selectedTemplate) return;

    updateResponse(templateComposer.responseId, {
      text: selectedTemplate.build(templateComposer.values),
    });

    setOpenTemplateResponseId(null);
    setTemplateComposer(null);
  };

  const buildIndividualText = (response) => {
    const title = data.title.trim() || "출동 위치";
    return `[${title}]\n${response.text.trim()}`;
  };

  const buildSummaryText = () => {
    const lines = [];
    const title = data.title.trim() || "출동 위치";

    lines.push(`[${title}]`);

    if (data.phenomenon.trim()) {
      lines.push(`-. 현상: ${data.phenomenon.trim()}`);
    }

    const properties = [];

    if (data.ph.trim()) properties.push(`pH ${data.ph.trim()}`);
    if (data.leakAmount.trim()) properties.push(data.leakAmount.trim());
    if (data.leakRate.trim()) properties.push(data.leakRate.trim());

    if (properties.length > 0) {
      lines.push(`-. 성상: ${properties.join(", ")}`);
    }

    if (data.noContact) {
      lines.push("-. 환자 여부: 접촉자 없음");
    } else if (data.patient.trim()) {
      lines.push(`-. 환자 여부: ${data.patient.trim()}`);
    } else {
      lines.push("-. 환자 여부: 환자 발생");
    }

    const selectedResponses = data.responses.filter(
      (response) => response.included && response.text.trim()
    );

    if (selectedResponses.length > 0) {
      lines.push("");
      lines.push("-. 대응 내용");

      selectedResponses.forEach((response, index) => {
        lines.push(`${index + 1}. ${response.text.trim()}`);
      });
    }

    const endLines = [];

    if (data.isEnded && data.requestAnalysis) {
      endLines.push("-. 원인분석 및 재발방지대책 요청하겠습니다.");
    }

    if (data.isEnded && data.closeSituation) {
      endLines.push("**상황 종료합니다.");
    }

    if (endLines.length > 0) {
      lines.push("");
      lines.push(...endLines);
    }

    return lines.join("\n");
  };

  const copyText = async (text) => {
    if (!text.trim()) return;

    try {
      await navigator.clipboard.writeText(text);
      window.alert("보고 내용이 복사되었습니다.");
    } catch (error) {
      console.error("클립보드 복사 실패:", error);

      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      window.alert("보고 내용이 복사되었습니다.");
    }
  };

  const copyResponse = (response) => {
    if (!response.text.trim()) {
      window.alert("대응 내용을 먼저 입력해주세요.");
      return;
    }

    copyText(buildIndividualText(response));
  };

  const resetAll = () => {
    const confirmed = window.confirm("작성 중인 V2 내용을 모두 초기화할까요?");
    if (!confirmed) return;

    const initialData = createInitialData();
    setData(initialData);
    setOpenTemplateResponseId(null);
    setTemplateComposer(null);
    setShowSummary(false);
  };

  const summaryText = buildSummaryText();
  const includedCount = data.responses.filter(
    (response) => response.included && response.text.trim()
  ).length;

  return (
    <div className="app">
      <main className="container">
        <header className="top-card">
          <div>
            <p className="eyebrow">ERT RESPONSE V2</p>
            <h1>출동 대응 보고 작성</h1>
            <p className="save-guide">
              작성 내용은 현재 기기에 자동 저장됩니다.
            </p>
          </div>

          <button type="button" className="reset-button" onClick={resetAll}>
            전체 초기화
          </button>
        </header>

        <section className="card basic-card">
          <div className="section-heading">
            <div>
              <p className="section-kicker">공통 정보</p>
              <h2>출동 기본정보</h2>
            </div>

            <label className={`gas-toggle ${data.gasAlarm ? "active" : ""}`}>
              <input
                type="checkbox"
                checked={data.gasAlarm}
                onChange={(event) =>
                  updateField("gasAlarm", event.target.checked)
                }
              />
              <span>Gas Alarm</span>
            </label>
          </div>

          <div className="field">
            <label htmlFor="title">제목 · 출동 위치</label>
            <input
              id="title"
              type="text"
              placeholder="예: 그린1동 1F H23기둥"
              value={data.title}
              onChange={(event) => updateField("title", event.target.value)}
            />
            <p className="field-help">영문은 자동으로 대문자로 입력됩니다.</p>
          </div>

          <div className="field">
            <label htmlFor="phenomenon">현상</label>
            <textarea
              id="phenomenon"
              placeholder="현장 현상을 입력하세요."
              value={data.phenomenon}
              onChange={(event) =>
                updateField("phenomenon", event.target.value)
              }
            />
          </div>

          <div className="field">
            <label>성상</label>
            <div className="property-grid">
              <div className="mini-field">
                <span>pH</span>
                <input
                  type="text"
                  placeholder="예: 3"
                  value={data.ph}
                  onChange={(event) => updateField("ph", event.target.value)}
                />
              </div>

              <div className="mini-field">
                <span>Leak량</span>
                <input
                  type="text"
                  placeholder="예: 10L"
                  value={data.leakAmount}
                  onChange={(event) =>
                    updateField("leakAmount", event.target.value)
                  }
                />
              </div>

              <div className="mini-field wide-on-mobile">
                <span>Leak속도</span>
                <input
                  type="text"
                  placeholder="예: 초당 1방울"
                  value={data.leakRate}
                  onChange={(event) =>
                    updateField("leakRate", event.target.value)
                  }
                />
              </div>
            </div>
          </div>

          <div className="field patient-field">
            <div className="patient-heading">
              <label htmlFor="patient">환자 여부</label>

              <label className="no-contact-toggle">
                <input
                  type="checkbox"
                  checked={data.noContact}
                  onChange={(event) =>
                    updateField("noContact", event.target.checked)
                  }
                />
                <span>접촉자 없음</span>
              </label>
            </div>

            <textarea
              id="patient"
              className="patient-textarea"
              placeholder={
                data.noContact ? "접촉자 없음" : "환자 정보를 입력하세요."
              }
              value={data.patient}
              disabled={data.noContact}
              onChange={(event) => updateField("patient", event.target.value)}
            />
          </div>
        </section>

        <section className="card response-section">
          <div className="section-heading response-heading">
            <div>
              <p className="section-kicker">실시간 전송</p>
              <h2>상황별 대응</h2>
              <p className="section-description">
                대응마다 개별 복사하고, 체크한 항목만 마지막 대응 정리에
                포함합니다.
              </p>
            </div>

            <span className="count-badge">총 {data.responses.length}건</span>
          </div>

          <div className="response-list">
            {data.responses.map((response) => {
              const templatePanelOpen =
                openTemplateResponseId === response.id;
              const composerOpen =
                templateComposer?.responseId === response.id &&
                selectedTemplate;

              return (
                <article className="response-card" key={response.id}>
                  <div className="response-card-header">
                    <label className="include-check">
                      <input
                        type="checkbox"
                        checked={response.included}
                        onChange={(event) =>
                          updateResponse(response.id, {
                            included: event.target.checked,
                          })
                        }
                      />
                      <strong>[{data.title.trim() || "출동 위치"}]</strong>
                    </label>

                    <div className="response-actions">
                      <button
                        type="button"
                        className="small-button template-button"
                        onClick={() => {
                          const willOpen = !templatePanelOpen;
                          setOpenTemplateResponseId(
                            willOpen ? response.id : null
                          );
                          setTemplateComposer(null);
                        }}
                      >
                        문구 목록
                      </button>

                      <button
                        type="button"
                        className="small-button copy-button"
                        onClick={() => copyResponse(response)}
                      >
                        복사
                      </button>

                      {data.responses.length > 1 && (
                        <button
                          type="button"
                          className="small-button delete-button"
                          onClick={() => removeResponse(response.id)}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    className="response-textarea"
                    placeholder="대응 내용을 직접 입력하거나 문구 목록에서 불러오세요."
                    value={response.text}
                    onChange={(event) =>
                      updateResponse(response.id, { text: event.target.value })
                    }
                  />

                  {templatePanelOpen && (
                    <div className="template-panel">
                      <div className="template-panel-title">
                        <div>
                          <strong>자주 쓰는 대응 문구</strong>
                          <span>
                            선택 후 입력창에서 문장 전체를 자유롭게 수정할 수
                            있습니다.
                          </span>
                        </div>

                        {data.gasAlarm && (
                          <span className="gas-badge">Gas Alarm 포함</span>
                        )}
                      </div>

                      <div className="template-list">
                        {visibleTemplates.map((template) => {
                          const isGasTemplate = GAS_ALARM_TEMPLATES.some(
                            (item) => item.id === template.id
                          );

                          return (
                            <button
                              type="button"
                              key={template.id}
                              className={`template-item ${
                                isGasTemplate ? "gas-template" : ""
                              } ${
                                templateComposer?.templateId === template.id
                                  ? "selected"
                                  : ""
                              }`}
                              onClick={() =>
                                selectTemplate(response.id, template)
                              }
                            >
                              {isGasTemplate && <span>GAS</span>}
                              <p>{template.label}</p>
                            </button>
                          );
                        })}
                      </div>

                      {composerOpen && (
                        <div className="template-composer">
                          <div className="composer-heading">
                            <strong>{selectedTemplate.label}</strong>
                            <span>
                              필요한 값을 넣은 뒤 문구를 적용하세요. 적용 후 전체
                              수정이 가능합니다.
                            </span>
                          </div>

                          <div className="composer-fields">
                            {selectedTemplate.fields.map((field) => {
                              if (
                                field.showWhen &&
                                templateComposer.values[field.showWhen.key] !==
                                  field.showWhen.value
                              ) {
                                return null;
                              }

                              return (
                                <label className="composer-field" key={field.key}>
                                  <span>{field.label}</span>

                                  {field.type === "select" ? (
                                    <select
                                      value={
                                        templateComposer.values[field.key] || ""
                                      }
                                      onChange={(event) =>
                                        updateTemplateValue(
                                          field.key,
                                          event.target.value
                                        )
                                      }
                                    >
                                      {field.options.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      placeholder={field.placeholder || "입력"}
                                      value={
                                        templateComposer.values[field.key] || ""
                                      }
                                      onChange={(event) =>
                                        updateTemplateValue(
                                          field.key,
                                          event.target.value
                                        )
                                      }
                                    />
                                  )}
                                </label>
                              );
                            })}
                          </div>

                          <div className="composer-preview">
                            <span>입력될 문구</span>
                            <p>{selectedTemplate.build(templateComposer.values)}</p>
                          </div>

                          <div className="composer-actions">
                            <button
                              type="button"
                              className="cancel-button"
                              onClick={() => setTemplateComposer(null)}
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              className="apply-button"
                              onClick={applyTemplate}
                            >
                              문구 적용
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <button type="button" className="add-response-button" onClick={addResponse}>
            + 대응 추가
          </button>
        </section>

        <section className="card summary-section">
          <div className="section-heading summary-heading">
            <div>
              <p className="section-kicker">최종 종합</p>
              <h2>대응 정리</h2>
              <p className="section-description">
                체크된 대응 {includedCount}건을 작성 순서대로 정리합니다.
              </p>
            </div>

            <label className={`end-toggle ${data.isEnded ? "active" : ""}`}>
              <input
                type="checkbox"
                checked={data.isEnded}
                onChange={(event) => updateField("isEnded", event.target.checked)}
              />
              <span>종료</span>
            </label>
          </div>

          {data.isEnded && (
            <div className="end-options">
              <label>
                <input
                  type="checkbox"
                  checked={data.requestAnalysis}
                  onChange={(event) =>
                    updateField("requestAnalysis", event.target.checked)
                  }
                />
                <span>원인분석 및 재발방지대책 요청하겠습니다.</span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={data.closeSituation}
                  onChange={(event) =>
                    updateField("closeSituation", event.target.checked)
                  }
                />
                <span>상황 종료합니다.</span>
              </label>
            </div>
          )}

          <button
            type="button"
            className="summary-toggle-button"
            onClick={() => setShowSummary((prev) => !prev)}
          >
            {showSummary ? "대응 정리 닫기" : "대응 정리 보기"}
          </button>

          {showSummary && (
            <div className="summary-preview">
              <div className="summary-preview-header">
                <strong>최종 대응 내용</strong>
                <button type="button" onClick={() => copyText(summaryText)}>
                  전체 복사
                </button>
              </div>

              <pre>{summaryText}</pre>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
