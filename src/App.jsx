import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'ert-response-v2-multi-final-v1'

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const createTemplateDraft = (templateId = '', values = {}) => ({
  id: createId(),
  templateId,
  values,
  collapsed: false,
  generatedText: '',
})

const createReport = () => ({
  id: createId(),
  included: true,
  content: '',
  templateDrafts: [],
})

const createPatientRecord = (type = 'inhalation') => ({
  id: createId(),
  affiliation: '',
  name: '',
  ...(type === 'contact' ? { contactArea: '' } : {}),
})

const normalizePatientCountInput = (value) => {
  if (value === '') return ''
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return ''
  return String(Math.max(0, parsed))
}

const resizePatientRecords = (records, count, type) => {
  const target = Math.max(0, Number.parseInt(count, 10) || 0)
  const normalized = Array.isArray(records)
    ? records.map((record) => ({
        ...createPatientRecord(type),
        ...record,
        id: record?.id || createId(),
      }))
    : []

  while (normalized.length < target) normalized.push(createPatientRecord(type))
  return normalized.slice(0, target)
}

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
  contactPatients: [],
  inhalationPatients: [],
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
  usedQuickTemplateIds: [],
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
    contactPatients: resizePatientRecords(
      incident.contactPatients,
      incident.contactCount,
      'contact',
    ),
    inhalationPatients: resizePatientRecords(
      incident.inhalationPatients,
      incident.inhalationCount,
      'inhalation',
    ),
    reports:
      Array.isArray(incident.reports) && incident.reports.length > 0
        ? incident.reports.map((report) => ({
            ...createReport(),
            ...report,
            id: report.id || createId(),
            templateDrafts: Array.isArray(report.templateDrafts)
              ? report.templateDrafts.map((draft) => ({
                  ...createTemplateDraft(),
                  ...draft,
                  id: draft.id || createId(),
                  values:
                    draft.values && typeof draft.values === 'object'
                      ? draft.values
                      : {},
                  collapsed: Boolean(draft.collapsed),
                  generatedText: String(draft.generatedText || ''),
                }))
              : [],
          }))
        : [createReport()],
    history: Array.isArray(incident.history) ? incident.history : [],
    usedQuickTemplateIds: Array.isArray(incident.usedQuickTemplateIds)
      ? incident.usedQuickTemplateIds
      : inferQuickTemplateIds([
          ...(Array.isArray(incident.history) ? incident.history : []),
          ...(Array.isArray(incident.reports)
            ? incident.reports.map((report) => report.content)
            : []),
        ]),
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
    label: 'Valve 차단 (실시/완료/후 확인 시 [])',
    fields: [
      {
        key: 'timing',
        label: '차단 상태',
        type: 'select',
        options: ['실시', '완료', '후 확인 시'],
      },
      {
        key: 'result',
        label: '확인 결과',
        type: 'text',
        placeholder: '예: 특이사항 없음',
        showWhen: (values) => values.timing === '후 확인 시',
      },
    ],
    build: (values) =>
      values.timing === '후 확인 시'
        ? `Valve 차단 후 확인 시 ${values.result}`
        : `Valve 차단 ${values.timing}`,
  },
  {
    id: 'torque-check',
    label: 'Torque값 확인 시 [] N.m 확인 ( 기준값: [] N.m )',
    fields: [
      {
        key: 'measuredTorque',
        label: '확인 Torque값',
        type: 'text',
        placeholder: '예: 30',
      },
      {
        key: 'standardTorque',
        label: '기준값',
        type: 'text',
        placeholder: '예: 43',
      },
    ],
    build: (values) =>
      `Torque값 확인 시 ${values.measuredTorque} N.m 확인 ( 기준값: ${values.standardTorque} N.m )`,
  },
  {
    id: 'additional-tightening',
    label: '추가 증가 조임 (실시/완료) ( [] N.m → [] N.m )',
    fields: [
      {
        key: 'status',
        label: '작업 상태',
        type: 'select',
        options: ['실시', '완료'],
      },
      {
        key: 'beforeTorque',
        label: '조임 전 Torque값',
        type: 'text',
        placeholder: '예: 30',
      },
      {
        key: 'afterTorque',
        label: '조임 후 Torque값',
        type: 'text',
        placeholder: '예: 43',
      },
    ],
    build: (values) =>
      `추가 증가 조임 ${values.status} ( ${values.beforeTorque} N.m → ${values.afterTorque} N.m )`,
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


const ALL_TEMPLATES = [...GENERAL_TEMPLATES, ...GAS_TEMPLATES]

const getTemplateById = (templateId) =>
  ALL_TEMPLATES.find((template) => template.id === templateId)

const getVisibleTemplateFields = (template, values) =>
  (template.fields || []).filter(
    (field) => !field.showWhen || field.showWhen(values),
  )

const buildLiveTemplateText = (template, values = {}) => {
  const safeValues = { ...getDefaultValues(template), ...values }

  ;(template.fields || []).forEach((field) => {
    if (field.type === 'select') {
      if (!String(safeValues[field.key] || '').trim()) {
        safeValues[field.key] = field.options[0]
      }
      return
    }

    const current = String(safeValues[field.key] || '')
    safeValues[field.key] = current.trim()
      ? field.uppercase
        ? current.toUpperCase()
        : current
      : '[]'
  })

  return template.build(safeValues).replace(/\s+/g, ' ').trim()
}

const isLiveTemplateComplete = (template, values = {}) =>
  getVisibleTemplateFields(template, values).every(
    (field) =>
      field.type === 'select' || String(values[field.key] || '').trim(),
  )

const removeManagedTemplateLines = (content, drafts = []) => {
  const lines = String(content || '').split(/\r?\n/)

  drafts.forEach((draft) => {
    const target = String(draft.generatedText || '').trim()
    if (!target) return
    const index = lines.findIndex((line) => line.trim() === target)
    if (index >= 0) lines.splice(index, 1)
  })

  while (lines.length && !lines[0].trim()) lines.shift()
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  return lines
}

const rebuildReportContentFromDrafts = (
  content,
  previousDrafts = [],
  nextDrafts = [],
) => {
  const manualLines = removeManagedTemplateLines(content, previousDrafts)
  const generatedLines = nextDrafts
    .map((draft) => String(draft.generatedText || '').trim())
    .filter(Boolean)

  return [...generatedLines, ...manualLines].join('\n')
}

const QUICK_ONCE_TEMPLATE_IDS = [
  'control-line',
  'unknown-liquid',
  'ppe-check',
  'ppe-entry',
]

function inferQuickTemplateIds(texts) {
  const lines = uniqueLines(texts)
  const used = new Set()

  lines.forEach((line) => {
    if (line === '통제라인 구축') used.add('control-line')
    if (/^미상의 액상 (고임|맺힘) 확인$/.test(line)) used.add('unknown-liquid')
    if (line === '보호구 착용 후 확인 예정') used.add('ppe-check')
    if (/^보호구 [ABCD]등급 착용 후 현장 진입 실시$/.test(line)) {
      used.add('ppe-entry')
    }
  })

  return QUICK_ONCE_TEMPLATE_IDS.filter((id) => used.has(id))
}

const getVisibleTemplates = (incident) => {
  const baseTemplates = incident.gasAlarm
    ? [
        ...GENERAL_TEMPLATES.slice(0, 4),
        ...GAS_TEMPLATES,
        ...GENERAL_TEMPLATES.slice(4),
      ]
    : GENERAL_TEMPLATES

  const usedIds = new Set(incident.usedQuickTemplateIds || [])
  return baseTemplates.filter(
    (template) =>
      !QUICK_ONCE_TEMPLATE_IDS.includes(template.id) || !usedIds.has(template.id),
  )
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
  if (String(incident.contactCount).trim()) {
    patientTypes.push(`접촉환자 ${String(incident.contactCount).trim()}명`)
  }
  if (String(incident.inhalationCount).trim()) {
    patientTypes.push(`흡입환자 ${String(incident.inhalationCount).trim()}명`)
  }

  const lines = []
  if (patientTypes.length) {
    lines.push(`-. 환자 여부: ${patientTypes.join(' / ')} 발생`)
  }

  resizePatientRecords(incident.contactPatients, incident.contactCount, 'contact').forEach(
    (patient, index) => {
      const identity = []
      if (String(patient.affiliation || '').trim()) {
        identity.push(`소속 ${String(patient.affiliation).trim()}`)
      }
      if (String(patient.name || '').trim()) {
        identity.push(`이름 ${String(patient.name).trim()}`)
      }
      if (identity.length) {
        lines.push(`접촉환자 ${index + 1}: ${identity.join(' / ')}`)
      } else if (String(patient.contactArea || '').trim()) {
        lines.push(`접촉환자 ${index + 1}:`)
      }
      if (String(patient.contactArea || '').trim()) {
        lines.push(`접촉 부위: ${String(patient.contactArea).trim()}`)
      }
    },
  )

  resizePatientRecords(
    incident.inhalationPatients,
    incident.inhalationCount,
    'inhalation',
  ).forEach((patient, index) => {
    const identity = []
    if (String(patient.affiliation || '').trim()) {
      identity.push(`소속 ${String(patient.affiliation).trim()}`)
    }
    if (String(patient.name || '').trim()) {
      identity.push(`이름 ${String(patient.name).trim()}`)
    }
    if (identity.length) {
      lines.push(`흡입환자 ${index + 1}: ${identity.join(' / ')}`)
    }
  })

  return lines
}

const parsePatientRecords = (patientLines, count, type) => {
  const records = resizePatientRecords([], count, type)
  let activeContactIndex = -1

  patientLines.forEach((line) => {
    const trimmed = String(line || '').trim()
    const contactMatch = trimmed.match(/^접촉환자\s*(\d+)\s*[:.]\s*(.*)$/)
    if (contactMatch && type === 'contact') {
      const index = Math.max(0, Number.parseInt(contactMatch[1], 10) - 1)
      const detail = String(contactMatch[2] || '').trim()
      const affiliationMatch = detail.match(/소속\s*(.*?)(?=\s*\/\s*이름|$)/)
      const nameMatch = detail.match(/이름\s*(.*)$/)
      if (records[index]) {
        records[index] = {
          ...records[index],
          affiliation: String(affiliationMatch?.[1] || '').trim(),
          name: String(nameMatch?.[1] || '').trim(),
        }
        activeContactIndex = index
      }
      return
    }

    const inhalationMatch = trimmed.match(/^흡입환자\s*(\d+)\s*[:.]\s*(.*)$/)
    if (inhalationMatch && type === 'inhalation') {
      const index = Math.max(0, Number.parseInt(inhalationMatch[1], 10) - 1)
      const detail = String(inhalationMatch[2] || '').trim()
      const affiliationMatch = detail.match(/소속\s*(.*?)(?=\s*\/\s*이름|$)/)
      const nameMatch = detail.match(/이름\s*(.*)$/)
      if (records[index]) {
        records[index] = {
          ...records[index],
          affiliation: String(affiliationMatch?.[1] || '').trim(),
          name: String(nameMatch?.[1] || '').trim(),
        }
      }
      return
    }

    const contactAreaMatch = trimmed.match(/^접촉\s*부위\s*:\s*(.*)$/)
    if (contactAreaMatch && type === 'contact' && activeContactIndex >= 0) {
      records[activeContactIndex] = {
        ...records[activeContactIndex],
        contactArea: String(contactAreaMatch[1] || '').trim(),
      }
    }
  })

  return records
}

const parsePropertyText = (text) => {
  const parts = String(text || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  let ph = ''
  let leakAmount = ''
  let leakRate = ''
  const remaining = []

  parts.forEach((part) => {
    const phMatch = part.match(/^pH\s*[:=]?\s*(.*)$/i)
    if (phMatch) {
      ph = phMatch[1].trim()
      return
    }

    const amountMatch = part.match(/^Leak\s*량\s*[:=]?\s*(.*)$/i)
    if (amountMatch) {
      leakAmount = amountMatch[1].trim()
      return
    }

    const rateMatch = part.match(/^Leak\s*속도\s*[:=]?\s*(.*)$/i)
    if (rateMatch) {
      leakRate = rateMatch[1].trim()
      return
    }

    remaining.push(part)
  })

  remaining.forEach((part) => {
    if (!leakRate && /(초당|분당|시간당|방울|속도|흐름)/i.test(part)) {
      leakRate = part
    } else if (!leakAmount) {
      leakAmount = part
    } else if (!leakRate) {
      leakRate = part
    } else {
      leakRate = `${leakRate}, ${part}`
    }
  })

  return { ph, leakAmount, leakRate }
}

const parseGasPhenomenon = (phenomenon) => {
  const original = String(phenomenon || '').trim()
  const isGasAlarm = /(Alarm|알람)/i.test(original)
  if (!isGasAlarm) return { gasAlarm: false, gasDraft: null }

  const normalized = original.replace(/\s+/g, ' ').trim()
  const match = normalized.match(
    /^(환경감지기|(.+?)호기)\s+(.+?)\s+([ABCD])급\s+(.+?)\s*(ppm|ppb|%LEL)\s*(?:(?:Gas\s+)?Alarm|알람)(?:\s*발생)?(?:\s*외\s*(\d+)\s*건\s*발생)?/i,
  )

  if (!match) return { gasAlarm: true, gasDraft: null }

  return {
    gasAlarm: true,
    gasDraft: {
      mode: match[7] ? 'multiple' : 'single',
      sourceType: match[1] === '환경감지기' ? 'environment' : 'unit',
      unitNo: match[1] === '환경감지기' ? '' : String(match[2] || '').trim().toUpperCase(),
      target: String(match[3] || '').trim(),
      grade: String(match[4] || 'A').toUpperCase(),
      value: String(match[5] || '').trim(),
      unit: match[6] || 'ppm',
      extraCount: String(match[7] || '').trim(),
    },
  }
}


const normalizeGasBuildingName = (rawValue) => {
  const value = String(rawValue || '').replace(/\s+/g, ' ').trim()
  if (!value) return ''

  if (/복합\s*3(?:동)?|P3\s*복합/i.test(value)) return '복합3동'
  if (/복합\s*4(?:동)?|P4\s*복합/i.test(value)) return '복합4동'

  const lineBuilding = value.match(/평택[_\s-]*(\d+)L동/i)
  if (lineBuilding) return `P${lineBuilding[1]}L`

  const shortBuilding = value.match(/\bP(\d+)L\b/i)
  if (shortBuilding) return `P${shortBuilding[1]}L`

  const englishBuilding = value.match(/PYEONGTAEK[_\s-]*(\d+)/i)
  return englishBuilding ? `P${englishBuilding[1]}L` : value
}

const normalizeGasLocation = (rawValue) => {
  const value = String(rawValue || '').replace(/\s+/g, ' ').trim()
  if (!value) return ''

  const floor = value.match(/(\d+)\s*층/i)
  const bay = value.match(/([A-Z]\d+)\s*(?:베이|BAY)/i)
  const pillar = value.match(/([A-Z]\d+)\s*기둥/i)

  const parts = []
  if (floor) parts.push(`${floor[1]}F`)
  if (bay) parts.push(`${bay[1].toUpperCase()}BAY`)
  if (pillar) parts.push(`${pillar[1].toUpperCase()}기둥`)

  if (parts.length) return parts.join(' ')

  return value
    .replace(/(\d+)\s*층/gi, '$1F')
    .replace(/([A-Z]\d+)\s*베이/gi, '$1BAY')
    .replace(/\b베이\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

const normalizeGasUnit = (rawValue) => {
  const compact = String(rawValue || '').replace(/\s+/g, '').toUpperCase()
  return compact === '%LEL' ? '%LEL' : compact.toLowerCase()
}

const createParsedGasAlarm = ({ building, location, equipment, gasName, grade, value, unit, source }) => {
  const normalizedBuilding = normalizeGasBuildingName(building)
  const normalizedLocation = normalizeGasLocation(location)
  const normalizedEquipment = String(equipment || '').trim().toUpperCase()
  const normalizedGasName = String(gasName || '').trim()
  const normalizedGrade = String(grade || '').trim().toUpperCase()
  const normalizedValue = String(value || '').trim()
  const normalizedUnit = normalizeGasUnit(unit)
  const title = [normalizedBuilding, normalizedLocation].filter(Boolean).join(' ').trim()
  const phenomenon = [
    normalizedEquipment,
    normalizedGasName,
    normalizedGrade ? `${normalizedGrade}급` : '',
    normalizedValue,
    normalizedUnit,
    'Gas Alarm 발생',
  ]
    .filter(Boolean)
    .join(' ')

  const missing = []
  if (!normalizedBuilding) missing.push('건물')
  if (!normalizedLocation) missing.push('위치')
  if (!normalizedEquipment) missing.push('대상 설비')
  if (!normalizedGasName) missing.push('가스명')
  if (!normalizedGrade) missing.push('등급')
  if (!normalizedValue) missing.push('수치')
  if (!normalizedUnit) missing.push('단위')

  return {
    recognized: missing.length === 0,
    missing,
    source,
    title: title.toUpperCase(),
    phenomenon,
    gasDraft: {
      mode: 'single',
      sourceType: 'unit',
      unitNo: normalizedEquipment,
      target: normalizedGasName,
      grade: normalizedGrade || 'A',
      value: normalizedValue,
      unit: normalizedUnit || 'ppm',
      extraCount: '',
    },
  }
}

const parseDetailedGasAlarmMessage = (text) => {
  const buildingMatch = text.match(/-\s*건물\s*정보\s*:\s*([^\n]+)/i)
  const locationMatch = text.match(/-\s*위치\s*정보\s*:\s*([^\n]+)/i)
  const equipmentMatch = text.match(/-\s*대상\s*설비\s*:\s*([^\n]+)/i)
  const alarmMatch = text.match(/-\s*알람\s*정보\s*:\s*([^\n]+)/i)

  if (!buildingMatch && !locationMatch && !equipmentMatch && !alarmMatch) return null

  const alarmText = String(alarmMatch?.[1] || '').trim()
  const alarmParts = alarmText.match(/^(.+?)\s+([ABCD])급\s*([0-9]+(?:\.[0-9]+)?)\s*(ppm|ppb|%\s*LEL)\b/i)

  return createParsedGasAlarm({
    building: buildingMatch?.[1],
    location: locationMatch?.[1],
    equipment: equipmentMatch?.[1],
    gasName: alarmParts?.[1],
    grade: alarmParts?.[2],
    value: alarmParts?.[3],
    unit: alarmParts?.[4],
    source: 'sms',
  })
}

const parseMessengerGasAlarmMessage = (text) => {
  if (!/(토빅방|메시지\s*:|가스감지기\]\s*평택_)/i.test(text)) return null

  const buildingMatch = text.match(/평택[_\s-]*(복합\s*[34]동|\d+L동)/i)
  const floorMatch = text.match(/(\d+)\s*층/i)
  const bayMatch = text.match(/([A-Z]\d+)\s*(?:BAY|베이)/i)
  const pillarMatch = text.match(/([A-Z]\d+)\s*기둥/i)
  const sensorMatch = text.match(/\b[A-Z]{1,4}-GST-[^\s,]+/i)
  const alarmParts = text.match(/([ABCD])등급\s*(.+?)\/\s*([0-9]+(?:\.[0-9]+)?)\s*(ppm|ppb|%\s*LEL)\b/i)

  const sensor = String(sensorMatch?.[0] || '').trim()
  const equipment = sensor.includes('(') ? sensor.slice(sensor.indexOf('(')) : sensor
  const location = [
    floorMatch ? `${floorMatch[1]}층` : '',
    bayMatch ? `${bayMatch[1]}Bay` : '',
    pillarMatch ? `${pillarMatch[1]}기둥` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return createParsedGasAlarm({
    building: buildingMatch?.[0],
    location,
    equipment,
    gasName: alarmParts?.[2],
    grade: alarmParts?.[1],
    value: alarmParts?.[3],
    unit: alarmParts?.[4],
    source: 'messenger',
  })
}

const parseGasAlarmMessage = (rawText) => {
  const text = String(rawText || '').replace(/\r\n?/g, '\n').trim()
  if (!text) return { recognized: false, missing: ['문자 내용'] }

  return (
    parseDetailedGasAlarmMessage(text) ||
    parseMessengerGasAlarmMessage(text) || {
      recognized: false,
      missing: ['건물', '위치', '대상 설비', '알람 정보'],
    }
  )
}

const isLikelyGasAlarmMessage = (rawText) => {
  const text = String(rawText || '').replace(/\r\n?/g, '\n')
  return (
    /가스감지기\s*알람\s*발생/i.test(text) ||
    /\[가스감지기\]/i.test(text) ||
    /^\s*-\s*알람\s*정보\s*:/im.test(text) ||
    (/^\s*-\s*대상\s*설비\s*:/im.test(text) && /^\s*-\s*위치\s*정보\s*:/im.test(text))
  )
}

const parseImportedReport = (rawText, incidentId) => {
  const text = String(rawText || '').replace(/\r\n?/g, '\n').trim()
  const lines = text.split('\n')
  const parsed = {
    title: '',
    phenomenon: '',
    property: '',
    patient: '',
    work: '',
    responses: [],
    requestAnalysis: false,
    situationEnd: false,
  }

  let section = ''
  let currentResponseIndex = -1

  const appendSection = (key, value) => {
    const clean = String(value || '').trimEnd()
    if (!clean.trim()) return
    parsed[key] = parsed[key] ? `${parsed[key]}\n${clean}` : clean
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()
    if (!trimmed) return

    const titleMatch = trimmed.match(/^\[([^\]]+)\]$/)
    if (titleMatch && !parsed.title) {
      parsed.title = titleMatch[1].trim()
      section = ''
      return
    }

    if (/원인분석\s*및\s*재발방지대책\s*요청하겠습니다\.?/.test(trimmed)) {
      parsed.requestAnalysis = true
      section = ''
      return
    }

    if (/상황\s*종료합니다\.?/.test(trimmed.replace(/^\*\*/, ''))) {
      parsed.situationEnd = true
      section = ''
      return
    }

    const commonMatch = trimmed.match(/^[-–]?\.\s*(현상|성상|환자\s*여부|(?:주변\s*)?작업사항)\s*:\s*(.*)$/)
    if (commonMatch) {
      const label = commonMatch[1].replace(/\s+/g, '')
      section =
        label === '현상'
          ? 'phenomenon'
          : label === '성상'
            ? 'property'
            : label === '환자여부'
              ? 'patient'
              : 'work'
      appendSection(section, commonMatch[2])
      currentResponseIndex = -1
      return
    }

    if (/^[-–]?\.\s*대응\s*내용\s*$/.test(trimmed)) {
      section = 'responses'
      currentResponseIndex = -1
      return
    }

    if (section === 'responses') {
      const responseMatch = trimmed.match(/^\d+\.\s*(.*)$/)
      if (responseMatch) {
        const response = responseMatch[1].trim()
        if (response) {
          parsed.responses.push(response)
          currentResponseIndex = parsed.responses.length - 1
        }
        return
      }

      if (currentResponseIndex >= 0) {
        parsed.responses[currentResponseIndex] = `${parsed.responses[currentResponseIndex]}\n${trimmed}`
      }
      return
    }

    if (['phenomenon', 'property', 'patient', 'work'].includes(section)) {
      appendSection(section, line)
    }
  })

  const property = parsePropertyText(parsed.property)
  const patientText = parsed.patient.trim()
  const patientLines = patientText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const noContact = /접촉자\s*없음|환자\s*없음/.test(patientText)
  const inhalationMatch = patientText.match(/흡입환자\s*(\d+)\s*명/)
  const contactMatch = patientText.match(/접촉환자\s*(\d+)\s*명/)
  const inhalationCount = inhalationMatch ? inhalationMatch[1] : ''
  const contactCount = contactMatch ? contactMatch[1] : ''
  const patientDetailLines = patientLines.slice(1)
  const contactPatients = parsePatientRecords(patientDetailLines, contactCount, 'contact')
  const inhalationPatients = parsePatientRecords(
    patientDetailLines,
    inhalationCount,
    'inhalation',
  )

  const workText = parsed.work.trim()
  const workNone = !workText || /^없음\.?$/.test(workText)
  const gasResult = parseGasPhenomenon(parsed.phenomenon)
  const responseItems = parsed.responses.filter((item) => String(item || '').trim())
  const history = uniqueLines(responseItems)

  const incident = {
    ...createIncident(incidentId),
    id: incidentId,
    title: parsed.title.toUpperCase(),
    phenomenon: parsed.phenomenon,
    includePhenomenon: Boolean(parsed.phenomenon.trim()),
    ph: property.ph,
    leakAmount: property.leakAmount,
    leakRate: property.leakRate,
    includeProperty: Boolean(parsed.property.trim()),
    includePatient: Boolean(patientText),
    noContact,
    inhalationCount,
    contactCount,
    contactPatients,
    inhalationPatients,
    workDetails: workNone ? '' : workText,
    workNone,
    includeWork: Boolean(workText),
    gasAlarm: gasResult.gasAlarm,
    gasDraft: gasResult.gasDraft || createIncident().gasDraft,
    reports: responseItems.length
      ? responseItems.map((content) => ({ ...createReport(), content, included: true }))
      : [createReport()],
    history,
    usedQuickTemplateIds: inferQuickTemplateIds(responseItems),
    endEnabled: parsed.requestAnalysis || parsed.situationEnd,
    requestAnalysis: parsed.requestAnalysis,
    situationEnd: parsed.situationEnd,
  }

  const recognizedCount = [
    parsed.title,
    parsed.phenomenon,
    parsed.property,
    parsed.patient,
    parsed.work,
    ...responseItems,
    parsed.requestAnalysis ? 'request' : '',
    parsed.situationEnd ? 'end' : '',
  ].filter(Boolean).length

  return {
    incident,
    recognizedCount,
    responseCount: responseItems.length,
    gasAlarm: gasResult.gasAlarm,
  }
}

const hasIncidentContent = (incident) =>
  Boolean(
    String(incident.title || '').trim() ||
      String(incident.phenomenon || '').trim() ||
      String(incident.ph || '').trim() ||
      String(incident.leakAmount || '').trim() ||
      String(incident.leakRate || '').trim() ||
      String(incident.inhalationCount || '').trim() ||
      String(incident.contactCount || '').trim() ||
      (Array.isArray(incident.contactPatients) &&
        incident.contactPatients.some((patient) =>
          [patient.affiliation, patient.name, patient.contactArea].some((value) =>
            String(value || '').trim(),
          ),
        )) ||
      (Array.isArray(incident.inhalationPatients) &&
        incident.inhalationPatients.some((patient) =>
          [patient.affiliation, patient.name].some((value) => String(value || '').trim()),
        )) ||
      String(incident.workDetails || '').trim() ||
      incident.gasAlarm ||
      incident.endEnabled ||
      incident.history.length ||
      incident.reports.some((report) => String(report.content || '').trim()),
  )

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
  if (incident.includeWork) {
    if (incident.workNone) {
      commonLines.push('-. 주변 작업사항: 없음')
    } else if (String(incident.workDetails || '').trim()) {
      commonLines.push(...formatMultilineField('주변 작업사항', incident.workDetails))
    }
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

function TemplateFieldInputs({ template, values, onChange }) {
  const visibleFields = getVisibleTemplateFields(template, values)

  return (
    <div className="template-field-grid">
      {visibleFields.map((field) => (
        <label className="field-stack" key={field.key}>
          <span>{field.label}</span>
          {field.type === 'select' ? (
            <select
              value={values[field.key]}
              onChange={(event) => onChange(field, event.target.value)}
            >
              {field.options.map((option) => (
                <option value={option} key={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={values[field.key] || ''}
              placeholder={field.placeholder || ''}
              onChange={(event) => onChange(field, event.target.value)}
            />
          )}
        </label>
      ))}
    </div>
  )
}

function TemplateEditor({ template, onApply, onCancel }) {
  const [values, setValues] = useState(() => getDefaultValues(template))

  useEffect(() => {
    setValues(getDefaultValues(template))
  }, [template])

  const visibleFields = getVisibleTemplateFields(template, values)

  const changeValue = (field, rawValue) => {
    const nextValue = field.uppercase ? rawValue.toUpperCase() : rawValue
    setValues((previous) => ({
      ...previous,
      [field.key]: nextValue,
    }))
  }

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

      <TemplateFieldInputs
        template={template}
        values={values}
        onChange={changeValue}
      />

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

function LiveTemplateEditor({
  template,
  draft,
  order,
  onChange,
  onToggleCollapse,
}) {
  const changeValue = (field, rawValue) => {
    onChange(field.key, field.uppercase ? rawValue.toUpperCase() : rawValue)
  }

  return (
    <div className={`live-template-editor ${draft.collapsed ? 'collapsed' : ''}`}>
      <div className="live-template-heading">
        <div>
          <span className="selection-order-badge">선택 {order}</span>
          <strong>실시간 문구 작성</strong>
        </div>
        <button
          type="button"
          className="secondary-button compact-button"
          onClick={onToggleCollapse}
        >
          {draft.collapsed ? '펼치기' : '접기'}
        </button>
      </div>

      <div className="live-template-preview">{draft.generatedText}</div>

      {!draft.collapsed && (
        <>
          {(template.fields || []).length > 0 ? (
            <TemplateFieldInputs
              template={template}
              values={draft.values}
              onChange={changeValue}
            />
          ) : (
            <p className="live-template-note">
              추가 입력이 없는 문구입니다. 체크를 해제하면 중간보고에서 제거됩니다.
            </p>
          )}
          <p className="live-template-note">
            입력값은 위 중간보고 입력창에 실시간으로 반영됩니다.
          </p>
        </>
      )}
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
    ).trim()} ${draft.unit} Gas Alarm 발생`

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
  addLiveTemplate,
  removeLiveTemplate,
  updateLiveTemplate,
  toggleLiveTemplate,
  syncHistory,
  notify,
}) {
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const visibleTemplates = getVisibleTemplates(incident)
  const title = incident.title.trim() || '출동 위치'
  const selectedDrafts = Array.isArray(report.templateDrafts)
    ? report.templateDrafts
    : []
  const selectedIds = new Set(selectedDrafts.map((draft) => draft.templateId))
  const selectedTemplateRows = selectedDrafts
    .map((draft) => ({ draft, template: getTemplateById(draft.templateId) }))
    .filter((item) => item.template)
  const unselectedTemplates = visibleTemplates.filter(
    (template) => !selectedIds.has(template.id),
  )

  const selectTemplate = (template) => {
    if (selectedIds.has(template.id)) {
      toggleLiveTemplate(report.id, template.id)
      return
    }

    if (!template.fields?.length) {
      appendToReport(report.id, template.build({}), template.id)
      setSelectedTemplate(null)
      setTemplatesOpen(false)
      return
    }

    // 이미 열려 있는 같은 문구를 다시 누르면 문구 완성창을 접습니다.
    setSelectedTemplate((current) =>
      current?.id === template.id ? null : template,
    )
  }

  const copyReport = async () => {
    const text = `[${title}]${report.content.trim() ? `
${report.content.trim()}` : ''}`
    await copyText(text)
    syncHistory(report.content)
    notify('개별 중간보고를 복사했습니다.')
  }

  const renderTemplateRow = (template, draft = null, order = 0) => (
    <div className={`template-option ${draft ? 'multi-selected' : ''}`} key={template.id}>
      <div className="template-choice-row">
        <label
          className="template-multi-check"
          title="체크하면 여러 문구를 선택 순서대로 작성할 수 있습니다."
        >
          <input
            type="checkbox"
            checked={Boolean(draft)}
            onChange={(event) => {
              if (event.target.checked) addLiveTemplate(report.id, template)
              else removeLiveTemplate(report.id, template.id)
              setSelectedTemplate((current) =>
                current?.id === template.id ? null : current,
              )
            }}
          />
          <span className="sr-only">다중 선택</span>
        </label>

        <button
          type="button"
          className={`template-select-button ${
            GAS_TEMPLATES.some((item) => item.id === template.id)
              ? 'gas-template'
              : ''
          } ${draft ? 'selected-template-button' : ''}`}
          onClick={() => selectTemplate(template)}
        >
          {template.label}
        </button>
      </div>

      {draft && (
        <LiveTemplateEditor
          template={template}
          draft={draft}
          order={order}
          onToggleCollapse={() => toggleLiveTemplate(report.id, template.id)}
          onChange={(key, value) =>
            updateLiveTemplate(report.id, template.id, key, value)
          }
        />
      )}

      {!draft && selectedTemplate?.id === template.id && (
        <TemplateEditor
          template={selectedTemplate}
          onCancel={() => setSelectedTemplate(null)}
          onApply={(text) => {
            appendToReport(report.id, text, selectedTemplate.id)
            setSelectedTemplate(null)
            setTemplatesOpen(false)
          }}
        />
      )}
    </div>
  )

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

      <details
        className="picker-panel"
        open={templatesOpen}
        onToggle={(event) => setTemplatesOpen(event.currentTarget.open)}
      >
        <summary>자주 쓰는 대응 문구</summary>
        <div className="template-multi-guide">
          <strong>다중 선택</strong>
          <span>왼쪽 체크박스를 누른 순서대로 위에 모이며 실시간으로 작성됩니다.</span>
        </div>
        <div className="template-list">
          {selectedTemplateRows.length > 0 && (
            <div className="selected-template-group">
              {selectedTemplateRows.map(({ template, draft }, index) =>
                renderTemplateRow(template, draft, index + 1),
              )}
            </div>
          )}

          {unselectedTemplates.length > 0 && (
            <div className="unselected-template-group">
              {unselectedTemplates.map((template) => renderTemplateRow(template))}
            </div>
          )}
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

function ImportDialog({ value, onChange, onApply, onClose }) {
  return (
    <div className="import-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="import-dialog card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="import-dialog-heading">
          <div>
            <p className="section-index">LOAD REPORT</p>
            <h2 id="import-dialog-title">불러오기</h2>
            <p>대응 정리 또는 가스알람 문자 전체를 붙여넣으면 형식을 자동으로 판단합니다.</p>
          </div>
          <button type="button" className="dialog-close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <textarea
          className="import-textarea"
          value={value}
          autoFocus
          placeholder={`대응 정리 또는 가스알람 문자 전체를 붙여넣으세요.

[출동 위치]
-. 현상: ...
-. 주변 작업사항: ...

또는

[Web발신]
[인프라][가스감지기 알람 발생]...
- 위치 정보: ...
- 대상 설비: ...
- 알람 정보: ...`}
          onChange={(event) => onChange(event.target.value)}
        />

        <div className="import-help">
          <strong>자동 판별</strong>
          <span>가스알람 문자: 건물·층·BAY·기둥·대상 설비·가스명·등급·수치·단위를 인식합니다.</span>
          <span>대응 정리: 제목·현상·성상·환자·주변 작업사항·중간보고·사용 이력·종료 문구를 인식합니다.</span>
          <span>복합3동과 복합4동은 제목에 각각 복합3동·복합4동으로 표시합니다.</span>
        </div>

        <div className="import-dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            취소
          </button>
          <button type="button" className="primary-button" onClick={onApply}>
            현재 출동에 적용
          </button>
        </div>
      </section>
    </div>
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
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')

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

  const closeImport = () => {
    setImportOpen(false)
    setImportText('')
  }

  const applyImport = () => {
    if (!String(importText || '').trim()) {
      window.alert('불러올 대응 정리 또는 가스알람 문자 내용을 붙여넣어 주세요.')
      return
    }

    const parsedGas = parseGasAlarmMessage(importText)
    if (parsedGas.recognized) {
      if (
        (String(activeIncident.title || '').trim() || String(activeIncident.phenomenon || '').trim()) &&
        !window.confirm(
          '가스알람 문자로 인식했습니다. 현재 출동의 제목 또는 현상을 바꿀까요?\n중간보고와 다른 입력 내용은 그대로 유지됩니다.',
        )
      ) {
        return
      }

      updateCurrent((incident) => ({
        ...incident,
        title: parsedGas.title,
        phenomenon: parsedGas.phenomenon,
        includePhenomenon: true,
        gasAlarm: true,
        gasDraft: parsedGas.gasDraft,
      }))
      closeImport()
      notify('가스알람 문자를 자동 인식해 현재 출동에 적용했습니다.')
      return
    }

    if (isLikelyGasAlarmMessage(importText)) {
      const missing = Array.isArray(parsedGas.missing) ? parsedGas.missing.join(', ') : ''
      window.alert(
        `가스알람 문자 형식으로 판단했지만 필요한 정보를 모두 찾지 못했습니다.${
          missing ? `\n확인 필요: ${missing}` : ''
        }`,
      )
      return
    }

    const parsed = parseImportedReport(importText, activeIncident.id)
    if (!parsed.recognizedCount) {
      window.alert('인식할 수 있는 항목이 없습니다. 대응 정리 또는 가스알람 문자 형식을 확인해 주세요.')
      return
    }

    if (
      hasIncidentContent(activeIncident) &&
      !window.confirm('현재 출동에 작성된 내용이 있습니다. 불러온 내용으로 덮어쓸까요?')
    ) {
      return
    }

    updateCurrent(() => parsed.incident)
    closeImport()
    notify(
      parsed.gasAlarm
        ? `가스 출동 보고와 중간보고 ${parsed.responseCount}건을 불러왔습니다.`
        : `보고서와 중간보고 ${parsed.responseCount}건을 불러왔습니다.`,
    )
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

    const inferredQuickIds = inferQuickTemplateIds(lines)

    return {
      ...incident,
      history: nextHistory.slice(0, 60),
      usedQuickTemplateIds: Array.from(
        new Set([...(incident.usedQuickTemplateIds || []), ...inferredQuickIds]),
      ),
    }
  }

  const appendToReport = (reportId, text, templateId = '') => {
    updateCurrent((incident) => {
      const withHistory = addHistoryItems(incident, text)
      const shouldHideTemplate = QUICK_ONCE_TEMPLATE_IDS.includes(templateId)
      const usedQuickTemplateIds = shouldHideTemplate
        ? Array.from(new Set([...(withHistory.usedQuickTemplateIds || []), templateId]))
        : withHistory.usedQuickTemplateIds || []

      return {
        ...withHistory,
        usedQuickTemplateIds,
        reports: withHistory.reports.map((report) =>
          report.id === reportId
            ? { ...report, content: appendLine(report.content, text) }
            : report,
        ),
      }
    })
  }

  const addLiveTemplate = (reportId, template) => {
    updateCurrent((incident) => {
      let generatedText = ''
      const reports = incident.reports.map((report) => {
        if (report.id !== reportId) return report
        const previousDrafts = Array.isArray(report.templateDrafts)
          ? report.templateDrafts
          : []
        if (previousDrafts.some((draft) => draft.templateId === template.id)) {
          return report
        }

        const values = getDefaultValues(template)
        generatedText = buildLiveTemplateText(template, values)
        const nextDraft = {
          ...createTemplateDraft(template.id, values),
          generatedText,
        }
        const nextDrafts = [...previousDrafts, nextDraft]

        return {
          ...report,
          templateDrafts: nextDrafts,
          content: rebuildReportContentFromDrafts(
            report.content,
            previousDrafts,
            nextDrafts,
          ),
        }
      })

      let nextIncident = {
        ...incident,
        reports,
        usedQuickTemplateIds: QUICK_ONCE_TEMPLATE_IDS.includes(template.id)
          ? Array.from(
              new Set([...(incident.usedQuickTemplateIds || []), template.id]),
            )
          : incident.usedQuickTemplateIds || [],
      }

      if (generatedText && isLiveTemplateComplete(template, getDefaultValues(template))) {
        nextIncident = addHistoryItems(nextIncident, generatedText)
      }
      return nextIncident
    })
  }

  const removeLiveTemplate = (reportId, templateId) => {
    updateCurrent((incident) => ({
      ...incident,
      reports: incident.reports.map((report) => {
        if (report.id !== reportId) return report
        const previousDrafts = Array.isArray(report.templateDrafts)
          ? report.templateDrafts
          : []
        const nextDrafts = previousDrafts.filter(
          (draft) => draft.templateId !== templateId,
        )

        return {
          ...report,
          templateDrafts: nextDrafts,
          content: rebuildReportContentFromDrafts(
            report.content,
            previousDrafts,
            nextDrafts,
          ),
        }
      }),
    }))
  }

  const updateLiveTemplate = (reportId, templateId, key, value) => {
    updateCurrent((incident) => {
      const reports = incident.reports.map((report) => {
        if (report.id !== reportId) return report
        const previousDrafts = Array.isArray(report.templateDrafts)
          ? report.templateDrafts
          : []
        const nextDrafts = previousDrafts.map((draft) => {
          if (draft.templateId !== templateId) return draft
          const template = getTemplateById(templateId)
          if (!template) return draft
          const values = { ...draft.values, [key]: value }
          const generatedText = buildLiveTemplateText(template, values)
          return { ...draft, values, generatedText }
        })

        return {
          ...report,
          templateDrafts: nextDrafts,
          content: rebuildReportContentFromDrafts(
            report.content,
            previousDrafts,
            nextDrafts,
          ),
        }
      })

      return { ...incident, reports }
    })
  }

  const toggleLiveTemplate = (reportId, templateId) => {
    updateCurrent((incident) => {
      let historyText = ''
      const reports = incident.reports.map((report) => {
        if (report.id !== reportId) return report

        return {
          ...report,
          templateDrafts: (report.templateDrafts || []).map((draft) => {
            if (draft.templateId !== templateId) return draft
            const nextCollapsed = !draft.collapsed
            const template = getTemplateById(templateId)
            if (
              nextCollapsed &&
              template &&
              isLiveTemplateComplete(template, draft.values)
            ) {
              historyText = draft.generatedText
            }
            return { ...draft, collapsed: nextCollapsed }
          }),
        }
      })

      const nextIncident = { ...incident, reports }
      return historyText ? addHistoryItems(nextIncident, historyText) : nextIncident
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
        <div className="hero-actions">
          <button
            type="button"
            className="import-button"
            onClick={() => {
              setImportText('')
              setImportOpen(true)
            }}
          >
            불러오기
            <small>현재 출동에 적용</small>
          </button>
          <button type="button" className="reset-button" onClick={resetCurrent}>
            전체 초기화
            <small>현재 출동만</small>
          </button>
        </div>
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
                <div className="field-title-main">
                  <span>현상</span>
                  {activeIncident.gasAlarm && (
                    <span className="gas-status-badge">가스 출동 작성 중</span>
                  )}
                </div>
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
                      <span>접촉환자</span>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={activeIncident.contactCount}
                        onChange={(event) => {
                          const nextCount = normalizePatientCountInput(event.target.value)
                          updateCurrent((current) => ({
                            ...current,
                            contactCount: nextCount,
                            contactPatients: resizePatientRecords(
                              current.contactPatients,
                              nextCount,
                              'contact',
                            ),
                          }))
                        }}
                      />
                      <span>명</span>
                    </label>
                    <label className="inline-count-field">
                      <span>흡입환자</span>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={activeIncident.inhalationCount}
                        onChange={(event) => {
                          const nextCount = normalizePatientCountInput(event.target.value)
                          updateCurrent((current) => ({
                            ...current,
                            inhalationCount: nextCount,
                            inhalationPatients: resizePatientRecords(
                              current.inhalationPatients,
                              nextCount,
                              'inhalation',
                            ),
                          }))
                        }}
                      />
                      <span>명</span>
                    </label>
                  </div>

                  <div className="patient-groups-grid">
                    {activeIncident.contactPatients.length > 0 && (
                      <section className="patient-group">
                        <h4>접촉환자 정보</h4>
                        {activeIncident.contactPatients.map((patient, index) => (
                          <div className="patient-card" key={patient.id}>
                            <strong>접촉환자 {index + 1}</strong>
                            <div className="patient-name-grid">
                              <label className="mini-field">
                                <span>소속</span>
                                <input
                                  type="text"
                                  value={patient.affiliation}
                                  placeholder="예: 비비테크"
                                  onChange={(event) =>
                                    updateCurrent((current) => ({
                                      ...current,
                                      contactPatients: current.contactPatients.map(
                                        (item, itemIndex) =>
                                          itemIndex === index
                                            ? { ...item, affiliation: event.target.value }
                                            : item,
                                      ),
                                    }))
                                  }
                                />
                              </label>
                              <label className="mini-field">
                                <span>이름</span>
                                <input
                                  type="text"
                                  value={patient.name}
                                  placeholder="예: 정원기"
                                  onChange={(event) =>
                                    updateCurrent((current) => ({
                                      ...current,
                                      contactPatients: current.contactPatients.map(
                                        (item, itemIndex) =>
                                          itemIndex === index
                                            ? { ...item, name: event.target.value }
                                            : item,
                                      ),
                                    }))
                                  }
                                />
                              </label>
                            </div>
                            <label className="mini-field patient-area-field">
                              <span>접촉 부위</span>
                              <input
                                type="text"
                                value={patient.contactArea}
                                placeholder="예: 오른팔"
                                onChange={(event) =>
                                  updateCurrent((current) => ({
                                    ...current,
                                    contactPatients: current.contactPatients.map(
                                      (item, itemIndex) =>
                                        itemIndex === index
                                          ? { ...item, contactArea: event.target.value }
                                          : item,
                                    ),
                                  }))
                                }
                              />
                            </label>
                          </div>
                        ))}
                      </section>
                    )}

                    {activeIncident.inhalationPatients.length > 0 && (
                      <section className="patient-group">
                        <h4>흡입환자 정보</h4>
                        {activeIncident.inhalationPatients.map((patient, index) => (
                          <div className="patient-card" key={patient.id}>
                            <strong>흡입환자 {index + 1}</strong>
                            <div className="patient-name-grid">
                              <label className="mini-field">
                                <span>소속</span>
                                <input
                                  type="text"
                                  value={patient.affiliation}
                                  placeholder="예: 비비테크"
                                  onChange={(event) =>
                                    updateCurrent((current) => ({
                                      ...current,
                                      inhalationPatients: current.inhalationPatients.map(
                                        (item, itemIndex) =>
                                          itemIndex === index
                                            ? { ...item, affiliation: event.target.value }
                                            : item,
                                      ),
                                    }))
                                  }
                                />
                              </label>
                              <label className="mini-field">
                                <span>이름</span>
                                <input
                                  type="text"
                                  value={patient.name}
                                  placeholder="예: 정원기"
                                  onChange={(event) =>
                                    updateCurrent((current) => ({
                                      ...current,
                                      inhalationPatients: current.inhalationPatients.map(
                                        (item, itemIndex) =>
                                          itemIndex === index
                                            ? { ...item, name: event.target.value }
                                            : item,
                                      ),
                                    }))
                                  }
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </section>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="common-field-block">
              <div className="field-title-row">
                <span>주변 작업사항</span>
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
                  placeholder="주변 작업 내용, 진행사항, 특이사항 등을 자유롭게 입력하세요."
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
              <p>체크한 문구는 선택 순서대로 위에 모이며 입력값이 실시간 반영됩니다.</p>
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
                addLiveTemplate={addLiveTemplate}
                removeLiveTemplate={removeLiveTemplate}
                updateLiveTemplate={updateLiveTemplate}
                toggleLiveTemplate={toggleLiveTemplate}
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

      {importOpen && (
        <ImportDialog
          value={importText}
          onChange={setImportText}
          onApply={applyImport}
          onClose={closeImport}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export default App
