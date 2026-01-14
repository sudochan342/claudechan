import DebateChamber from '@/components/DebateChamber';

export default function Home() {
  return (
    <div className="relative min-h-screen bg-gray-950 overflow-hidden">
      {/* Mystical Background */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Gradient orbs in background */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl" />

        {/* Starfield effect */}
        <div className="absolute inset-0 opacity-30">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Main Content */}
      <main className="relative z-10">
        <DebateChamber />
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 text-center py-2 text-xs text-gray-600 z-20">
        <p>The Duality Oracle — Where light and shadow seek truth together</p>
      </footer>
    </div>
  );
}
