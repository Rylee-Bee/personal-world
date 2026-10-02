import { useId } from "react";
import { usePrefs } from "./prefs-core";
import type { Density, Pack, TextSize, Theme, Words } from "./types";
import "./fd.css";

interface Option<T extends string> {
  value: T;
  label: string;
  /** One plain line about this choice. */
  hint: string;
}

const DENSITY_OPTIONS: Option<Density>[] = [
  { value: "calm", label: "Calm", hint: "What needs you first, quiet things folded away." },
  { value: "standard", label: "Standard", hint: "Everything in order." },
  { value: "detailed", label: "Detailed", hint: "Everything, with the technical details open." },
];

const WORDS_OPTIONS: Option<Words>[] = [
  { value: "minimal", label: "Minimal", hint: "Facts only: names, values and states." },
  { value: "short", label: "Short", hint: "A short meaning beside each fact." },
  { value: "full", label: "Full", hint: "Whole sentences, and when each thing last worked." },
];

const TEXT_OPTIONS: Option<TextSize>[] = [
  { value: "standard", label: "Standard", hint: "16px." },
  { value: "large", label: "Large", hint: "About 18px." },
  { value: "larger", label: "Larger", hint: "About 21px." },
];

const THEME_OPTIONS: Option<Theme>[] = [
  { value: "starfield", label: "Starfield", hint: "Dark and warm. The default." },
  { value: "daylight", label: "Daylight", hint: "Light." },
];

const PACK_OPTIONS: Option<Pack>[] = [
  { value: "none", label: "None", hint: "Nothing added." },
  { value: "station", label: "Station", hint: "Decoration only. It never changes what Worlds says or does." },
];

interface RadioGroupProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** One native radio group bound to prefs. The fieldset and legend name the group once; each option has its own line. */
function RadioGroup<T extends string>({ label, options, value, onChange }: RadioGroupProps<T>) {
  const name = useId();
  return (
    <fieldset className="fd-settings-group">
      <legend className="fd-settings-legend">{label}</legend>
      <div className="fd-radio-group">
        {options.map((option) => {
          const hintId = `${name}-${option.value}-hint`;
          return (
            <div key={option.value} className="fd-radio">
              <label className="fd-radio-label-wrap">
                <input type="radio" name={name} value={option.value} checked={value === option.value} aria-describedby={hintId} onChange={() => onChange(option.value)} />
                <span className="fd-radio-label">{option.label}</span>
              </label>
              <span id={hintId} className="fd-radio-hint">
                {option.hint}
              </span>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Settings: comfort first, then the look, then the optional pack, then the assistant. */
export function Settings() {
  const { prefs, set } = usePrefs();

  return (
    <div className="fd-screen">
      <h1 className="fd-screen-title">Settings</h1>

      <section className="fd-settings-section">
        <h2 className="fd-settings-section-title">Comfort</h2>
        <RadioGroup label="Density" options={DENSITY_OPTIONS} value={prefs.density} onChange={(density) => set({ density })} />
        <RadioGroup label="Words" options={WORDS_OPTIONS} value={prefs.words} onChange={(words) => set({ words })} />
        <RadioGroup label="Text size" options={TEXT_OPTIONS} value={prefs.text} onChange={(text) => set({ text })} />
        <p className="fd-settings-note">Motion follows your device setting.</p>
      </section>

      <section className="fd-settings-section">
        <h2 className="fd-settings-section-title">Look</h2>
        <RadioGroup label="Theme" options={THEME_OPTIONS} value={prefs.theme} onChange={(theme) => set({ theme })} />
      </section>

      <section className="fd-settings-section">
        <h2 className="fd-settings-section-title">Experience</h2>
        <RadioGroup label="Experience pack" options={PACK_OPTIONS} value={prefs.pack} onChange={(pack) => set({ pack })} />
      </section>

      <section className="fd-settings-section">
        <h2 className="fd-settings-section-title">Assistant</h2>
        <p className="fd-settings-value">Not installed</p>
      </section>
    </div>
  );
}
