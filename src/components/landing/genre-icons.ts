import {
  Crosshair,
  Drama,
  Film,
  Fingerprint,
  Globe,
  Laugh,
  Rocket,
  Skull,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import type { TabId } from "@/lib/examples";

/**
 * One icon per tab (Featured and every genre). Typed over TabId, so adding a genre without
 * picking an icon for it is a type error. (Kept out of lib/examples.ts: the refresh script
 * imports that file under plain Node, which has no use for React components.)
 */
export const GENRE_ICONS: Record<TabId, LucideIcon> = {
  featured: Sparkles,
  classic: Film,
  horror: Skull,
  "sci-fi": Rocket,
  "crime-thriller": Fingerprint,
  comedy: Laugh,
  drama: Drama,
  "action-western": Crosshair,
  "world-cinema": Globe,
  animation: WandSparkles,
};
