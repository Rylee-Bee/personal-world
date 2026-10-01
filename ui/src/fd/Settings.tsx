import { useId } from "react";
import { usePrefs } from "./prefs";
import type { Density, Pack, Theme, Words } from "./types";
import "./fd.css";

interface Option<T extends string> {
  value: T;
  label: string;
}

const PACK_OPTIONS: Option<Pack>[] = [
  { value: "none", label: "None" },
  { value: "station", label: "Station" },
];

const THEME_OPTIONS: Option<Theme>[] = [
  { value: "starfield", label: "Starfield" },
  { value: "daylight", label: "Daylight" },
  { value: "plain", label: "Plain" },
];

const DENSITY_OPTIONS: Option<Density>[] = [
  { value: "calm", label: "Calm" },
  { value: "standard", label: "Standard" },
  { value: "detailed", label: "Detailed" },
];

const WORDS_OPTIONS: Option<Words>[] = [
  { value: "minimal", label: "Minimal" },
  { value: "short", label: "Short" },
  { value: "full", label: "Full" },
];

interface RadioGroupProps<T extends string> {
  label: string;
  description: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** One native radio group bound to prefs; the description sits outside the labels. */
function RadioGroup<T extends string>({ label, description, options, value, onChange }: RadioGroupProps<T>) {
  const name = useId();
  return (
    <fieldset className="fd-settings-group">
      <legend className="fd-settings-legend">{label}</legend>
      <p className="fd-settings-desc">{description}</p>
      <div role="radiogroup" aria-label={label} className="fd-radio-group">
        {options.map((option) => (
          <label key={option.value} className="fd-radio">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="fd-radio-label">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Settings: Experience, Comfort and Assistant, all prefs-bound and text-only. */
export function Settings() {
  const { prefs, set } = usePrefs();

  return (
    <div className="fd-screen">
      <h1 className="fd-screen-title">Settings</h1>

      <section className="fd-settings-section">
        <h2 className="fd-settings-section-title">Experience</h2>
        <RadioGroup
          label="Experience pack"
          description="Decoration only. It never changes what Worlds says or does."
          options={PACK_OPTIONS}
          value={prefs.pack}
          onChange={(pack) => set({ pack })}
        />
        <RadioGroup
          label="Theme"
          description="How the interface looks and reads."
          options={THEME_OPTIONS}
          value={prefs.theme}
          onChange={(theme) => set({ theme })}
        />
      </section>

      <section className="fd-settings-section">
        <h2 className="fd-settings-section-title">Comfort</h2>
        <RadioGroup
          label="Density"
          description="How much fits on screen at once."
          options={DENSITY_OPTIONS}
          value={prefs.density}
          onChange={(density) => set({ density })}
        />
        <RadioGroup
          label="Words"
          description="Minimal: facts only. Short: a short meaning. Full: sentences and freshness."
          options={WORDS_OPTIONS}
          value={prefs.words}
          onChange={(words) => set({ words })}
        />
        <p className="fd-settings-note">Motion follows your device setting.</p>
      </section>

      <section className="fd-settings-section">
        <h2 className="fd-settings-section-title">Assistant</h2>
        <p className="fd-settings-value">Not installed</p>
      </section>
    </div>
  );
}
