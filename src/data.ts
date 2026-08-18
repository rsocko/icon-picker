import type { IconSource } from './types';

export interface SourceFilter {
  id: IconSource;
  label: string;
  iconifyPrefix?: 'lucide' | 'mdi' | 'ph';
}

export const SOURCE_FILTERS: readonly SourceFilter[] = [
  { id: 'emoji', label: 'Emoji' },
  { id: 'lucide', label: 'Lucide', iconifyPrefix: 'lucide' },
  { id: 'mdi', label: 'Material', iconifyPrefix: 'mdi' },
  { id: 'ph', label: 'Phosphor', iconifyPrefix: 'ph' },
  { id: 'dash', label: 'Apps' },
  { id: 'si', label: 'Brands' },
];

export const ICON_COLORS = [
  '#ffffff',
  '#94a3b8',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#ef4444',
  '#f97316',
] as const;

export const POPULAR_EMOJI = [
  '🚀', '⭐', '🎯', '🔥', '💡', '🎨', '📦', '🏠',
  '💰', '📊', '🔒', '⚡', '🌍', '📝', '🎵', '📸',
  '🛠️', '🎮', '📱', '💻', '🧪', '🔔', '💎', '🏆',
];

export const POPULAR_LUCIDE = [
  'home', 'settings', 'user', 'search', 'star', 'heart', 'plus', 'check',
  'x', 'arrow-right', 'arrow-left', 'chevron-down', 'chevron-right', 'mail',
  'calendar', 'clock', 'bell', 'bookmark', 'folder', 'file', 'image', 'video',
  'music', 'camera', 'mic', 'phone', 'globe', 'map-pin', 'navigation', 'compass',
  'sun', 'moon', 'cloud', 'zap', 'flame', 'rocket', 'target', 'flag', 'tag',
  'hash', 'link', 'paperclip', 'scissors', 'copy', 'clipboard', 'trash-2',
  'edit', 'eye', 'eye-off', 'lock', 'unlock', 'shield', 'key', 'database',
  'server', 'code', 'terminal', 'git-branch', 'box', 'package', 'layers',
  'layout', 'grid-3x3', 'list', 'bar-chart-3', 'pie-chart', 'trending-up',
  'activity', 'cpu', 'wifi', 'download', 'upload', 'refresh-cw', 'alert-circle',
  'info', 'help-circle', 'message-circle', 'send', 'external-link', 'filter',
];

export const POPULAR_MDI = [
  'home', 'account', 'cog', 'magnify', 'star', 'heart', 'plus', 'check',
  'close', 'arrow-right', 'arrow-left', 'chevron-down', 'email', 'calendar',
  'clock', 'bell', 'bookmark', 'folder', 'file', 'image', 'video', 'music',
  'camera', 'microphone', 'phone', 'earth', 'map-marker', 'navigation',
  'weather-sunny', 'weather-night', 'cloud', 'flash', 'fire', 'rocket', 'target',
  'flag', 'tag', 'link', 'paperclip', 'content-copy', 'clipboard', 'delete',
  'pencil', 'eye', 'eye-off', 'lock', 'lock-open', 'shield', 'database',
  'server', 'code-tags', 'console', 'source-branch', 'package', 'layers',
  'view-dashboard', 'view-grid', 'view-list', 'chart-bar', 'chart-pie',
  'trending-up', 'pulse', 'chip', 'wifi', 'download', 'upload', 'alert-circle',
  'information', 'help-circle', 'message', 'send', 'open-in-new', 'filter',
];

export const POPULAR_PHOSPHOR = [
  'house', 'gear', 'user', 'magnifying-glass', 'star', 'heart', 'plus', 'check',
  'x', 'arrow-right', 'arrow-left', 'caret-down', 'envelope', 'calendar',
  'clock', 'bell', 'bookmark-simple', 'folder', 'file', 'image', 'video-camera',
  'music-note', 'camera', 'microphone', 'phone', 'globe', 'map-pin',
  'navigation-arrow', 'sun', 'moon', 'cloud', 'lightning', 'fire', 'rocket',
  'crosshair', 'flag', 'tag', 'link', 'paperclip', 'copy', 'clipboard', 'trash',
  'pencil-simple', 'eye', 'eye-slash', 'lock', 'lock-open', 'shield', 'database',
  'desktop', 'code', 'terminal', 'git-branch', 'package', 'stack', 'layout',
  'squares-four', 'list-bullets', 'chart-bar', 'chart-pie', 'trend-up',
  'activity', 'cpu', 'wifi-high', 'download', 'upload', 'warning-circle', 'info',
  'question', 'chat-circle', 'paper-plane-tilt', 'arrow-square-out', 'funnel',
];

export const POPULAR_DASHBOARD_ICONS = [
  'github', 'gitlab', 'discord', 'slack', 'plex', 'jellyfin', 'sonarr',
  'radarr', 'nextcloud', 'home-assistant', 'grafana', 'prometheus', 'portainer',
  'nginx', 'traefik', 'docker', 'proxmox', 'unraid', 'pihole', 'adguard-home',
  'bitwarden', 'vaultwarden', 'immich', 'photoprism', 'audiobookshelf',
  'calibre', 'paperless-ngx', 'uptime-kuma', 'truenas', 'synology', 'qnap',
  'cloudflare', 'tailscale', 'wireguard', 'opnsense', 'pfsense', 'ubuntu',
  'debian', 'windows', 'linux', 'apple', 'android', 'google', 'microsoft',
  'amazon', 'aws', 'azure', 'notion', 'obsidian', 'freshrss', 'miniflux',
];

export const POPULAR_SIMPLE_ICONS = [
  'github', 'gitlab', 'bitbucket', 'docker', 'kubernetes', 'react', 'vuedotjs',
  'angular', 'svelte', 'nextdotjs', 'typescript', 'javascript', 'python', 'go',
  'rust', 'nodedotjs', 'deno', 'bun', 'npm', 'yarn', 'google', 'apple',
  'microsoft', 'amazon', 'meta', 'slack', 'discord', 'telegram', 'whatsapp',
  'signal', 'x', 'linkedin', 'instagram', 'youtube', 'twitch', 'reddit',
  'stackoverflow', 'medium', 'devdotto', 'figma', 'sketch', 'canva', 'notion',
  'obsidian', 'todoist', 'trello', 'jira', 'vercel', 'netlify', 'cloudflare',
  'digitalocean', 'postgresql', 'mysql', 'mongodb', 'redis', 'sqlite', 'grafana',
  'prometheus', 'elasticsearch', 'nginx', 'linux', 'ubuntu', 'visualstudiocode',
];

export const POPULAR_BY_SOURCE: Record<
  Exclude<IconSource, 'emoji'>,
  readonly string[]
> = {
  lucide: POPULAR_LUCIDE,
  mdi: POPULAR_MDI,
  ph: POPULAR_PHOSPHOR,
  dash: POPULAR_DASHBOARD_ICONS,
  si: POPULAR_SIMPLE_ICONS,
};
