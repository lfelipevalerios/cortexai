// Ícones Lucide da paleta do Studio (nomes de NODE_KINDS.icon).
import {
  MessageCircle, Zap, CalendarClock, Webhook, DatabaseZap, Bot, Tags, ScanText, AlignLeft, BookOpen, Scale, Database,
  Wrench, Globe, Plug, GitBranch, Table, Split, Columns2, Repeat, Timer, Shuffle, UserCheck, Headset, ListTodo,
  ShieldCheck, ShieldAlert, Gauge, BadgeCheck, Send, Bell, Ticket, CircleStop, Box, type LucideIcon,
} from 'lucide-react';
import { NODE_KINDS, type NodeKindDef } from '@cortex/schemas';

const ICONS: Record<string, LucideIcon> = {
  MessageCircle, Zap, CalendarClock, Webhook, DatabaseZap, Bot, Tags, ScanText, AlignLeft, BookOpen, Scale, Database,
  Wrench, Globe, Plug, GitBranch, Table, Split, Columns2, Repeat, Timer, Shuffle, UserCheck, Headset, ListTodo,
  ShieldCheck, ShieldAlert, Gauge, BadgeCheck, Send, Bell, Ticket, CircleStop,
};

export const KIND_BY_ID = new Map<string, NodeKindDef>(NODE_KINDS.map((k) => [k.kind, k]));

export function iconFor(name?: string): LucideIcon {
  return (name && ICONS[name]) || Box;
}

export function iconForKind(kind: string): LucideIcon {
  return iconFor(KIND_BY_ID.get(kind)?.icon);
}

export function kindLabel(kind: string): string {
  return KIND_BY_ID.get(kind)?.label ?? kind;
}
