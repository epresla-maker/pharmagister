"use client";

import { useEffect, useRef } from "react";
import { Loader2, Send } from "lucide-react";
import useKeyboardInset from "./useKeyboardInset";

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
  const keyboardInset = useKeyboardInset();
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
      className={`fixed left-0 right-0 z-50 border-t backdrop-blur-xl shadow-[0_-16px_40px_rgba(15,23,42,0.12)] ${
        darkMode ? "bg-gray-900/95 border-gray-700" : "bg-white/95 border-gray-200"
      }`}
      style={{
        bottom: keyboardInset,
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="max-w-4xl mx-auto px-4 pt-3">
        {replyTo ? (
          <div className={`mb-3 rounded-2xl border px-3 py-2 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${darkMode ? "text-cyan-300" : "text-cyan-700"}`}>
                  {market === "de" ? "Antwort an" : "Válasz erre"}: {replyTo.senderName}
                </p>
                <p className={`mt-1 text-sm line-clamp-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  {replyTo.text}
                </p>
              </div>
              {onClearReply ? (
                <button
                  type="button"
                  onClick={onClearReply}
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${darkMode ? "bg-gray-700 text-gray-200" : "bg-gray-200 text-gray-700"}`}
                >
                  {market === "de" ? "Entfernen" : "Mégse"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex items-end gap-3">
          <textarea
            ref={resolvedInputRef}
            rows={1}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={onFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={sending || disabled}
            enterKeyHint="send"
            autoComplete="off"
            autoCapitalize="sentences"
            spellCheck
            className={`flex-1 resize-none rounded-[1.5rem] border px-4 py-3.5 text-[15px] leading-6 outline-none transition focus:ring-2 focus:ring-cyan-400/30 disabled:opacity-60 ${
              darkMode
                ? "bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
                : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-500"
            }`}
            style={{
              minHeight: 52,
              maxHeight: 144,
            }}
          />

          <button
            type="button"
            onClick={submitMessage}
            disabled={sending || disabled || !value.trim()}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg transition hover:from-blue-600 hover:to-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}