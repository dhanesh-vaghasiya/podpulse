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
    offsetSeconds: 0,
    severity: 'critical',
    description:
      'Memory Agent: heap growth 12.3 MB/min in auth-service - OOM predicted in 18 min (confidence: 94%)',
  },
  {
    offsetSeconds: 17,
    severity: 'critical',
    description:
      'Storage Agent: PVC read latency 5.1s in library-service - threshold: 1.0s (confidence: 87%)',
  },
  {
    offsetSeconds: 102,
    severity: 'warning',
    description:
      'CPU Agent: spike in student-portal matches login surge pattern - not anomalous (confidence: 91%)',
  },
  {
    offsetSeconds: 182,
    severity: 'info',
    description: 'Master Agent: 47 raw alerts correlated into 3 incidents',
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
    insight.id === insightId ? { ...insight, resolved: false } : insight,
  )
}

function HeaderBadgeGroup({ criticalCount, warningCount }) {
  const allNominal = criticalCount === 0 && warningCount === 0

  return (
    <div className="mr-1 hidden items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 md:flex">
      <StatusDot status={allNominal ? 'healthy' : 'critical'} />
      <span className={allNominal ? 'text-[#00ff88]' : undefined}>{criticalCount} critical</span>
      <span className="text-slate-600">/</span>
      <StatusDot status={allNominal ? 'healthy' : 'warning'} />
      <span className={allNominal ? 'text-[#00ff88]' : undefined}>{warningCount} warning</span>
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
        className="inline-flex items-center gap-2 rounded-md border border-[#ffaa00]/35 bg-[#ffaa00]/10 px-3 py-2 text-sm font-semibold text-[#ffd27a] transition hover:border-[#ffaa00]/70 hover:bg-[#ffaa00]/15"
      >
        Inject Failure
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-lg border border-white/10 bg-[#1a1d27] shadow-2xl shadow-black/40">
          <button
            type="button"
            onClick={() => selectFailure(onInjectMemory)}
            className="block w-full px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-[#ff4444]/10 hover:text-white"
          >
            Memory Leak — Auth Service
          </button>
          <button
            type="button"
            onClick={() => selectFailure(onInjectPvc)}
            className="block w-full border-t border-white/[0.06] px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-[#ffaa00]/10 hover:text-white"
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
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0f1117]/95 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg border border-[#4488ff]/30 bg-[#4488ff]/10 text-[#8fb2ff] shadow-[0_0_28px_rgba(68,136,255,0.18)]">
            <Shield size={21} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-white">CampusGuardian</h1>
              <StatusBadge
                status={clusterStatus}
                label={activeAnomalies > 0 ? 'cluster degraded' : 'cluster nominal'}
              />
            </div>
            <p className="text-xs text-slate-500">
              AI-powered Kubernetes observability for campus services
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <HeaderBadgeGroup criticalCount={criticalCount} warningCount={warningCount} />
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300">
            <Clock size={15} className="text-[#4488ff]" />
            <span className="font-mono text-slate-100">{clockText}</span>
            <span className="text-xs text-slate-500">Last scan: {lastScanAge}s ago</span>
          </div>
          <InjectFailureMenu onInjectMemory={onInjectMemory} onInjectPvc={onInjectPvc} />
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
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
            className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#1a1d27] px-4 py-3"
          >
            <div>
              <div className="text-xs uppercase tracking-[0.08em] text-slate-500">{item.label}</div>
              <div className="mt-1 text-lg font-semibold text-white">{item.value}</div>
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
    document
      .getElementById(`insight-${spotlightInsightId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [spotlightInsightId])

  const orderedInsights = useMemo(() => {
    const spotlight = insights.find((insight) => insight.id === spotlightInsightId)
    const rest = insights.filter((insight) => insight.id !== spotlightInsightId)
    return spotlight ? [spotlight, ...rest] : insights
  }, [insights, spotlightInsightId])

  return (
    <aside className="min-h-0 space-y-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-semibold text-white">AI Insights</h2>
          <p className="text-xs text-slate-500">Root cause cards and commands</p>
        </div>
        <StatusBadge
          status={activeAnomalies > 0 ? 'critical' : 'healthy'}
          label={`${activeAnomalies} active`}
        />
      </div>
      <div className="max-h-[calc(100vh-224px)] space-y-3 overflow-y-auto pr-1 lg:max-h-[calc(100vh-154px)]">
        {orderedInsights.map((insight) => (
          <AIInsightCard
            key={insight.id}
            insight={insight}
            podsById={podsById}
            isHighlighted={insight.id === spotlightInsightId}
            fixState={fixStates[insight.id]}
            onApplyFix={onApplyFix}
          />
        ))}
      </div>
    </aside>
  )
}

export default function App() {
  const [pods, setPods] = useState(() => PODS.map((pod) => ({ ...pod })))
  const [insights, setInsights] = useState(() =>
    AI_INSIGHTS.map((insight) => ({ ...insight, resolved: false })),
  )
  const [selectedPodId, setSelectedPodId] = useState('auth-service-5b2c')
  const [spotlightInsightId, setSpotlightInsightId] = useState(1)
  const [pulsePodId, setPulsePodId] = useState('auth-service-5b2c')
  const [animationKey, setAnimationKey] = useState(0)
  const [memoryData, setMemoryData] = useState(MEMORY_TIMELINE)
  const [cpuData, setCpuData] = useState(CPU_TIMELINE)
  const [pvcData, setPvcData] = useState(PVC_TIMELINE)
  const [networkData, setNetworkData] = useState(NETWORK_TIMELINE)
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
      'Memory Agent: injected memory leak in auth-service - heap growth 12.3 MB/min (confidence: 94%)',
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
      'Storage Agent: injected PVC bottleneck in library-service - read latency 5.1s (confidence: 87%)',
    )
  }

  function resetDemo() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current = []
    scanCycleRef.current = 841
    setPods(PODS.map((pod) => ({ ...pod })))
    setInsights(AI_INSIGHTS.map((insight) => ({ ...insight, resolved: false })))
    setSelectedPodId('auth-service-5b2c')
    setSpotlightInsightId(1)
    setPulsePodId('auth-service-5b2c')
    setMemoryData(MEMORY_TIMELINE)
    setCpuData(CPU_TIMELINE)
    setPvcData(PVC_TIMELINE)
    setNetworkData(NETWORK_TIMELINE)
    setFixStates({})
    setEventLog(createInitialEventLog())
    setLastScanAge(0)
    setAnimationKey((key) => key + 1)
    schedule(() => setPulsePodId(null), 1800)
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
    <div className="min-h-screen bg-[#0f1117] text-slate-100">
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

      <main className="grid min-h-[calc(100vh-65px)] grid-cols-1 gap-3 p-3 lg:grid-cols-[250px_minmax(0,1fr)_320px]">
        <aside className="min-h-0 space-y-3">
          <KPICards pods={pods} />
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
        </aside>

        <section className="min-w-0 space-y-3">
          <SignalStrip
            clusterCpu={clusterCpu}
            clusterMemory={clusterMemory}
            healthyCount={healthyCount}
            restartCount={restartCount}
          />
          <DependencyGraph
            pods={pods}
            selectedPodId={selectedPodId}
            pulsePodId={pulsePodId}
            criticalCount={criticalCount}
            warningCount={warningCount}
            onSelectPod={handleSelectPod}
          />
          <ResourceCharts
            pods={pods}
            memoryData={memoryData}
            cpuData={cpuData}
            pvcData={pvcData}
            networkData={networkData}
            animationKey={animationKey}
          />
          <LiveEventLog events={eventLog} onClear={() => setEventLog([])} />
        </section>

        <RightPanel
          insights={insights}
          podsById={podsById}
          spotlightInsightId={spotlightInsightId}
          activeAnomalies={activeAnomalies}
          fixStates={fixStates}
          onApplyFix={applyFix}
        />
      </main>

      <footer className="border-t border-white/10 px-4 py-4 text-center text-xs text-slate-600">
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
