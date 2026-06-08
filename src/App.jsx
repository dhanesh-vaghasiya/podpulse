import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import 'reactflow/dist/style.css'
import { CheckCircle, ChevronDown, Clock, Cpu, Gauge, RefreshCcw, Server, Shield } from 'lucide-react'
import AIInsightCard from './components/AIInsightCard'
import DependencyGraph from './components/DependencyGraph'
import KPICards from './components/KPICards'
import LiveEventLog from './components/LiveEventLog'
import PodDetailsModal from './components/PodDetailsModal'
import PodGrid from './components/PodGrid'
import ResourceCharts from './components/ResourceCharts'
import { StatusBadge, StatusDot } from './components/status'
import { getStatusMeta } from './components/statusMeta'
import {
  AI_INSIGHTS,
  CPU_TIMELINE,
  DEPENDENCY_GRAPH,
  MEMORY_TIMELINE,
  NETWORK_TIMELINE,
  PODS,
  PVC_TIMELINE,
  hasIndependentIssue,
} from './data/staticData'
import './App.css'

const RECOVERED_MEMORY_TIMELINE = MEMORY_TIMELINE.map((point, index) => ({
  ...point,
  authService: [42, 43, 44, 45, 46, 45, 44, 43][index],
  libraryService: [38, 39, 40, 42, 43, 44, 44, 43][index],
  studentPortal: [35, 42, 48, 53, 58, 56, 54, 52][index],
}))

const RECOVERED_CPU_TIMELINE = CPU_TIMELINE.map((point, index) => ({
  ...point,
  studentPortal: [18, 24, 34, 42, 48, 45, 43, 41][index],
  authService: [22, 25, 27, 29, 31, 28, 26, 24][index],
  apiGateway: [31, 34, 38, 42, 45, 43, 41, 39][index],
}))

const RECOVERED_PVC_TIMELINE = PVC_TIMELINE.map((point, index) => ({
  ...point,
  latency: [0.12, 0.14, 0.16, 0.2, 0.24, 0.22, 0.2, 0.18][index],
}))

const QUIET_NETWORK_TIMELINE = NETWORK_TIMELINE.map((point, index) => ({
  ...point,
  requests: [860, 930, 1040, 1220, 1360, 1290, 1180, 1100][index],
  errors: [4, 5, 6, 8, 9, 7, 6, 5][index],
}))

const INITIAL_LOG_SEED = [
  {
    offsetSeconds: 102,
    severity: 'warning',
    description:
      'CPU Agent: spike in student-portal matches login surge pattern - not anomalous (confidence: 91%)',
  },
  {
    offsetSeconds: 182,
    severity: 'info',
    description: 'Master Agent: 0 raw alerts correlated',
  },
  {
    offsetSeconds: 252,
    severity: 'info',
    description: 'Network Agent: dependency graph updated - 8 nodes, 8 edges mapped',
  },
  {
    offsetSeconds: 312,
    severity: 'info',
    description: 'Scan cycle #841 completed - 8 pods checked in 23s',
  },
]

function formatTime(date) {
  return new Intl.DateTimeFormat('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function makeEvent(severity, description, date = new Date()) {
  return {
    id: `${date.getTime()}-${Math.random().toString(36).slice(2)}`,
    time: formatTime(date),
    severity,
    description,
  }
}

function createInitialEventLog() {
  const now = new Date()

  return INITIAL_LOG_SEED.map((event) =>
    makeEvent(
      event.severity,
      event.description,
      new Date(now.getTime() - event.offsetSeconds * 1000),
    ),
  )
}

function getDependentPodIds(podId) {
  const dependents = new Set()
  const visit = (targetId) => {
    DEPENDENCY_GRAPH.edges
      .filter((edge) => edge.target === targetId)
      .forEach((edge) => {
        if (!dependents.has(edge.source)) {
          dependents.add(edge.source)
          visit(edge.source)
        }
      })
  }

  visit(podId)

  DEPENDENCY_GRAPH.edges
    .filter((edge) => edge.source === podId)
    .forEach((edge) => dependents.add(edge.target))

  return dependents
}

function canAutoRecover(podId, insightsAfterFix) {
  const impactedByUnresolved = insightsAfterFix.some(
    (insight) => !insight.resolved && insight.impact.includes(podId),
  )

  return !hasIndependentIssue(podId, insightsAfterFix) && !impactedByUnresolved
}

function resetInsightState(insights, insightId) {
  return insights.map((insight) =>
    insight.id === insightId ? { ...insight, active: true, resolved: false } : insight,
  )
}

function HeaderBadgeGroup({ criticalCount, warningCount }) {
  const allNominal = criticalCount === 0 && warningCount === 0

  return (
    <div className="mr-1 hidden items-center gap-2 rounded-md border border-[rgba(168,196,101,0.2)] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-sm text-[#dad7cd] md:flex">
      <StatusDot status={allNominal ? 'healthy' : 'critical'} />
      <span>
        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs border ${
          allNominal 
            ? 'border-[rgba(34,197,94,0.35)] bg-[rgba(22,163,74,0.15)] text-[#22c55e]' 
            : 'border-[rgba(220,38,38,0.35)] bg-[rgba(220,38,38,0.12)] text-[#DC2626]'
        }`}>{criticalCount} critical</span>
      </span>
      <span className="text-[#555555]">/</span>
      <StatusDot status={allNominal ? 'healthy' : 'warning'} />
      <span>
        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs border ${
          allNominal 
            ? 'border-[rgba(34,197,94,0.35)] bg-[rgba(22,163,74,0.15)] text-[#22c55e]' 
            : 'border-[rgba(217,119,6,0.35)] bg-[rgba(217,119,6,0.12)] text-[#D97706]'
        }`}>{warningCount} warning</span>
      </span>
    </div>
  )
}

function InjectFailureMenu({ onInjectMemory, onInjectPvc }) {
  const [open, setOpen] = useState(false)

  function selectFailure(handler) {
    handler()
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-md border border-[rgba(217,119,6,0.35)] bg-[rgba(217,119,6,0.12)] px-3 py-2 text-sm font-semibold text-[#D97706] transition hover:bg-[#D97706] hover:text-black pulse-inject"
      >
        Inject Failure
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-lg border border-[rgba(168,196,101,0.4)] bg-[#111111] shadow-[0_8px_24px_rgba(0,0,0,0.5),0_0_16px_rgba(168,196,101,0.15)]">
          <button
            type="button"
            onClick={() => selectFailure(onInjectMemory)}
            className="block w-full px-3.5 py-2.5 text-left text-sm text-[#dad7cd] transition hover:bg-[rgba(255,255,255,0.08)] hover:text-white hover:border-l-2 hover:border-l-[#DC2626]"
          >
            Memory Leak — Auth Service
          </button>
          <button
            type="button"
            onClick={() => selectFailure(onInjectPvc)}
            className="block w-full border-t border-[rgba(168,196,101,0.08)] px-3.5 py-2.5 text-left text-sm text-[#dad7cd] transition hover:bg-[rgba(255,255,255,0.08)] hover:text-white hover:border-l-2 hover:border-l-[#D97706]"
          >
            PVC Bottleneck — Library Service
          </button>
        </div>
      )}
    </div>
  )
}

function ClusterHeader({
  criticalCount,
  warningCount,
  activeAnomalies,
  clockText,
  lastScanAge,
  onInjectMemory,
  onInjectPvc,
  onReset,
}) {
  const clusterStatus = activeAnomalies > 0 ? 'critical' : 'healthy'

  return (
    <header className="sticky top-0 z-20 border-b border-[rgba(168,196,101,0.2)] bg-[#111111]/95 px-4 py-3 backdrop-blur" style={{boxShadow:'0 1px 0 rgba(168,196,101,0.08)'}}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[rgba(168,196,101,0.2)] bg-[rgba(168,196,101,0.05)] overflow-hidden">
            <img src="/logo.png" alt="PodPulse Logo" className="h-8 w-8 object-contain" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-white">PodPulse</h1>
              <StatusBadge
                status={clusterStatus}
                label={activeAnomalies > 0 ? 'cluster degraded' : 'cluster nominal'}
              />
            </div>
            <p className="text-xs text-[#555555]">
              AI-powered Kubernetes observability for campus services
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <HeaderBadgeGroup criticalCount={criticalCount} warningCount={warningCount} />
          <div className="flex items-center gap-2 rounded-md border border-[rgba(168,196,101,0.2)] bg-[rgba(168,196,101,0.08)] px-2.5 py-1 text-sm">
            <Clock size={15} className="text-[#A8C465]" />
            <span className="font-mono text-[#A8C465]">{clockText}</span>
            <span className="text-xs text-[#A8C465]">Last scan: {lastScanAge}s ago</span>
          </div>
          <InjectFailureMenu onInjectMemory={onInjectMemory} onInjectPvc={onInjectPvc} />
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[rgba(168,196,101,0.2)] bg-[rgba(255,255,255,0.05)] text-[#555555] transition hover:text-[#A8C465] hover:border-[rgba(168,196,101,0.4)]"
            title="Reset demo"
            aria-label="Reset demo"
          >
            <RefreshCcw size={15} />
          </button>
        </div>
      </div>
    </header>
  )
}

function SignalStrip({ clusterCpu, clusterMemory, healthyCount, restartCount }) {
  return (
    <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {[
        { label: 'Cluster CPU', value: `${clusterCpu}%`, icon: Cpu, status: clusterCpu >= 70 ? 'warning' : 'info' },
        {
          label: 'Cluster Memory',
          value: `${clusterMemory}%`,
          icon: Gauge,
          status: clusterMemory >= 80 ? 'critical' : clusterMemory >= 60 ? 'warning' : 'healthy',
        },
        { label: 'Healthy Pods', value: healthyCount, icon: CheckCircle, status: 'healthy' },
        { label: 'Restarts', value: restartCount, icon: Server, status: restartCount > 0 ? 'warning' : 'healthy' },
      ].map((item) => {
        const Icon = item.icon
        const meta = getStatusMeta(item.status)

        return (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 rounded-[10px] border border-[rgba(168,196,101,0.2)] bg-[rgba(255,255,255,0.05)] px-4 py-3 transition duration-200 hover:bg-[rgba(255,255,255,0.08)] hover:border-[rgba(168,196,101,0.4)]"
          >
            <div>
              <div className="text-xs uppercase tracking-[0.08em] text-[#555555]">{item.label}</div>
              <div className="mt-1 text-lg font-bold text-white">{item.value}</div>
            </div>
            <span className={`grid h-9 w-9 place-items-center rounded-md ${meta.bg} ${meta.text}`}>
              <Icon size={18} />
            </span>
          </div>
        )
      })}
    </section>
  )
}

function RightPanel({
  insights,
  podsById,
  spotlightInsightId,
  activeAnomalies,
  fixStates,
  onApplyFix,
}) {
  useEffect(() => {
    if (spotlightInsightId !== null) {
      document
        .getElementById(`insight-${spotlightInsightId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [spotlightInsightId])

  const orderedInsights = useMemo(() => {
    const active = insights.filter((insight) => insight.active)
    if (spotlightInsightId === null) return active
    const spotlight = active.find((insight) => insight.id === spotlightInsightId)
    const rest = active.filter((insight) => insight.id !== spotlightInsightId)
    return spotlight ? [spotlight, ...rest] : active
  }, [insights, spotlightInsightId])

  const activeCount = useMemo(() => {
    return insights.filter((insight) => insight.active && !insight.resolved).length
  }, [insights])

  return (
    <aside className="rounded-lg border border-[rgba(168,196,101,0.2)] bg-[#111111] p-4 h-full flex flex-col">
      <div className="mb-3 flex items-center justify-between pb-3 border-b border-[rgba(168,196,101,0.08)]">
        <div>
          <h2 className="text-sm font-semibold text-white">AI Insights</h2>
          <p className="text-xs text-[#555555]">Root cause cards and commands</p>
        </div>
        <StatusBadge
          status={activeCount > 0 ? 'critical' : 'healthy'}
          label={`${activeCount} active`}
        />
      </div>
      <div className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">
        {orderedInsights.length === 0 ? (
          <div className="rounded-[10px] border border-[rgba(168,196,101,0.15)] bg-[rgba(255,255,255,0.05)] p-4 text-center text-xs text-[#555555]">
            No active anomalies or insights detected. Use "Inject Failure" to simulate an incident.
          </div>
        ) : (
          orderedInsights.map((insight) => (
            <AIInsightCard
              key={insight.id}
              insight={insight}
              podsById={podsById}
              isHighlighted={insight.id === spotlightInsightId}
              fixState={fixStates[insight.id]}
              onApplyFix={onApplyFix}
            />
          ))
        )}
      </div>
    </aside>
  )
}

export default function App() {
  const [pods, setPods] = useState(() =>
    PODS.map((pod) => ({
      ...pod,
      status: 'healthy',
      cpu: pod.cpuBaseline,
      memory: pod.memBaseline,
      restarts: 0,
      phase: 'Running',
    })),
  )
  const [insights, setInsights] = useState(() =>
    AI_INSIGHTS.map((insight) => ({ ...insight, active: false, resolved: false })),
  )
  const [selectedPodId, setSelectedPodId] = useState(null)
  const [spotlightInsightId, setSpotlightInsightId] = useState(null)
  const [pulsePodId, setPulsePodId] = useState(null)
  const [animationKey, setAnimationKey] = useState(0)
  const [memoryData, setMemoryData] = useState(RECOVERED_MEMORY_TIMELINE)
  const [cpuData, setCpuData] = useState(RECOVERED_CPU_TIMELINE)
  const [pvcData, setPvcData] = useState(RECOVERED_PVC_TIMELINE)
  const [networkData, setNetworkData] = useState(QUIET_NETWORK_TIMELINE)
  const [fixStates, setFixStates] = useState({})
  const [eventLog, setEventLog] = useState(createInitialEventLog)
  const [clockNow, setClockNow] = useState(() => new Date())
  const [lastScanAge, setLastScanAge] = useState(0)
  
  const [isPodModalOpen, setIsPodModalOpen] = useState(false)
  const [modalScrollPodId, setModalScrollPodId] = useState(null)
  const [modalHighlightPodId, setModalHighlightPodId] = useState(null)

  const timersRef = useRef([])
  const scanCycleRef = useRef(841)

  const addEventLog = useCallback((severity, description, date = new Date()) => {
    setEventLog((current) => [makeEvent(severity, description, date), ...current].slice(0, 50))
  }, [])

  useEffect(() => {
    const initialPulse = window.setTimeout(() => setPulsePodId(null), 1800)
    return () => {
      window.clearTimeout(initialPulse)
      timersRef.current.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    const clockTimer = window.setInterval(() => setClockNow(new Date()), 1000)
    return () => window.clearInterval(clockTimer)
  }, [])

  useEffect(() => {
    const ageTimer = window.setInterval(() => {
      setLastScanAge((current) => current + 1)
    }, 1000)
    const scanTimer = window.setInterval(() => {
      scanCycleRef.current += 1
      addEventLog(
        'info',
        `Scan cycle #${scanCycleRef.current} completed - ${pods.length} pods checked in ${
          18 + Math.floor(Math.random() * 11)
        }s`,
      )
      setLastScanAge(0)
    }, 15000)

    return () => {
      window.clearInterval(ageTimer)
      window.clearInterval(scanTimer)
    }
  }, [addEventLog, pods.length])

  const podsById = useMemo(() => new Map(pods.map((pod) => [pod.id, pod])), [pods])
  const criticalCount = useMemo(
    () => pods.filter((pod) => pod.status === 'critical').length,
    [pods],
  )
  const warningCount = useMemo(
    () => pods.filter((pod) => pod.status === 'warning').length,
    [pods],
  )
  const healthyCount = useMemo(
    () => pods.filter((pod) => pod.status === 'healthy').length,
    [pods],
  )
  const activeAnomalies = useMemo(
    () => pods.filter((pod) => pod.status === 'critical' || pod.status === 'warning').length,
    [pods],
  )
  const clusterCpu = useMemo(
    () => Math.round(pods.reduce((sum, pod) => sum + pod.cpu, 0) / Math.max(pods.length, 1)),
    [pods],
  )
  const clusterMemory = useMemo(
    () => Math.round(pods.reduce((sum, pod) => sum + pod.memory, 0) / Math.max(pods.length, 1)),
    [pods],
  )
  const restartCount = useMemo(
    () => pods.reduce((sum, pod) => sum + pod.restarts, 0),
    [pods],
  )
  const clockText = useMemo(() => formatTime(clockNow), [clockNow])

  function schedule(callback, delay) {
    const timer = window.setTimeout(callback, delay)
    timersRef.current.push(timer)
  }

  function clearFixState(insightId) {
    setFixStates((current) => {
      const next = { ...current }
      delete next[insightId]
      return next
    })
  }

  function animateChartTo(setter, recoveredData, alertData) {
    setter(recoveredData)
    setAnimationKey((key) => key + 1)
    schedule(() => {
      setter(alertData)
      setAnimationKey((key) => key + 1)
    }, 180)
  }

  function getInsightForPod(podId) {
    return (
      insights.find((insight) => insight.rootCause === podId && !insight.resolved) ??
      insights.find((insight) => insight.impact.includes(podId) && !insight.resolved) ??
      insights.find((insight) => insight.rootCause === podId || insight.impact.includes(podId))
    )
  }

  function highlightPodAndInsight(podId, insightId) {
    setSelectedPodId(podId)
    setPulsePodId(podId)
    if (insightId) setSpotlightInsightId(insightId)
    schedule(() => setPulsePodId(null), 2000)
  }

  function handleSelectPod(podId) {
    const insight = getInsightForPod(podId)
    highlightPodAndInsight(podId, insight?.id)
  }

  function handlePodGridClick(podId) {
    const pod = podsById.get(podId)
    setIsPodModalOpen(true)
    setModalScrollPodId(podId)
    if (pod?.status === 'critical' || pod?.status === 'warning') {
      setModalHighlightPodId(podId)
      schedule(() => setModalHighlightPodId(null), 1600)
    } else {
      setModalHighlightPodId(null)
    }
  }

  function handleViewInsightFromModal(podId) {
    setIsPodModalOpen(false)
    handleSelectPod(podId)
  }

  function injectMemoryLeak() {
    const insightId = 1

    setPods((current) =>
      current.map((pod) => {
        if (pod.id === 'auth-service-5b2c') {
          return { ...pod, status: 'critical', cpu: 45, memory: 89, restarts: 3, phase: undefined }
        }
        if (pod.id === 'api-gateway-2f8a' || pod.id === 'student-portal-7d9f') {
          return {
            ...pod,
            status: pod.status === 'critical' ? 'critical' : 'warning',
            phase: undefined,
          }
        }
        return pod
      }),
    )
    setInsights((current) => resetInsightState(current, insightId))
    clearFixState(insightId)
    animateChartTo(setMemoryData, RECOVERED_MEMORY_TIMELINE, MEMORY_TIMELINE)
    setCpuData(CPU_TIMELINE)
    highlightPodAndInsight('auth-service-5b2c', insightId)
    addEventLog(
      'critical',
      'Memory Agent: heap growth 12.3 MB/min in auth-service - OOM predicted in 18 min (confidence: 94%)',
    )
  }

  function injectPvcBottleneck() {
    const insightId = 2

    setPods((current) =>
      current.map((pod) => {
        if (pod.id === 'library-service-8a1e') {
          return { ...pod, status: 'critical', cpu: 34, memory: 91, restarts: 2, phase: undefined }
        }
        if (pod.id === 'student-portal-7d9f') {
          return {
            ...pod,
            status: pod.status === 'critical' ? 'critical' : 'warning',
            phase: undefined,
          }
        }
        return pod
      }),
    )
    setInsights((current) => resetInsightState(current, insightId))
    clearFixState(insightId)
    animateChartTo(setPvcData, RECOVERED_PVC_TIMELINE, PVC_TIMELINE)
    setMemoryData(MEMORY_TIMELINE)
    highlightPodAndInsight('library-service-8a1e', insightId)
    addEventLog(
      'critical',
      'Storage Agent: PVC read latency 5.1s in library-service - threshold: 1.0s (confidence: 87%)',
    )
  }

  function resetDemo() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current = []
    scanCycleRef.current = 841
    setPods(
      PODS.map((pod) => ({
        ...pod,
        status: 'healthy',
        cpu: pod.cpuBaseline,
        memory: pod.memBaseline,
        restarts: 0,
        phase: 'Running',
      })),
    )
    setInsights(AI_INSIGHTS.map((insight) => ({ ...insight, active: false, resolved: false })))
    setSelectedPodId(null)
    setSpotlightInsightId(null)
    setPulsePodId(null)
    setMemoryData(RECOVERED_MEMORY_TIMELINE)
    setCpuData(RECOVERED_CPU_TIMELINE)
    setPvcData(RECOVERED_PVC_TIMELINE)
    setNetworkData(QUIET_NETWORK_TIMELINE)
    setFixStates({})
    setEventLog(createInitialEventLog())
    setLastScanAge(0)
    setAnimationKey((key) => key + 1)
  }

  function applyFix(insight) {
    const podId = insight.rootCause
    const pod = podsById.get(podId)
    const insightsAfterFix = insights.map((item) =>
      item.rootCause === podId ? { ...item, resolved: true } : item,
    )
    const autoRecoverIds = new Set([...getDependentPodIds(podId), ...insight.impact])
    autoRecoverIds.delete(podId)

    const recoverableIds = new Set(
      [...autoRecoverIds].filter((id) => canAutoRecover(id, insightsAfterFix)),
    )
    const autoRecoveredCount = pods.filter(
      (item) => recoverableIds.has(item.id) && item.status !== 'healthy',
    ).length

    setSelectedPodId(podId)
    setSpotlightInsightId(insight.id)
    setPulsePodId(podId)
    setFixStates((current) => ({ ...current, [insight.id]: 'terminating' }))
    setPods((current) =>
      current.map((item) =>
        item.id === podId ? { ...item, status: 'warning', phase: 'Terminating' } : item,
      ),
    )

    if (insight.id === 1) {
      setMemoryData(RECOVERED_MEMORY_TIMELINE)
      setCpuData(RECOVERED_CPU_TIMELINE)
    }

    if (insight.id === 2) {
      setPvcData(RECOVERED_PVC_TIMELINE)
      setMemoryData(RECOVERED_MEMORY_TIMELINE)
    }

    if (insight.id === 3) {
      setCpuData(RECOVERED_CPU_TIMELINE)
      setNetworkData(QUIET_NETWORK_TIMELINE)
    }

    setAnimationKey((key) => key + 1)

    schedule(() => {
      setPods((current) =>
        current.map((item) => {
          if (item.id === podId) {
            return {
              ...item,
              status: 'healthy',
              cpu: item.cpuBaseline,
              memory: item.memBaseline,
              restarts: insight.severity === 'critical' ? (pod?.restarts ?? item.restarts) + 1 : item.restarts,
              phase: 'Running',
            }
          }

          if (recoverableIds.has(item.id)) {
            return {
              ...item,
              status: 'healthy',
              cpu: item.cpuBaseline,
              memory: item.memBaseline,
              phase: 'Running',
            }
          }

          return item
        }),
      )
      setInsights(insightsAfterFix)
      setFixStates((current) => ({ ...current, [insight.id]: 'running' }))
      addEventLog(
        'resolved',
        `${pod?.id ?? podId} restarted - resources normalized to baseline. ${autoRecoveredCount} downstream pods auto-recovered.`,
      )
    }, 1100)

    schedule(() => setPulsePodId(null), 2600)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#dad7cd]">
      <ClusterHeader
        criticalCount={criticalCount}
        warningCount={warningCount}
        activeAnomalies={activeAnomalies}
        clockText={clockText}
        lastScanAge={lastScanAge}
        onInjectMemory={injectMemoryLeak}
        onInjectPvc={injectPvcBottleneck}
        onReset={resetDemo}
      />

      <main className="w-full space-y-4 p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_360px] lg:h-[750px] items-stretch">
          <aside className="flex flex-col gap-3 h-full min-h-0">
            <KPICards pods={pods} />
            <div className="flex-1 min-h-0">
              <PodGrid 
                pods={pods} 
                selectedPodId={selectedPodId} 
                onPodClick={handlePodGridClick} 
                onOpenModal={() => {
                  setModalScrollPodId(null)
                  setModalHighlightPodId(null)
                  setIsPodModalOpen(true)
                }}
              />
            </div>
          </aside>

          <div className="flex flex-col gap-3 h-full min-h-0">
            <SignalStrip
              clusterCpu={clusterCpu}
              clusterMemory={clusterMemory}
              healthyCount={healthyCount}
              restartCount={restartCount}
            />
            <div className="flex-grow min-h-0">
              <DependencyGraph
                pods={pods}
                selectedPodId={selectedPodId}
                pulsePodId={pulsePodId}
                criticalCount={criticalCount}
                warningCount={warningCount}
                onSelectPod={handleSelectPod}
              />
            </div>
          </div>

          <div className="h-full min-h-0">
            <RightPanel
              insights={insights}
              podsById={podsById}
              spotlightInsightId={spotlightInsightId}
              activeAnomalies={activeAnomalies}
              fixStates={fixStates}
              onApplyFix={applyFix}
            />
          </div>
        </div>

        <div className="space-y-4">
          <ResourceCharts
            pods={pods}
            memoryData={memoryData}
            cpuData={cpuData}
            pvcData={pvcData}
            networkData={networkData}
            animationKey={animationKey}
          />
          <LiveEventLog events={eventLog} onClear={() => setEventLog([])} />
        </div>
      </main>

      <footer className="border-t border-[rgba(168,196,101,0.2)] bg-[#111111] px-4 py-4 text-center text-xs font-mono text-[#555555]">
        Demo Cluster: smart-campus • v1.28.4 • minikube-node-1
      </footer>

      <PodDetailsModal
        isOpen={isPodModalOpen}
        onClose={() => setIsPodModalOpen(false)}
        pods={pods}
        insights={insights}
        onViewInsight={handleViewInsightFromModal}
        scrollPodId={modalScrollPodId}
        highlightPodId={modalHighlightPodId}
      />
    </div>
  )
}
