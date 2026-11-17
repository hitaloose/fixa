import { Link } from "@tanstack/react-router";
import { type ReactNode, useId, useState } from "react";
import { type Deck, type Preset, type PresetValues, parseSteps } from "../../../domain/model";
import { t } from "../../../i18n/pt-BR";
import { Button, Icon, Sheet, Stepper, Switch, TextField, Toast } from "../../../ui";
import {
  DEFAULT_PRESET_ID,
  type DeckOptionsData,
  useDeckOptions,
  useOptionsActions,
} from "../hooks/useDeckOptions";
import {
  LIMIT_FIELDS,
  type LimitDraft,
  type LimitField,
  type LimitScope,
  limitDraft,
  overridesFrom,
} from "../model/limits";
import { SimulationSheet } from "./SimulationSheet";

const o = t.options;

function valuesOf(preset: Preset): PresetValues {
  const { id, name, createdAt, updatedAt, deletedAt, ...values } = preset;
  return values;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-section border border-line bg-surface p-4">
      <h2 id={id} className="mb-2 text-sm font-semibold text-muted">
        {title}
      </h2>
      <div className="flex flex-col divide-y divide-line-soft">{children}</div>
    </section>
  );
}

function Select<V extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: V;
  onChange: (value: V) => void;
  options: Record<V, string>;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1 py-2">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as V)}
        className="min-h-11 rounded-field border border-line bg-surface px-3"
      >
        {(Object.entries(options) as Array<[V, string]>).map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function StepsField({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
}) {
  return (
    <TextField
      label={label}
      hint={o.stepsHint}
      value={value}
      onChange={onChange}
      autoCapitalize="none"
      className="py-2"
      {...(invalid ? { error: o.stepsError } : {})}
    />
  );
}

function ScopePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: LimitScope;
  onChange: (scope: LimitScope) => void;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-1 py-2">
      {(Object.keys(o.scopes) as LimitScope[]).map((scope) => (
        <label
          key={scope}
          className="flex min-h-11 items-center justify-center rounded-button border border-line px-2 text-center text-sm has-checked:border-primary has-checked:bg-new-bg has-checked:text-primary"
        >
          <input
            type="radio"
            name={name}
            value={scope}
            checked={value === scope}
            onChange={() => onChange(scope)}
            className="sr-only"
          />
          {o.scopes[scope]}
        </label>
      ))}
    </div>
  );
}

function NameSheet({
  title,
  initial,
  confirm,
  onConfirm,
  onClose,
}: {
  title: string;
  initial: string;
  confirm: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      closeLabel={t.common.close}
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onConfirm(name.trim());
        }}
      >
        <TextField label={o.name} value={name} onChange={setName} />
        <Button type="submit" disabled={name.trim() === ""}>
          {confirm}
        </Button>
      </form>
    </Sheet>
  );
}

function ConfirmSheet({
  title,
  description,
  confirm,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirm: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description={description}
      closeLabel={t.common.close}
    >
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          {t.common.cancel}
        </Button>
        <Button variant="danger" onClick={onConfirm} className="flex-1">
          {confirm}
        </Button>
      </div>
    </Sheet>
  );
}

type Dialog = "clone" | "rename" | "remove" | "restore" | "simulate" | null;

function OptionsForm({ data, onSaved }: { data: DeckOptionsData; onSaved: () => void }) {
  const { deck, presets, usage, today } = data;
  const actions = useOptionsActions();
  const presetOf = (id: string) => presets.find((p) => p.id === id) ?? (presets[0] as Preset);
  const [presetId, setPresetId] = useState(deck.presetId);
  const preset = presetOf(presetId);
  const [values, setValues] = useState(() => valuesOf(preset));
  const [steps, setSteps] = useState(() => ({
    learning: preset.learningSteps.join(" "),
    relearning: preset.relearningSteps.join(" "),
  }));
  const [limits, setLimits] = useState(
    () =>
      Object.fromEntries(
        LIMIT_FIELDS.map((f) => [f, limitDraft(deck, preset, f, today)]),
      ) as Record<LimitField, LimitDraft>,
  );
  const [invalid, setInvalid] = useState({ learning: false, relearning: false });
  const [dialog, setDialog] = useState<Dialog>(null);

  const set = <K extends keyof PresetValues>(key: K, value: PresetValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const switchPreset = (id: string) => {
    const next = presetOf(id);
    setPresetId(id);
    setValues(valuesOf(next));
    setSteps({
      learning: next.learningSteps.join(" "),
      relearning: next.relearningSteps.join(" "),
    });
    setInvalid({ learning: false, relearning: false });
  };

  /** The draft as preset values, or null when the steps are invalid. */
  const draftValues = (): PresetValues | null => {
    const learning = parseSteps(steps.learning);
    const relearning = parseSteps(steps.relearning);
    setInvalid({ learning: learning === null, relearning: relearning === null });
    if (!learning || !relearning) return null;
    return { ...values, learningSteps: learning, relearningSteps: relearning };
  };

  const save = async () => {
    const valid = draftValues();
    if (!valid) return;
    await actions.save({
      deckId: deck.id,
      presetId,
      values: valid,
      overrides: overridesFrom(deck.overrides, limits, today),
    });
    onSaved();
  };

  const limitValue = (field: LimitField) => {
    const draft = limits[field];
    return draft.scope === "preset" ? values[field] : draft[draft.scope];
  };
  const setLimit = (field: LimitField, value: number) => {
    const draft = limits[field];
    if (draft.scope === "preset") set(field, value);
    else setLimits((l) => ({ ...l, [field]: { ...draft, [draft.scope]: value } }));
  };
  const setScope = (field: LimitField, scope: LimitScope) =>
    setLimits((l) => ({ ...l, [field]: { ...l[field], scope } }));

  const close = () => setDialog(null);
  const presetSelectId = useId();
  const presetActionClass = "min-h-11 rounded-button px-3 text-sm font-medium text-primary";

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-section border border-line bg-surface p-4">
        <label htmlFor={presetSelectId} className="font-medium">
          {o.preset}
        </label>
        <select
          id={presetSelectId}
          value={presetId}
          onChange={(e) => switchPreset(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-field border border-line bg-surface px-3"
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">{o.usedBy(usage[presetId] ?? 0)}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          <button type="button" className={presetActionClass} onClick={() => setDialog("clone")}>
            {o.clone}
          </button>
          <button type="button" className={presetActionClass} onClick={() => setDialog("rename")}>
            {o.rename}
          </button>
          {presetId === DEFAULT_PRESET_ID ? null : (
            <button type="button" className={presetActionClass} onClick={() => setDialog("remove")}>
              {o.remove}
            </button>
          )}
          <button type="button" className={presetActionClass} onClick={() => setDialog("restore")}>
            {o.restore}
          </button>
        </div>
      </section>

      <Section title={o.sections.limits}>
        {LIMIT_FIELDS.map((field) => (
          <div key={field}>
            <Stepper
              label={field === "newPerDay" ? o.newPerDay : o.reviewsPerDay}
              value={limitValue(field)}
              onChange={(v) => setLimit(field, v)}
              max={9999}
            />
            <ScopePicker
              label={field === "newPerDay" ? o.scopeNew : o.scopeReviews}
              value={limits[field].scope}
              onChange={(scope) => setScope(field, scope)}
            />
          </div>
        ))}
      </Section>

      <Section title={o.sections.newCards}>
        <StepsField
          label={o.learningSteps}
          value={steps.learning}
          onChange={(learning) => setSteps((s) => ({ ...s, learning }))}
          invalid={invalid.learning}
        />
        <Select
          label={o.newCardOrder}
          value={values.newCardOrder}
          onChange={(v) => set("newCardOrder", v)}
          options={o.newOrders}
        />
        <Switch
          label={o.buryNew}
          hint={o.buryNewHint}
          checked={values.buryNewSiblings}
          onChange={(v) => set("buryNewSiblings", v)}
        />
      </Section>

      <Section title={o.sections.lapses}>
        <StepsField
          label={o.relearningSteps}
          value={steps.relearning}
          onChange={(relearning) => setSteps((s) => ({ ...s, relearning }))}
          invalid={invalid.relearning}
        />
        <Stepper
          label={o.leechThreshold}
          hint={o.leechThresholdHint}
          value={values.leechThreshold}
          onChange={(v) => set("leechThreshold", v)}
          min={1}
          max={99}
        />
        <Select
          label={o.leechAction}
          value={values.leechAction}
          onChange={(v) => set("leechAction", v)}
          options={o.leechActions}
        />
      </Section>

      <Section title={o.sections.reviews}>
        <Select
          label={o.reviewOrder}
          value={values.reviewOrder}
          onChange={(v) => set("reviewOrder", v)}
          options={o.reviewOrders}
        />
        <Switch
          label={o.buryReviews}
          checked={values.buryReviewSiblings}
          onChange={(v) => set("buryReviewSiblings", v)}
        />
        <Stepper
          label={o.maximumInterval}
          value={values.maximumIntervalDays}
          onChange={(v) => set("maximumIntervalDays", v)}
          min={1}
          max={36500}
        />
      </Section>

      <Section title={o.sections.fsrs}>
        <RetentionSlider
          value={values.desiredRetention}
          onChange={(v) => set("desiredRetention", v)}
        />
        <button
          type="button"
          onClick={() => setDialog("simulate")}
          className="min-h-11 py-2 text-left font-semibold text-primary"
        >
          {o.simulate}
        </button>
      </Section>

      <Section title={o.sections.display}>
        <Switch
          label={o.showTimer}
          checked={values.showTimer}
          onChange={(v) => set("showTimer", v)}
        />
        <Switch
          label={o.autoplayAudio}
          checked={values.autoplayAudio}
          onChange={(v) => set("autoplayAudio", v)}
        />
      </Section>

      <Button onClick={() => void save()} className="min-h-14">
        {o.save}
      </Button>

      {dialog === "simulate" ? (
        <SimulationSheet
          deckId={deck.id}
          preset={{
            ...preset,
            ...values,
            learningSteps: parseSteps(steps.learning) ?? preset.learningSteps,
            relearningSteps: parseSteps(steps.relearning) ?? preset.relearningSteps,
            newPerDay: limitValue("newPerDay"),
            reviewsPerDay: limitValue("reviewsPerDay"),
          }}
          onClose={close}
        />
      ) : null}
      {dialog === "clone" ? (
        <NameSheet
          title={o.clone}
          initial={o.cloneName(preset.name)}
          confirm={o.create}
          onClose={close}
          onConfirm={(name) => {
            close();
            void actions.clone(deck.id, name, draftValues() ?? valuesOf(preset));
          }}
        />
      ) : null}
      {dialog === "rename" ? (
        <NameSheet
          title={o.rename}
          initial={preset.name}
          confirm={o.save}
          onClose={close}
          onConfirm={(name) => {
            close();
            void actions.rename(preset.id, name);
          }}
        />
      ) : null}
      {dialog === "remove" ? (
        <ConfirmSheet
          title={o.removeTitle(preset.name)}
          description={o.removeDescription}
          confirm={o.removeConfirm}
          onClose={close}
          onConfirm={() => {
            close();
            void actions.remove(preset.id);
          }}
        />
      ) : null}
      {dialog === "restore" ? (
        <ConfirmSheet
          title={o.restoreTitle}
          description={o.restoreDescription}
          confirm={o.restoreConfirm}
          onClose={close}
          onConfirm={() => {
            close();
            void actions.restore(preset.id);
          }}
        />
      ) : null}
    </div>
  );
}

function RetentionSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const id = useId();
  const hintId = useId();
  const percent = `${Math.round(value * 100)}%`;
  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="font-medium">
          {o.retention}
        </label>
        <span className="tabular-nums">{percent}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0.7}
        max={0.99}
        step={0.01}
        value={value}
        aria-valuetext={percent}
        aria-describedby={hintId}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full accent-primary"
      />
      <span id={hintId} className="text-xs text-muted">
        {o.retentionHint}
      </span>
    </div>
  );
}

/** Remounts the form whenever what it was built from changes (save, clone, rename…). */
const formKey = (deck: Deck, presets: Preset[]) => JSON.stringify([deck, presets]);

export function DeckOptionsScreen({ deckId }: { deckId: string }) {
  const data = useDeckOptions(deckId);
  const [status, setStatus] = useState<string | null>(null);
  if (data === undefined) return null;
  if (data === null) return <p className="pt-6 text-muted">{o.notFound}</p>;
  return (
    <div className="flex flex-col gap-4 pt-4 pb-6">
      <Link
        to="/decks/$deckId"
        params={{ deckId }}
        aria-label={o.back}
        className="inline-flex size-11 items-center justify-center rounded-button text-ink"
      >
        <Icon name="chevronRight" className="size-6 rotate-180" />
      </Link>
      <header>
        <h1 className="font-display text-[28px] font-bold">{o.title}</h1>
        <p className="text-sm text-muted">{data.path}</p>
      </header>
      <OptionsForm
        key={formKey(data.deck, data.presets)}
        data={data}
        onSaved={() => setStatus(o.saved)}
      />
      {status ? <Toast message={status} onDismiss={() => setStatus(null)} /> : null}
    </div>
  );
}
