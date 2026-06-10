import Skeleton from './Skeleton'

export default function ProjectCardSkeleton() {
  return (
    <div className="rounded-xl border border-mist bg-white overflow-hidden">
      <Skeleton className="h-1.5 w-full rounded-none" />
      <div className="p-7 space-y-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-6 w-14 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      </div>
    </div>
  )
}
