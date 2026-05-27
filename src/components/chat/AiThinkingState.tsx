/** Small inline loading bubble shown while the LLM is generating a response. */
export default function AiThinkingState({ label = "מנתח/ת..." }: { label?: string }) {
  return (
    <div className="flex justify-start">
      <div className="bg-white border border-slate-200 rounded-2xl rounded-br-md px-4 py-3 shadow-sm flex items-center gap-2">
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:120ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:240ms]" />
        </span>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
    </div>
  );
}
