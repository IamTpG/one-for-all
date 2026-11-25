"use client";

import { useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { Checkbox } from "@base-ui/react/checkbox";
import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import clsx from "clsx";
import { CheckIcon, ChevronIcon, MinusIcon } from "@/lib/icons";
import type { FilterOptions } from "@/lib/sourceRegistry";
import type { HomeCopy } from "./homeCopy";
import { groupState, toggleGroup, toggleOption, triggerLabel, type SourceGroupId } from "./sourceFilterModel";
import styles from "./Feed.module.css";
import world from "./world.module.css";

// The source filter: a multi-select dropdown with two groups, "Chính thức"
// (publishers) and "Cộng đồng & báo chí" (community sources). A popover from
// 720px up, a bottom sheet with a scrim and a "Xong" button below it. Both
// show the same panel; base-ui supplies the focus handling, Esc, outside
// press and the aria wiring.

export type SourceCounts = {
  byId: Record<string, number>;
  official: number;
  community: number;
  // Rows the stream shows right now (topic, view and source applied).
  result: number;
};

const SHEET_QUERY = "(max-width: 719.98px)";

function subscribeSheet(onChange: () => void): () => void {
  const query = window.matchMedia(SHEET_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsSheet(): boolean {
  return useSyncExternalStore(
    subscribeSheet,
    () => window.matchMedia(SHEET_QUERY).matches,
    () => false
  );
}

type PanelProps = {
  options: FilterOptions;
  selected: readonly string[];
  counts: SourceCounts;
  copy: HomeCopy;
  sheet: boolean;
  onChange: (next: string[]) => void;
};

function Count({ n, copy }: { n: number; copy: HomeCopy }) {
  return (
    <>
      <span className={styles.srcCount} aria-hidden="true">
        {n}
      </span>
      <span className={world.visuallyHidden}>, {copy.sourceCount(n)}</span>
    </>
  );
}

function Box({
  checked,
  indeterminate = false,
  onCheckedChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onCheckedChange: () => void;
}) {
  return (
    <Checkbox.Root
      className={styles.srcBox}
      checked={checked}
      indeterminate={indeterminate}
      onCheckedChange={onCheckedChange}
    >
      <Checkbox.Indicator className={styles.srcBoxMark}>
        {indeterminate ? <MinusIcon /> : <CheckIcon />}
      </Checkbox.Indicator>
    </Checkbox.Root>
  );
}

function Group({
  group,
  title,
  panel,
}: {
  group: SourceGroupId;
  title: string;
  panel: PanelProps;
}) {
  const { options, selected, counts, copy, onChange } = panel;
  const state = groupState(selected, options, group);
  const headingId = `source-group-${group}`;
  return (
    <section role="group" aria-labelledby={headingId} className={styles.srcGroup}>
      <label className={styles.srcGroupHead}>
        <Box
          checked={state === "all"}
          indeterminate={state === "some"}
          onCheckedChange={() => onChange(toggleGroup(selected, group, options))}
        />
        <span id={headingId} className={styles.srcGroupName}>
          {title}
        </span>
        <Count n={counts[group]} copy={copy} />
      </label>
      <ul className={styles.srcList}>
        {options[group].map((option) => (
          <li key={option.id}>
            <label className={styles.srcOption}>
              <Box
                checked={selected.includes(option.id)}
                onCheckedChange={() => onChange(toggleOption(selected, option.id, options))}
              />
              <span className={styles.srcOptionName}>{option.name}</span>
              <Count n={counts.byId[option.id] ?? 0} copy={copy} />
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PanelBody(panel: PanelProps) {
  const { copy, sheet, selected, counts, onChange } = panel;
  return (
    <div className={styles.srcPanel}>
      {sheet ? (
        <div className={styles.srcSheetHead}>
          <Dialog.Title className={styles.srcSheetTitle}>{copy.sourceSheetTitle}</Dialog.Title>
          <Dialog.Close className={styles.srcDone}>{copy.sourceDone}</Dialog.Close>
        </div>
      ) : (
        <Popover.Title className={world.visuallyHidden}>{copy.sourceLabel}</Popover.Title>
      )}
      <div className={styles.srcScroll}>
        <Group group="official" title={copy.sourceGroupOfficial} panel={panel} />
        <Group group="community" title={copy.sourceGroupCommunity} panel={panel} />
      </div>
      <div className={styles.srcFoot}>
        <span className={styles.srcResult}>{copy.sourceResult(counts.result)}</span>
        <button
          type="button"
          className={styles.srcClear}
          disabled={selected.length === 0}
          onClick={() => onChange([])}
        >
          {copy.sourceClear}
        </button>
      </div>
    </div>
  );
}

export default function SourceFilter({
  options,
  selected,
  counts,
  copy,
  onChange,
  portalRef,
}: {
  options: FilterOptions;
  selected: readonly string[];
  counts: SourceCounts;
  copy: HomeCopy;
  onChange: (next: string[]) => void;
  // The element carrying the design tokens; the popup renders inside it so
  // the tokens (and the dark theme) reach it.
  portalRef: RefObject<HTMLElement | null>;
}) {
  const sheet = useIsSheet();
  const [open, setOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  // Opening moves focus to the first checkbox (not the sheet's "Xong" button,
  // which comes first in the DOM); closing returns it to the trigger, which is
  // base-ui's default finalFocus for Esc, Xong, the scrim and outside presses.
  const firstCheckbox = () => popupRef.current?.querySelector<HTMLElement>('[role="checkbox"]') ?? true;
  const label = triggerLabel(selected, options, {
    all: copy.sourceAll,
    allOfficial: copy.sourceAllOfficial,
    community: copy.sourceGroupCommunity,
  });
  const active = selected.length > 0;
  const triggerProps = {
    className: clsx(styles.srcTrigger, active && styles.srcTriggerActive),
    "aria-label": `${copy.sourceLabel}: ${label}`,
    children: (
      <>
        <span className={styles.srcTriggerLabel}>{label}</span>
        <ChevronIcon className={styles.srcChevron} />
      </>
    ),
  };
  const panel: PanelProps = { options, selected, counts, copy, sheet, onChange };

  if (sheet) {
    return (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger {...triggerProps} />
        <Dialog.Portal container={portalRef}>
          <Dialog.Backdrop className={styles.srcScrim} />
          <Dialog.Popup ref={popupRef} className={styles.srcSheet} initialFocus={firstCheckbox}>
            <PanelBody {...panel} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger {...triggerProps} />
      <Popover.Portal container={portalRef}>
        {/* Always under the trigger: when the viewport is short the popup shrinks and
            scrolls (--available-height) instead of hopping to the trigger's side. */}
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={16}
          collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
          className={styles.srcPositioner}
        >
          <Popover.Popup ref={popupRef} className={styles.srcPopup} initialFocus={firstCheckbox}>
            <PanelBody {...panel} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
