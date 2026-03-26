import React from 'react';
import { 
  BookOpen, 
  Box, 
  FileCode2, 
  Wand2, 
  RotateCw, 
  Layers, 
  Save, 
  Zap, 
  Wind, 
  CornerUpRight, 
  Download,
  CheckCircle2,
  Info,
  AlertTriangle
} from 'lucide-react';

export default function GuideTab() {
  return (
    <div className="max-w-4xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero Section */}
      <div className="text-center mb-16 pt-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
          <BookOpen className="w-8 h-8 text-emerald-500" />
        </div>
        <h1 className="text-4xl font-bold text-zinc-100 mb-4 tracking-tight">Vejledning til 3D Print Optimerer</h1>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Lær hvordan du får de stærkeste og mest pålidelige 3D-prints ved at bruge vores optimeringsværktøjer.
        </p>
      </div>

      {/* STL Optimizer Section */}
      <section className="mb-20">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Box className="w-6 h-6 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-100">1. STL Optimerer</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:border-emerald-500/30 transition-colors group">
            <div className="flex items-center gap-3 mb-4">
              <Wand2 className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-zinc-100">Auto-Optimering</h3>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              Vores algoritme analyserer din models dimensioner og finder den fladeste orientering. Dette maksimerer kontaktfladen med printpladen og sikrer, at lagene lægges optimalt for styrke.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-500/70 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              Bedre vedhæftning & Stærkere dele
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:border-emerald-500/30 transition-colors group">
            <div className="flex items-center gap-3 mb-4">
              <Layers className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-zinc-100">Væg-antal (Wall Count)</h3>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              Væggene bærer den største belastning i et FDM-print. Ved at øge fra 2 til 4 vægge kan du ofte fordoble delens styrke uden at bruge væsentligt mere filament end ved høj infill.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-500/70 font-medium">
              <Info className="w-3 h-3" />
              Anbefales til mekaniske dele
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:border-emerald-500/30 transition-colors group">
            <div className="flex items- Manuel Rotation gap-3 mb-4">
              <RotateCw className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-zinc-100">Manuel Rotation</h3>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              Brug rotationsknapperne til at finjustere orienteringen. Husk reglen: Belastningen bør aldrig ligge vinkelret på lagene, da printet er svagest her.
            </p>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:border-emerald-500/30 transition-colors group">
            <div className="flex items-center gap-3 mb-4">
              <Save className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-zinc-100">Eksport</h3>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              Når du er tilfreds, kan du gemme den optimerede model som en ny STL-fil, klar til din slicer. Filnavnet vil automatisk indikere dine valg.
            </p>
          </div>
        </div>
      </section>

      {/* GCode Analyzer Section */}
      <section className="mb-20">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <FileCode2 className="w-6 h-6 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-100">2. GCODE Analysator</h2>
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <h3 className="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              Forstå Advarslerne
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-500 font-medium">
                  <Wind className="w-4 h-4" />
                  <span>Køle-advarsel</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Udløses hvis et lag printes for hurtigt uden nok køling. Dette kan føre til "sagging" eller dårlig overfladekvalitet. Systemet foreslår automatisk højere blæserhastighed her.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-500 font-medium">
                  <CornerUpRight className="w-4 h-4" />
                  <span>Hurtige Hjørner</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Markeret når printeren tager skarpe sving ved for høj hastighed. Dette kan give "ghosting" eller vibrationer i printet. Optimeringen vil sænke farten i disse lag.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-500 font-medium">
                  <Zap className="w-4 h-4" />
                  <span>Flow-problemer</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Hvis flowet (mm³/s) overstiger 15, risikerer du under-ekstrudering. Hold øje med flow-grafen for at sikre, at din hotend kan følge med.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-emerald-400" />
              Optimér & Gem GCODE
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-6">
              Når du klikker på "Optimér & Gem GCODE", gennemgår systemet din fil og indsætter specielle kommandoer (M106 for køling og M220 for hastighed) direkte i koden for at løse de fundne problemer.
            </p>
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-500/80 leading-relaxed">
                <strong>Bemærk:</strong> Optimeringen bruger standard G-code kommandoer (M106 til køling, M220 til hastighed) og fungerer på stort set alle moderne FDM-printere (BambuLab, Prusa, Creality, Anycubic m.fl.).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer / Call to action */}
      <div className="text-center border-t border-zinc-800 pt-12">
        <p className="text-zinc-500 text-sm">
          Har du spørgsmål eller forslag til forbedringer?
        </p>
      </div>
    </div>
  );
}
