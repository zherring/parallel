/** What `pickOpener` chooses from: elements, or anything shaped like them. */
export interface OpenerChoices<T extends { isConnected: boolean }> {
  /** The control the view said opened the panel: the target of the press itself (`rememberOpener`). */
  said: T | null;
  /** What has focus as the panel opens. */
  active: T | null;
  /** The page's body, which has focus when nothing does. */
  body: T | null;
  /** The control last pressed with a pointer (`useRememberPressed`). */
  pressed: T | null;
}

/**
 * The control a slide-out panel hands focus back to when it closes, chosen as the panel opens: the one the view said opened it, if it is still on the
 * page, which no browser gets wrong; else whatever has focus (the control a key was pressed on), but not the body, which has it when nothing does; else
 * the control last pressed with a pointer. Safari does not focus a button on a click, so there, with a scroller or a dialog round the control that
 * takes focus instead, "whatever has focus" is that scroller and not the control: the panel closes onto the scene and the visitor loses their place.
 */
export function pickOpener<T extends { isConnected: boolean }>({ said, active, body, pressed }: OpenerChoices<T>): T | null {
  if (said?.isConnected) return said;
  if (active && active !== body) return active;
  return pressed;
}
