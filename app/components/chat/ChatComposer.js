"use client";

import { useEffect, useRef } from "react";
import { Loader2, Send } from "lucide-react";

export default function ChatComposer({
  inputRef,
  value,
  onChange,
  onSubmit,
  onFocus,
  onHeightChange,
  replyTo = null,
  onClearReply,
  darkMode = false,
  market = "hu",
  placeholder,
  sending = false,
  disabled = false,
}) {
  const rootRef = useRef(null);
  const localInputRef = useRef(null);
  const resolvedInputRef = inputRef || localInputRef;

  useEffect(() => {
    const textarea = resolvedInputRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, 144);
    textarea.style.height = `${Math.max(52, nextHeight)}px`;
  }, [value, resolvedInputRef]);

  useEffect(() => {
    if (!onHeightChange || !rootRef.current) return;

    const updateHeight = () => {
      if (rootRef.current) {
        onHeightChange(rootRef.current.getBoundingClientRect().height || 0);
      }
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(rootRef.current);

    window.addEventListener("resize", updateHeight);
    window.addEventListener("orientationchange", updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
      window.removeEventListener("orientationchange", updateHeight);
    };
  }, [onHeightChange, replyTo, darkMode, sending, value]);

  const submitMessage = () => {
    if (sending || disabled) return;
    if (!value.trim()) return;

    onSubmit?.();
    setTimeout(() => {
      resolvedInputRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  };

  return (
    <div
      ref={rootRef}
      className={`w-full flex-shrink-0 ${
        darkMode ? "bg-[#1c1c1e] border-[#2c2c2e]" : "bg-white border-gray-200"
      } border-t`}
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
        paddingTop: "0.5rem",
      }}
    >
      {replyTo ? (
        <div className={`mx-3 mb-2 rounded-xl border-l-4 px-3 py-2 ${darkMode ? "bg-[#2c2c2e] border-blue-500" : "bg-gray-100 border-blue-500"}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-blue-500">{replyTo.senderName}</p>
              <p className={`text-xs truncate ${darkMode ? "text-gray-400" : "text-gray-600"}`}>{replyTo.text}</p>
            </div>
            {onClearReply && (
              <button type="button" onClick={onClearReply} className={`text-lg leading-none ${darkMode ? "text-gray-400" : "text-gray-500"}`}>×</button>
            )}
          </div>
        </div>
      ) : null}

      <div className="flex items-end gap-2 px-3">
        <div className={`flex-1 flex items-end rounded-[22px] border px-4 py-2 ${
          darkMode
            ? "bg-[#2c2c2e] border-[#3a3a3c]"
            : "bg-[#f0f2f5] border-transparent"
        }`}>
          <textarea
            ref={resolvedInputRef}
            rows={1}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={onFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || (market === "de" ? "Aa" : "Aa")}
            disabled={sending || disabled}
            enterKeyHint="send"
            autoComplete="off"
            autoCapitalize="sentences"
            spellCheck
            className={`w-full resize-none bg-transparent outline-none text-[16px] leading-6 disabled:opacity-60 ${
              darkMode ? "text-white placeholder:text-gray-500" : "text-gray-900 placeholder:text-gray-500"
            }`}
            style={{
              minHeight: 24,
              maxHeight: 120,
            }}
          />
        </div>

        <button
          type="button"
          onClick={submitMessage}
          disabled={sending || disabled || !value.trim()}
          className="flex-shrink-0 inline-flex h-[44px] w-[44px] items-center justify-center rounded-full bg-blue-500 text-white shadow transition active:scale-95 disabled:opacity-40"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </div>
  );
}