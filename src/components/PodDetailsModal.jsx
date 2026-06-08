import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCcw, Search, X } from 'lucide-react'
import { StatusDot } from './status'
import { getStatusMeta } from './statusMeta'

const NAMESPACE_COLORS = {
  academic: 'border-[rgba(122,158,151,0.3)] bg-[rgba(122,158,151,0.15)] text-[#7A9E97]',
  security: 'border-[rgba(151,122,168,0.3)] bg-[rgba(151,122,168,0.15)] text-[#9E7AA8]',
  finance: 'border-[rgba(168,196,101,0.35)] bg-[rgba(168,196,101,0.12)] text-[#A8C465]',
  ops: 'border-[rgba(168,196,101,0.2)] bg-[rgba(255,255,255,0.05)] text-[#555555]',
  infra: 'border-[rgba(168,140,122,0.3)] bg-[rgba(168,140,122,0.15)] text-[#A88C7A]',
  data: 'border-[rgba(122,158,151,0.35)] bg-[rgba(122,158,151,0.12)] text-[#7A9E97]',
}

function ProgressBar({ value, thresholds }) {
  let gradient = 'linear-gradient(90deg, #22c55e, #16a34a)' // green
  if (value >= thresholds.red) gradient = 'linear-gradient(90deg, #DC2626, #EF4444)' // red
  else if (value >= thresholds.amber) gradient = 'linear-gradient(90deg, #D97706, #F59E0B)' // amber

  return (
    <div className="mt-1 h-[6px] w-[120px] overflow-hidden rounded-sm bg-[rgba(255,255,255,0.06)]">
      <div
        className="h-full rounded-sm transition-all duration-300"
        style={{ width: `${Math.min(value, 100)}%`, background: gradient }}
      />
    </div>
  )
}

function StatusBadge({ status }) {
  let colorClass = 'border-[rgba(34,197,94,0.35)] bg-[rgba(22,163,74,0.15)] text-[#22c55e]'
  let text = 'HEALTHY'
  if (status === 'critical') {
    colorClass = 'border-[rgba(220,38,38,0.35)] bg-[rgba(220,38,38,0.12)] text-[#DC2626] shadow-[0_0_6px_rgba(220,38,38,0.2)]'
    text = 'CRITICAL'
  } else if (status === 'warning') {
    colorClass = 'border-[rgba(217,119,6,0.35)] bg-[rgba(217,119,6,0.12)] text-[#D97706]'
    text = 'WARNING'
  }

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider ${colorClass}`}>
      <StatusDot status={status} className={`h-1.5 w-1.5 ${status === 'critical' ? 'pod-dot-critical' : ''}`} />
      {text}
    </div>
  )
}

export default function PodDetailsModal({
  isOpen,
  onClose,
  pods,
  insights,
  onViewInsight,
  scrollPodId,
  highlightPodId,
}) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const rowRefs = useRef({})

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen && scrollPodId && rowRefs.current[scrollPodId]) {
      // Scroll slightly after render to ensure layout
      setTimeout(() => {
        rowRefs.current[scrollPodId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
    }
  }, [isOpen, scrollPodId])

  const criticalCount = useMemo(() => pods.filter((p) => p.status === 'critical').length, [pods])
  const warningCount = useMemo(() => pods.filter((p) => p.status === 'warning').length, [pods])
  const healthyCount = useMemo(() => pods.filter((p) => p.status === 'healthy').length, [pods])

  const filteredPods = useMemo(() => {
    return pods.filter((pod) => {
      const matchFilter = filter === 'all' || pod.status === filter
      const matchSearch =
        search === '' ||
        pod.id.toLowerCase().includes(search.toLowerCase()) ||
        pod.namespace.toLowerCase().includes(search.toLowerCase())
      return matchFilter && matchSearch
    })
  }, [pods, filter, search])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/85 backdrop-blur-[4px]" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative flex h-[80vh] w-[85vw] flex-col overflow-hidden rounded-2xl border border-[rgba(168,196,101,0.2)] bg-[#111111] shadow-[0_24px_64px_rgba(0,0,0,0.6),0_0_40px_rgba(168,196,101,0.15)]">
        
        {/* Section 1: Header */}
        <div className="flex flex-col gap-4 border-b border-[rgba(168,196,101,0.2)] bg-[#111111] p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-[20px] font-bold text-white leading-tight">Pod Health Overview</h2>
              <p className="text-[13px] text-[#555555]">minikube-node-1 • {pods.length} pods observed</p>
            </div>
            
            <div className="ml-2 hidden h-8 w-px bg-[rgba(168,196,101,0.2)] lg:block" />
            
            <div className="hidden gap-2 lg:flex">
              <span className="inline-flex items-center rounded-md border border-[rgba(220,38,38,0.35)] bg-[rgba(220,38,38,0.12)] px-2 py-1 text-xs font-bold text-[#DC2626]">
                {criticalCount} CRITICAL
              </span>
              <span className="inline-flex items-center rounded-md border border-[rgba(217,119,6,0.35)] bg-[rgba(217,119,6,0.12)] px-2 py-1 text-xs font-bold text-[#D97706]">
                {warningCount} WARNING
              </span>
              <span className="inline-flex items-center rounded-md border border-[rgba(34,197,94,0.35)] bg-[rgba(22,163,74,0.15)] px-2 py-1 text-xs font-bold text-[#22c55e]">
                {healthyCount} HEALTHY
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-full border border-[rgba(168,196,101,0.15)] bg-[rgba(255,255,255,0.03)] p-0.5 items-center">
              {['all', 'critical', 'warning', 'healthy'].map((f) => {
                const isActive = filter === f
                const status = f === 'all' ? 'active' : f
                const meta = getStatusMeta(status)

                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-full px-3 py-1 text-[11px] font-medium capitalize font-sans transition-all duration-200 ${
                      isActive
                        ? `${meta.bg} ${meta.text}`
                        : 'text-[#555555] hover:text-[#dad7cd]'
                    }`}
                    style={{
                      boxShadow: isActive ? `0 0 6px ${meta.line}1a` : undefined,
                      border: isActive ? `1px solid ${meta.line}50` : '1px solid transparent'
                    }}
                  >
                    {f}
                  </button>
                )
              })}
              <div className="mx-1 w-px h-4 bg-[rgba(168,196,101,0.15)]" />
              <button disabled className="px-3 py-1 text-[11px] font-medium font-sans text-[#555555] cursor-not-allowed">
                by Namespace ▾
              </button>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555555]" />
              <input
                type="text"
                placeholder="Search pods..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-48 rounded-md border border-[rgba(168,196,101,0.2)] bg-[rgba(255,255,255,0.05)] pl-8 pr-3 text-xs text-[#dad7cd] placeholder-[#555555] focus:border-[rgba(168,196,101,0.4)] focus:outline-none focus:ring-1 focus:shadow-[0_0_0_3px_rgba(168,196,101,0.2)]"
              />
            </div>
            
            <button 
              onClick={onClose}
              className="ml-1 rounded-md border border-[rgba(168,196,101,0.2)] bg-[rgba(255,255,255,0.05)] p-1.5 text-[#555555] transition hover:bg-[rgba(220,38,38,0.12)] hover:border-[rgba(220,38,38,0.35)] hover:text-[#DC2626]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Section 2: Table */}
        <div className="flex-1 overflow-auto bg-transparent">
          <table className="w-full text-left text-sm text-[#dad7cd]">
            <thead className="sticky top-0 z-10 bg-[#0a0a0a] text-[11px] uppercase tracking-[0.06em] text-[#555555] after:absolute after:bottom-0 after:left-0 after:right-0 after:border-b after:border-[rgba(168,196,101,0.2)]">
              <tr>
                <th className="px-4 py-3 font-semibold w-[80px]">Status</th>
                <th className="px-4 py-3 font-semibold w-[200px]">Pod Name</th>
                <th className="px-4 py-3 font-semibold w-[150px]">CPU</th>
                <th className="px-4 py-3 font-semibold w-[150px]">Memory</th>
                <th className="px-4 py-3 font-semibold text-center w-[80px]">Restarts</th>
                <th className="px-4 py-3 font-semibold w-[130px]">Node</th>
                <th className="px-4 py-3 font-semibold w-[60px]">Age</th>
                <th className="px-4 py-3 font-semibold w-[120px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(168,196,101,0.08)]">
              {filteredPods.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-[#555555]">
                    No pods found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredPods.map((pod, index) => {
                  const isHighlighted = highlightPodId === pod.id
                  const hasInsight =
                    (pod.status === 'critical' || pod.status === 'warning') &&
                    insights.some(
                      (insight) =>
                        !insight.resolved &&
                        (insight.rootCause === pod.id || insight.impact.includes(pod.id))
                    )

                  // Colors and styling based on status
                  const isCritical = pod.status === 'critical'
                  const isWarning = pod.status === 'warning'
                  const bgClass = index % 2 === 0 ? 'bg-[rgba(255,255,255,0.05)]' : 'bg-transparent'
                  let borderLeft = '3px solid transparent'
                  if (isCritical) borderLeft = '3px solid #DC2626'
                  else if (isWarning) borderLeft = '3px solid #D97706'
                  
                  // Restart color
                  let restartColor = 'text-[#555555]'
                  if (pod.restarts >= 3) restartColor = 'text-[#DC2626] font-semibold'
                  else if (pod.restarts > 0) restartColor = 'text-[#D97706]'

                  const namespaceStyle = NAMESPACE_COLORS[pod.namespace] || NAMESPACE_COLORS['ops']

                  return (
                    <tr
                      key={pod.id}
                      ref={(el) => (rowRefs.current[pod.id] = el)}
                      className={`h-[56px] transition-colors duration-150 hover:bg-[rgba(255,255,255,0.08)] ${bgClass} ${isHighlighted ? 'row-highlight-anim' : ''}`}
                      style={{ borderLeft }}
                    >
                      <td className="px-4 py-2">
                        <StatusBadge status={pod.status} />
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-mono text-[13px] text-white">{pod.id}</div>
                        <div className={`mt-0.5 inline-block rounded-full border px-1.5 text-[9px] font-medium uppercase tracking-wider ${namespaceStyle}`}>
                          {pod.namespace}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-bold text-white">{pod.cpu}%</div>
                        <ProgressBar value={pod.cpu} thresholds={{ amber: 60, red: 80 }} />
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-bold text-white">{pod.memory}%</div>
                        <ProgressBar value={pod.memory} thresholds={{ amber: 70, red: 85 }} />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className={`flex items-center justify-center gap-1 ${restartColor}`}>
                          {pod.restarts > 0 && <RefreshCcw size={14} />}
                          {pod.restarts}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs text-[#555555]">minikube-node-1</span>
                      </td>
                      <td className="px-4 py-2 text-[#555555]">{pod.age}</td>
                      <td className="px-4 py-2">
                        {hasInsight ? (
                          <button
                            onClick={() => onViewInsight(pod.id)}
                            className="rounded border border-[rgba(217,119,6,0.35)] bg-transparent px-2 py-1 text-xs font-semibold text-[#D97706] transition hover:bg-[rgba(217,119,6,0.12)]"
                          >
                            View Insight →
                          </button>
                        ) : (
                          <span className="text-[#555555]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Section 3: Footer */}
        <div className="flex items-center justify-between border-t border-[rgba(168,196,101,0.2)] bg-[#0a0a0a] px-5 py-3 text-xs text-[#555555] rounded-b-2xl">
          <div>
            Showing <span className="font-semibold text-[#dad7cd]">{filteredPods.length}</span> of {pods.length} pods
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[#A8C465]">
            Auto-refreshing every 15s
            <RefreshCcw size={12} className="animate-spin text-[#A8C465]" />
          </div>
        </div>
      </div>
    </div>
  )
}
