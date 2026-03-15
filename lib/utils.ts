const AVATAR_COLORS = [
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F43F5E', // rose
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#A855F7', // purple
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatSnoozeRemaining(snoozedUntil: string): string {
  const target = new Date(snoozedUntil);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h remaining`;
  if (diffHours > 0) return `${diffHours}h remaining`;
  const diffMins = Math.floor(diffMs / 60000);
  return `${diffMins}m remaining`;
}

function stripHtmlToText(input: string): string {
  if (!input.includes('<') || !input.includes('>')) return input;
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n');
}

function stripTrailingSignature(input: string): string {
  const dashSignatureIdx = input.search(/\n--\s*\n/);
  if (dashSignatureIdx >= 0) {
    return input.slice(0, dashSignatureIdx).trim();
  }

  const lines = input.split('\n');
  const valedictionRegex = /^(best|best regards|regards|thanks|thank you|sincerely|cheers)\b[,\s]*$/i;
  // Look only near the end to avoid clipping mid-message content.
  const start = Math.max(1, lines.length - 8);
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (valedictionRegex.test(line)) {
      return lines.slice(0, i).join('\n').trim();
    }
  }
  return input.trim();
}

export function cleanEmailReplyContent(rawContent: string): {
  cleanedContent: string;
  rawContent: string;
  wasCleaned: boolean;
} {
  const raw = (rawContent || '').trim();
  if (!raw) {
    return { cleanedContent: '', rawContent: '', wasCleaned: false };
  }

  let normalized = stripHtmlToText(raw)
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const quoteMarkers: RegExp[] = [
    /^\s*On .+wrote:\s*$/im,
    /^\s*From:\s.+$/im,
    /^\s*Sent:\s.+$/im,
    /^\s*-----Original Message-----\s*$/im,
    /^\s*>.+$/im,
  ];

  let cutoffIdx = -1;
  for (const marker of quoteMarkers) {
    const match = marker.exec(normalized);
    if (match && match.index >= 0) {
      cutoffIdx = cutoffIdx === -1 ? match.index : Math.min(cutoffIdx, match.index);
    }
  }
  if (cutoffIdx >= 0) {
    normalized = normalized.slice(0, cutoffIdx).trim();
  }

  const cleaned = stripTrailingSignature(normalized);
  const finalContent = cleaned || normalized || raw;
  return {
    cleanedContent: finalContent,
    rawContent: raw,
    wasCleaned: finalContent !== raw,
  };
}
