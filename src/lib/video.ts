import { fetchWithTimeout } from "@/lib/http";

const YOUTUBE_RE = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i;

export function findYoutubeUrl(...candidates: (string | undefined)[]): string | undefined {
  for (const candidate of candidates) {
    if (candidate && YOUTUBE_RE.test(candidate)) {
      const match = candidate.match(YOUTUBE_RE);
      if (match) return `https://www.youtube.com/watch?v=${match[1]}`;
    }
  }
  return undefined;
}

export async function fetchYoutubeEmbed(videoUrl: string): Promise<string | undefined> {
  try {
    const res = await fetchWithTimeout(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`
    );
    if (!res.ok) return undefined;
    const data: { html?: string } = await res.json();
    return data.html;
  } catch {
    return undefined;
  }
}
