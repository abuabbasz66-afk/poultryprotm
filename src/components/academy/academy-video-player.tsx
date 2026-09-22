import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Expand, Loader2, Play, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration, getVideoProvider, type AcademyTutorial } from "@/lib/academy";

type Props = {
  tutorial: AcademyTutorial;
  initialPosition?: number;
  onProgress?: (position: number, percent: number) => void;
  onComplete?: () => void;
  onReport?: () => void;
};

function youtubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/i);
  return match?.[1] ?? null;
}

function vimeoId(url: string): string | null {
  return url.match(/vimeo\.com\/(?:video\/)?(\d+)/i)?.[1] ?? null;
}

export function AcademyVideoPlayer({ tutorial, initialPosition = 0, onProgress, onComplete, onReport }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [slow, setSlow] = useState(false);
  const [percent, setPercent] = useState(() => tutorial.duration_seconds && initialPosition > 0
    ? Math.min(100, (initialPosition / tutorial.duration_seconds) * 100)
    : 0);
  const [attempt, setAttempt] = useState(0);
  const completedRef = useRef(false);
  const lastSavedRef = useRef(0);
  const provider = getVideoProvider(tutorial.video_url);
  const duration = formatDuration(tutorial.duration_seconds);

  useEffect(() => {
    if (!started || !loading) return;
    const timer = window.setTimeout(() => setSlow(true), 7_000);
    return () => window.clearTimeout(timer);
  }, [started, loading, attempt]);

  const retry = () => {
    setFailed(false);
    setSlow(false);
    setLoading(true);
    setStarted(true);
    setAttempt((value) => value + 1);
  };

  const updateProgress = () => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const nextPercent = Math.min(100, (video.currentTime / video.duration) * 100);
    setPercent(nextPercent);
    // Throttle saves to once every 5s of playback, plus a single final save
    // when the tutorial crosses the 85% completion threshold.
    const crossedThreshold = nextPercent >= 85 && !completedRef.current;
    if (Math.abs(video.currentTime - lastSavedRef.current) >= 5 || crossedThreshold) {
      lastSavedRef.current = video.currentTime;
      onProgress?.(Math.floor(video.currentTime), nextPercent);
    }
    if (crossedThreshold) {
      completedRef.current = true;
      onComplete?.();
    }
  };

  const begin = () => {
    setStarted(true);
    setLoading(true);
  };

  let player: React.ReactNode = null;
  if (started && tutorial.video_url && !failed) {
    if (provider === "youtube") {
      const id = youtubeId(tutorial.video_url);
      if (id) {
        player = (
          <iframe
            key={`${id}-${attempt}`}
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={tutorial.title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={() => setLoading(false)}
            className="absolute inset-0 h-full w-full border-0"
          />
        );
      }
    } else if (provider === "vimeo") {
      const id = vimeoId(tutorial.video_url);
      if (id) {
        player = (
          <iframe
            key={`${id}-${attempt}`}
            src={`https://player.vimeo.com/video/${id}?autoplay=1&dnt=1`}
            title={tutorial.title}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            onLoad={() => setLoading(false)}
            className="absolute inset-0 h-full w-full border-0"
          />
        );
      }
    } else if (provider === "direct" || provider === "storage") {
      player = (
        <video
          key={`${tutorial.video_url}-${attempt}`}
          ref={videoRef}
          src={tutorial.video_url}
          poster={tutorial.thumbnail_url ?? undefined}
          controls
          autoPlay
          preload="metadata"
          playsInline
          aria-label={`${tutorial.title} tutorial video`}
          onLoadedMetadata={(event) => {
            if (initialPosition > 0 && initialPosition < event.currentTarget.duration - 2) {
              event.currentTarget.currentTime = initialPosition;
            }
          }}
          onCanPlay={() => { setLoading(false); setSlow(false); }}
          onTimeUpdate={updateProgress}
          onError={() => { setFailed(true); setLoading(false); }}
          className="absolute inset-0 h-full w-full object-contain"
        />
      );
    }
  }

  return (
    <section aria-label="Tutorial video">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-foreground">
        {!started && (
          <>
            {tutorial.thumbnail_url ? (
              <img src={tutorial.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-primary" />
            )}
            <div className="absolute inset-0 bg-foreground/35" />
            <div className="absolute inset-x-4 bottom-4 top-4 flex flex-col items-center justify-center text-center text-primary-foreground">
              <Button type="button" size="icon" onClick={begin} aria-label={`Play ${tutorial.title}`} className="h-16 w-16 rounded-full bg-accent text-accent-foreground shadow-[var(--shadow-lift)] hover:bg-accent/90">
                <Play className="h-7 w-7 fill-current" />
              </Button>
              <p className="mt-4 max-w-lg font-display text-xl font-semibold">{tutorial.title}</p>
              <p className="mt-1 text-xs font-semibold uppercase text-primary-foreground/85">Click to play{duration ? ` · ${duration}` : ""}</p>
            </div>
          </>
        )}

        {player}

        {loading && !failed && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-foreground/65 text-primary-foreground">
            <div className="text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin" />
              <p className="mt-3 text-sm font-medium">Loading {tutorial.title}…</p>
              {slow && <p className="mt-1 text-xs">Your connection appears slow.</p>}
            </div>
          </div>
        )}

        {(failed || (started && !player)) && (
          <div className="absolute inset-0 grid place-items-center bg-foreground px-5 text-center text-primary-foreground">
            <div>
              <AlertTriangle className="mx-auto h-7 w-7 text-accent" />
              <p className="mt-3 font-display text-xl font-semibold">Video unavailable</p>
              <p className="mt-1 text-sm text-primary-foreground/80">Sorry, this tutorial video could not be loaded.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button type="button" variant="secondary" onClick={retry}><RefreshCw /> Try again</Button>
                {onReport && <Button type="button" variant="outline" onClick={onReport} className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"><Send /> Report video</Button>}
              </div>
            </div>
          </div>
        )}

        {started && (provider === "direct" || provider === "storage") && !failed && (
          <Button type="button" size="icon" variant="secondary" aria-label="Enter fullscreen" title="Fullscreen" onClick={() => void videoRef.current?.requestFullscreen?.()} className="absolute right-3 top-3 h-10 w-10 opacity-90">
            <Expand />
          </Button>
        )}
      </div>
      <div className="mt-3" aria-label={`${Math.round(percent)}% watched`}>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{percent >= 85 ? "Completed" : percent > 0 ? "In progress" : "Not started"}</span>
          <span>{Math.round(percent)}%</span>
        </div>
        <progress value={percent} max={100} className="mt-1 block h-1.5 w-full accent-primary" />
      </div>
    </section>
  );
}