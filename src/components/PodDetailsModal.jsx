import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCcw, Search, X } from 'lucide-react'
import { StatusDot } from './status'

const NAMESPACE_COLORS = {
  academic: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
  security: 'border-purple-500/20 bg-purple-500/10 text-purple-400',
  finance: 'border-green-500/20 bg-green-500/10 text-green-400',
  ops: 'border-gray-500/20 bg-gray-500/10 text-gray-400',
  infra: 'border-orange-500/20 bg-orange-500/10 text-orange-400',
  data: 'border-teal-500/20 bg-teal-500/10 text-teal-400',
}

function ProgressBar({ value, thresholds }) {
  let color = '#00ff88' // green
  if (value >= thresholds.red) color = '#ff4444' // red
  else if (value >= thresholds.amber) color = '#ffaa00' // amber

  return (
    <div className="mt-1 h-[6px] w-[120px] overflow-hidden rounded-full bg-white/[0.08]">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
      />
    </div>
  )
}

function StatusBadge({ status }) {
  let colorClass = 'border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88]'
  let text = 'HEALTHY'
  if (status === 'critical') {
    colorClass = 'border-[#ff4444]/30 bg-[#ff4444]/10 text-[#ff4444]'
    text = 'CRITICAL'
  } else if (status === 'warning') {
    colorClass = 'border-[#ffaa00]/30 bg-[#ffaa00]/10 text-[#ffaa00]'
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
        className="absolute inset-0 bg-black/75 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative flex h-[80vh] w-[85vw] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1a1d27] shadow-2xl">
        
        {/* Section 1: Header */}
        <div className="flex flex-col gap-4 border-b border-white/10 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-[20px] font-semibold text-white leading-tight">Pod Health Overview</h2>
              <p className="text-sm text-slate-400">minikube-node-1 • {pods.length} pods observed</p>
            </div>
            
            <div className="ml-2 hidden h-8 w-px bg-white/10 lg:block" />
            
            <div className="hidden gap-2 lg:flex">
              <span className="inline-flex items-center rounded-md border border-[#ff4444]/20 bg-[#ff4444]/10 px-2 py-1 text-xs font-bold text-[#ff4444]">
                {criticalCount} CRITICAL
              </span>
              <span className="inline-flex items-center rounded-md border border-[#ffaa00]/20 bg-[#ffaa00]/10 px-2 py-1 text-xs font-bold text-[#ffaa00]">
                {warningCount} WARNING
              </span>
              <span className="inline-flex items-center rounded-md border border-[#00ff88]/20 bg-[#00ff88]/10 px-2 py-1 text-xs font-bold text-[#00ff88]">
                {healthyCount} HEALTHY
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-md border border-white/10 bg-black/20 p-1">
              {['all', 'critical', 'warning', 'healthy'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded px-3 py-1 text-xs font-medium capitalize transition ${
                    filter === f ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
              <div className="mx-1 w-px bg-white/10" />
              <button disabled className="px-2 py-1 text-xs font-medium text-slate-500 cursor-not-allowed">
                by Namespace ▾
              </button>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search pods..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-48 rounded-md border border-white/10 bg-black/20 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:border-[#4488ff]/50 focus:outline-none focus:ring-1 focus:ring-[#4488ff]/50"
              />
            </div>
            
            <button 
              onClick={onClose}
              className="ml-1 rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Section 2: Table */}
        <div className="flex-1 overflow-auto bg-[#1a1d27]">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="sticky top-0 z-10 bg-[#1a1d27] text-[11px] uppercase tracking-wider text-slate-500 shadow-sm after:absolute after:bottom-0 after:left-0 after:right-0 after:border-b after:border-white/10">
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
            <tbody className="divide-y divide-white/5">
              {filteredPods.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500">
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
                  const bgClass = index % 2 === 0 ? 'bg-[#1a1d27]' : 'bg-[#1e2130]'
                  let borderLeft = '3px solid transparent'
                  if (isCritical) borderLeft = '3px solid #ff4444'
                  else if (isWarning) borderLeft = '3px solid #ffaa00'
                  
                  // Restart color
                  let restartColor = 'text-[#00ff88]'
                  if (pod.restarts >= 3) restartColor = 'text-[#ff4444]'
                  else if (pod.restarts > 0) restartColor = 'text-[#ffaa00]'

                  const namespaceStyle = NAMESPACE_COLORS[pod.namespace] || NAMESPACE_COLORS['ops']

                  return (
                    <tr
                      key={pod.id}
                      ref={(el) => (rowRefs.current[pod.id] = el)}
                      className={`h-[56px] transition-colors duration-300 hover:bg-white/[0.04] ${bgClass} ${isHighlighted ? 'row-highlight-anim' : ''}`}
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
                        <div className={`flex items-center justify-center gap-1 font-semibold ${restartColor}`}>
                          {pod.restarts > 0 && <RefreshCcw size={14} />}
                          {pod.restarts}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs text-slate-400">minikube-node-1</span>
                      </td>
                      <td className="px-4 py-2 text-slate-400">{pod.age}</td>
                      <td className="px-4 py-2">
                        {hasInsight ? (
                          <button
                            onClick={() => onViewInsight(pod.id)}
                            className="rounded-md border border-[#ffaa00]/40 bg-[#ffaa00]/10 px-2 py-1 text-xs font-semibold text-[#ffaa00] transition hover:border-[#ffaa00] hover:bg-[#ffaa00]/20"
                          >
                            View Insight →
                          </button>
                        ) : (
                          <span className="text-slate-600">—</span>
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
        <div className="flex items-center justify-between border-t border-white/10 bg-[#161821] px-5 py-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-300">{filteredPods.length}</span> of {pods.length} pods
          </div>
          <div className="flex items-center gap-2">
            Auto-refreshing every 15s
            <RefreshCcw size={12} className="animate-spin text-[#4488ff]" />
          </div>
        </div>
      </div>
    </div>
  )
}
