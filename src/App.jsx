import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'ert-response-v2-multi-final-v1'

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const createReport = () => ({
  id: createId(),
  included: true,
  content: '',
})

const createIncident = (id = createId()) => ({
  id,
  title: '',
  phenomenon: '',
  includePhenomenon: true,
  ph: '',
  leakAmount: '',
  leakRate: '',
  includeProperty: true,
  includePatient: true,
  noContact: true,
  inhalationCount: '',
  contactCount: '',
  patientDetails: '',
  workDetails: '',
  workNone: true,
  includeWork: true,
  gasAlarm: false,
  gasDraft: {
    mode: 'single',
    sourceType: 'unit',
    unitNo: '',
    target: '',
    grade: 'A',
    value: '',
    unit: 'ppm',
    extraCount: '',
  },
  reports: [createReport()],
  history: [],
  endEnabled: false,
  requestAnalysis: false,
  situationEnd: false,
})

const createInitialState = () => {
  const incidents = [createIncident(), createIncident(), createIncident()]
  return {
    activeId: incidents[0].id,
    incidents,
  }
}

const normalizeState = (raw) => {
  if (!raw || !Array.isArray(raw.incidents)) return createInitialState()

  const incidents = raw.incidents.map((incident) => ({
    ...createIncident(incident.id || createId()),
    ...incident,
    id: incident.id || createId(),
    workNone:
      typeof incident.workNone === 'boolean'
        ? incident.workNone
        : !String(incident.workDetails || '').trim(),
    gasDraft: {
      ...createIncident().gasDraft,
      ...(incident.gasDraft || {}),
    },
    reports:
      Array.isArray(incident.reports) && incident.reports.length > 0
        ? incident.reports.map((report) => ({
            ...createReport(),
            ...report,
            id: report.id || createId(),
          }))
        : [createReport()],
    history: Array.isArray(incident.history) ? incident.history : [],
  }))

  while (incidents.length < 3) incidents.push(createIncident())

  const activeExists = incidents.some((incident) => incident.id === raw.activeId)
  return {
    activeId: activeExists ? raw.activeId : incidents[0].id,
    incidents,
  }
}

const GENERAL_TEMPLATES = [
  {
    id: 'control-line',
    label: '통제라인 구축',
    build: () => '통제라인 구축',
  },
  {
    id: 'unknown-liquid',
    label: '미상의 액상 (고임/맺힘) 확인',
    fields: [
      {
        key: 'state',
        label: '액상 상태',
        type: 'select',
        options: ['고임', '맺힘'],
      },
    ],
    build: (values) => `미상의 액상 ${values.state} 확인`,
  },
  {
    id: 'ppe-check',
    label: '보호구 착용 후 확인 예정',
    build: () => '보호구 착용 후 확인 예정',
  },
  {
    id: 'ppe-entry',
    label: '보호구 (A/B/C/D)등급 착용 후 현장 진입 실시',
    fields: [
      {
        key: 'grade',
        label: '보호구 등급',
        type: 'select',
        options: ['A', 'B', 'C', 'D'],
      },
    ],
    build: (values) => `보호구 ${values.grade}등급 착용 후 현장 진입 실시`,
  },
  {
    id: 'unit-defect',
    label: '[]호기 []결함 확인',
    fields: [
      { key: 'unitNo', label: '호기', type: 'text', placeholder: '예: GCS 3', uppercase: true },
      { key: 'defect', label: '결함 내용', type: 'text', placeholder: '예: Valve ' },
    ],
    build: (values) => `${values.unitNo}호기 ${values.defect}결함 확인`,
  },
  {
    id: 'pipe-defect',
    label: '[]배관 []결함 확인',
    fields: [
      { key: 'pipe', label: '배관명', type: 'text', placeholder: '예: PCW ', uppercase: true },
      { key: 'defect', label: '결함 내용', type: 'text', placeholder: '예: Flange ' },
    ],
    build: (values) => `${values.pipe}배관 ${values.defect}결함 확인`,
  },
  {
    id: 'decontamination',
    label: '[] 오염부 제거 및 제수 작업 (실시/완료)',
    fields: [
      { key: 'target', label: '대상 또는 위치', type: 'text', placeholder: '예: 바닥 ' },
      {
        key: 'status',
        label: '작업 상태',
        type: 'select',
        options: ['실시', '완료'],
      },
    ],
    build: (values) => `${values.target} 오염부 제거 및 제수 작업 ${values.status}`,
  },
  {
    id: 'no-more-defect',
    label: '추가 결함 없음 확인',
    build: () => '추가 결함 없음 확인',
  },
  {
    id: 'temperature-humidity',
    label: '온/습도 확인 결과 []',
    fields: [
      {
        key: 'result',
        label: '온·습도 결과',
        type: 'text',
        placeholder: '예: 23℃ / 45%',
      },
    ],
    build: (values) => `온/습도 확인 결과 ${values.result}`,
  },
  {
    id: 'valve-block',
    label: 'Valve 차단 (실시/후 확인 시 (특이사항 없음/[]))',
    fields: [
      {
        key: 'timing',
        label: '차단 상태',
        type: 'select',
        options: ['실시', '후 확인 시'],
      },
      {
        key: 'resultType',
        label: '확인 결과',
        type: 'select',
        options: ['특이사항 없음', '직접 입력'],
        showWhen: (values) => values.timing === '후 확인 시',
      },
      {
        key: 'result',
        label: '확인 결과 직접 입력',
        type: 'text',
        placeholder: '확인 결과 입력',
        showWhen: (values) =>
          values.timing === '후 확인 시' && values.resultType === '직접 입력',
      },
    ],
    build: (values) => {
      if (values.timing === '실시') return 'Valve 차단 실시'
      const result =
        values.resultType === '직접 입력' ? values.result : '특이사항 없음'
      return `Valve 차단 후 확인 시 ${result}`
    },
  },
  {
    id: 'environment-clear',
    label: '주변 환경 측정 시 [](ppm/ppb/%LEL)으로 특이사항 없음',
    fields: [
      { key: 'value', label: '측정 수치', type: 'text', placeholder: '예: 0' },
      {
        key: 'unit',
        label: '단위',
        type: 'select',
        options: ['ppm', 'ppb', '%LEL'],
      },
    ],
    build: (values) =>
      `주변 환경 측정 시 ${values.value} ${values.unit}으로 특이사항 없음`,
  },
]

const GAS_TEMPLATES = [
  {
    id: 'detector-reading',
    label: '[]감지기 측정 시 [](ppm/ppb/%LEL) 확인',
    fields: [
      { key: 'detector', label: '감지기명', type: 'text', placeholder: '예: NH3 ' },
      { key: 'value', label: '측정 수치', type: 'text', placeholder: '예: 12' },
      {
        key: 'unit',
        label: '단위',
        type: 'select',
        options: ['ppm', 'ppb', '%LEL'],
      },
    ],
    build: (values) =>
      `${values.detector}감지기 측정 시 ${values.value} ${values.unit} 확인`,
  },
  {
    id: 'chem-cassette',
    label: '주변 환경 측정 시 [](ppm/ppb/%LEL) 및 Chem Cassete 변색 확인',
    fields: [
      { key: 'value', label: '측정 수치', type: 'text', placeholder: '예: 0' },
      {
        key: 'unit',
        label: '단위',
        type: 'select',
        options: ['ppm', 'ppb', '%LEL'],
      },
    ],
    build: (values) =>
      `주변 환경 측정 시 ${values.value} ${values.unit} 및 Chem Cassete 변색 확인`,
  },
  {
    id: 'ultrasonic-gpd',
    label: '초음파 카메라 및 GPD-100 [카트리지]감지기 측정 시 특이사항 없음',
    fields: [
      {
        key: 'cartridge',
        label: '카트리지',
        type: 'text',
        placeholder: '예: NH3 ',
      },
    ],
    build: (values) =>
      `초음파 카메라 및 GPD-100 ${values.cartridge}감지기 측정 시 특이사항 없음`,
  },
  {
    id: 'calibration-request',
    label: 'LP E&C 감지기 검교정 요청 실시',
    build: () => 'LP E&C 감지기 검교정 요청 실시',
  },
  {
    id: 'smcs-trend',
    label:
      'SMCS Trend 확인 시 수치 [](ppm/ppb/%LEL)으로 (상승하였습니다/하락하였습니다/유지중입니다)',
    fields: [
      { key: 'value', label: '측정 수치', type: 'text', placeholder: '예: 12' },
      {
        key: 'unit',
        label: '단위',
        type: 'select',
        options: ['ppm', 'ppb', '%LEL'],
      },
      {
        key: 'trend',
        label: '변화 상태',
        type: 'select',
        options: ['상승하였습니다', '하락하였습니다', '유지중입니다'],
      },
    ],
    build: (values) =>
      `SMCS Trend 확인 시 수치 ${values.value} ${values.unit}으로 ${values.trend}`,
  },
]

const getDefaultValues = (template) => {
  const values = {}
  ;(template.fields || []).forEach((field) => {
    if (field.type === 'select') values[field.key] = field.options[0]
    else values[field.key] = ''
  })
  return values
}

const getVisibleTemplates = (gasAlarm) => {
  if (!gasAlarm) return GENERAL_TEMPLATES
  return [
    ...GENERAL_TEMPLATES.slice(0, 4),
    ...GAS_TEMPLATES,
    ...GENERAL_TEMPLATES.slice(4),
  ]
}

const appendLine = (original, text) => {
  const cleanText = text.trim()
  if (!cleanText) return original
  const cleanOriginal = original.trimEnd()
  return cleanOriginal ? `${cleanOriginal}\n${cleanText}` : cleanText
}

const uniqueLines = (texts) => {
  const seen = new Set()
  const result = []

  texts.forEach((text) => {
    String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        if (!seen.has(line)) {
          seen.add(line)
          result.push(line)
        }
      })
  })

  return result
}

const formatMultilineField = (label, text) => {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())

  if (!lines.length) return []
  return [`-. ${label}: ${lines[0].trim()}`, ...lines.slice(1)]
}

const buildPatientLines = (incident) => {
  if (!incident.includePatient) return []
  if (incident.noContact) return ['-. 환자 여부: 접촉자 없음']

  const patientTypes = []
  if (String(incident.inhalationCount).trim()) {
    patientTypes.push(`흡입환자 ${String(incident.inhalationCount).trim()}명`)
  }
  if (String(incident.contactCount).trim()) {
    patientTypes.push(`접촉환자 ${String(incident.contactCount).trim()}명`)
  }

  const details = String(incident.patientDetails || '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())

  const lines = []
  if (patientTypes.length) {
    lines.push(`-. 환자 여부: ${patientTypes.join(' / ')} 발생`)
  } else if (details.length) {
    lines.push(`-. 환자 여부: ${details[0].trim()}`)
    details.shift()
  }

  lines.push(...details)
  return lines
}

const buildFinalText = (incident) => {
  const title = incident.title.trim() || '출동 위치'
  const commonLines = []

  if (incident.includePhenomenon) {
    commonLines.push(...formatMultilineField('현상', incident.phenomenon))
  }
  if (incident.includeProperty) {
    const propertyParts = []
    if (String(incident.ph || '').trim()) {
      propertyParts.push(`pH ${String(incident.ph).trim()}`)
    }
    if (String(incident.leakAmount || '').trim()) {
      propertyParts.push(String(incident.leakAmount).trim())
    }
    if (String(incident.leakRate || '').trim()) {
      propertyParts.push(String(incident.leakRate).trim())
    }
    if (propertyParts.length) {
      commonLines.push(`-. 성상: ${propertyParts.join(', ')}`)
    }
  }
  commonLines.push(...buildPatientLines(incident))
  if (incident.includeWork && !incident.workNone) {
    commonLines.push(...formatMultilineField('작업사항', incident.workDetails))
  }

  const responseLines = uniqueLines(
    incident.reports.filter((report) => report.included).map((report) => report.content),
  )

  const lines = [`[${title}]`]
  if (commonLines.length) lines.push(...commonLines)

  if (responseLines.length) {
    if (commonLines.length) lines.push('')
    lines.push('-. 대응 내용')
    responseLines.forEach((line, index) => lines.push(`${index + 1}. ${line}`))
  }

  const endLines = []
  if (incident.endEnabled && incident.requestAnalysis) {
    endLines.push('-. 원인분석 및 재발방지대책 요청하겠습니다.')
  }
  if (incident.endEnabled && incident.situationEnd) {
    endLines.push('**상황 종료합니다.')
  }

  if (endLines.length) {
    lines.push('')
    lines.push(...endLines)
  }

  return lines.join('\n')
}

const copyText = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function TemplateEditor({ template, onApply, onCancel }) {
  const [values, setValues] = useState(() => getDefaultValues(template))

  useEffect(() => {
    setValues(getDefaultValues(template))
  }, [template])

  const visibleFields = (template.fields || []).filter(
    (field) => !field.showWhen || field.showWhen(values),
  )

  const apply = () => {
    const missing = visibleFields.find(
      (field) => field.type !== 'select' && !String(values[field.key] || '').trim(),
    )

    if (missing) {
      window.alert(`${missing.label} 값을 입력해 주세요.`)
      return
    }

    const result = template.build(values).replace(/\s+/g, ' ').trim()
    onApply(result)
  }

  return (
    <div className="template-editor">
      <div className="template-editor-title">문구 완성</div>
      <div className="template-preview-label">선택 문구</div>
      <div className="template-source">{template.label}</div>

      <div className="template-field-grid">
        {visibleFields.map((field) => (
          <label className="field-stack" key={field.key}>
            <span>{field.label}</span>
            {field.type === 'select' ? (
              <select
                value={values[field.key]}
                onChange={(event) =>
                  setValues((previous) => ({
                    ...previous,
                    [field.key]: event.target.value,
                  }))
                }
              >
                {field.options.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={values[field.key]}
                placeholder={field.placeholder || ''}
                onChange={(event) => {
                  const nextValue = field.uppercase
                    ? event.target.value.toUpperCase()
                    : event.target.value
                  setValues((previous) => ({
                    ...previous,
                    [field.key]: nextValue,
                  }))
                }}
              />
            )}
          </label>
        ))}
      </div>

      <div className="template-editor-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          취소
        </button>
        <button type="button" className="primary-button" onClick={apply}>
          입력창에 추가
        </button>
      </div>
    </div>
  )
}

function GasAlarmBuilder({ incident, updateCurrent }) {
  const draft = incident.gasDraft

  const updateDraft = (key, value) => {
    updateCurrent((current) => ({
      ...current,
      gasDraft: {
        ...current.gasDraft,
        [key]: value,
      },
    }))
  }

  const confirmGasPhenomenon = () => {
    if (draft.sourceType === 'unit' && !String(draft.unitNo).trim()) {
      window.alert('호기 번호를 입력해 주세요.')
      return
    }
    if (!String(draft.target).trim()) {
      window.alert('Alarm 대상 또는 물질을 입력해 주세요.')
      return
    }
    if (!String(draft.value).trim()) {
      window.alert('측정 수치를 입력해 주세요.')
      return
    }
    if (draft.mode === 'multiple' && !String(draft.extraCount).trim()) {
      window.alert('추가 발생 건수를 입력해 주세요.')
      return
    }

    const source =
      draft.sourceType === 'unit'
        ? `${String(draft.unitNo).trim()}호기`
        : '환경감지기'

    const base = `${source} ${String(draft.target).trim()} ${draft.grade}급 ${String(
      draft.value,
    ).trim()} ${draft.unit} Alarm`

    const sentence =
      draft.mode === 'multiple'
        ? `${base} 외 ${String(draft.extraCount).trim()} 건 발생`
        : base

    updateCurrent((current) => ({
      ...current,
      phenomenon: sentence,
    }))
  }

  return (
    <div className="gas-builder">
      <div className="gas-builder-heading">
        <div>
          <strong>Gas Alarm 현상 자동작성</strong>
          <p>확인 후 현상 입력창에서 전체 문장을 다시 수정할 수 있습니다.</p>
        </div>
      </div>

      <div className="segmented-control" aria-label="Gas Alarm 발생 유형">
        <button
          type="button"
          className={draft.mode === 'single' ? 'active' : ''}
          onClick={() => updateDraft('mode', 'single')}
        >
          단발
        </button>
        <button
          type="button"
          className={draft.mode === 'multiple' ? 'active' : ''}
          onClick={() => updateDraft('mode', 'multiple')}
        >
          다발
        </button>
      </div>

      <div className="gas-input-grid">
        <label className="field-stack">
          <span>발생 위치</span>
          <select
            value={draft.sourceType}
            onChange={(event) => updateDraft('sourceType', event.target.value)}
          >
            <option value="unit">호기</option>
            <option value="environment">환경감지기</option>
          </select>
        </label>

        {draft.sourceType === 'unit' && (
          <label className="field-stack">
            <span>호기 번호</span>
            <input
              value={draft.unitNo}
              placeholder="예: 3"
              onChange={(event) => updateDraft('unitNo', event.target.value.toUpperCase())}
            />
          </label>
        )}

        <label className="field-stack">
          <span>Alarm 대상·물질</span>
          <input
            value={draft.target}
            placeholder="예: NH3"
            onChange={(event) => updateDraft('target', event.target.value)}
          />
        </label>

        <label className="field-stack">
          <span>Alarm 등급</span>
          <select
            value={draft.grade}
            onChange={(event) => updateDraft('grade', event.target.value)}
          >
            {['A', 'B', 'C', 'D'].map((grade) => (
              <option value={grade} key={grade}>
                {grade}급
              </option>
            ))}
          </select>
        </label>

        <label className="field-stack">
          <span>측정 수치</span>
          <input
            value={draft.value}
            placeholder="예: 12"
            onChange={(event) => updateDraft('value', event.target.value)}
          />
        </label>

        <label className="field-stack">
          <span>단위</span>
          <select
            value={draft.unit}
            onChange={(event) => updateDraft('unit', event.target.value)}
          >
            {['ppm', 'ppb', '%LEL'].map((unit) => (
              <option value={unit} key={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>

        {draft.mode === 'multiple' && (
          <label className="field-stack">
            <span>추가 발생 건수</span>
            <input
              value={draft.extraCount}
              placeholder="예: 2"
              onChange={(event) => updateDraft('extraCount', event.target.value)}
            />
          </label>
        )}
      </div>

      <button type="button" className="primary-button full-button" onClick={confirmGasPhenomenon}>
        확인 후 현상에 입력
      </button>
    </div>
  )
}

function ReportCard({
  incident,
  report,
  updateReport,
  deleteReport,
  appendToReport,
  syncHistory,
  notify,
}) {
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const visibleTemplates = getVisibleTemplates(incident.gasAlarm)
  const title = incident.title.trim() || '출동 위치'

  const selectTemplate = (template) => {
    if (!template.fields?.length) {
      appendToReport(report.id, template.build({}))
      return
    }
    setSelectedTemplate(template)
  }

  const copyReport = async () => {
    const text = `[${title}]${report.content.trim() ? `\n${report.content.trim()}` : ''}`
    await copyText(text)
    syncHistory(report.content)
    notify('개별 중간보고를 복사했습니다.')
  }

  return (
    <article className="card report-card">
      <div className="report-header">
        <label className="checkbox-label strong-check">
          <input
            type="checkbox"
            checked={report.included}
            onChange={(event) => updateReport(report.id, { included: event.target.checked })}
          />
          <span>대응 정리에 포함</span>
        </label>
        <button
          type="button"
          className="danger-ghost-button"
          onClick={() => deleteReport(report.id)}
          disabled={incident.reports.length === 1}
        >
          삭제
        </button>
      </div>

      <div className="report-location">[{title}]</div>

      <textarea
        className="large-textarea"
        value={report.content}
        placeholder="대응 내용을 직접 입력하거나 아래 목록에서 문구를 추가하세요."
        onChange={(event) => updateReport(report.id, { content: event.target.value })}
        onBlur={() => syncHistory(report.content)}
      />

      <details className="picker-panel">
        <summary>자주 쓰는 대응 문구</summary>
        <div className="template-list">
          {visibleTemplates.map((template) => (
            <div className="template-option" key={template.id}>
              <button
                type="button"
                className={`template-select-button ${
                  GAS_TEMPLATES.some((item) => item.id === template.id)
                    ? 'gas-template'
                    : ''
                }`}
                onClick={() => selectTemplate(template)}
              >
                {template.label}
              </button>

              {selectedTemplate?.id === template.id && (
                <TemplateEditor
                  template={selectedTemplate}
                  onCancel={() => setSelectedTemplate(null)}
                  onApply={(text) => {
                    appendToReport(report.id, text)
                    setSelectedTemplate(null)
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </details>

      {incident.history.length > 0 && (
        <details className="picker-panel history-panel">
          <summary>같은 출동 사용 이력 ({incident.history.length})</summary>
          <div className="template-list">
            {incident.history.map((historyItem) => (
              <button
                type="button"
                className="history-item-button"
                onClick={() => appendToReport(report.id, historyItem)}
                key={historyItem}
              >
                {historyItem}
              </button>
            ))}
          </div>
        </details>
      )}


      <div className="report-actions">
        <button type="button" className="secondary-button" onClick={copyReport}>
          개별 보고 복사
        </button>
      </div>
    </article>
  )
}

function App() {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? normalizeState(JSON.parse(saved)) : createInitialState()
    } catch {
      return createInitialState()
    }
  })
  const [toast, setToast] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const activeIncident =
    state.incidents.find((incident) => incident.id === state.activeId) || state.incidents[0]

  const notify = (message) => setToast(message)

  const updateCurrent = (updater) => {
    setState((previous) => ({
      ...previous,
      incidents: previous.incidents.map((incident) => {
        if (incident.id !== previous.activeId) return incident
        return typeof updater === 'function' ? updater(incident) : { ...incident, ...updater }
      }),
    }))
  }

  const addIncident = () => {
    const incident = createIncident()
    setState((previous) => ({
      activeId: incident.id,
      incidents: [...previous.incidents, incident],
    }))
  }

  const deleteIncident = (id) => {
    if (state.incidents.length <= 3) return
    const index = state.incidents.findIndex((incident) => incident.id === id)
    if (index < 0) return
    if (!window.confirm('이 출동 건과 저장된 내용을 삭제할까요?')) return

    setState((previous) => {
      const remaining = previous.incidents.filter((incident) => incident.id !== id)
      let activeId = previous.activeId
      if (previous.activeId === id) {
        activeId = remaining[Math.min(index, remaining.length - 1)].id
      }
      return { activeId, incidents: remaining }
    })
  }

  const resetCurrent = () => {
    if (!window.confirm('현재 선택한 출동의 모든 내용과 사용 이력을 초기화할까요?')) return
    updateCurrent((incident) => createIncident(incident.id))
  }

  const updateReport = (reportId, patch) => {
    updateCurrent((incident) => ({
      ...incident,
      reports: incident.reports.map((report) =>
        report.id === reportId ? { ...report, ...patch } : report,
      ),
    }))
  }

  const addReport = () => {
    updateCurrent((incident) => ({
      ...incident,
      reports: [...incident.reports, createReport()],
    }))
  }

  const deleteReport = (reportId) => {
    if (activeIncident.reports.length <= 1) return
    if (!window.confirm('이 중간보고를 삭제할까요?')) return
    updateCurrent((incident) => ({
      ...incident,
      reports: incident.reports.filter((report) => report.id !== reportId),
    }))
  }

  const addHistoryItems = (incident, text) => {
    const lines = uniqueLines([text])
    if (!lines.length) return incident

    const nextHistory = [...incident.history]
    lines.forEach((line) => {
      const oldIndex = nextHistory.indexOf(line)
      if (oldIndex >= 0) nextHistory.splice(oldIndex, 1)
      nextHistory.unshift(line)
    })

    return {
      ...incident,
      history: nextHistory.slice(0, 60),
    }
  }

  const appendToReport = (reportId, text) => {
    updateCurrent((incident) => {
      const withHistory = addHistoryItems(incident, text)
      return {
        ...withHistory,
        reports: withHistory.reports.map((report) =>
          report.id === reportId
            ? { ...report, content: appendLine(report.content, text) }
            : report,
        ),
      }
    })
  }

  const syncHistory = (text) => {
    updateCurrent((incident) => addHistoryItems(incident, text))
  }

  const finalText = useMemo(() => buildFinalText(activeIncident), [activeIncident])

  const copyFinal = async () => {
    await copyText(finalText)
    activeIncident.reports.forEach((report) => {
      if (report.included) syncHistory(report.content)
    })
    notify('대응 정리를 복사했습니다.')
  }

  return (
    <div className="app-shell">
      <header className="hero-card card">
        <div>
          <p className="eyebrow">ERT RESPONSE REPORT</p>
          <h1>출동 대응 보고 작성</h1>
          <p>작성 내용은 현재 기기에 자동 저장됩니다.</p>
        </div>
        <button type="button" className="reset-button" onClick={resetCurrent}>
          전체 초기화
          <small>현재 출동만</small>
        </button>
      </header>

      <section className="incident-tabs-card card">
        <div className="section-heading compact-heading">
          <div>
            <h2>출동 선택</h2>
            <p>최소 3건을 유지하며 각 출동은 독립적으로 저장됩니다.</p>
          </div>
          <button type="button" className="add-incident-button" onClick={addIncident}>
            + 출동 추가
          </button>
        </div>

        <div className="incident-tabs">
          {state.incidents.map((incident, index) => (
            <div
              className={`incident-tab ${incident.id === state.activeId ? 'active' : ''}`}
              key={incident.id}
            >
              <button
                type="button"
                className="incident-select"
                onClick={() => setState((previous) => ({ ...previous, activeId: incident.id }))}
              >
                {index + 1}
              </button>
              {state.incidents.length > 3 && (
                <button
                  type="button"
                  className="incident-delete"
                  aria-label={`${index + 1}번 출동 삭제`}
                  onClick={() => deleteIncident(incident.id)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <main>
        <section className="card common-card">
          <div className="section-heading">
            <div>
              <p className="section-index">현재 출동 {state.incidents.findIndex((item) => item.id === activeIncident.id) + 1}</p>
              <h2>공통정보</h2>
            </div>
          </div>

          <div className="common-fields">
            <label className="field-stack">
              <span>제목 · 출동 위치</span>
              <input
                value={activeIncident.title}
                placeholder="예: 그린1동 1F H23기둥"
                onChange={(event) =>
                  updateCurrent({ title: event.target.value.toUpperCase() })
                }
              />
              <small>영문은 자동으로 대문자로 변환됩니다.</small>
            </label>

            <div className="common-field-block">
              <div className="field-title-row">
                <span>현상</span>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={activeIncident.includePhenomenon}
                    onChange={(event) =>
                      updateCurrent({ includePhenomenon: event.target.checked })
                    }
                  />
                  대응 정리에 포함
                </label>
              </div>
              <textarea
                value={activeIncident.phenomenon}
                placeholder="현상을 입력하세요."
                onChange={(event) => updateCurrent({ phenomenon: event.target.value })}
              />

              <label className="gas-toggle">
                <input
                  type="checkbox"
                  checked={activeIncident.gasAlarm}
                  onChange={(event) => updateCurrent({ gasAlarm: event.target.checked })}
                />
                <span>
                  <strong>Gas Alarm</strong>
                  <small>체크하면 현상 자동작성과 전용 대응 문구 5개가 활성화됩니다.</small>
                </span>
              </label>

              {activeIncident.gasAlarm && (
                <GasAlarmBuilder incident={activeIncident} updateCurrent={updateCurrent} />
              )}
            </div>

            <div className="common-field-block">
              <div className="field-title-row">
                <span>성상</span>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={activeIncident.includeProperty}
                    onChange={(event) => updateCurrent({ includeProperty: event.target.checked })}
                  />
                  대응 정리에 포함
                </label>
              </div>
              <div className="property-grid">
                <label className="mini-field">
                  <span>pH</span>
                  <input
                    type="text"
                    value={activeIncident.ph}
                    placeholder="예: 3"
                    onChange={(event) => updateCurrent({ ph: event.target.value })}
                  />
                </label>

                <label className="mini-field">
                  <span>Leak량</span>
                  <input
                    type="text"
                    value={activeIncident.leakAmount}
                    placeholder="예: 10L"
                    onChange={(event) =>
                      updateCurrent({ leakAmount: event.target.value })
                    }
                  />
                </label>

                <label className="mini-field wide-on-mobile">
                  <span>Leak속도</span>
                  <input
                    type="text"
                    value={activeIncident.leakRate}
                    placeholder="예: 초당 1방울"
                    onChange={(event) =>
                      updateCurrent({ leakRate: event.target.value })
                    }
                  />
                </label>
              </div>
            </div>

            <div className="common-field-block">
              <div className="field-title-row">
                <span>환자 여부</span>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={activeIncident.includePatient}
                    onChange={(event) => updateCurrent({ includePatient: event.target.checked })}
                  />
                  대응 정리에 포함
                </label>
              </div>

              <label className="no-contact-toggle">
                <input
                  type="checkbox"
                  checked={activeIncident.noContact}
                  onChange={(event) => updateCurrent({ noContact: event.target.checked })}
                />
                접촉자 없음
              </label>

              {!activeIncident.noContact && (
                <div className="patient-detail-box">
                  <div className="patient-count-grid">
                    <label className="inline-count-field">
                      <span>흡입환자</span>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={activeIncident.inhalationCount}
                        onChange={(event) =>
                          updateCurrent({ inhalationCount: event.target.value })
                        }
                      />
                      <span>명</span>
                    </label>
                    <label className="inline-count-field">
                      <span>접촉환자</span>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={activeIncident.contactCount}
                        onChange={(event) =>
                          updateCurrent({ contactCount: event.target.value })
                        }
                      />
                      <span>명</span>
                    </label>
                  </div>

                  <label className="field-stack">
                    <span>환자 상세정보</span>
                    <textarea
                      className="patient-textarea"
                      value={activeIncident.patientDetails}
                      placeholder="소속, 성명, 연락처, 접촉 부위, 상태, 조치 내용 등을 자유롭게 입력하세요."
                      onChange={(event) =>
                        updateCurrent({ patientDetails: event.target.value })
                      }
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="common-field-block">
              <div className="field-title-row">
                <span>작업사항</span>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={activeIncident.includeWork}
                    onChange={(event) => updateCurrent({ includeWork: event.target.checked })}
                  />
                  대응 정리에 포함
                </label>
              </div>

              <label className="no-contact-toggle">
                <input
                  type="checkbox"
                  checked={activeIncident.workNone}
                  onChange={(event) => updateCurrent({ workNone: event.target.checked })}
                />
                없음
              </label>

              {!activeIncident.workNone && (
                <textarea
                  value={activeIncident.workDetails}
                  placeholder="작업 내용, 진행사항, 특이사항 등을 자유롭게 입력하세요."
                  onChange={(event) => updateCurrent({ workDetails: event.target.value })}
                />
              )}
            </div>
          </div>
        </section>

        <section className="reports-section">
          <div className="section-heading reports-heading">
            <div>
              <p className="section-index">SITUATION REPORT</p>
              <h2>상황별 중간보고</h2>
              <p>문구를 여러 개 선택하면 같은 입력창 아래에 순서대로 누적됩니다.</p>
            </div>
          </div>

          <div className="reports-list">
            {activeIncident.reports.map((report) => (
              <ReportCard
                incident={activeIncident}
                report={report}
                updateReport={updateReport}
                deleteReport={deleteReport}
                appendToReport={appendToReport}
                syncHistory={syncHistory}
                notify={notify}
                key={report.id}
              />
            ))}
          </div>

          <button
            type="button"
            className="primary-button add-report-bottom-button"
            onClick={addReport}
          >
            + 중간보고 추가
          </button>
        </section>

        <section className="card summary-card">
          <div className="section-heading">
            <div>
              <p className="section-index">FINAL SUMMARY</p>
              <h2>대응 정리</h2>
              <p>체크된 보고만 모으고 같은 문장은 최초 한 번만 표시합니다.</p>
            </div>
          </div>

          <div className="end-options">
            <label className="checkbox-label strong-check">
              <input
                type="checkbox"
                checked={activeIncident.endEnabled}
                onChange={(event) =>
                  updateCurrent({
                    endEnabled: event.target.checked,
                    requestAnalysis: event.target.checked
                      ? activeIncident.requestAnalysis
                      : false,
                    situationEnd: event.target.checked
                      ? activeIncident.situationEnd
                      : false,
                  })
                }
              />
              종료
            </label>

            {activeIncident.endEnabled && (
              <div className="end-detail-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={activeIncident.requestAnalysis}
                    onChange={(event) =>
                      updateCurrent({ requestAnalysis: event.target.checked })
                    }
                  />
                  원인분석 및 재발방지대책 요청하겠습니다.
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={activeIncident.situationEnd}
                    onChange={(event) =>
                      updateCurrent({ situationEnd: event.target.checked })
                    }
                  />
                  상황 종료합니다.
                </label>
              </div>
            )}
          </div>

          <pre className="summary-preview">{finalText}</pre>

          <button type="button" className="copy-final-button" onClick={copyFinal}>
            대응 정리 전체 복사
          </button>
        </section>
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export default App
