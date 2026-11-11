import { describe, expect, it } from "vitest";
import { pickOpener } from "@/lib/panel-opener";

const element = (name: string, isConnected = true) => ({ name, isConnected });
const body = element("body");

describe("pickOpener", () => {
  it("is the control the view said opened the panel, whatever has focus (Safari: a scroller does, not the poster)", () => {
    const poster = element("poster");
    const scroller = element("scroller");
    expect(pickOpener({ said: poster, active: scroller, body, pressed: poster })).toBe(poster);
    // Chromium focuses the pressed button: the same answer.
    expect(pickOpener({ said: poster, active: poster, body, pressed: poster })).toBe(poster);
  });

  it("is the focused control when the view said nothing (a key pressed on it)", () => {
    const button = element("button");
    expect(pickOpener({ said: null, active: button, body, pressed: element("other") })).toBe(button);
  });

  it("is the control last pressed when nothing but the body has focus", () => {
    const pressed = element("pressed");
    expect(pickOpener({ said: null, active: body, body, pressed })).toBe(pressed);
    expect(pickOpener({ said: null, active: null, body, pressed })).toBe(pressed);
  });

  it("is nothing when nothing is known", () => {
    expect(pickOpener({ said: null, active: body, body, pressed: null })).toBeNull();
    expect(pickOpener({ said: null, active: null, body, pressed: null })).toBeNull();
  });

  it("does not trust a control that has left the page", () => {
    const gone = element("gone", false);
    const scroller = element("scroller");
    expect(pickOpener({ said: gone, active: scroller, body, pressed: null })).toBe(scroller);
  });
});
