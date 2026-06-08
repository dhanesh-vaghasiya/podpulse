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
    <section className="rounded-lg border border-[rgba(168,196,101,0.2)] bg-[#111111] p-4 h-full flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Pods</h2>
          <p className="text-xs text-[#555555]">Pod Health Grid</p>
        </div>
        <span className="rounded-md border border-[rgba(168,196,101,0.2)] bg-[rgba(168,196,101,0.2)] px-2 py-1 text-xs text-[#A8C465]">
          {pods.length}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((item) => {
          const active = filter === item
          const status = item === 'all' ? 'active' : item
          const meta = getStatusMeta(status)

          return (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize font-sans transition-all duration-200 ${
                active
                  ? `${meta.border} ${meta.bg} ${meta.text}`
                  : 'border-[rgba(168,196,101,0.12)] bg-transparent text-[#555555] hover:border-[rgba(168,196,101,0.3)] hover:text-[#dad7cd]'
              }`}
              style={{
                boxShadow: active ? `0 0 8px ${meta.line}25` : undefined
              }}
            >
              {item}
            </button>
          )
        })}
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-2 gap-2 overflow-y-auto pr-1">
        {visiblePods.map((pod) => {
          const meta = getStatusMeta(pod.status)
          const selected = pod.id === selectedPodId
          const statusColor = pod.status === 'critical' ? '#DC2626' : pod.status === 'warning' ? '#D97706' : '#22c55e'

          return (
            <button
              key={pod.id}
              type="button"
              onClick={() => onPodClick(pod.id)}
              title={`${pod.id}\nNamespace: ${pod.namespace}\nRestarts: ${pod.restarts}\nAge: ${pod.age}`}
              className={`relative flex h-[42px] items-center gap-1.5 overflow-hidden rounded-md bg-[rgba(255,255,255,0.05)] border border-[rgba(168,196,101,0.08)] p-[6px] text-left transition duration-300 hover:bg-[rgba(255,255,255,0.08)] hover:border-[rgba(168,196,101,0.2)] hover:cursor-pointer ${
                selected ? 'ring-2 ring-[#A8C465]/70' : ''
              }`}
              style={{
                borderLeft: `2px solid ${meta.line}`,
                boxShadow: pod.status === 'critical' ? 'inset 0 0 8px rgba(220,38,38,0.2)' : pod.status === 'warning' ? 'inset 0 0 8px rgba(217,119,6,0.2)' : undefined,
              }}
            >
              <StatusDot
                status={pod.status}
                className={`h-2 w-2 shrink-0 ${pod.status === 'critical' ? 'pod-dot-critical' : ''}`}
              />
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold leading-none text-[#dad7cd]" title={pod.name}>
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
        className="mt-3 w-full rounded-md border border-[rgba(168,196,101,0.2)] bg-transparent py-2 text-[12px] font-medium text-[#A8C465] transition hover:bg-[rgba(168,196,101,0.08)] hover:border-[rgba(168,196,101,0.4)]"
      >
        View All Pods →
      </button>
    </section>
  )
}
