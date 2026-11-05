import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { 
  Milk, 
  ScanSearch, 
  HeartPulse, 
  BarChart3, 
  ArrowRight, 
  ChevronUp, 
  Sliders,
  Sun,
  Moon
} from "lucide-react";

const features = [
  { icon: Milk, title: "Milk Tracking", desc: "Monitor daily production with real-time analytics" },
  { icon: ScanSearch, title: "AI Breed Recognition", desc: "Identify cattle breeds instantly with image AI" },
  { icon: HeartPulse, title: "Health Monitoring", desc: "Track vaccinations, treatments, and health alerts" },
  { icon: BarChart3, title: "Smart Reports", desc: "Generate insights and analytics for your farm" },
];

const stats = [
  { value: "500+", label: "Farms Managed" },
  { value: "60 %", label: "AI Accuracy" },
  { value: "10K+", label: "Cattle Tracked" },
  { value: "24/7", label: "Cloud Availability" },
];

const steps = [
  { 
    step: "1", 
    title: "Register Your Farm", 
    desc: "Create an account and set up your farm profile",
    detail: "Sign up in seconds with email or 1-click Google sign-in to initialize your farm workspace."
  },
  { 
    step: "2", 
    title: "Add Your Cattle", 
    desc: "Input cattle data or use AI to identify breeds",
    detail: "Snap cattle photos to instantly auto-detect breeds using Gemini vision AI, or log tag numbers manually."
  },
  { 
    step: "3", 
    title: "Track & Optimize", 
    desc: "Monitor health, milk production, and get insights",
    detail: "Log morning/evening milk yields and receive automated health alerts to maximize productivity."
  },
];

const Landing = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [herdSize, setHerdSize] = useState(25);

  const estimatedMonthlyYield = (herdSize * 14.5 * 30).toLocaleString();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Subtle cursor-follow tilt effect for interactive cards
  const handleCardMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only apply tilt on desktop hover-supported devices
    if (window.matchMedia("(hover: hover)").matches) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      e.currentTarget.style.transform = `perspective(1000px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-4px) scale(1.015)`;
    }
  }, []);

  const handleCardMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = `perspective(1000px) rotateY(0deg) rotateX(0deg) translateY(0px) scale(1)`;
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary transition-colors duration-300">
      
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/50 transition-colors duration-300">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Logo with micro-interaction */}
          <div 
            onClick={() => navigate("/")} 
            className="flex items-center gap-2.5 cursor-pointer group py-1"
          >
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center transition-all duration-300 ease-out group-hover:scale-110 group-hover:rotate-3 shadow-sm group-hover:shadow-primary/30">
              <Milk className="w-4 h-4 text-primary-foreground transition-transform duration-300 group-hover:scale-110" />
            </div>
            <span className="font-bold text-lg tracking-tight text-foreground transition-colors duration-300 group-hover:text-primary">
              SmartDairy <span className="text-primary font-extrabold">AI</span>
            </span>
          </div>

          {/* Nav Links with Underline Animations */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#features" className="relative group text-muted-foreground hover:text-primary transition-colors duration-200 py-1">
              Features
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-300 ease-out group-hover:w-full rounded-full" />
            </a>
            <a href="#calculator" className="relative group text-muted-foreground hover:text-primary transition-colors duration-200 py-1">
              Yield Estimator
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-300 ease-out group-hover:w-full rounded-full" />
            </a>
            <a href="#how-it-works" className="relative group text-muted-foreground hover:text-primary transition-colors duration-200 py-1">
              How It Works
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-300 ease-out group-hover:w-full rounded-full" />
            </a>
          </div>

          {/* Theme Toggle & Auth Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle Light / Dark Theme"
              className="w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200 ease-out hover:scale-110 active:scale-95 cursor-pointer shadow-xs"
            >
              {theme === "dark" ? (
                <Sun className="w-4.5 h-4.5 text-amber-400 transition-transform duration-300 hover:rotate-45" />
              ) : (
                <Moon className="w-4.5 h-4.5 text-slate-700 dark:text-slate-200 transition-transform duration-300 hover:-rotate-12" />
              )}
            </Button>

            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/login")}
              className="transition-all duration-200 ease-out hover:scale-105 active:scale-95 hover:bg-primary/10 hover:text-primary cursor-pointer"
            >
              Sign In
            </Button>
            <Button 
              size="sm" 
              onClick={() => navigate("/login")} 
              className="shadow-sm transition-all duration-200 ease-out hover:scale-105 active:scale-95 hover:shadow-md hover:shadow-primary/25 cursor-pointer"
            >
              Sign Up
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10 pointer-events-none" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            
            {/* Hero Pill Badge */}
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium border border-primary/20 transition-all duration-300 hover:scale-105 hover:bg-primary/15 cursor-default shadow-xs">
              <Milk className="h-4 w-4 animate-pulse" /> AI-Powered Dairy Management
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-tight">
              SmartDairy <span className="text-primary">AI</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              AI-powered cattle management for modern dairy farms. Track milk production, monitor health, and recognize breeds with cutting-edge technology.
            </p>

            {/* CTAs with Micro-Interactions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <Button 
                size="lg" 
                onClick={() => navigate("/login")} 
                className="group relative overflow-hidden transition-all duration-300 ease-out hover:scale-105 active:scale-95 shadow-md hover:shadow-lg hover:shadow-primary/25 cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1.5" />
              </Button>
              
              <Button 
                size="lg" 
                variant="outline" 
                onClick={() => navigate("/dashboard")} 
                className="transition-all duration-300 ease-out hover:scale-105 active:scale-95 hover:bg-primary/5 hover:border-primary/50 hover:shadow-md cursor-pointer"
              >
                View Dashboard
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section with Mouse Tilt Cards */}
      <section id="features" className="container mx-auto px-4 py-16 md:py-24">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-foreground">Why Choose SmartDairy AI?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
              className="will-change-transform transition-all duration-300 ease-out"
            >
              <Card className="h-full border border-border/70 hover:border-primary/50 shadow-xs hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 ease-out cursor-pointer group active:scale-[0.98]">
                <CardContent className="p-6 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary transition-all duration-300 ease-out group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-md">
                    <f.icon className="h-6 w-6 transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="font-semibold text-foreground transition-colors duration-200 group-hover:text-primary">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Section with Interactive Response */}
      <section className="bg-primary/5 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <div 
                key={i} 
                onMouseMove={handleCardMouseMove}
                onMouseLeave={handleCardMouseLeave}
                className="text-center p-6 rounded-2xl bg-card/60 backdrop-blur border border-border/40 space-y-1 transition-all duration-300 ease-out hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 cursor-pointer active:scale-95 group"
              >
                <p className="text-3xl md:text-4xl font-extrabold text-primary transition-transform duration-300 ease-out group-hover:scale-110">{s.value}</p>
                <p className="text-sm text-muted-foreground font-semibold group-hover:text-foreground transition-colors">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Farm Yield Estimator with Responsive Micro-Feedback */}
      <section id="calculator" className="container mx-auto px-4 py-16 md:py-24">
        <div 
          onMouseMove={handleCardMouseMove}
          onMouseLeave={handleCardMouseLeave}
          className="max-w-4xl mx-auto rounded-3xl bg-card border border-border p-6 md:p-10 shadow-xl transition-all duration-300 ease-out hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10 space-y-8"
        >
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full mb-2">
              <Sliders className="w-3.5 h-3.5 animate-pulse" /> Interactive Tool
            </div>
            <h2 className="text-2xl font-bold text-foreground">Interactive Farm Yield Estimator</h2>
            <p className="text-sm text-muted-foreground">Adjust your herd size to estimate monthly milk production with SmartDairy AI tracking</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-medium">
                <span>Number of Cattle in Farm:</span>
                <span className="text-lg font-bold text-primary px-3 py-1 bg-primary/10 rounded-lg shadow-xs transition-transform duration-200 hover:scale-105 cursor-default">{herdSize} Cows</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="200" 
                step="5" 
                value={herdSize} 
                onChange={(e) => setHerdSize(Number(e.target.value))}
                className="w-full h-2.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-all duration-200 active:scale-[0.99]"
              />
              <div className="flex justify-between text-xs text-muted-foreground font-medium">
                <span>5 Cows</span>
                <span>100 Cows</span>
                <span>200 Cows</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border">
              <div className="p-4 rounded-xl bg-background border border-border/60 text-center transition-all duration-300 ease-out hover:border-primary/40 hover:-translate-y-1 hover:shadow-md active:scale-98">
                <p className="text-xs text-muted-foreground font-medium">Est. Daily Output</p>
                <p className="text-xl font-bold text-foreground">{(herdSize * 14.5).toFixed(0)} L / day</p>
              </div>
              <div className="p-4 rounded-xl bg-background border border-border/60 text-center transition-all duration-300 ease-out hover:border-primary/40 hover:-translate-y-1 hover:shadow-md active:scale-98">
                <p className="text-xs text-muted-foreground font-medium">Est. Monthly Output</p>
                <p className="text-xl font-bold text-primary">{estimatedMonthlyYield} Liters</p>
              </div>
              <div className="p-4 rounded-xl bg-background border border-border/60 text-center transition-all duration-300 ease-out hover:border-primary/40 hover:-translate-y-1 hover:shadow-md active:scale-98">
                <p className="text-xs text-muted-foreground font-medium">Efficiency Boost</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">+12.5% AI Gain</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="container mx-auto px-4 py-16 md:py-24">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-foreground">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((s, i) => {
            const isSelected = activeStepIndex === i;
            return (
              <div 
                key={i} 
                onClick={() => setActiveStepIndex(i)}
                onMouseMove={handleCardMouseMove}
                onMouseLeave={handleCardMouseLeave}
                className={`p-6 rounded-2xl border text-center space-y-3 cursor-pointer transition-all duration-300 ease-out active:scale-95 ${
                  isSelected 
                    ? "border-primary bg-primary/5 shadow-lg scale-105" 
                    : "border-border/60 hover:border-primary/40 hover:bg-muted/20 hover:shadow-md"
                }`}
              >
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-300 ease-out ${
                  isSelected ? "bg-primary text-primary-foreground scale-110 shadow-md" : "bg-primary/20 text-primary"
                }`}>
                  {s.step}
                </div>
                <h3 className="font-semibold text-foreground">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                {isSelected && (
                  <p className="text-xs text-primary pt-2 border-t border-primary/20 font-medium animate-fadeIn">
                    {s.detail}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card mt-auto transition-colors duration-300">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={scrollToTop}>
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <Milk className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground group-hover:text-primary transition-colors">SmartDairy AI</span>
            </div>
            
            <div className="flex gap-6 text-sm text-muted-foreground">
              <button onClick={() => navigate("/dashboard")} className="relative group hover:text-foreground transition-colors py-0.5">
                Dashboard
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-full" />
              </button>
              <button onClick={() => navigate("/cattle")} className="relative group hover:text-foreground transition-colors py-0.5">
                Cattle
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-full" />
              </button>
              <button onClick={() => navigate("/reports")} className="hover:text-foreground transition-colors relative group py-0.5">
                Reports
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-full" />
              </button>
              <button onClick={() => navigate("/settings")} className="hover:text-foreground transition-colors relative group py-0.5">
                Settings
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-full" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <p className="text-sm text-muted-foreground">© 2026 SmartDairy AI. All rights reserved.</p>
              <button 
                onClick={scrollToTop}
                className="p-2 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary transition-all duration-200 hover:scale-105 active:scale-95 text-xs flex items-center gap-1 cursor-pointer font-medium"
                title="Back to Top"
              >
                <ChevronUp className="w-4 h-4" /> Top
              </button>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default Landing;
