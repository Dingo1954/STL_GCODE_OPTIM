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
  AlertTriangle,
  Eye,
  Settings2,
  BarChart2
} from 'lucide-react';

export default function GuideTab() {
  return (
    <div className="max-w-4xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero Section */}
      <div className="text-center mb-16 pt-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-6">
          <BookOpen className="w-8 h-8 text-blue-500" />
        </div>
        <h1 className="text-4xl font-bold text-slate-100 mb-4 tracking-tight">Vejledning til 3D Print Analyse og Optimering</h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Lær hvordan du får de stærkeste og mest pålidelige 3D-prints ved at bruge vores optimeringsværktøjer.
        </p>
      </div>

      {/* STL Optimizer Section */}
      <section className="mb-20">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <Box className="w-6 h-6 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100">1. STL Optimerer</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-blue-500/30 transition-colors group">
            <div className="flex items-center gap-3 mb-4">
              <Wand2 className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-slate-100">Auto-Optimering</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Vores algoritme analyserer din models dimensioner og finder den fladeste orientering. Dette maksimerer kontaktfladen med printpladen og sikrer, at lagene lægges optimalt for styrke.
            </p>
            <div className="flex items-center gap-2 text-xs text-blue-500/70 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              Bedre vedhæftning & Stærkere dele
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-blue-500/30 transition-colors group">
            <div className="flex items-center gap-3 mb-4">
              <Layers className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-slate-100">Væg-antal (Wall Count)</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Væggene bærer den største belastning i et FDM-print. Ved at øge fra 2 til 4 vægge kan du ofte fordoble delens styrke uden at bruge væsentligt mere filament end ved høj infill.
            </p>
            <div className="flex items-center gap-2 text-xs text-blue-500/70 font-medium">
              <Info className="w-3 h-3" />
              Anbefales til mekaniske dele
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-blue-500/30 transition-colors group">
            <div className="flex items-center gap-3 mb-4">
              <RotateCw className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-slate-100">Manuel Rotation</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Brug rotationsknapperne til at finjustere orienteringen. Husk reglen: Belastningen bør aldrig ligge vinkelret på lagene, da printet er svagest her.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-blue-500/30 transition-colors group">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-slate-100">GCODE Overlay</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Upload din slicede GCODE-fil for at se den direkte ovenpå din STL-model. Dette gør det nemt at verificere, at modellen printes præcis som forventet, og at orienteringen matcher.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-blue-500/30 transition-colors group">
            <div className="flex items-center gap-3 mb-4">
              <Save className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-slate-100">Eksport</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Når du er tilfreds, kan du gemme den optimerede model som en ny STL-fil, klar til din slicer. Filnavnet vil automatisk indikere dine valg.
            </p>
          </div>
        </div>
      </section>

      {/* GCode Analyzer Section */}
      <section className="mb-20">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <FileCode2 className="w-6 h-6 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100">2. GCODE Analysator</h2>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8">
            <h3 className="text-lg font-semibold text-slate-100 mb-6 flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-400" />
              Forstå Advarslerne
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-500 font-medium">
                  <Wind className="w-4 h-4" />
                  <span>Køle-advarsel</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Udløses hvis et lag printes for hurtigt uden nok køling. Dette kan føre til "sagging" eller dårlig overfladekvalitet. Systemet foreslår automatisk højere blæserhastighed her.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-500 font-medium">
                  <CornerUpRight className="w-4 h-4" />
                  <span>Hurtige Hjørner</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Markeret når printeren tager skarpe sving ved for høj hastighed. Dette kan give "ghosting" eller vibrationer i printet. Optimeringen vil sænke farten i disse lag.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-500 font-medium">
                  <Zap className="w-4 h-4" />
                  <span>Flow-problemer</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Hvis flowet (mm³/s) overstiger 15, risikerer du under-ekstrudering. Hold øje med flow-grafen for at sikre, at din hotend kan følge med.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8">
            <h3 className="text-lg font-semibold text-slate-100 mb-6 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-blue-400" />
              Avancerede Funktioner
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-400 font-medium">
                  <Box className="w-4 h-4" />
                  <span>3D Lag Preview</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Klik på et specifikt lag i tabellen for at se det visualiseret i 3D. Printstierne er farvekodede efter hastighed (blå er langsom, rød er hurtig). Hvis der er advarsler om "Hurtige hjørner", markeres de problematiske punkter med røde prikker i 3D-visningen.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-purple-400 font-medium">
                  <Settings2 className="w-4 h-4" />
                  <span>Global Flow Justering</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Brug flow-slideren til at justere det overordnede flow for hele printet. Dette er nyttigt, hvis du ved, at dit filament generelt over- eller under-ekstruderer.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-400 font-medium">
                  <BarChart2 className="w-4 h-4" />
                  <span>Sammenlign Filer</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Upload en anden GCODE-fil for at sammenligne statistikker og grafer direkte. Perfekt til at se forskellen mellem to forskellige slicer-profiler.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8">
            <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-400" />
              Optimér & Gem GCODE
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Når du klikker på "Optimér & Gem GCODE", gennemgår systemet din fil og indsætter specielle kommandoer direkte i koden for at løse de fundne problemer. Her er de kommandoer, der kan blive indsat:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-blue-400 font-semibold bg-slate-800 px-2 py-1 rounded text-xs border border-slate-700">M106 S[0-255]</span>
                  <span className="text-sm font-medium text-slate-200">Printkøler</span>
                </div>
                <p className="text-xs text-slate-400">Styrer blæseren. S255 er 100% (maksimal køling). Indsættes ved små lag for at forhindre overophedning af plastikken.</p>
              </div>
              
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-blue-400 font-semibold bg-slate-800 px-2 py-1 rounded text-xs border border-slate-700">M220 S[procent]</span>
                  <span className="text-sm font-medium text-slate-200">Printhastighed</span>
                </div>
                <p className="text-xs text-slate-400">Justerer hastigheden globalt. Indsættes for at sænke farten ved skarpe hjørner eller lag med meget kort printtid.</p>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-blue-400 font-semibold bg-slate-800 px-2 py-1 rounded text-xs border border-slate-700">M221 S[procent]</span>
                  <span className="text-sm font-medium text-slate-200">Flow Rate</span>
                </div>
                <p className="text-xs text-slate-400">Justerer ekstruderingen globalt. Indsættes hvis du har valgt at ændre den overordnede flow multiplier.</p>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-blue-400 font-semibold bg-slate-800 px-2 py-1 rounded text-xs border border-slate-700">M204 P[værdi]</span>
                  <span className="text-sm font-medium text-slate-200">Acceleration</span>
                </div>
                <p className="text-xs text-slate-400">Justerer accelerationen for printbevægelser. Indsættes for at reducere "ghosting" og vibrationer ved skarpe hjørner.</p>
              </div>
            </div>

            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-500/80 leading-relaxed">
                <strong>Bemærk:</strong> Optimeringen bruger standard G-code kommandoer og fungerer på stort set alle moderne FDM-printere (BambuLab, Prusa, Creality, Anycubic m.fl.). Du kan altid se præcis hvilke kommandoer der er indsat i loggen efter optimering.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer / Call to action */}
      <div className="text-center border-t border-slate-700 pt-12">
        <p className="text-slate-500 text-sm">
          Har du spørgsmål eller forslag til forbedringer?
        </p>
      </div>
    </div>
  );
}
