import { Howl } from 'howler'
import type { ThemeOption, ThemeSoundConfig } from '@shared/types'

export const THEME_SOUND_EVENTS = ['hover', 'click', 'notify', 'error', 'success'] as const
export type ThemeSoundEvent = typeof THEME_SOUND_EVENTS[number]

const THEME_TONE_SOURCES: Record<ThemeOption, string> = {
  constructivism: 'data:audio/wav;base64,UklGRgQCAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YeABAAAAANIEdgnHDaYR9xSiF5MZvRoaG6caaxlxF8kUiRHLDa0JTgXRAFn8Bvj681PwK+2a6rLof+cJ51LnVugM6mTsS++q8mf2Y/p//p0CnQZgCssNxBA3ExEVRhbPFqkW2BViFFYSww/ADGQJygUOAkz+ovoq9//zOfHq7iTt8utc62TrCexE7QnvSvH08/L2K/qI/ewAQARpB08K3wwFD7IQ2xF4EocSChIFEYIPjg05C5cIvQXBArr/v/zn+Uj38/T78m3xU/C075Pv7+/E8ArytPO39f/3fPoZ/cL/YwLnBDwHUQkXC4EMhw0iDk8ODg5kDVcM8Qo9CUsHKgXrAqAAWv4s/CT6UvjD9oL1lvQF9NLz/fOC9Fz1gvbr94n5Ufsz/SD/CgHhApkEJAZ4B4sIWAnZCQwK8QmMCeAI9QfTBoQFFASOAv4Acf/y/Y38TPs4+lf5r/hD+Bb4Jvhx+PT4qfmI+ov7p/zT/Qb/NwBbAWsCXwMxBNoEWQWpBcsFwAWIBSkFpQQEBEoDgAKrAdQAAAA3/33+2f1P/eH8kfxh/FD8XfyG/Mj8H/2H/fz9eP73/nT/6/9ZALoACwFLAXoBlgGgAZoBhgFmATwBDAHYAKQAcwBIACMACAD2/+//8/8=',
  'modern-light': 'data:audio/wav;base64,UklGRgQCAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YeABAAAAAGsGcQzCERcWOBn8Gk8bMBqwF/YTNQ+xCbYDlv2l9zPyh+3h6W7nTeaL5iHo9+rj7q3zEvnJ/oIE8AnLDtIS0BWgFysYbhd2FWASWQ6aCWYEA/+7+dX0lPAu7c/qlumP6bjq/uw/8Ez07fjh/eQCsgcKDLQPfxJIFPkUjRQME40QNg02CcUEIACI+zr3b/NZ8CHu4eyo7HXtOu/d8Tb1F/lJ/ZIBuAWECcIMSQ/5EL4RkRF3EIEOzwuGCNUE7wAL/Vz5FfZf813xKfDP71LwpvG382f2jvkB/Y4ABgQ7BwEKNAy6DYEOgA67DUAMJgqLB5YEbwFC/jv7gfg59n70Z/MA80nzPfTM9d33UvoI/dn/ngIzBXQHRQmQCkYLYAvgCs8JQAhKBgkEnwEs/9L8sPrj+H/3l/Yz9lb2+/YV+JP5X/td/XL/gQFuAyAFgQaBBxQINgjpBzMHIQbEBDEDgAHI/yD+n/xY+1v6svll+XP52fmP+of7s/wA/lv/sgDxAQkD7AORBPAECQXcBHAEzAP9AhACEwEUACP/Sv6V/Qz9tPyO/Jn80/w0/bX9S/7u/pP/MAC8ADIBiwHGAeEB3gG/AYsBRwH4AKcAWAASANn/r/+X/4//lv+p/8T/4/8=',
  'warm-light': 'data:audio/wav;base64,UklGRgQCAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YeABAAAAADAH1g2CE9UXihp0G4ga2hecExoOswfXAPz5mPMV7s/pDuf75afmAOnc7PXx8fdp/uwEDAthEJMUXBeQGB8YFRaXEuYNUwhBAhf8P/YcQTtOerp6CXp5eoI7lXygPct/fwCiAh0DW4RNBSbFY4VExRFEVoNlghOA9z9nvjt8xfwWu3j68frA+1/7wzza/dO/GIBTwbBCm8OHBGdEt0S2xGsD3oMfgj+A0n/sPqA9gDzaPDj7obuU+858RT0sPfM+yIAZQRPCJ0LGg6eDxMQdQ/SDUoLDAhSBF0AcPzQ+Lj1W/Pf8VjxzfEx82r1Tfim+zz/zwIjBgAJOAuoDDoN6Ay9C9AJRQdLBBUB3f3Y+jn4K/bO9Db0afRg9Qf3Pfnb+7H+jgFBBJ4GfQjCCVkKPgp2CRIILQbqA3MB8v6S/Hz60Pip9xf3H/e/9+b4ffpn/IH+pQCvAnwE8AX0BnsHfwcDBxQGxgQyA3UBrv/8/Xv8Q/tn+vH55/lE+v/6CPxJ/az+FgBvAaECmANIBKYEsQRsBN8DGAMmAh0BEAAR/zH+ff0A/b38t/zq/E792f1+/jD/4f+FABEBfQHEAeQB4AG6AXoBJwHLAG0AGADP/5r/ef9t/3P/iP+n/8n/6f8=',
  cyberpunk: 'data:audio/wav;base64,UklGRgQCAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YeABAAAAAH8IIRAvFhwajxtqGs0WFhHSCbIBe/nz8c3rmee45VHmUOlp7hv1xPyoBAoMOhKnFuoY0xhoFusRygueBBT94/W27x7rh+go6Abq7u198yr6UgFICGUOGhP5FcEWZxUPEg8N5AYkAHP5cfOs7pTrbepP6x7ukfI6+I3+8ATMCpMP2BJQFN0TkBGkDX4InAKN/OP2JPLA7gTtE+3o7lDy9fZk/BgChwcxDKcPnBHkEX8QlA1uCXQEIf/0+Wr17vHO7zrvOPCt8lj23frM/64EDQmEDMIOlw/0Du0MuQmpBSIBkfxl+AD1r/Kn8fnxmvNd9vr5GP5RAkEGignhCxENBA3AC2kJOwaIAqn+/fra94n1PfQR9AL19va3+QD9gADiA9UGFQlwCssKIgqLCDEGUAMxACD9ZfpA+OH2ZPbP9hP8MgAsBPQG3Ae1BtsDGABs/Mv52fjH+Un8q/8GA3sFcAa0BYYDhAB+/Tr7SPrY+rf8Wf8KAhcE/wSUBAEDvABj/pL8uvsF/FL9PP88Ac0CjgNbA1ACvwAZ/839KP1J/Rn+U/+dAKIBJAIOAnUBjwCf/+b+jf6f/gf/nP8wAJoAxQCyAHUALADz/9v/5P8=',
  swiss: 'data:audio/wav;base64,UklGRgQCAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YeABAAAAAIAJzRHvFzMbPBsPGBQSBQraAKn3iO9q6QLmseV66ALunPVd/jwHLA9BFcYYWRnuFtYRsQpaAtD5FvIR7HTopee26WLuFfUA/TIFswyiElEWVheaFVcRFAuUA7z7efSk7urqtekj6wHv1fTp+2UDZwobENsTOhUWFJgQMQuIBGn9rvYe8V/t3Ou87N3v2/QZ+9gBSwiwDWkRChNpEqAPCQs0Bdb+r/h488zvE+577vHwJPWQ+o0AZAZoCwMPzhCZEHEOnwqbBQAAevqu9SryU/Bb8DnyrvVM+oT/twRHCa4Miw6rDhEN9gm7BeYACvy593T0l/JV8q/zdvZO+sH+RQNSB3EKSAymDIYLEQmYBYgBXf2W+aP21/Rk9Uj4u/yhASsGmQlhC0ALRAnLBXEB8fwK+V72V/UY9nb4BfwnACsEZwdYCbQJdAjYBVYCh/4P+374Ovdv9wz5w/sZ/34CYgVOB/kHUAd4BcgCuP/M/H76KvkB+f/58ft8/jEBmwNYBSUG6AW1BMkCfAAx/kv8FPu4+j77hfxP/koAIQKIA0oETgSeA2AC0QA2/9X94/yD/Lr8dv2P/tD/AQHxAXwClQI/ApQBuADT/w7/hv5M/mH+tv42/8T/RAChANAA0QCsAHIANAADAOr/6/8=',
  dark: 'data:audio/wav;base64,UklGRgQCAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YeABAAAAADMLchQ7Gp4baxgzETEHFPy28c3po+Xg5XHqivLL/H4H2hBWF+YZJRhpEq0JbP9b9SXtIugf5z7q7/AP+hUEVg1KFNEXXhcNE58LVwLE+Hvw2urH6JLq5e/U9wkB+gktEXUVIxYmEwUNzgTh+7vzs+3E6mDrZe8e9mf+3AYWDuYSiBTAEuINxwah/s72mPAB7Znsae/u9Df8CgQaCz0QoBLnEToOPwj6AKP5cvNp7yvu5e9C9IL6lAFMCI0NfxCsEBcONgniAir8Lfbm8QPwy/AU9En5hv+/Be4KOg4fD4INsAlTBFX+tvhj9AzyDPJb9Iz45v2CA3EI5gtVDYoMsQlLBRoA/PrK9jH0l/MM9Uj4u/yhASsGmQlhC0ALRAnLBXEB8fwK+V72V/UY9nb4BfwnACsEZwdYCbQJdAjYBVYCh/4P+374Ovdv9wz5w/sZ/34CYgVOB/kHUAd4BcgCuP/M/H76KvkB+f/58ft8/jEBmwNYBSUG6AW1BMkCfAAx/kv8FPu4+j77hfxP/koAIQKIA0oETgSeA2AC0QA2/9X94/yD/Lr8dv2P/tD/AQHxAXwClQI/ApQBuADT/w7/hv5M/mH+tv42/8T/RAChANAA0QCsAHIANAADAOr/6/8=',
  light: 'data:audio/wav;base64,UklGRgQCAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YeABAAAAAOANAxjNG04YgA7+AFfzHOnw5NznDvES/nkLxBVLGusXVA/RAq/1XOuD5lvoWfBa/DIJhROpGFMX6g9tBOX3mO0x6Azp4u/a+g8HTRHwFokWQxDQBfT5yu/16e3pp++U+RQFIg8jFZIVYRD5Btn77vHI6/jqpu+J+EUDCA1KE3QURhDnB5H9/POl7Sjs3O+496UBBgtrETMT9g+aCBj/8fWF73jtRfAi9zcAIAmLD9URcw8UCW0Ax/dj8ePu3/DF9vzVAP5RAkEGignhCxENBA3AC2kJOwaIAqn+/fra94n1PfQR9AL19va3+QD9gADiA9UGFQlwCssKIgqLCDEGUAMxACD9ZfpA+OH2ZPbP9hP4DPqG/EP/AAJ7BHoG0QdlCCwIMgeUBX0DIgG+/or8ufp1+db46Pih+e36pvyg/qkAkAIpBFAF7gX4BXQFdAQUA3kBzP82/t383ftL+zH7iftI/Fb9lf7l/yUBOQIIA4IDogNpA+ICIAI5AUUAXP+V/gD+p/2O/bL9Cv6J/h7/uP9GAL0AEQE+AUUBKgH1ALEAaQAmAPL/0f/F/83/4/8='
}

export function defaultThemeSoundConfig(themeId: ThemeOption): ThemeSoundConfig {
  const src = THEME_TONE_SOURCES[themeId]
  return {
    themeId,
    enabled: false,
    volume: 0.3,
    events: {
      hover: src,
      click: src,
      notify: src,
      error: src,
      success: src
    }
  }
}

export class ThemeSoundManager {
  private readonly sounds = new Map<string, Howl>()
  private readonly failedKeys = new Set<string>()

  load(config: ThemeSoundConfig): void {
    this.dispose()
    if (!config.enabled) return

    for (const event of THEME_SOUND_EVENTS) {
      const src = config.events[event]
      if (!src) continue
      const key = `${config.themeId}:${event}`
      try {
        const howl = new Howl({
          src: [src],
          volume: config.volume,
          preload: true,
          html5: src.startsWith('file:'),
          onloaderror: () => {
            this.failedKeys.add(key)
            this.sounds.get(key)?.unload()
            this.sounds.delete(key)
          },
          onplayerror: () => {
            this.failedKeys.add(key)
          }
        })
        this.sounds.set(key, howl)
      } catch {
        this.failedKeys.add(key)
      }
    }
  }

  play(themeId: ThemeOption, event: ThemeSoundEvent): boolean {
    const key = `${themeId}:${event}`
    if (this.failedKeys.has(key)) return false
    const sound = this.sounds.get(key)
    if (!sound) return false
    try {
      sound.play()
      return true
    } catch {
      this.failedKeys.add(key)
      sound.unload()
      this.sounds.delete(key)
      return false
    }
  }

  dispose(): void {
    for (const sound of this.sounds.values()) {
      sound.unload()
    }
    this.sounds.clear()
    this.failedKeys.clear()
  }
}
