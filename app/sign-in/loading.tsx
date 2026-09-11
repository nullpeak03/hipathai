export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-[#050A08] px-5 py-10">
      <div className="terminal-card max-w-sm w-full animate-pulse space-y-3 p-5">
        <div className="h-6 w-1/2 rounded bg-[#0A120E]" />
        <div className="h-10 rounded bg-[#0A120E]" />
        <div className="h-10 rounded bg-[#0A120E]" />
        <div className="h-10 rounded bg-[#10B98122]" />
      </div>
    </div>
  );
}
