import { FileText, Film, ImageOff } from "lucide-react";
import type { OrgContext } from "@/lib/context";
import { fmtDateTime } from "@/lib/format";

type FileRow = { id: string; bucket: string; path: string; kind: string; original_name: string | null; mime_type: string | null; created_at: string };

/** Loads entity files (RLS) and short-lived signed URLs (storage RLS mirrors public.files). */
export async function loadFiles(ctx: OrgContext, entityType: string, entityId: string) {
  const { data } = await ctx.supabase.from("files").select("id, bucket, path, kind, original_name, mime_type, created_at")
    .eq("entity_type", entityType).eq("entity_id", entityId).is("deleted_at", null).order("created_at");
  const files = (data ?? []) as FileRow[];
  const byBucket = new Map<string, FileRow[]>();
  for (const f of files) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f]);
  const urls = new Map<string, string>();
  await Promise.all([...byBucket.entries()].map(async ([bucket, list]) => {
    const { data: signed } = await ctx.supabase.storage.from(bucket).createSignedUrls(list.map((f) => f.path), 60 * 60);
    for (const s of signed ?? []) if (s.signedUrl && s.path) urls.set(`${bucket}/${s.path}`, s.signedUrl);
  }));
  return files.map((f) => ({ ...f, url: urls.get(`${f.bucket}/${f.path}`) ?? null }));
}

export type LoadedFile = Awaited<ReturnType<typeof loadFiles>>[number];

export function FileGallery({ files, tz, empty }: { files: LoadedFile[]; tz: string; empty?: string }) {
  if (!files.length) return <p className="py-3 text-sm text-muted">{empty ?? "—"}</p>;
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {files.map((f) => {
        const isImg = f.mime_type?.startsWith("image/");
        const isVid = f.mime_type?.startsWith("video/");
        return (
          <li key={f.id} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-2">
            {f.url ? (
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="block h-full w-full" title={`${f.original_name ?? ""} · ${fmtDateTime(f.created_at, tz)}`}>
                {isImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt={f.original_name ?? ""} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <span className="grid h-full w-full place-items-center p-2 text-center text-[11px] text-muted">
                    {isVid ? <Film className="mb-1 h-6 w-6 text-moss" /> : <FileText className="mb-1 h-6 w-6 text-moss" />}
                    <span className="line-clamp-2">{f.original_name}</span>
                  </span>
                )}
              </a>
            ) : (
              <span className="grid h-full w-full place-items-center text-faint"><ImageOff className="h-5 w-5" /></span>
            )}
            {f.kind !== "photo" && <span className="absolute left-1.5 top-1.5 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-2">{f.kind}</span>}
          </li>
        );
      })}
    </ul>
  );
}
