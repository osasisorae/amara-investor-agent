import type { TimelineCardComponentData } from '@/lib/chat/components';

interface TimelineCardProps {
  data?: TimelineCardComponentData;
}

export function TimelineCard({ data }: TimelineCardProps) {
  const milestones = Array.isArray(data?.milestones) ? data.milestones : [];

  if (!milestones.length) {
    return (
      <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5 text-sm text-futurex-muted">
        Timeline data is not available yet.
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        Timeline
      </div>
      <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
        {data?.title || 'Timeline'}
      </h3>
      <div className="mt-5 space-y-4">
        {milestones.map((milestone, index) => (
          <div key={`${milestone.label}-${milestone.timing}-${index}`} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="mt-1 h-3 w-3 rounded-full bg-futurex-gold" />
              {index < milestones.length - 1 ? (
                <div className="mt-2 h-full min-h-14 w-px bg-futurex-line" />
              ) : null}
            </div>
            <div className="flex-1 rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-futurex-ink">
                  {milestone.label || 'Milestone'}
                </div>
                <div className="rounded-full border border-futurex-gold-border bg-futurex-gold-soft px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-futurex-gold">
                  {milestone.timing || 'Timing TBD'}
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-futurex-muted">
                {milestone.description || 'No description available.'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
