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
import type { GenreId } from "@/lib/examples";

/**
 * One icon per genre tab. Typed over GenreId, so adding a genre without picking an icon for it is
 * a type error. (Kept out of lib/examples.ts: the refresh script imports that file under plain
 * Node, which has no use for React components.)
 */
export const GENRE_ICONS: Record<GenreId, LucideIcon> = {
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
