import { useMemo, useState } from 'react'
import { StatusDot } from './status'
import { getStatusMeta } from './statusMeta'

const FILTERS = ['all', 'critical', 'warning', 'healthy']



export default function PodGrid({ pods, selectedPodId, onPodClick, onOpenModal }) {
  const [filter, setFilter] = useState('all')
  const visiblePods = useMemo(
    () => (filter === 'all' ? pods : pods.filter((pod) => pod.status === filter)),
    [filter, pods],
  )

  return (
    <section className="rounded-lg border border-white/10 bg-[#1a1d27] p-4 shadow-xl shadow-black/10">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Pods</h2>
          <p className="text-xs text-slate-500">Pod Health Grid</p>
        </div>
        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-400">
          {pods.length}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {FILTERS.map((item) => {
          const active = filter === item
          const status = item === 'all' ? 'info' : item
          const meta = getStatusMeta(status)

          return (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition ${
                active
                  ? `${meta.border} ${meta.bg} ${meta.text}`
                  : 'border-white/[0.07] bg-white/[0.03] text-slate-500 hover:border-white/15 hover:text-slate-300'
              }`}
            >
              {item}
            </button>
          )
        })}
      </div>

      <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto pr-1">
        {visiblePods.map((pod) => {
          const meta = getStatusMeta(pod.status)
          const selected = pod.id === selectedPodId
          const statusColor = pod.status === 'critical' ? '#ff4444' : pod.status === 'warning' ? '#ffaa00' : '#00ff88'

          return (
            <button
              key={pod.id}
              type="button"
              onClick={() => onPodClick(pod.id)}
              title={`${pod.id}\nNamespace: ${pod.namespace}\nRestarts: ${pod.restarts}\nAge: ${pod.age}`}
              className={`relative flex h-[42px] items-center gap-1.5 overflow-hidden rounded-md bg-[#1a1d27] p-[6px] text-left transition duration-300 hover:bg-white/[0.07] ${
                selected ? 'ring-2 ring-[#4488ff]/70' : ''
              }`}
              style={{ borderLeft: `2px solid ${meta.line}` }}
            >
              <StatusDot
                status={pod.status}
                className={`h-2 w-2 shrink-0 ${pod.status === 'critical' ? 'pod-dot-critical' : ''}`}
              />
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold leading-none text-slate-100" title={pod.name}>
                {pod.name.length > 10 ? `${pod.name.substring(0, 10)}…` : pod.name}
              </span>
              
              {/* Thin colored bar at bottom */}
              <div 
                className="absolute bottom-0 left-0 right-0 h-[4px]"
                style={{ backgroundColor: statusColor }}
              />
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onOpenModal}
        className="mt-3 w-full rounded-md border border-white/10 bg-transparent py-2 text-[12px] font-medium text-slate-400 transition hover:border-white/20 hover:text-slate-200"
      >
        View All Pods →
      </button>
    </section>
  )
}
