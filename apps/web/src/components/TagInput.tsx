import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Tag } from "../api/client.js";
import { cn } from "../lib/utils.js";
import { tagColorStyle } from "./ui.js";

export type DraftTag = Pick<Tag, "name" | "color"> & { id?: string };

export function TagInput({
  label,
  tags,
  value,
  onChange,
  disabled,
}: {
  label: string;
  tags: Tag[];
  value: DraftTag[];
  onChange: (value: DraftTag[]) => void;
  disabled: boolean;
}) {
  const id = useId();
  const listId = id + "-suggestions";
  const input = useRef<HTMLInputElement>(null);
  const activeOption = useRef<HTMLLIElement>(null);
  const composing = useRef(false);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const name = text.trim();
  const query = name.toLocaleLowerCase();
  const selectedNames = new Set(value.map((tag) => tag.name));
  const matches = tags.filter(
    (tag) => !selectedNames.has(tag.name) && tag.name.toLocaleLowerCase().includes(query),
  );
  const open = focused && !disabled && matches.length > 0;

  useEffect(() => {
    activeOption.current?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  function choose(tag: DraftTag) {
    if (!selectedNames.has(tag.name)) onChange([...value, tag]);
    setText("");
    setActive(-1);
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (composing.current || event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      const match = open ? matches[active] : undefined;
      if (match) choose(match);
      else if (name) choose(tags.find((tag) => tag.name === name) ?? { name, color: null });
    }
    if (open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => {
        if (index === -1) return direction === 1 ? 0 : matches.length - 1;
        return (index + direction + matches.length) % matches.length;
      });
    }
    if (event.key === "Backspace" && !text && value.length) {
      event.preventDefault();
      onChange(value.slice(0, -1));
      setActive(-1);
    }
  }

  return (
    <div className="relative space-y-1.5 text-[13px]">
      <label htmlFor={id} className="font-medium">{label}</label>
      <div
        className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/25"
        onClick={() => input.current?.focus()}
      >
        {value.map((tag, index) => (
          <span
            key={tag.id ?? tag.name}
            className="tag-color inline-flex max-w-full items-center gap-0.5 rounded-full border pl-2 pr-0.5 text-[12px] font-medium"
            style={tagColorStyle(tag.color)}
          >
            <span className="truncate">{tag.name}</span>
            <button
              type="button"
              aria-label={`移除 ${tag.name}`}
              disabled={disabled}
              className="grid size-5 shrink-0 place-items-center rounded-full text-sm hover:bg-current/10 focus-visible:outline-2"
              onClick={() => {
                onChange(value.filter((_, position) => position !== index));
                setActive(-1);
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder={value.length ? undefined : "输入后按 Enter 添加"}
          disabled={disabled}
          value={text}
          className="min-w-28 flex-1 bg-transparent px-1 py-0.5 outline-none placeholder:text-muted-foreground"
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setActive(-1);
          }}
          onChange={(event) => {
            setText(event.target.value);
            setActive(-1);
          }}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; }}
          onKeyDown={handleKey}
        />
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label}建议`}
          className="absolute inset-x-0 z-10 max-h-36 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {matches.map((tag, index) => (
            <li
              key={tag.id}
              id={`${listId}-${index}`}
              ref={index === active ? activeOption : undefined}
              role="option"
              aria-selected={index === active}
              className={cn("cursor-pointer rounded-sm px-2 py-1.5 hover:bg-accent", index === active && "bg-accent")}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(tag)}
            >
              <span className="tag-color inline-block max-w-full truncate rounded-full border px-2 align-middle text-[12px]" style={tagColorStyle(tag.color)}>
                {tag.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
